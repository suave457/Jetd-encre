import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openPilotDatabase, seedLocalPilot, LOCAL_PROFILES } from "../scripts/pilot-local-store.mjs";
import { authenticate, issueSession, now } from "../worker/pilot/session.js";
import { handleGames } from "../worker/pilot/games.js";
import { MOTS_FLECHES_GRIDS } from "../src/features/games/mots-fleches/motsFlechesData.js";
import { buildGridModel, createEmptyProgress } from "../src/features/games/mots-fleches/motsFlechesEngine.js";

const origin = "http://127.0.0.1:5173";
const root = "/api/pilot/games/mots-fleches";
const firstGrid = MOTS_FLECHES_GRIDS[0];
const firstModel = buildGridModel(firstGrid);
const firstKey = [...firstModel.cells].find(([, cell]) => cell.type === "letter")[0];
const solved = (grid = firstGrid) => Object.fromEntries([...buildGridModel(grid).cells].filter(([, cell]) => cell.type === "letter").map(([key, cell]) => [key, cell.solution]));
const payload = (extra = {}) => ({ ownerId: "pilot-a-student", progress: { [firstKey]: "E" }, hintCount: 0, revision: 0, requestId: crypto.randomUUID(), ...extra });

function setup(t) {
  const store = openPilotDatabase();
  seedLocalPilot(store.sqlite);
  t.after(() => store.close());
  return store;
}

