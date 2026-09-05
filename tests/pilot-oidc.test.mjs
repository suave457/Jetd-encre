import assert from "node:assert/strict";
import test from "node:test";
import { createHash, KeyObject, sign, webcrypto } from "node:crypto";
import { handleOidc, limitAuthStarts } from "../worker/pilot/oidc.js";
import { issueSession, hash } from "../worker/pilot/session.js";
import { openPilotDatabase, seedLocalPilot } from "../scripts/pilot-local-store.mjs";
const keyOptions = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
const [signingKeys, wrongKeys] = await Promise.all([
  webcrypto.subtle.generateKey(keyOptions, true, ["sign", "verify"]),
  webcrypto.subtle.generateKey(keyOptions, true, ["sign", "verify"]),
]);
const publicJwk = { ...await webcrypto.subtle.exportKey("jwk", signingKeys.publicKey), kid: "research-rsa-key", alg: "RS256", use: "sig" };
const epoch = () => Math.floor(Date.now() / 1000);
const b64 = value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
function jwt(claims, invalidSignature = false) {
  const input = b64({ alg: "RS256", kid: publicJwk.kid, typ: "JWT" }) + "." + b64(claims);
  return input + "." + sign("RSA-SHA256", Buffer.from(input), KeyObject.from(invalidSignature ? wrongKeys.privateKey : signingKeys.privateKey)).toString("base64url");
}
async function invoke(request, env) {
  try { return await handleOidc(request, env); }
  catch (error) { if (error instanceof Response) return error; throw error; }
}
function setup(t) {
  const store = openPilotDatabase();
  seedLocalPilot(store.sqlite);
  const issuer = `https://idp-${crypto.randomUUID()}.research.example`;
  const origin = "https://school.research.example";
  const clientId = "research-client";
  const env = { DB: store.DB, PILOT_ENABLED: "true", PILOT_ORIGIN: origin, OIDC_ISSUER: issuer, OIDC_CLIENT_ID: clientId, OIDC_CLIENT_SECRET: "research-only-not-a-real-secret" };
  store.sqlite.prepare("INSERT INTO pilot_identities(issuer,subject,user_id) VALUES (?,?,?)").run(issuer, "subject-a", "pilot-a-student");
  const state = { mode: "valid", expectedFlow: null, calls: [], tokenCalls: [] };
  const originalFetch = globalThis.fetch;
  // No fallback to the real fetch. Unexpected destinations fail this harness.
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    state.calls.push({ origin: url.origin, path: url.pathname, redirect: init.redirect });
    if (url.origin !== issuer) throw new Error("Unexpected outbound origin in OIDC test");
    if (url.pathname === "/.well-known/openid-configuration") {
      if (state.mode === "discovery-redirect") return new Response(null, { status: 302, headers: { Location: issuer + "/unexpected" } });
      return Response.json({
        issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", jwks_uri: issuer + "/jwks",
        response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_basic"], code_challenge_methods_supported: ["S256"],
      });
    }
    if (url.pathname === "/jwks") return Response.json({ keys: [publicJwk] });
    if (url.pathname !== "/token") throw new Error("Unexpected outbound path in OIDC test");
    if (state.mode === "token-redirect") return new Response(null, { status: 302, headers: { Location: "https://foreign.research.example/token" } });
    const body = new URLSearchParams(init.body);
    const headers = new Headers(init.headers);
    state.tokenCalls.push({ verifier: body.get("code_verifier"), grant: body.get("grant_type"), callback: body.get("redirect_uri"), basic: headers.get("authorization")?.startsWith("Basic ") });
    const claims = { iss: issuer, aud: clientId, sub: "subject-a", nonce: state.expectedFlow?.nonce, iat: epoch(), exp: epoch() + 300 };
    if (state.mode === "bad-nonce") claims.nonce = "incorrect-nonce";
    if (state.mode === "missing-nonce") delete claims.nonce;
    if (state.mode === "bad-issuer") claims.iss = "https://different.research.example";
    if (state.mode === "bad-audience") claims.aud = "another-client";
    if (state.mode === "expired-token") claims.exp = epoch() - 300;
    if (state.mode === "unknown-subject") claims.sub = "subject-not-enrolled";
    const response = { token_type: "Bearer", access_token: "unused-research-access-token" };
    if (state.mode !== "missing-id-token") response.id_token = jwt(claims, state.mode === "bad-signature");
    return Response.json(response);
  };
  t.after(() => { globalThis.fetch = originalFetch; store.close(); });
  const startRequest = (headers = {}) => new Request(origin + "/api/pilot/auth/start", { headers: { "Sec-Fetch-Site": "same-origin", "CF-Connecting-IP": "192.0.2.20", ...headers } });
  const begin = async (headers = {}) => {
    const response = await invoke(startRequest(headers), env);
    if (response.status !== 303) return { response };
    const target = new URL(response.headers.get("location"));
    const flow = {
      response, target, cookie: response.headers.getSetCookie()[0].split(";")[0], state: target.searchParams.get("state"), nonce: target.searchParams.get("nonce"),
    };
    const row = store.sqlite.prepare("SELECT verifier FROM pilot_auth_flows WHERE state_hash=?").get(createHash("sha256").update(flow.state).digest("hex"));
    flow.verifier = row.verifier;
    flow.callback = origin + "/api/pilot/auth/callback?code=research-code&state=" + encodeURIComponent(flow.state);
    state.expectedFlow = flow;
    return flow;
  };
  const complete = (flow, { callback = flow.callback, cookie = flow.cookie } = {}) => invoke(new Request(callback, { headers: cookie ? { cookie } : {} }), env);
  const countSessions = () => store.sqlite.prepare("SELECT count(*) n FROM pilot_sessions").get().n;
  const countFlows = () => store.sqlite.prepare("SELECT count(*) n FROM pilot_auth_flows").get().n;
  return { ...store, issuer, origin, env, state, begin, complete, startRequest, countSessions, countFlows };
}
function assertExchange(h, flow) {
  assert.equal(h.state.tokenCalls.length, 1);
  assert.deepEqual(h.state.tokenCalls[0], { verifier: flow.verifier, grant: "authorization_code", callback: h.origin + "/api/pilot/auth/callback", basic: true });
  assert.ok(h.state.calls.every(call => call.redirect === "manual"));
}

