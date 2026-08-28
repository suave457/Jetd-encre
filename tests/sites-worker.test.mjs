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

test("refuses analytics writes without a dedicated stable pseudonym key", async () => {
  let prepareCalls = 0;
  const response = await worker.fetch(new Request("https://example.test/api/v1/events/batch", {
    method: "POST",
    headers: {
      authorization: "Bearer private-token",
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ events: [{ eventId: "e1" }] }),
  }), {
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    DB: { prepare: () => { prepareCalls += 1; throw new Error("D1 must not be queried"); } },
    BETA_WRITE_TOKEN: "private-token",
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "event_pseudonymization_disabled");
  assert.equal(prepareCalls, 0);
});

test("protects private editorial and media inventories before any D1 query", async () => {
  let prepareCalls = 0;
  const blockedDB = { prepare: () => { prepareCalls += 1; throw new Error("D1 must not be queried"); } };
  const assets = { fetch: async () => new Response("missing", { status: 404 }) };

  for (const path of ["/api/v1/editorial?status=published", "/api/v1/media"]) {
    const unauthorized = await worker.fetch(new Request(`https://example.test${path}`), {
      ASSETS: assets,
      DB: blockedDB,
      BETA_WRITE_TOKEN: "private-token",
    });
    assert.equal(unauthorized.status, 401, path);
    assert.equal((await unauthorized.json()).error.code, "private_access_required", path);
  }
  assert.equal(prepareCalls, 0);

  const disabled = await worker.fetch(new Request("https://example.test/api/v1/editorial"), { ASSETS: assets, DB: blockedDB });
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).error.code, "beta_private_access_disabled");
  assert.equal(prepareCalls, 0);

  const foreignOrigin = await worker.fetch(new Request("https://example.test/api/v1/media", {
    headers: { authorization: "Bearer private-token", origin: "https://attacker.test" },
  }), { ASSETS: assets, DB: blockedDB, BETA_WRITE_TOKEN: "private-token" });
  assert.equal(foreignOrigin.status, 403);
  assert.equal((await foreignOrigin.json()).error.code, "origin_rejected");
  assert.equal(prepareCalls, 0);
});

test("preserves authorized private inventory reads and the public dashboard", async () => {
  const queries = [];
  const DB = {
    prepare(sql) {
      queries.push(sql);
      const result = sql.includes("beta_editorial_items") ? [{ id: "content-1", status: "draft", audience: "private" }] : [{ id: "media-1", status: "ready" }];
      return {
        all: async () => ({ results: result }),
        bind: (...values) => ({ all: async () => ({ results: result, values }) }),
      };
    },
  };
  const env = {
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    DB,
    BETA_WRITE_TOKEN: "private-token",
  };
  const headers = { authorization: "Bearer private-token", origin: "https://example.test" };
  const editorial = await worker.fetch(new Request("https://example.test/api/v1/editorial?status=draft", { headers }), env);
  const media = await worker.fetch(new Request("https://example.test/api/v1/media", { headers }), env);
  assert.equal(editorial.status, 200);
  assert.equal(media.status, 200);
  assert.equal((await editorial.json()).items[0].id, "content-1");
  assert.equal((await media.json()).items[0].id, "media-1");
  assert.equal(queries.length, 2);
});