async function client(db, id = "pilot-a-student", overrides = {}) {
  const issued = await issueSession(db, id, "local_fixture", true);
  const cookie = issued.cookie.split(";")[0];
  const session = await authenticate(new Request(origin, { headers: { cookie } }), db, true);
  const profile = LOCAL_PROFILES.find((item) => item.id === id);
  const context = { user: { id, name: profile?.name || id }, schoolId: profile?.schoolId, role: profile?.role, session, ...overrides };
  return {
    context,
    async call(path = "/progress", body, headers = {}) {
      const request = new Request(origin + root + path, { method: body === undefined ? "GET" : "POST",
        headers: { cookie, origin, "Content-Type": "application/json", "X-CSRF-Token": issued.csrfToken, ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      let response;
      try { response = await handleGames(request, { DB: db }, context); }
      catch (error) { if (error instanceof Response) response = error; else throw error; }
      return { status: response.status, data: await response.json(), headers: response.headers };
    },
  };
}

test("jeu serveur : sauvegarde, reprise sur une nouvelle session et synthèse familiale", async (t) => {
  const { DB, sqlite } = setup(t);
  const student = await client(DB);
  const empty = await student.call();
  assert.deepEqual(empty.data, { userId: "pilot-a-student", schoolId: "pilot-school-a", xpTotal: 0, grids: [] });
  const write = await student.call(`/${firstGrid.id}/progress`, payload({ hintCount: 2 }));
  assert.equal(write.status, 200, JSON.stringify(write.data));
  assert.equal(write.data.grid.revision, 1);
  assert.equal(write.data.grid.hintCount, 2);
  assert.equal(write.data.grid.progress[firstKey], "É");
  assert.equal(write.data.grid.awardedXp, 0);
  assert.equal(write.data.awarded, false);
  const refreshed = await client(DB);
  assert.deepEqual((await refreshed.call()).data.grids, [write.data.grid]);
  const parent = await client(DB, "pilot-a-parent");
  const family = await parent.call("/summary");
  assert.equal(family.data.children.length, 1);
  assert.equal(family.data.children[0].studentId, "pilot-a-student");
  assert.equal(family.data.children[0].startedCount, 1);
  assert.equal(family.data.children[0].completedCount, 0);
  assert.equal("progress" in family.data.children[0].grids[0], false);
  assert.equal(family.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});

test("jeu serveur : les 18 premières réussites rapportent 630 XP, les rejeux aucun", async (t) => {
  const { DB, sqlite } = setup(t);
  const student = await client(DB);
  let expected = 0;
  for (const grid of MOTS_FLECHES_GRIDS) {
    const complete = await student.call(`/${grid.id}/complete`, payload({ progress: solved(grid) }));
    assert.equal(complete.status, 200, JSON.stringify(complete.data));
    assert.equal(complete.data.awarded, true);
    expected += grid.xp;
    assert.equal(complete.data.xpTotal, expected);
    assert.equal(complete.data.grid.awardedXp, grid.xp);
    assert.ok(complete.data.grid.completedAt > 0);
  }
  assert.equal(expected, 630);
  const erased = await student.call(`/${firstGrid.id}/progress`, payload({ revision: 1, progress: {}, hintCount: 0 }));
  assert.equal(erased.data.grid.revision, 2);
  assert.equal(erased.data.grid.awardedXp, 20);
  assert.equal(Object.values(erased.data.grid.progress).some(Boolean), false);
  const replay = await student.call(`/${firstGrid.id}/complete`, payload({ revision: 2, progress: solved() }));
  assert.equal(replay.data.awarded, false);
  assert.equal(replay.data.xpTotal, 630);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_awards").get().n, 18);
  const summary = (await student.call("/summary")).data.children[0];
  assert.equal(summary.completedCount, 18);
  assert.equal(summary.xpTotal, 630);
});

test("jeu serveur : une grille pleine sauvegardée ne gagne rien avant validation complète", async (t) => {
  const { DB } = setup(t);
  const student = await client(DB);
  const written = await student.call(`/${firstGrid.id}/progress`, payload({ progress: solved() }));
  assert.equal(written.data.xpTotal, 0);
  assert.equal(written.data.grid.completedAt, null);
  const finished = await student.call(`/${firstGrid.id}/complete`, payload({ revision: 1, progress: solved() }));
  assert.equal(finished.data.xpTotal, 20);
  assert.equal(finished.data.awarded, true);
});

test("jeu serveur : retry identique idempotent, contenu changé et révision périmée en conflit", async (t) => {
  const { DB } = setup(t);
  const student = await client(DB);
  const input = payload({ progress: solved() });
  const first = await student.call(`/${firstGrid.id}/complete`, input);
  const retry = await student.call(`/${firstGrid.id}/complete`, input);
  assert.equal(retry.status, 200);
  assert.equal(retry.data.awarded, false);
  assert.deepEqual(retry.data.grid, first.data.grid);
  assert.equal(retry.data.xpTotal, 20);
  const changed = await student.call(`/${firstGrid.id}/complete`, { ...input, hintCount: 1 });
  assert.equal(changed.status, 409);
  assert.equal(changed.data.error.code, "game_request_conflict");
  assert.deepEqual(changed.data.grid, first.data.grid);
  assert.equal(changed.data.userId, "pilot-a-student");
  const stale = await student.call(`/${firstGrid.id}/progress`, payload());
  assert.equal(stale.status, 409);
  assert.equal(stale.data.error.code, "game_revision_conflict");
  assert.equal(stale.data.grid.revision, 1);
  const switchedOperation = await student.call(`/${firstGrid.id}/progress`, input);
  assert.equal(switchedOperation.status, 409);
});

test("jeu serveur : deux écritures concurrentes d'une même révision n'écrasent pas la gagnante", async (t) => {
  const { DB, sqlite } = setup(t);
  let arrivals = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  const racingDb = { ...DB, async batch(statements) { arrivals += 1; if (arrivals === 2) release(); await ready; return DB.batch(statements); } };
  const student = await client(racingDb);
  const inputs = [payload({ progress: solved() }), payload({ progress: solved(), hintCount: 1 })];
  const results = await Promise.all(inputs.map((input) => student.call(`/${firstGrid.id}/complete`, input)));
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const winner = results.find((result) => result.status === 200).data;
  assert.equal(winner.awarded, true);
  assert.equal(winner.grid.revision, 1);
  assert.equal(winner.xpTotal, 20);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_awards").get().n, 1);
  assert.deepEqual((await student.call()).data.grids, [winner.grid]);
});

test("jeu serveur : deux retries concurrents identiques n'attribuent qu'une seule récompense", async (t) => {
  const { DB, sqlite } = setup(t);
  let arrivals = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  const racingDb = { ...DB, async batch(statements) { arrivals += 1; if (arrivals === 2) release(); await ready; return DB.batch(statements); } };
  const student = await client(racingDb);
  const input = payload({ progress: solved() });
  const results = await Promise.all([student.call(`/${firstGrid.id}/complete`, input), student.call(`/${firstGrid.id}/complete`, input)]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.equal(results.filter((result) => result.data.awarded).length, 1);
  assert.equal(sqlite.prepare("SELECT revision FROM pilot_game_progress").get().revision, 1);
  assert.equal(sqlite.prepare("SELECT SUM(xp) total FROM pilot_game_awards").get().total, 20);
});

test("jeu serveur : l'échec SQL de la récompense annule aussi la sauvegarde", async (t) => {
  const { DB, sqlite } = setup(t);
  const student = await client(DB);
  sqlite.exec("CREATE TRIGGER fail_game_award BEFORE INSERT ON pilot_game_awards BEGIN SELECT RAISE(ABORT, 'test reward unavailable'); END;");
  const input = payload({ progress: solved() });
  await assert.rejects(student.call(`/${firstGrid.id}/complete`, input), /test reward unavailable/);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_progress").get().n, 0);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_awards").get().n, 0);
  sqlite.exec("DROP TRIGGER fail_game_award");
  const retry = await student.call(`/${firstGrid.id}/complete`, input);
  assert.equal(retry.status, 200);
  assert.equal(retry.data.awarded, true);
});

test("jeu serveur : écoles, élèves et parents restent isolés, y compris lors d'un conflit", async (t) => {
  const { DB } = setup(t);
  const student = await client(DB);
  await student.call(`/${firstGrid.id}/complete`, payload({ progress: solved() }));
  for (const id of ["pilot-a-other", "pilot-b-student"]) {
    const other = await client(DB, id);
    assert.deepEqual((await other.call()).data.grids, []);
    assert.equal((await other.call()).data.xpTotal, 0);
    const forged = await other.call(`/${firstGrid.id}/progress`, payload());
    assert.equal(forged.status, 403);
    assert.equal("grid" in forged.data, false);
    const conflict = await other.call(`/${firstGrid.id}/progress`, payload({ ownerId: id, revision: 1 }));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.userId, id);
    assert.equal(conflict.data.grid.revision, 0);
    assert.equal(conflict.data.grid.awardedXp, 0);
  }
  const parent = await client(DB, "pilot-a-parent");
  assert.equal((await parent.call()).status, 403);
  assert.equal((await parent.call(`/${firstGrid.id}/progress`, payload())).status, 403);
  assert.equal((await parent.call("/summary")).data.children[0].xpTotal, 20);
  const otherParent = await client(DB, "pilot-b-parent");
  const children = (await otherParent.call("/summary")).data.children;
  assert.deepEqual(children.map((child) => child.studentId), ["pilot-b-student"]);
  assert.equal(children[0].xpTotal, 0);
  const teacher = await client(DB, "pilot-a-teacher");
  assert.equal((await teacher.call("/summary")).status, 403);
});

test("jeu serveur : un même élève dans deux écoles conserve deux progressions et deux totaux", async (t) => {
  const { DB, sqlite } = setup(t);
  sqlite.exec("INSERT INTO pilot_memberships VALUES ('pilot-school-b','pilot-a-student','eleve',1); INSERT INTO pilot_class_members VALUES ('pilot-school-b','pilot-class-b','pilot-a-student');");
  const schoolA = await client(DB);
  const schoolB = await client(DB, "pilot-a-student", { schoolId: "pilot-school-b" });
  const input = payload({ progress: solved() });
  assert.equal((await schoolA.call(`/${firstGrid.id}/complete`, input)).data.xpTotal, 20);
  assert.equal((await schoolB.call()).data.xpTotal, 0);
  assert.deepEqual((await schoolB.call()).data.grids, []);
  assert.equal((await schoolB.call(`/${firstGrid.id}/complete`, input)).data.awarded, true);
  assert.equal((await schoolA.call()).data.xpTotal, 20);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_awards").get().n, 2);
});

test("jeu serveur : familles et enfants inactifs disparaissent de la synthèse", async (t) => {
  for (const mutation of [
    "UPDATE pilot_family_links SET active=0 WHERE parent_id='pilot-a-parent'",
    "UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'",
    "UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'",
    "DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'",
  ]) {
    const { DB, sqlite } = setup(t);
    const parent = await client(DB, "pilot-a-parent");
    assert.equal((await parent.call("/summary")).data.children.length, 1);
    sqlite.exec(mutation);
    assert.deepEqual((await parent.call("/summary")).data.children, [], mutation);
  }
});

test("jeu serveur : retrait d'accès après lecture et avant batch empêche sauvegarde et XP", async (t) => {
  for (const mutation of [
    "UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_memberships SET role='parent' WHERE user_id='pilot-a-student'",
    "UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'",
    "UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'",
    "UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'",
    "DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'",
    "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'",
    `UPDATE pilot_sessions SET expires_at=${now() - 1} WHERE user_id='pilot-a-student'`,
  ]) {
    const { DB, sqlite } = setup(t);
    const changingDb = { ...DB, async batch(statements) { sqlite.exec(mutation); return DB.batch(statements); } };
    const student = await client(changingDb);
    const result = await student.call(`/${firstGrid.id}/complete`, payload({ progress: solved() }));
    assert.equal(result.status, 403, mutation);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_progress").get().n, 0, mutation);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_awards").get().n, 0, mutation);
    assert.equal((await student.call()).status, 403, mutation);
  }
});

