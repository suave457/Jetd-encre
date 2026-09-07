import * as oidc from "openid-client";
import { fail, first, hash, issueSession, now, randomToken, readCookie, run, TOKEN } from "./session.js";
import { effectiveRole, requestedProfile, signInReturn } from './access-role.js';

const configurations = new Map();
function publicHttps(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || !url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.startsWith("[") || url.hostname.endsWith(".local")) throw new Error("invalid_oidc_url");
  return url;
}
export function authSettings(env) {
  if (env.PILOT_ENABLED !== "true" || !env.PILOT_ORIGIN || !env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET) return null;
  try {
    const origin = publicHttps(env.PILOT_ORIGIN);
    if (origin.pathname !== "/") return null;
    const issuer = publicHttps(env.OIDC_ISSUER);
    if (issuer.pathname.includes("/.well-known/")) return null;
    const allowedOrigins = new Set([issuer.origin]);
    for (const extra of (env.OIDC_ALLOWED_ORIGINS || "").split(",").filter(Boolean)) {
      const allowed = publicHttps(extra.trim()); if (allowed.pathname !== "/") return null; allowedOrigins.add(allowed.origin);
    }
    return { issuer, origin: origin.origin, redirectUri: origin.origin + "/api/pilot/auth/callback", allowedOrigins };
  } catch { return null; }
}
export async function limitAuthStarts(db,request,env) {
  const window=Math.floor(now()/60);
  // Short-lived pseudonymous buckets; no raw IP is stored. The global cap also applies when no edge IP is available.
  const peer=request.headers.get("CF-Connecting-IP")||"unknown";
  const key=await hash(env.OIDC_CLIENT_SECRET+":"+peer);
  await run(db,"DELETE FROM pilot_auth_limits WHERE bucket IN (SELECT bucket FROM pilot_auth_limits WHERE window < ? LIMIT 100)",window-2);
  // One transaction: a refused peer spends no global quota, and an exhausted
  // global quota allocates no peer row. changes() refers to the preceding insert.
  const results=await db.batch([
    db.prepare(`INSERT INTO pilot_auth_limits(bucket,window,attempts)
      SELECT ?,?,1 WHERE NOT EXISTS (SELECT 1 FROM pilot_auth_limits WHERE bucket='global' AND (window>? OR (window=? AND attempts>=300)))
      ON CONFLICT(bucket) DO UPDATE SET window=excluded.window,attempts=CASE WHEN pilot_auth_limits.window=excluded.window THEN pilot_auth_limits.attempts+1 ELSE 1 END
      WHERE pilot_auth_limits.window<excluded.window OR (pilot_auth_limits.window=excluded.window AND pilot_auth_limits.attempts<12)`)
      .bind(key,window,window,window),
    db.prepare(`INSERT INTO pilot_auth_limits(bucket,window,attempts)
      SELECT 'global',?,1 WHERE changes()=1
      ON CONFLICT(bucket) DO UPDATE SET window=excluded.window,attempts=CASE WHEN pilot_auth_limits.window=excluded.window THEN pilot_auth_limits.attempts+1 ELSE 1 END
      WHERE pilot_auth_limits.window<excluded.window OR (pilot_auth_limits.window=excluded.window AND pilot_auth_limits.attempts<300)`)
      .bind(window),
  ]);
  if(results.some((result)=>!result.meta?.changes))fail(429,"auth_rate_limited","Trop de tentatives de connexion. Réessayez dans une minute.");
}
async function configuration(env, settings) {
  const cacheKey = JSON.stringify([env.OIDC_ISSUER,env.OIDC_CLIENT_ID,env.OIDC_CLIENT_SECRET,env.OIDC_ALLOWED_ORIGINS]);
  const saved = configurations.get(cacheKey);
  if (saved && saved.expiresAt > Date.now()) return saved.config;
  const guardedFetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.protocol !== "https:" || url.username || url.password || !settings.allowedOrigins.has(url.origin)) throw new Error("oidc_destination_rejected");
    // Cloudflare Workers only accepts "follow" or "manual". Keep redirects
    // blocked explicitly so a provider cannot move an OIDC request outside the
    // allowlisted origin.
    const response = await fetch(input, { ...init, redirect: "manual" });
    if (response.redirected || response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      try { await response.body?.cancel(); } catch {}
      throw new Error("oidc_redirect_rejected");
    }
    const reader = response.body?.getReader(); const chunks = []; let size=0;
    if (reader) try {
      while (true) { const {value,done}=await reader.read(); if(done)break; size+=value.length; if(size>512*1024){await reader.cancel();throw new Error("oidc_response_too_large");} chunks.push(value); }
    } finally {reader.releaseLock();}
    const body=new Uint8Array(size); let offset=0; for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
    return new Response(body, {status:response.status,statusText:response.statusText,headers:response.headers});
  };
  const config = await oidc.discovery(settings.issuer, env.OIDC_CLIENT_ID, { id_token_signed_response_alg: "RS256" }, oidc.ClientSecretBasic(env.OIDC_CLIENT_SECRET), {
    timeout:5, [oidc.customFetch]:guardedFetch, execute:[oidc.enableNonRepudiationChecks],
  });
  for(const key of ["authorization_endpoint","token_endpoint","jwks_uri"]){
    const value=config.serverMetadata()[key]; if(!value)throw new Error("oidc_endpoint_missing");
    const url=new URL(value); if(url.protocol!=="https:"||url.username||url.password||!settings.allowedOrigins.has(url.origin))throw new Error("oidc_endpoint_rejected");
  }
  if(configurations.size>=4) configurations.clear();
  configurations.set(cacheKey,{config,expiresAt:Date.now()+15*60_000});
  return config;
}
const flowCookie = (value="", seconds=600) => `__Host-jde_auth=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function redirect(location,cookies=[]) {
  const headers=new Headers({Location:location,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"});
  for(const cookie of cookies)headers.append("Set-Cookie",cookie);
  return new Response(null,{status:303,headers});
}
export async function handleOidc(request,env) {
  const settings=authSettings(env);
  if(!settings)fail(503,"identity_not_configured","La connexion réelle n’est pas encore configurée.");
  const url=new URL(request.url);
  if(url.origin!==settings.origin || request.method!=="GET")fail(403,"auth_request_rejected","Requête de connexion refusée.");
  if(url.pathname==="/api/pilot/auth/start") {
    if(request.headers.get("Sec-Fetch-Site")==="cross-site")fail(403,"origin_rejected","Ouvrez la connexion depuis la plateforme.");
    const profile=requestedProfile(url);
    const returns=url.searchParams.getAll('retour');
    if(returns.length>1||(returns.length===1&&(returns[0]!=='activation'||profile!=='eleve')))fail(400,'invalid_auth_return','Destination de connexion invalide.');
    const returnPath=returns.length?'/activation':null;
    await limitAuthStarts(env.DB,request,env);
    const config=await configuration(env,settings);
    const state=oidc.randomState(),nonce=oidc.randomNonce(),verifier=oidc.randomPKCECodeVerifier(),browser=randomToken();
    await run(env.DB,"DELETE FROM pilot_auth_flows WHERE state_hash IN (SELECT state_hash FROM pilot_auth_flows WHERE expires_at < ? LIMIT 100)",now());
    const admitted=await run(env.DB,"INSERT INTO pilot_auth_flows(state_hash,browser_hash,verifier,nonce,expires_at,requested_role,return_path) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM pilot_auth_flows WHERE expires_at>?)<500",await hash(state),await hash(browser),verifier,nonce,now()+600,profile,returnPath,now());
    if(!admitted.meta?.changes)fail(429,"auth_capacity_reached","Beaucoup de connexions sont en cours. Réessayez dans quelques minutes.");
    // Shared computers must ask the provider to reauthenticate, even when its SSO cookie remains.
    // Never accept a browser-supplied prompt override.
    const target=oidc.buildAuthorizationUrl(config,{response_type:"code",redirect_uri:settings.redirectUri,scope:"openid",prompt:"login",ui_locales:"fr-FR",code_challenge_method:"S256",code_challenge:await oidc.calculatePKCECodeChallenge(verifier),state,nonce});
    return redirect(target.href,[flowCookie(browser)]);
  }
  if(url.pathname!=="/api/pilot/auth/callback")fail(404,"not_found","Page introuvable.");
  let profile=null,returnPath=null;
  const destination=reason=>returnPath==='/activation'&&profile==='eleve'?'/activation'+(reason?'?connexion='+encodeURIComponent(reason):''):signInReturn(profile,reason);
  try {
    for(const key of new Set(url.searchParams.keys()))if(url.searchParams.getAll(key).length!==1)fail(400,"ambiguous_callback","Retour de connexion invalide.");
    const state=url.searchParams.get("state"),browser=readCookie(request,"__Host-jde_auth");
    if(!state||state.length>128||!browser||!TOKEN.test(browser))fail(400,"invalid_auth_flow","La connexion a expiré. Recommencez.");
    const stateHash=await hash(state),browserHash=await hash(browser);
    // DELETE RETURNING atomically consumes the transaction; even concurrent callbacks have one winner.
    const transaction=await first(env.DB,"DELETE FROM pilot_auth_flows WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING verifier,nonce,requested_role,return_path",stateHash,browserHash,now());
    if(!transaction)fail(400,"invalid_auth_flow","La connexion a expiré ou a déjà été utilisée.");
    profile=transaction.requested_role;
    returnPath=transaction.return_path==='/activation'?'/activation':null;
    const config=await configuration(env,settings);
    const tokens=await oidc.authorizationCodeGrant(config,url,{pkceCodeVerifier:transaction.verifier,expectedState:state,expectedNonce:transaction.nonce,idTokenExpected:true});
    const claims=tokens.claims();
    if(!claims||typeof claims.sub!=="string"||claims.iss!==config.serverMetadata().issuer)fail(403,"identity_rejected","Identité refusée.");
    const identity=await first(env.DB,`SELECT i.user_id FROM pilot_identities i JOIN pilot_users u ON u.id=i.user_id WHERE i.issuer=? AND i.subject=? AND u.active=1`,claims.iss,claims.sub);
    if(!identity) return redirect(destination('non-autorisee'),[flowCookie()]);
    const role=await effectiveRole(env.DB,identity.user_id);
    if(profile&&role!==profile)return redirect(destination('profil-incompatible'),[flowCookie()]);
    if(!role)return redirect(destination('non-autorisee'),[flowCookie()]);
    // No email-based account linking, implicit enrolment or browser-supplied role.
    const session=await issueSession(env.DB,identity.user_id,"oidc",false,profile);
    const previous=readCookie(request,"__Host-jde_pilot");
    if(previous&&TOKEN.test(previous))await run(env.DB,"UPDATE pilot_sessions SET revoked_at=? WHERE token_hash=?",now(),await hash(previous));
    return redirect(destination(),[flowCookie(),session.cookie]);
  } catch (error) {
    if(error instanceof Response)return redirect(destination('expiree'),[flowCookie()]);
    // Do not log codes, provider payloads, claims, cookies or personal data.
    return redirect(destination('echec'),[flowCookie()]);
  }
}
