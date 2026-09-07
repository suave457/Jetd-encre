import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../worker/index.js";
import { PUBLIC_PREVIEW_PATHS } from "../src/publicContent.js";

const base = "https://example.test";
const authorization = "Bearer private-token";
const bytes = (value) => new TextEncoder().encode(value);
test('pilot server errors share a support reference without exposing exception data', async t => {
  const logs=[];t.mock.method(console,'error',value=>logs.push(JSON.parse(value)));
  const env={PILOT_ENABLED:'true',PILOT_ORIGIN:base,OIDC_ISSUER:'https://identity.example.test',OIDC_CLIENT_ID:'fixture-client',OIDC_CLIENT_SECRET:'fixture-secret-not-real',DB:{prepare(){throw new Error('private exception must not escape');}}};
  const response=await worker.fetch(new Request(base+'/api/pilot/auth/start'),env);
  const body=await response.json();
  assert.equal(response.status,503);assert.equal(response.headers.get('X-Request-ID'),body.reference);
  assert.deepEqual(logs,[{reference:body.reference,operation:'pilot',code:'request_failed'}]);
  assert.equal(JSON.stringify(body).includes('private exception'),false);
});
const pdf = bytes("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n");
function harness(mimeType = "application/pdf", status = "uploading") {
  const writes = []; const queries = [];
  return {
    writes, queries,
    env: {
      BETA_WRITE_TOKEN: "private-token", BETA_EVENT_PSEUDONYM_KEY: "stable-pseudonym-secret-for-beta-1",
      DB: {
        prepare(sql) {
          return { bind(...values) {
            queries.push({ sql, values });
            return { first: async () => ({ id: "abc", r2_key: "beta/test.pdf", mime_type: mimeType, status }), run: async () => ({ meta: { changes: 1 } }), sql, values };
          } };
        },
        batch: async (statements) => statements.map(() => ({ meta: { changes: 1 } })),
      },
      FILES: { put: async (...args) => writes.push(args) },
    },
  };
}
function upload(body, options = {}) {
  return new Request(`${base}/api/v1/media/abc/blob`, {
    method: "PUT", headers: { authorization, "content-type": "application/pdf", "content-length": String(body.byteLength), ...options.headers },
    body, ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  });
}

test("upload rejects forged PDF MIME and a truncated PDF before object storage", async () => {
  for (const body of [bytes("<html>not a PDF</html>"), bytes("%PDF-1.7\ntruncated")]) {
    const { env, writes } = harness();
    const response = await worker.fetch(upload(body), env);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "media_signature_mismatch");
    assert.equal(writes.length, 0);
  }
});

test("signature-screened PDF is checksummed and quarantined, never marked ready", async () => {
  const { env, writes, queries } = harness();
  const response = await worker.fetch(upload(pdf), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.media.status, "quarantined");
  assert.equal(result.media.byteSize, pdf.length);
  assert.match(result.media.checksumSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.validation.safeForPublication, false);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0][1], pdf);
  assert.equal(writes[0][2].customMetadata.validation, "quarantined");
  assert.ok(queries.some(({ sql }) => sql.includes("status = 'quarantined'")));
  assert.ok(queries.some(({ values }) => values.includes("beta-service-token")));
  assert.ok(queries.every(({ sql }) => !sql.includes("status = 'ready'")));
});

test("active PDF signatures cannot bypass quarantine, and reviewed files cannot be overwritten", async () => {
  const active = bytes("%PDF-1.7\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\n%%EOF\n");
  const { env } = harness();
  const response = await worker.fetch(upload(active), env);
  assert.equal((await response.json()).media.status, "quarantined");
  for (const status of ["ready", "quarantined", "archived"]) {
    const blocked = harness("application/pdf", status);
    assert.equal((await worker.fetch(upload(pdf), blocked.env)).status, 409);
    assert.equal(blocked.writes.length, 0);
  }
});

test("simultaneous uploads acquire one atomic claim and cannot overwrite each other", async () => {
  let status = "uploading"; let stored; let checksum; let puts = 0;
  const { env } = harness();
  env.DB = { prepare(sql) { return { bind(...values) { return {
    first: async () => ({ id: "abc", r2_key: "beta/test.pdf", mime_type: "application/pdf", status }),
    run: async () => {
      if (sql.includes("SET status = 'receiving'")) {
        if (status !== "uploading") return { meta: { changes: 0 } };
        status = "receiving";
      } else if (sql.includes("status = 'quarantined'")) { status = "quarantined"; checksum = values[1]; }
      return { meta: { changes: 1 } };
    },
  }; } }; } };
  env.FILES = { put: async (key, body) => { puts += 1; stored = body; await new Promise((resolve) => setTimeout(resolve, 10)); } };
  const other = bytes("%PDF-1.7\nDifferent content\n%%EOF\n");
  const results = await Promise.all([worker.fetch(upload(pdf), env), worker.fetch(upload(other), env)]);
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
  assert.equal(puts, 1);
  assert.equal(status, "quarantined");
  const digest = Buffer.from(await crypto.subtle.digest("SHA-256", stored)).toString("hex");
  assert.equal(checksum, digest);
});

