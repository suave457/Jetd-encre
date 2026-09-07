import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { sqliteBinding, seedLocalPilot } from "../scripts/pilot-local-store.mjs";
import { handlePilot } from "../worker/pilot/api.js";
import { issueSession, now } from "../worker/pilot/session.js";
import { STUDENT_AVATARS, isStudentAvatar, updateStudentSessionAvatar, mergeStudentSessionRead } from "../src/features/student/studentProfileCore.js";

const origin = "http://127.0.0.1:5173";
const directory = new URL("../drizzle/", import.meta.url);
const migrationFiles = () => readdirSync(directory).filter(name => name.endsWith(".sql")).sort();
const migrationSql = name => readFileSync(new URL(name, directory), "utf8");
function setup(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const name of migrationFiles()) sqlite.exec(migrationSql(name));
  seedLocalPilot(sqlite);
  t.after(() => sqlite.close());
  return { sqlite, DB: sqliteBinding(sqlite) };
}
async function client(DB, id = "pilot-a-student") {
  const session = await issueSession(DB, id, "local_fixture", true);
  const cookie = session.cookie.split(";")[0];
  return {
    async call(body, { binding = DB, headers = {}, method = body === undefined ? "GET" : "POST", query = "", path = "/student/profile" } = {}) {
      const response = await handlePilot(new Request(origin + "/api/pilot" + path + query, {
        method, headers: { cookie, origin, "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken, ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }), { DB: binding }, { local: true });
      return { status: response.status, data: await response.json(), headers: response.headers };
    },
  };
}
function snapshot(sqlite) {
  return Object.fromEntries(sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, sqlite.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '" ORDER BY rowid').all().map(row => ({ ...row }))]));
}
function beforeSql(DB, predicate, mutate) {
  let changed = false;
  return {
    binding: { ...DB, prepare(sql) {
      if (!changed && predicate(sql)) { changed = true; mutate(); }
      return DB.prepare(sql);
    } },
    changed: () => changed,
  };
}
const revocations = [
  "UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'",
  "UPDATE pilot_memberships SET role='parent' WHERE user_id='pilot-a-student'",
  "UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'",
  "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'",
  "UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'",
  "INSERT INTO pilot_admins(user_id) VALUES ('pilot-a-student')",
];

test("avatar : seulement les pictogrammes existants et les initiales, ni fichier ni URL", () => {
  assert.deepEqual(STUDENT_AVATARS.map(item => item.id), ["initials", "sparkle", "book", "trophy", "pencil"]);
  assert.ok(Object.isFrozen(STUDENT_AVATARS));
  assert.ok(STUDENT_AVATARS.every(Object.isFrozen));
  for (const { id } of STUDENT_AVATARS) assert.equal(isStudentAvatar(id), true);
  for (const value of [null, undefined, 0, {}, [], "", "BOOK", "https://example.test/avatar.png", "data:image/png;base64,AA=="])
    assert.equal(isStudentAvatar(value), false);
});

test("profil : initiales par défaut, aucun enregistrement créé par une lecture", async t => {
  const { DB, sqlite } = setup(t), actor = await client(DB), before = snapshot(sqlite);
  const result = await actor.call(undefined, { query: "?avatar=trophy&studentId=pilot-a-other&schoolId=pilot-school-b" });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.deepEqual(result.data, { userId: "pilot-a-student", schoolId: "pilot-school-a", avatar: "initials", updatedAt: null });
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(snapshot(sqlite), before);
  assert.deepEqual(snapshot(sqlite).pilot_student_profiles, []);
});

test("avatar : choix enregistré, reconnexion persistante, rejeu sans écriture ni changement d’identité", async t => {
  const { DB, sqlite } = setup(t), actor = await client(DB), initial = snapshot(sqlite);
  for (const { id } of STUDENT_AVATARS) {
    const result = await actor.call({ avatar: id });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.avatar, id);
    assert.equal(result.data.userId, "pilot-a-student");
    assert.equal(result.data.schoolId, "pilot-school-a");
    assert.equal(result.data.changed, true);
    assert.ok(result.data.updatedAt > 0);
    const beforeReplay = snapshot(sqlite), replay = await actor.call({ avatar: id });
    assert.equal(replay.status, 200);
    assert.equal(replay.data.changed, false);
    assert.equal(replay.data.updatedAt, result.data.updatedAt);
    assert.deepEqual(snapshot(sqlite), beforeReplay);
    const fresh = await client(DB), beforeRead = snapshot(sqlite), read = await fresh.call();
    assert.equal(read.status, 200);
    const { changed, ...persisted } = result.data;
    assert.deepEqual(read.data, persisted);
    assert.deepEqual(snapshot(sqlite), beforeRead);
  }
  const after = snapshot(sqlite);
  for (const [table, rows] of Object.entries(initial))
    if (!["pilot_student_profiles", "pilot_sessions"].includes(table)) assert.deepEqual(after[table], rows, table);
  assert.equal(after.pilot_student_profiles.length, 1);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});

