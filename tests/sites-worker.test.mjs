import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker, { sanitizeApiEvent } from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  assert.doesNotMatch(response.headers.get("content-security-policy"), /script-src[^;]*unsafe-inline/);
  assert.match(response.headers.get("strict-transport-security"), /max-age=31536000/);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("routes API before static assets and reports missing bindings cleanly", async () => {
  let calls = 0;
  const response = await worker.fetch(new Request("https://example.test/api/v1/dashboard"), {
    ASSETS: { fetch: async () => { calls += 1; return new Response("missing", { status: 404 }); } },
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
  assert.equal((await response.json()).error.code, "database_unavailable");
});

test("does not turn write requests into the app shell", async () => {
  let calls = 0;
  const response = await worker.fetch(new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => { calls += 1; return new Response("missing", { status: 404 }); } },
  });
  assert.equal(response.status, 404);
  assert.equal(calls, 1);
});

test("exposes BETA health and read-only aggregate dashboard endpoints", async () => {
  const assets = { fetch: async () => new Response("missing", { status: 404 }) };
  const health = await worker.fetch(new Request("https://example.test/api/v1/health"), { ASSETS: assets });
  assert.equal(health.status, 200);
  assert.deepEqual((await health.json()).storage, { database: false, media: false });

  const counts = [27, 8, 3, 2, 31];
  let index = 0;
  const DB = { prepare: () => ({ first: async () => ({ count: counts[index++] }) }) };
  const dashboard = await worker.fetch(new Request("https://example.test/api/v1/dashboard"), { ASSETS: assets, DB });
  assert.equal(dashboard.status, 200);
  const payload = await dashboard.json();
  assert.equal(payload.release, "BETA");
  assert.deepEqual(payload.counts, { events: 27, contents: 8, media: 3, imports: 2, activeReferences: 31 });
});

test("keeps persistent writes disabled without a private server secret", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/v1/events/batch", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ events: [{ eventId: "e1" }] }),
  }), {
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    DB: {},
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "beta_writes_disabled");
});

test("sanitizes analytics metadata and rejects identifying or unknown fields", () => {
  const result = sanitizeApiEvent({
    eventId: "event-1", eventName: "game_completed", occurredAt: "2026-08-27T10:00:00Z",
    subjectKey: "pseudonym-1", tenantKey: "school-1", role: "eleve",
    properties: { scorePercent: 80, email: "child@example.test", answerText: "secret", source: "quiz" },
  }, new Date("2026-08-27T10:01:00Z"));
  assert.equal(result.ok, true);
  assert.deepEqual(result.event.properties, { scorePercent: 80, source: "quiz" });
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0000_funny_stephen_strange.sql", import.meta.url));
});
