export const SESSION_SECONDS = 3 * 60 * 60;
export const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const now = () => Math.floor(Date.now() / 1000);
export const all = async (db, sql, ...values) => (await db.prepare(sql).bind(...values).all()).results || [];
export const first = (db, sql, ...values) => db.prepare(sql).bind(...values).first();
export const run = (db, sql, ...values) => db.prepare(sql).bind(...values).run();
export function randomToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
export function reply(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}
export function fail(status, code, message) { throw reply({ error: { code, message } }, status); }
export function readCookie(request, name) {
  const matches = (request.headers.get("cookie") || "").split(";").map(x => x.trim()).filter(x => x.startsWith(name + "="));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}
export function sessionCookie(local, token = "", maxAge = SESSION_SECONDS) {
  return `${local ? "jde_local_pilot" : "__Host-jde_pilot"}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${local ? "" : "; Secure"}`;
}
export function sameOrigin(request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin || request.headers.get("Sec-Fetch-Site") === "cross-site") fail(403, "origin_rejected", "Cette action doit partir de la plateforme.");
}
export async function readInput(request) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json") fail(415, "json_required", "Format de requête invalide.");
  const reader = request.body?.getReader(); const chunks = []; let length = 0;
  if (reader) try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      length += item.value.length;
      if (length > 16 * 1024) { await reader.cancel(); fail(413, "body_too_large", "Le texte envoyé est trop long."); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch { fail(400, "invalid_json", "Requête invalide."); }
}
export function requiredText(value, name, min, max) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) fail(422, "invalid_field", `${name} : entre ${min} et ${max} caractères attendus.`);
  return value.trim();
}
export async function issueSession(db, userId, assurance, local) {
  if (assurance !== (local ? "local_fixture" : "oidc")) fail(403, "identity_rejected", "Identité non autorisée.");
  const token = randomToken(), csrfToken = randomToken(), time = now();
  const result = await run(db, `INSERT INTO pilot_sessions(token_hash,user_id,csrf_token,assurance,created_at,expires_at)
    SELECT ?,id,?,?,?,? FROM pilot_users WHERE id=? AND active=1`, await hash(token), csrfToken, assurance, time, time + SESSION_SECONDS, userId);
  if (!result.meta?.changes) fail(403, "account_unavailable", "Ce compte n’est pas actif.");
  await run(db, "DELETE FROM pilot_sessions WHERE token_hash IN (SELECT token_hash FROM pilot_sessions WHERE expires_at < ? LIMIT 100)", time - 86400);
  return { cookie: sessionCookie(local, token), csrfToken };
}
export async function authenticate(request, db, local = false, optional = false) {
  const token = readCookie(request, local ? "jde_local_pilot" : "__Host-jde_pilot");
  const tokenHash = token && TOKEN.test(token) ? await hash(token) : "";
  const session = tokenHash ? await first(db, `SELECT s.token_hash,s.user_id,s.csrf_token,s.assurance,u.display_name FROM pilot_sessions s
    JOIN pilot_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1 AND s.assurance=?`, tokenHash, now(), local ? "local_fixture" : "oidc") : null;
  if (!session && !optional) fail(401, "session_required", "Connectez-vous à nouveau pour accéder au pilote.");
  return session;
}
export function checkCsrf(request, session) {
  sameOrigin(request);
  if (!TOKEN.test(request.headers.get("X-CSRF-Token") || "") || request.headers.get("X-CSRF-Token") !== session.csrf_token) fail(403, "csrf_rejected", "La session a changé. Rechargez la page avant de réessayer.");
}
// Embed in each conditional write as well as checking the session when the request starts.
export const LIVE_SESSION_SQL = `EXISTS (SELECT 1 FROM pilot_sessions live JOIN pilot_users lu ON lu.id=live.user_id
  WHERE live.token_hash=? AND live.user_id=? AND live.revoked_at IS NULL AND live.expires_at>? AND lu.active=1)`;
export const liveValues = session => [session.token_hash, session.user_id, now()];