test("sanitizes analytics metadata and rejects identifying or unknown fields", () => {
  const result = sanitizeApiEvent({
    eventId: "event-1", eventName: "game_completed", occurredAt: "2026-08-27T10:00:00Z",
    subjectKey: "pseudonym-1", tenantKey: "school-1", role: "eleve",
    properties: { scorePercent: 80, email: "child@example.test", answerText: "secret", source: "quiz", dataMode: "fixture" },
  }, new Date("2026-08-27T10:01:00Z"));
  assert.equal(result.ok, true);
  assert.deepEqual(result.event.properties, { scorePercent: 80, source: "quiz", dataMode: "fixture" });

  const identifyingValue = sanitizeApiEvent({
    eventId: "event-2", eventName: "game_completed", occurredAt: "2026-08-27T10:00:00Z",
    subjectKey: "pseudonym-1", tenantKey: "school-1", role: "eleve",
    properties: { source: "Lina Mansouri", resultCode: "child@example.test", scorePercent: 101 },
    competencyCodes: ["LEX-01", "LINA-01"],
  }, new Date("2026-08-27T10:01:00Z"));
  assert.equal(identifyingValue.ok, false);
  assert.deepEqual(identifyingValue.event.properties, {});
  assert.ok(identifyingValue.errors.includes("invalid_property:source"));
  assert.ok(identifyingValue.errors.includes("invalid_property:resultCode"));
  assert.ok(identifyingValue.errors.includes("unknown_competency"));

  const identifyingContentVersion = sanitizeApiEvent({
    eventId: "event-3", eventName: "game_completed", occurredAt: "2026-08-27T10:00:00Z",
    subjectKey: "pseudonym-1", tenantKey: "school-1", role: "eleve", contentVersion: "212661234567",
  }, new Date("2026-08-27T10:01:00Z"));
  assert.equal(identifyingContentVersion.ok, false);
  assert.equal(identifyingContentVersion.event.contentVersion, null);
  assert.ok(identifyingContentVersion.errors.includes("invalid_content_version"));
});

test("pseudonymizes every analytics identifier before D1 and preserves deduplication", async () => {
  const boundRows = [];
  const DB = {
    prepare(sql) {
      return {
        bind(...values) {
          boundRows.push({ sql, values });
          return { sql, values };
        },
      };
    },
    batch: async (statements) => statements.map((_, index) => ({ meta: { changes: index === 0 ? 1 : 0 } })),
  };
  const rawEvent = {
    eventId: "child@example.test",
    eventName: "game_completed",
    occurredAt: "2026-08-27T10:00:00Z",
    subjectKey: "child@example.test",
    tenantKey: "child@example.test",
    classKey: "Classe de Lina",
    sessionId: "session de Lina",
    contentId: "contenu de Lina",
    activityId: "activité de Lina",
    attemptId: "tentative de Lina",
    role: "eleve",
    competencyCodes: ["LEX-01"],
    properties: { scorePercent: 80, source: "quiz", dataMode: "fixture" },
  };
  const response = await worker.fetch(new Request("https://example.test/api/v1/events/batch", {
    method: "POST",
    headers: {
      authorization: "Bearer private-token",
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ events: [rawEvent, rawEvent] }),
  }), {
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    DB,
    BETA_WRITE_TOKEN: "private-token",
    BETA_EVENT_PSEUDONYM_KEY: "stable-pseudonym-secret-for-beta-1",
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: 1, duplicates: 1 });
  assert.equal(boundRows.length, 2);
  assert.equal(boundRows[0].values[0], boundRows[1].values[0]);
  assert.equal(boundRows[0].values[4], boundRows[1].values[4]);
  assert.match(boundRows[0].values[0], /^evt_[a-f0-9]{64}$/);
  assert.match(boundRows[0].values[4], /^sub_[a-f0-9]{64}$/);
  assert.match(boundRows[0].values[6], /^tnt_[a-f0-9]{64}$/);
  assert.notEqual(boundRows[0].values[0], boundRows[0].values[4]);
  assert.doesNotMatch(JSON.stringify(boundRows), /child@example\.test|Classe de Lina|session de Lina|contenu de Lina|activité de Lina|tentative de Lina/);
  assert.deepEqual(JSON.parse(boundRows[0].values[13]), ["LEX-01"]);
  assert.deepEqual(JSON.parse(boundRows[0].values[14]), { scorePercent: 80, source: "quiz", dataMode: "fixture" });

  const rotatedResponse = await worker.fetch(new Request("https://example.test/api/v1/events/batch", {
    method: "POST",
    headers: {
      authorization: "Bearer rotated-token",
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ events: [rawEvent] }),
  }), {
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    DB,
    BETA_WRITE_TOKEN: "rotated-token",
    BETA_EVENT_PSEUDONYM_KEY: "stable-pseudonym-secret-for-beta-1",
  });
  assert.equal(rotatedResponse.status, 202);
  assert.equal(boundRows.length, 3);
  assert.equal(boundRows[2].values[0], boundRows[0].values[0]);
  assert.equal(boundRows[2].values[4], boundRows[0].values[4]);
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0000_funny_stephen_strange.sql", import.meta.url));
});
