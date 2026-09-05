import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../worker/index.js";

const base = "https://example.test";
const authorization = "Bearer private-token";
const bytes = (value) => new TextEncoder().encode(value);
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

test("serves exact prerendered public routes; unknown public paths and local PDFs stay 404", async () => {
  const calls = [];
  const env = { ASSETS: { fetch: async (request) => { calls.push(new URL(request.url).pathname); return new Response("static", { status: new URL(request.url).pathname.endsWith("index.html") ? 200 : 404 }); } } };
  assert.equal((await worker.fetch(new Request(`${base}/methode`, { headers: { accept: "text/html" } }), env)).status, 200);
  assert.deepEqual(calls, ["/methode/index.html"]);
  assert.equal((await worker.fetch(new Request(`${base}/page-inventee`, { headers: { accept: "text/html" } }), env)).status, 404);
  for (const path of ["/connexion", "/connexion/parent", "/activation", "/mentions-legales", "/blog"]) assert.equal((await worker.fetch(new Request(`${base}${path}`, { headers: { accept: "text/html" } }), env)).status, 200);
  assert.equal((await worker.fetch(new Request(`${base}/connexion/invente`, { headers: { accept: "text/html" } }), env)).status, 404);
  const before = calls.length;
  assert.equal((await worker.fetch(new Request(`${base}/__local-media/momo-chapitre-1.pdf`), env)).status, 404);
  assert.equal(calls.length, before);
});