// One parent test deliberately serializes all subtests: they replace global fetch.
test("OIDC réel : signatures, transactions, cookies, rejouement et limites", { concurrency: false }, async t => {
  await t.test("le parcours valide utilise PKCE S256, state et nonce puis une session opaque", async t => {
    const h = setup(t), flow = await h.begin();
    assert.equal(flow.target.searchParams.get("response_type"), "code");
    assert.equal(flow.target.searchParams.get("scope"), "openid");
    assert.equal(flow.target.searchParams.get("prompt"), "login");
    assert.equal(flow.target.searchParams.get("ui_locales"), "fr-FR");
    assert.equal(flow.target.searchParams.get("code_challenge_method"), "S256");
    assert.equal(flow.target.searchParams.get("code_challenge"), createHash("sha256").update(flow.verifier).digest("base64url"));
    assert.match(flow.state, /^[\w-]{43}$/); assert.match(flow.nonce, /^[\w-]{43}$/);
    const response = await h.complete(flow);
    assert.equal(response.headers.get("location"), "/pilote");
    assert.equal(h.countSessions(), 1); assert.equal(h.countFlows(), 0);
    const cookie = response.headers.getSetCookie().find(value => value.startsWith("__Host-jde_pilot="));
    assert.match(cookie, /; Secure/); assert.match(cookie, /; HttpOnly/); assert.match(cookie, /; SameSite=Lax/); assert.match(cookie, /; Path=\//); assert.doesNotMatch(cookie, /Domain=/i);
    const token = cookie.split(";")[0].split("=")[1];
    const stored = h.sqlite.prepare("SELECT token_hash,assurance,user_id FROM pilot_sessions").get();
    assert.equal(stored.token_hash, await hash(token)); assert.equal(stored.assurance, "oidc"); assert.equal(stored.user_id, "pilot-a-student");
    assertExchange(h, flow);
  });

  await t.test("un nouveau démarrage impose la réauthentification sans accepter de prompt du navigateur", async t => {
    const h = setup(t), first = await h.begin();
    const response = await invoke(new Request(h.origin + "/api/pilot/auth/start?prompt=none&prompt=select_account", {
      headers: { "Sec-Fetch-Site": "same-origin", "CF-Connecting-IP": "192.0.2.20" },
    }), h.env);
    assert.equal(response.status, 303);
    const target = new URL(response.headers.get("location"));
    assert.deepEqual(target.searchParams.getAll("prompt"), ["login"]);
    for (const key of ["state", "nonce", "code_challenge"]) {
      assert.ok(target.searchParams.get(key));
      assert.notEqual(target.searchParams.get(key), first.target.searchParams.get(key));
    }
    assert.notEqual(response.headers.getSetCookie()[0].split(";")[0], first.cookie);
    assert.equal(h.countSessions(), 0);
    assert.equal(h.state.tokenCalls.length, 0);
  });

  for (const mode of ["bad-signature", "bad-nonce", "missing-nonce", "bad-issuer", "bad-audience", "expired-token", "missing-id-token"]) {
    await t.test(`${mode} : aucune session après échange avec le vrai client OIDC`, async t => {
      const h = setup(t), flow = await h.begin(); h.state.mode = mode;
      const response = await h.complete(flow);
      assert.equal(response.headers.get("location"), "/pilote?connexion=echec");
      assert.equal(h.countSessions(), 0); assert.equal(h.countFlows(), 0);
      assertExchange(h, flow);
      assert.ok(response.headers.getSetCookie().every(value => !value.startsWith("__Host-jde_pilot=")));
    });
  }

  for (const variant of ["bad-state", "missing-state", "duplicate-state", "bad-cookie", "missing-cookie", "duplicate-cookie", "expired-flow"]) {
    await t.test(`${variant} : refus avant tout échange de code`, async t => {
      const h = setup(t), flow = await h.begin(); let callback = flow.callback, cookie = flow.cookie;
      if (variant === "bad-state") { const url = new URL(callback); url.searchParams.set("state", "z".repeat(43)); callback = url.href; }
      if (variant === "missing-state") { const url = new URL(callback); url.searchParams.delete("state"); callback = url.href; }
      if (variant === "duplicate-state") callback += "&state=" + flow.state;
      if (variant === "bad-cookie") cookie = "__Host-jde_auth=" + "z".repeat(43);
      if (variant === "missing-cookie") cookie = "";
      if (variant === "duplicate-cookie") cookie += "; " + cookie;
      if (variant === "expired-flow") h.sqlite.prepare("UPDATE pilot_auth_flows SET expires_at=?").run(epoch() - 1);
      const response = await h.complete(flow, { callback, cookie });
      assert.equal(response.headers.get("location"), "/pilote?connexion=expiree");
      assert.equal(h.countSessions(), 0); assert.equal(h.state.tokenCalls.length, 0);
      if (variant !== "expired-flow") {
        // An unrelated/ambiguous callback must not consume the genuine transaction.
        assert.equal(h.countFlows(), 1);
        assert.equal((await h.complete(flow)).headers.get("location"), "/pilote");
      }
    });
  }

  await t.test("un sujet signé mais non inscrit n’est pas auto-provisionné", async t => {
    const h = setup(t), flow = await h.begin(); h.state.mode = "unknown-subject";
    const users = h.sqlite.prepare("SELECT count(*) n FROM pilot_users").get().n;
    const response = await h.complete(flow);
    assert.equal(response.headers.get("location"), "/pilote?connexion=non-autorisee");
    assert.equal(h.countSessions(), 0); assert.equal(h.sqlite.prepare("SELECT count(*) n FROM pilot_users").get().n, users);
  });

  await t.test("un callback déjà consommé ne rejoue pas l’échange", async t => {
    const h = setup(t), flow = await h.begin();
    assert.equal((await h.complete(flow)).headers.get("location"), "/pilote");
    assert.equal((await h.complete(flow)).headers.get("location"), "/pilote?connexion=expiree");
    assert.equal(h.state.tokenCalls.length, 1); assert.equal(h.countSessions(), 1);
  });

  await t.test("deux callbacks concurrents ne créent qu’une session", async t => {
    const h = setup(t), flow = await h.begin();
    const responses = await Promise.all([h.complete(flow), h.complete(flow)]);
    assert.deepEqual(responses.map(r => r.headers.get("location")).sort(), ["/pilote", "/pilote?connexion=expiree"]);
    assert.equal(h.state.tokenCalls.length, 1); assert.equal(h.countSessions(), 1);
  });

  await t.test("une nouvelle connexion remplace et révoque la session précédente", async t => {
    const h = setup(t), previous = await issueSession(h.DB, "pilot-a-student", "oidc", false), flow = await h.begin();
    const previousCookie = previous.cookie.split(";")[0];
    const response = await h.complete(flow, { cookie: flow.cookie + "; " + previousCookie });
    const newCookie = response.headers.getSetCookie().find(value => value.startsWith("__Host-jde_pilot=")).split(";")[0];
    assert.notEqual(newCookie, previousCookie);
    const oldHash = await hash(previousCookie.split("=")[1]);
    assert.ok(h.sqlite.prepare("SELECT revoked_at FROM pilot_sessions WHERE token_hash=?").get(oldHash).revoked_at);
    assert.equal(h.sqlite.prepare("SELECT count(*) n FROM pilot_sessions WHERE revoked_at IS NULL").get().n, 1);
  });

  await t.test("les clés JWKS sont réutilisées sur deux connexions au même fournisseur", async t => {
    const h = setup(t);
    await h.complete(await h.begin()); await h.complete(await h.begin());
    assert.equal(h.countSessions(), 2);
    assert.equal(h.state.calls.filter(call => call.path === "/jwks").length, 1);
  });

  await t.test("la limite par pair refuse le 13e démarrage sans nouvelle transaction", async t => {
    const h = setup(t); const fixed = Date.now(); t.mock.method(Date, "now", () => fixed);
    for (let i = 0; i < 12; i++) assert.equal((await h.begin()).response.status, 303);
    const limited = (await h.begin()).response;
    assert.equal(limited.status, 429); assert.equal((await limited.json()).error.code, "auth_rate_limited");
    assert.equal(h.countFlows(), 12);
    const buckets = h.sqlite.prepare("SELECT bucket,attempts FROM pilot_auth_limits").all();
    assert.equal(buckets.find(row => row.bucket !== "global").attempts, 12);
    assert.equal(buckets.find(row => row.bucket === "global").attempts, 12);
    assert.ok(buckets.every(row => row.bucket === "global" || /^[a-f0-9]{64}$/.test(row.bucket)));
    for (let i = 13; i < 300; i++) assert.equal((await h.begin()).response.status, 429);
    assert.equal(h.sqlite.prepare("SELECT attempts FROM pilot_auth_limits WHERE bucket='global'").get().attempts, 12);
    assert.equal((await h.begin({"CF-Connecting-IP":"192.0.2.21"})).response.status, 303);
  });

  await t.test("les appels concurrents conservent les plafonds individuel et global", async t => {
    const h=setup(t);t.mock.method(Date,"now",()=>1800000000000);
    const admit=async peer=>{try{await limitAuthStarts(h.env.DB,new Request(h.origin+"/api/pilot/auth/start",{headers:{"CF-Connecting-IP":peer}}),h.env);return 200;}catch(error){if(error instanceof Response)return error.status;throw error;}};
    const same=await Promise.all(Array.from({length:40},()=>admit("192.0.2.30")));
    assert.equal(same.filter(status=>status===200).length,12);
    assert.equal(same.filter(status=>status===429).length,28);
    assert.equal(h.sqlite.prepare("SELECT attempts FROM pilot_auth_limits WHERE bucket='global'").get().attempts,12);
    h.sqlite.prepare("UPDATE pilot_auth_limits SET attempts=299 WHERE bucket='global'").run();
    const distinct=await Promise.all(Array.from({length:8},(_,i)=>admit(`192.0.2.${40+i}`)));
    assert.equal(distinct.filter(status=>status===200).length,1);
    assert.equal(distinct.filter(status=>status===429).length,7);
    assert.equal(h.sqlite.prepare("SELECT attempts FROM pilot_auth_limits WHERE bucket='global'").get().attempts,300);
    assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM pilot_auth_limits WHERE bucket<>'global'").get().n,2);
    await Promise.all(Array.from({length:400},(_,i)=>admit(`2001:db8::${i.toString(16)}`)));
    assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM pilot_auth_limits WHERE bucket<>'global'").get().n,2);
  });

  await t.test("une demande retardée ne remet pas un compteur à une ancienne minute", async t => {
    const h=setup(t);let clock=1800000000000;t.mock.method(Date,"now",()=>clock);
    let release,paused;const pause=new Promise(resolve=>{paused=resolve;});const gate=new Promise(resolve=>{release=resolve;});
    const delayedDb={batch:statements=>h.env.DB.batch(statements),prepare(sql){const statement=h.env.DB.prepare(sql);if(!sql.startsWith("DELETE FROM pilot_auth_limits"))return statement;return {bind(...values){const bound=statement.bind(...values);return {async run(){paused();await gate;return bound.run();}};}};}};
    const request=new Request(h.origin+"/api/pilot/auth/start",{headers:{"CF-Connecting-IP":"192.0.2.50"}});
    const delayed=limitAuthStarts(delayedDb,request,h.env).then(()=>200,error=>{if(error instanceof Response)return error.status;throw error;});
    await pause;clock+=60000;
    await limitAuthStarts(h.env.DB,request,h.env);
    const before=h.sqlite.prepare("SELECT bucket,window,attempts FROM pilot_auth_limits ORDER BY bucket").all();
    release();assert.equal(await delayed,429);
    assert.deepEqual(h.sqlite.prepare("SELECT bucket,window,attempts FROM pilot_auth_limits ORDER BY bucket").all(),before);
  });

  await t.test("le compteur par pair repart dans la fenêtre suivante", async t => {
    const h = setup(t); let clock = Date.now(); t.mock.method(Date, "now", () => clock);
    const peer = createHash("sha256").update(h.env.OIDC_CLIENT_SECRET + ":192.0.2.20").digest("hex");
    h.sqlite.prepare("INSERT INTO pilot_auth_limits(bucket,window,attempts) VALUES (?,?,?)").run(peer, Math.floor(clock / 60000), 12);
    assert.equal((await h.begin()).response.status, 429);
    clock += 60000;
    assert.equal((await h.begin()).response.status, 303);
    assert.equal(h.sqlite.prepare("SELECT attempts FROM pilot_auth_limits WHERE bucket=?").get(peer).attempts, 1);
  });

  await t.test("le plafond global est imposé avant découverte et création de flux", async t => {
    const h = setup(t); const fixed = Date.now(); t.mock.method(Date, "now", () => fixed);
    h.sqlite.prepare("INSERT INTO pilot_auth_limits(bucket,window,attempts) VALUES ('global',?,300)").run(Math.floor(fixed / 60000));
    const limited = (await h.begin({ "CF-Connecting-IP": "192.0.2.99" })).response;
    assert.equal(limited.status, 429); assert.equal(h.countFlows(), 0); assert.equal(h.state.calls.length, 0);
  });

  await t.test("sans adresse fournie par l’edge, le seau unknown reste limité", async t => {
    const h = setup(t); const fixed = Date.now(); t.mock.method(Date, "now", () => fixed);
    const peer = createHash("sha256").update(h.env.OIDC_CLIENT_SECRET + ":unknown").digest("hex");
    h.sqlite.prepare("INSERT INTO pilot_auth_limits(bucket,window,attempts) VALUES (?,?,12)").run(peer, Math.floor(fixed / 60000));
    const response = await invoke(new Request(h.origin + "/api/pilot/auth/start"), h.env);
    assert.equal(response.status, 429); assert.equal(h.countFlows(), 0);
  });

  await t.test("la capacité de 500 transactions actives bloque tout nouveau flux", async t => {
    const h = setup(t);
    const insert = h.sqlite.prepare("INSERT INTO pilot_auth_flows(state_hash,browser_hash,verifier,nonce,expires_at) VALUES (?,?,?,?,?)");
    for (let i = 0; i < 500; i++) insert.run("research-flow-" + i, "research-browser", "research-verifier", "research-nonce", epoch() + 600);
    const response = (await h.begin()).response;
    assert.equal(response.status, 429); assert.equal((await response.json()).error.code, "auth_capacity_reached"); assert.equal(h.countFlows(), 500);
  });

  await t.test("la découverte OIDC refuse toute redirection HTTP", async t => {
    const h = setup(t); h.state.mode = "discovery-redirect";
    await assert.rejects(() => h.begin());
    assert.equal(h.countFlows(), 0);
    assert.equal(h.state.calls.length, 1);
    assert.equal(h.state.calls[0].redirect, "manual");
  });

  await t.test("l’échange de code refuse une redirection sans créer de session", async t => {
    const h = setup(t), flow = await h.begin(); h.state.mode = "token-redirect";
    const response = await h.complete(flow);
    assert.equal(response.headers.get("location"), "/pilote?connexion=echec");
    assert.equal(h.countSessions(), 0);
    assert.equal(h.state.calls.at(-1).path, "/token");
    assert.equal(h.state.calls.at(-1).redirect, "manual");
  });

  await t.test("l’activation manquante ou une origine de callback étrangère échoue sans réseau", async t => {
    const h = setup(t);
    const disabled = await invoke(h.startRequest(), { ...h.env, PILOT_ENABLED: "false" });
    assert.equal(disabled.status, 503);
    const foreign = await invoke(new Request("https://foreign.research.example/api/pilot/auth/callback?code=x&state=x"), h.env);
    assert.equal(foreign.status, 403); assert.equal(h.state.calls.length, 0); assert.equal(h.countSessions(), 0);
  });
});