test("profil : isolation entre élèves, écoles et rattachements successifs du même compte", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB), other = await client(DB, "pilot-a-other"), foreign = await client(DB, "pilot-b-student");
  await student.call({ avatar: "book" }); await other.call({ avatar: "pencil" }); await foreign.call({ avatar: "trophy" });
  for (const [actor, avatar] of [[student, "book"], [other, "pencil"], [foreign, "trophy"]]) assert.equal((await actor.call()).data.avatar, avatar);
  sqlite.exec("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-b','pilot-a-student','eleve'); UPDATE pilot_memberships SET active=0 WHERE school_id='pilot-school-a' AND user_id='pilot-a-student'");
  const moved = await client(DB), first = await moved.call();
  assert.equal(first.status, 200); assert.equal(first.data.schoolId, "pilot-school-b"); assert.equal(first.data.avatar, "initials");
  assert.equal((await moved.call({ avatar: "sparkle" })).status, 200);
  assert.equal(sqlite.prepare("SELECT avatar FROM pilot_student_profiles WHERE school_id='pilot-school-a' AND student_id='pilot-a-student'").get().avatar, "book");
  assert.equal(sqlite.prepare("SELECT avatar FROM pilot_student_profiles WHERE school_id='pilot-school-b' AND student_id='pilot-a-student'").get().avatar, "sparkle");
  assert.equal((await foreign.call()).data.avatar, "trophy");
});

test("profil : champs d’identité, rôle, école, URL et formats non permis refusés avant toute écriture", async t => {
  const { DB, sqlite } = setup(t), actor = await client(DB), before = snapshot(sqlite);
  for (const extra of [{ userId: "pilot-a-other" }, { studentId: "pilot-a-other" }, { schoolId: "pilot-school-b" }, { role: "admin" }, { photo: "new.png" }, { email: "new@example.test" }])
    assert.equal((await actor.call({ avatar: "book", ...extra })).status, 422);
  for (const avatar of [undefined, null, 1, "", " book ", "BOOK", "unknown", "https://example.test/image.png", "data:image/png;base64,AA==", "<script>"])
    assert.equal((await actor.call({ avatar })).status, 422);
  for (const body of [null, [], "book"]) assert.equal((await actor.call(body)).status, 400);
  assert.deepEqual(snapshot(sqlite), before);
});