test("object storage failure releases only the in-progress claim and never confirms ready", async () => {
  const { env, queries } = harness();
  env.FILES.put = async () => { throw new Error("storage unavailable"); };
  const response = await worker.fetch(upload(pdf), env);
  assert.equal(response.status, 500);
  assert.ok(queries.some(({ sql }) => sql.includes("SET status = 'uploading'") && sql.includes("AND status = 'receiving'")));
  assert.ok(queries.every(({ sql }) => !sql.includes("status = 'quarantined'")));
});

test("upload rejects actual-byte mismatch and oversized declarations without storing", async () => {
  for (const [length, status] of [[String(pdf.length - 1), 400], [String(pdf.length + 1), 400], [String(50 * 1024 * 1024 + 1), 413], ["-1", 400]]) {
    const { env, writes } = harness();
    assert.equal((await worker.fetch(upload(pdf, { headers: { "content-length": length } }), env)).status, status);
    assert.equal(writes.length, 0);
  }
});

test("JSON size is bounded while streaming, not after unbounded text allocation", async () => {
  let cancelled = false; let pulls = 0;
  const body = new ReadableStream({ pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(32769)); }, cancel() { cancelled = true; } });
  const { env, queries } = harness();
  const response = await worker.fetch(new Request(`${base}/api/v1/editorial`, { method: "POST", headers: { authorization, "content-type": "application/json" }, body, duplex: "half" }), env);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 3);
  assert.equal(queries.length, 0);
  for (const value of ["null", "[]", "\"string\""]) {
    const result = await worker.fetch(new Request(`${base}/api/v1/editorial`, { method: "POST", headers: { authorization, "content-type": "application/json" }, body: value }), env);
    assert.equal(result.status, 400);
  }
});

test("real SQLite migrations satisfy readiness; missing schema returns unavailable", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const DB = { prepare: (sql) => ({ first: async () => sqlite.prepare(sql).get() }) };
  try {
    assert.equal((await worker.fetch(new Request(`${base}/api/v1/ready`), { DB })).status, 503);
    const directory = new URL("../drizzle/", import.meta.url);
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
    const response = await worker.fetch(new Request(`${base}/api/v1/health`), { DB, FILES: {} });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).storage.schema, "checked");
    assert.equal(sqlite.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    const pilotEnv={DB,PILOT_ENABLED:'true',PILOT_ORIGIN:base,OIDC_ISSUER:'https://identity.example.test',OIDC_CLIENT_ID:'fixture',OIDC_CLIENT_SECRET:'fixture-not-real'};
    const pilotReady=await worker.fetch(new Request(`${base}/api/v1/ready`),pilotEnv);
    assert.equal(pilotReady.status,200);assert.equal((await pilotReady.json()).identityAssurance,'oidc');
    sqlite.exec('DROP TABLE pilot_game_awards');
    assert.equal((await worker.fetch(new Request(`${base}/api/v1/ready`),pilotEnv)).status,503);
    sqlite.exec("DROP TABLE beta_media_assets");
    assert.equal((await worker.fetch(new Request(`${base}/api/v1/ready`), { DB })).status, 503);
  } finally { sqlite.close(); }
  assert.equal((await worker.fetch(new Request(`${base}/api/v1/live`), {})).status, 200);
});

test("client-declared identities cannot become production events or verified roles", async () => {
  for (const dataMode of ["beta", undefined]) {
    const { env, queries } = harness();
    const event = { eventId: "e1", eventName: "game_completed", subjectKey: "s1", tenantKey: "t1", role: "admin", occurredAt: new Date().toISOString(), properties: { dataMode } };
    const response = await worker.fetch(new Request(`${base}/api/v1/events/batch`, { method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify({ events: [event] }) }), env);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "verified_identity_required");
    assert.equal(queries.length, 0);
  }
});

test('readiness requires production learning migrations; local-only PDF metadata remains optional',async()=>{
  const sqlite=new DatabaseSync(':memory:');
  try{
    const directory=new URL('../drizzle/',import.meta.url);
    for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<'0006').sort())sqlite.exec(readFileSync(new URL(file,directory),'utf8'));
    const DB={prepare:sql=>({first:async()=>sqlite.prepare(sql).get()})};
    const env={DB,PILOT_ENABLED:'true',PILOT_ORIGIN:base,OIDC_ISSUER:'https://identity.example.test',OIDC_CLIENT_ID:'fixture',OIDC_CLIENT_SECRET:'fixture-not-real'};
    assert.equal((await worker.fetch(new Request(base+'/api/v1/ready'),env)).status,503);
    const pending=readdirSync(directory).filter(name=>name.endsWith('.sql')&&name>='0006').sort();
    for(const [index,file] of pending.entries()) {
      sqlite.exec(readFileSync(new URL(file,directory),'utf8'));
      assert.equal((await worker.fetch(new Request(base+'/api/v1/ready'),env)).status,file<'0013_class_challenges.sql'?503:200,file);
    }
    assert.equal((await worker.fetch(new Request(base+'/api/v1/ready'),env)).status,200);
    assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_manuals').get().n,0);
  }finally{sqlite.close();}
});