test("jeu serveur : propriétaire, cases, lettres, UUID, révision et aides strictement validés", async (t) => {
  const { DB, sqlite } = setup(t);
  const student = await client(DB);
  for (const extra of [
    { xp: 999 }, { schoolId: "pilot-school-b" }, { revision: "0" }, { revision: -1 }, { revision: 0.5 },
    { hintCount: "1" }, { hintCount: -1 }, { hintCount: 10001 }, { requestId: "fake" },
    { progress: [] }, { progress: null }, { progress: { "99:99": "A" } },
    { progress: { [firstKey]: "AB" } }, { progress: { [firstKey]: "1" } },
    { progress: { [firstKey]: "ا" } }, { progress: { [firstKey]: true } },
    { progress: { [firstKey]: " A" } }, { progress: { [firstKey]: "ß" } },
  ]) {
    const result = await student.call(`/${firstGrid.id}/progress`, payload(extra));
    assert.equal(result.status, 422, JSON.stringify(extra));
  }
  assert.equal((await student.call("/unknown-grid/progress", payload())).status, 404);
  assert.equal((await student.call(`/${firstGrid.id}/progress`, payload({ ownerId: "pilot-a-other" }))).status, 403);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_progress").get().n, 0);
});

test("jeu serveur : lettres manquantes ou erronées interdisent la récompense", async (t) => {
  const { DB, sqlite } = setup(t);
  const student = await client(DB);
  for (const progress of [{}, { [firstKey]: "E" }, { ...solved(), [firstKey]: "X" }]) {
    assert.equal((await student.call(`/${firstGrid.id}/complete`, payload({ progress }))).status, 422);
  }
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_awards").get().n, 0);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_progress").get().n, 0);
});