test("profil : enseignant, parent, directeur et administrateur ne disposent pas d’un profil élève", async t => {
  const { DB, sqlite } = setup(t);
  for (const id of ["pilot-a-teacher", "pilot-a-parent", "pilot-local-admin"]) {
    const actor = await client(DB, id);
    assert.equal((await actor.call()).status, 403, id);
    assert.equal((await actor.call({ avatar: "book" })).status, 403, id);
  }
  sqlite.exec("UPDATE pilot_memberships SET role='directeur' WHERE user_id='pilot-a-parent'");
  const director = await client(DB, "pilot-a-parent");
  assert.equal((await director.call()).status, 403); assert.equal((await director.call({ avatar: "book" })).status, 403);
  sqlite.exec("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-a','pilot-local-admin','eleve')");
  const overlap = await client(DB, "pilot-local-admin"), result = await overlap.call({ avatar: "book" });
  assert.equal(result.status, 403); assert.equal(result.data.error.code, "profile_mismatch");
  assert.equal((await overlap.call()).status, 403);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_student_profiles").get().n, 0);
});

test("profil : session et protection CSRF obligatoires, aucune modification par méthode inattendue", async t => {
  const { DB, sqlite } = setup(t), actor = await client(DB), before = snapshot(sqlite);
  for (const method of ["GET", "POST"]) {
    const result = await handlePilot(new Request(origin + "/api/pilot/student/profile", {
      method, headers: { origin, "Content-Type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify({ avatar: "book" }) } : {}),
    }), { DB }, { local: true });
    assert.equal(result.status, 401);
  }
  for (const headers of [{ "X-CSRF-Token": "" }, { "X-CSRF-Token": "forged" }, { origin: "https://evil.example" }, { "Sec-Fetch-Site": "cross-site" }])
    assert.equal((await actor.call({ avatar: "book" }, { headers })).status, 403);
  for (const method of ["PUT", "DELETE", "PATCH"]) assert.equal((await actor.call({ avatar: "book" }, { method })).status, 405);
  assert.deepEqual(snapshot(sqlite), before);
});

test("profil : sessions révoquées ou expirées refusées sans exposition de l’avatar enregistré", async t => {
  for (const mutate of ["UPDATE pilot_sessions SET revoked_at=1", "UPDATE pilot_sessions SET expires_at=1"]) {
    const { DB, sqlite } = setup(t), actor = await client(DB);
    await actor.call({ avatar: "book" }); sqlite.exec(mutate);
    const before = snapshot(sqlite);
    for (const body of [undefined, { avatar: "pencil" }]) {
      const response = await actor.call(body);
      assert.equal(response.status, 401); assert.equal(response.data.avatar, undefined);
    }
    assert.deepEqual(snapshot(sqlite), before);
  }
});

test("profil : rattachement, école ou compte retirés refusés dès la requête", async t => {
  for (const mutation of revocations.filter(sql => !sql.includes("pilot_sessions"))) {
    const { DB, sqlite } = setup(t), actor = await client(DB);
    await actor.call({ avatar: "book" }); sqlite.exec(mutation);
    const before = snapshot(sqlite);
    for (const body of [undefined, { avatar: "pencil" }]) {
      const result = await actor.call(body);
      assert.ok([401,403].includes(result.status), mutation + ": " + result.status);
      assert.equal(result.data.avatar, undefined);
    }
    assert.deepEqual(snapshot(sqlite), before);
  }
});

test("profil : révocation au moment du SQL interdit aussi bien la création que la mise à jour", async t => {
  for (const existing of [false, true]) for (const mutation of revocations) {
    const { DB, sqlite } = setup(t), actor = await client(DB);
    if (existing) assert.equal((await actor.call({ avatar: "book" })).status, 200);
    const before = snapshot(sqlite).pilot_student_profiles;
    const changed = beforeSql(DB, sql => sql.startsWith("INSERT INTO pilot_student_profiles"), () => sqlite.exec(mutation));
    const result = await actor.call({ avatar: "pencil" }, { binding: changed.binding });
    assert.equal(changed.changed(), true);
    assert.equal(result.status, 403, mutation);
    assert.equal(result.data.avatar, undefined);
    assert.deepEqual(snapshot(sqlite).pilot_student_profiles, before, mutation);
  }
});

test("profil : révocation pendant lecture, garde finale avant tout résultat", async t => {
  for (const mutation of revocations) {
    const { DB, sqlite } = setup(t), actor = await client(DB);
    await actor.call({ avatar: "book" });
    const before = snapshot(sqlite).pilot_student_profiles;
    const changed = beforeSql(DB, sql => sql.startsWith("SELECT 1 allowed WHERE"), () => sqlite.exec(mutation));
    const result = await actor.call(undefined, { binding: changed.binding });
    assert.equal(changed.changed(), true); assert.equal(result.status, 403);
    assert.equal(result.data.avatar, undefined);
    assert.deepEqual(snapshot(sqlite).pilot_student_profiles, before);
  }
});

test("migration avatar : données antérieures intactes, table non peuplée et contraintes effectives", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("PRAGMA foreign_keys=ON");
    for (const name of migrationFiles().filter(name => name < "0008")) sqlite.exec(migrationSql(name));
    seedLocalPilot(sqlite);
    sqlite.exec("INSERT INTO pilot_manuals(id,title,level,active) VALUES ('old-manual','Manuel antérieur','Test',1)");
    sqlite.exec("INSERT INTO pilot_manual_codes(id,school_id,manual_id,code_hash,created_by,created_at,student_id,activated_at) VALUES ('old-code','pilot-school-a','old-manual','" + "a".repeat(64) + "','pilot-local-admin',1,'pilot-a-student',1)");
    const before = snapshot(sqlite);
    sqlite.exec(migrationSql("0008_student_profiles.sql"));
    const after = snapshot(sqlite);
    for (const [table, rows] of Object.entries(before)) assert.deepEqual(after[table], rows, table);
    assert.deepEqual(after.pilot_student_profiles, []);
    const insert = sqlite.prepare("INSERT INTO pilot_student_profiles(school_id,student_id,avatar,updated_at) VALUES (?,?,?,?)");
    insert.run("pilot-school-a", "pilot-a-student", "book", now());
    assert.throws(() => insert.run("pilot-school-a", "pilot-a-student", "pencil", now()), /UNIQUE constraint failed/);
    assert.throws(() => insert.run("pilot-school-a", "pilot-a-other", "unknown", now()), /CHECK constraint failed/);
    assert.throws(() => insert.run("pilot-school-b", "pilot-a-other", "book", now()), /FOREIGN KEY constraint failed/);
    assert.throws(() => insert.run("pilot-school-a", "missing", "book", now()), /FOREIGN KEY constraint failed/);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { sqlite.close(); }
});