test("serves exact prerendered public routes; unknown public paths and local PDFs stay 404", async () => {
  const calls = [];
  const env = { ASSETS: { fetch: async (request) => { calls.push(new URL(request.url).pathname); return new Response("static", { status: new URL(request.url).pathname.endsWith("index.html") ? 200 : 404 }); } } };
  assert.equal((await worker.fetch(new Request(`${base}/methode`, { headers: { accept: "text/html" } }), env)).status, 200);
  assert.deepEqual(calls, ["/methode/index.html"]);
  for (const path of PUBLIC_PREVIEW_PATHS) {
    const expected = path === "/" ? "/index.html" : `${path}/index.html`;
    assert.equal((await worker.fetch(new Request(`${base}${path}`, { headers: { accept: "text/html" } }), env)).status, 200, path);
    assert.equal(calls.at(-1), expected, path);
  }
  for (const path of ["/pilote", "/pilote/jeux/mots-fleches", "/pilote/jeux/mots-fleches/", "/pilote/jeux/culture-generale", "/pilote/jeux/defi-du-jour", "/pilote/jeux/souk-des-mots", "/pilote/jeux/defis-classe", "/pilote/jeux/defis-classe/", "/pilote/bibliotheque", "/pilote/bibliotheque/", "/pilote/lecture/manual-test", "/pilote/lecture/manual-test/", "/pilote/lecture/A_1?profil=eleve", "/admin/bibliotheque", "/admin/bibliotheque/", "/admin", "/admin/accueil", "/admin/accueil/", "/admin/ecoles-acces", "/admin/licences", "/admin/analyses"]) {
    const response = await worker.fetch(new Request(`${base}${path}`, { headers: { accept: "text/html" } }), env);
    assert.equal(response.status, 200, path);
    assert.equal(calls.at(-1), "/index.html", path);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  }
  for (const path of ["/pilote/jeux/inconnu", "/pilote/jeux/mots-fleches/extra", "/pilote/jeux/defis-classe/extra", "/pilote/bibliotheque/extra", "/pilote/lecture", "/pilote/lecture/", "/pilote/lecture/manual-test/extra", "/pilote/lecture/manual%20test", `/pilote/lecture/${"a".repeat(101)}`, "/guide-ecole/inconnu"]) {
    assert.equal((await worker.fetch(new Request(`${base}${path}`, { headers: { accept: "text/html" } }), env)).status, 404, path);
  }
  assert.equal((await worker.fetch(new Request(`${base}/page-inventee`, { headers: { accept: "text/html" } }), env)).status, 404);
  for (const path of ["/connexion", "/connexion/parent", "/activation", "/mentions-legales", "/blog"]) assert.equal((await worker.fetch(new Request(`${base}${path}`, { headers: { accept: "text/html" } }), env)).status, 200);
  assert.equal((await worker.fetch(new Request(`${base}/connexion/invente`, { headers: { accept: "text/html" } }), env)).status, 404);
  const before = calls.length;
  assert.equal((await worker.fetch(new Request(`${base}/__local-media/momo-chapitre-1.pdf`), env)).status, 404);
  assert.equal(calls.length, before);
});

test("documents privés : HEAD et liens directs sans élargir les méthodes ni servir de fichier local", async () => {
  const calls = [];
  const env = { ASSETS: { async fetch(request) {
    const path = new URL(request.url).pathname;
    calls.push({ path, method: request.method, search: new URL(request.url).search });
    return new Response(request.method === "HEAD" ? null : "shell", { status: path === "/index.html" ? 200 : 404 });
  } } };
  for (const path of ["/pilote/jeux/defis-classe", "/pilote/bibliotheque", "/pilote/lecture/manual-test", "/admin/bibliotheque"]) {
    const response = await worker.fetch(new Request(`${base}${path}?profil=eleve`, { method: "HEAD", headers: { accept: "text/html" } }), env);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
    assert.equal(await response.text(), "");
    assert.deepEqual(calls.at(-1), { path: "/index.html", method: "HEAD", search: "" });
    for (const options of [{ method: "POST", headers: { accept: "text/html" } }, { headers: { accept: "application/pdf" } }]) {
      assert.equal((await worker.fetch(new Request(`${base}${path}`, options), env)).status, 404);
    }
  }
  for (const path of ["/pilote/lecture/manual-test/file", "/pilote/lecture/manual-test/versions/sha/file", "/__local-media/private-manuals/test.pdf", "/.local-media/private-manuals/test.pdf"]) {
    assert.equal((await worker.fetch(new Request(`${base}${path}`, { headers: { accept: "text/html" } }), env)).status, 404);
  }
});