test("jeu serveur : CSRF, origine et cohérence du contexte protègent les écritures", async (t) => {
  const { DB, sqlite } = setup(t);
  const student = await client(DB);
  for (const headers of [{ "X-CSRF-Token": "forged" }, { origin: "https://evil.example" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await student.call(`/${firstGrid.id}/progress`, payload(), headers)).status, 403);
  }
  const mixedContext = await client(DB, "pilot-a-student", { user: { id: "pilot-a-other" } });
  assert.equal((await mixedContext.call()).status, 401);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_game_progress").get().n, 0);
});

test("jeu serveur : migration depuis 0003 sans perte, puis progression et XP après réouverture", async () => {
  const file = join(tmpdir(), `jde-pilot-games-${crypto.randomUUID()}.sqlite`);
  const previous = new DatabaseSync(file);
  let store = { sqlite: previous, close: () => { if (previous.isOpen) previous.close(); } };
  try {
    previous.exec("PRAGMA foreign_keys=ON; CREATE TABLE __pilot_local_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL)");
    const directory = new URL("../drizzle/", import.meta.url);
    for (const name of readdirSync(directory).filter((name) => name.endsWith(".sql") && name < "0004").sort()) {
      const sql = readFileSync(new URL(name, directory), "utf8");
      previous.exec(sql);
      previous.prepare("INSERT INTO __pilot_local_migrations VALUES (?, ?)").run(name, createHash("sha256").update(sql).digest("hex"));
    }
    seedLocalPilot(previous);
    const oldTables = previous.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__pilot_local_migrations' ORDER BY name").all().map((row) => row.name);
    const contents = (db) => Object.fromEntries(oldTables.map((name) => [name, db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
    const before = contents(previous);
    store.close();
    store = openPilotDatabase(file);
    assert.deepEqual(contents(store.sqlite), before, "les tables antérieures sont inchangées après la migration 0004");
    assert.deepEqual(store.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    const student = await client(store.DB);
    await student.call(`/${firstGrid.id}/complete`, payload({ progress: solved(), hintCount: 3 }));
    store.close();
    store = openPilotDatabase(file);
    const restored = await client(store.DB);
    const result = await restored.call();
    assert.equal(result.data.xpTotal, 20);
    assert.equal(result.data.grids[0].hintCount, 3);
    assert.deepEqual(result.data.grids[0].progress, solved());
  } finally {
    store.close();
    for (const suffix of ["", "-wal", "-shm"]) { try { unlinkSync(file + suffix); } catch (error) { if (error.code !== "ENOENT") throw error; } }
  }
});