test("session élève : avatar persistant présent dès la connexion, aucune écriture GET", async t => {
  const { DB, sqlite } = setup(t), actor = await client(DB);
  const initial = await actor.call(undefined, { path: "/session", query: "?profil=eleve" });
  assert.equal(initial.status, 200); assert.equal(initial.data.user.avatar, "initials");
  assert.equal((await actor.call({ avatar: "trophy" })).status, 200);
  const fresh = await client(DB), before = snapshot(sqlite);
  const result = await fresh.call(undefined, { path: "/session", query: "?profil=eleve" });
  assert.equal(result.status, 200); assert.equal(result.data.authenticated, true);
  assert.equal(result.data.user.id, "pilot-a-student"); assert.equal(result.data.user.schoolId, "pilot-school-a");
  assert.equal(result.data.user.avatar, "trophy"); assert.ok(result.data.csrfToken);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(snapshot(sqlite), before);
});

test("session : aucun avatar élève transmis à un autre élève ou à un autre rôle", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB);
  await student.call({ avatar: "book" });
  for (const id of ["pilot-a-other", "pilot-b-student"]) {
    const result = await (await client(DB, id)).call(undefined, { path: "/session" });
    assert.equal(result.status, 200); assert.equal(result.data.user.id, id); assert.equal(result.data.user.avatar, "initials");
  }
  for (const id of ["pilot-a-teacher", "pilot-a-parent", "pilot-local-admin"]) {
    const actor = await client(DB, id), result = await actor.call(undefined, { path: "/session" });
    assert.equal(result.status, 200); assert.equal(Object.hasOwn(result.data.user, "avatar"), false);
    const mismatch = await actor.call(undefined, { path: "/session", query: "?profil=eleve" });
    assert.equal(mismatch.status, 403); assert.equal(mismatch.data.user, undefined);
  }
  sqlite.exec("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-a','pilot-local-admin','eleve')");
  const admin = await client(DB, "pilot-local-admin"), result = await admin.call(undefined, { path: "/session" });
  assert.equal(result.data.user.role, "admin"); assert.equal(Object.hasOwn(result.data.user, "avatar"), false);
});

test("session avatar : droits révoqués pendant la lecture ne renvoient aucune identité", async t => {
  for (const mutation of revocations) {
    const { DB, sqlite } = setup(t), actor = await client(DB);
    await actor.call({ avatar: "book" });
    const changed = beforeSql(DB, sql => sql.startsWith("SELECT 1 allowed WHERE"), () => sqlite.exec(mutation));
    const result = await actor.call(undefined, { path: "/session", binding: changed.binding });
    assert.equal(changed.changed(), true); assert.equal(result.status, 403);
    assert.equal(result.data.user, undefined); assert.equal(result.data.avatar, undefined);
  }
});

test("en-tête : confirmation avatar met seulement à jour la présentation de la session", () => {
  const user = Object.freeze({ id: "student", schoolId: "school", role: "eleve", name: "Lina", avatar: "initials" });
  const current = Object.freeze({ authenticated: true, csrfToken: "unchanged-csrf", mode: "local_fixture", user });
  const profile = { userId: "student", schoolId: "school", avatar: "book" };
  const next = updateStudentSessionAvatar(current, profile);
  assert.deepEqual(next, { ...current, user: { ...user, avatar: "book" } });
  assert.equal(current.user.avatar, "initials");
  assert.equal(updateStudentSessionAvatar(next, profile), next, "Le rejeu conserve la référence, sans réinitialisation.");
  for (const change of [{ userId: "another" }, { schoolId: "another" }, { avatar: "https://example.test/photo" }, { avatar: null }])
    assert.equal(updateStudentSessionAvatar(current, { ...profile, ...change }), current);
  for (const changed of [null, { ...current, authenticated: false }, { ...current, user: { ...user, role: "admin" } }])
    assert.equal(updateStudentSessionAvatar(changed, profile), changed);
});

test("en-tête : une lecture de session ancienne ne remplace pas un avatar confirmé ensuite", () => {
  const current = { authenticated: true, csrfToken: "old-token", user: { id: "student", schoolId: "school", role: "eleve", avatar: "book" } };
  const incoming = { authenticated: true, csrfToken: "fresh-token", user: { ...current.user, name: "Lina", avatar: "initials" } };
  const result = mergeStudentSessionRead(incoming, current, 0, 1);
  assert.deepEqual(result, { ...incoming, user: { ...incoming.user, avatar: "book" } });
  assert.equal(result.csrfToken, "fresh-token", "La vraie session reçue reste la source du jeton CSRF.");
  assert.equal(mergeStudentSessionRead(incoming, current, 1, 1), incoming, "Une nouvelle lecture garde les changements reçus du serveur.");
  for (const changed of [
    { authenticated: false },
    { ...incoming, user: { ...incoming.user, id: "another" } },
    { ...incoming, user: { ...incoming.user, schoolId: "another" } },
    { ...incoming, user: { ...incoming.user, role: "admin" } },
  ]) assert.equal(mergeStudentSessionRead(changed, current, 0, 1), changed, "Aucune confirmation ancienne transférée à une autre identité.");
  assert.equal(mergeStudentSessionRead(incoming, null, 0, 1), incoming);
});
