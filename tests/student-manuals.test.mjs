import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { openPilotDatabase, seedLocalPilot } from "../scripts/pilot-local-store.mjs";
import { handleLocalPilot } from "../scripts/pilot-local-api.mjs";
import { hash, issueSession, now } from "../worker/pilot/session.js";

const origin = "http://127.0.0.1:5173";
const manualId = "manual-in-memory-test";
const activate = "/manuals/activate";
const issue = "/admin/manual-codes";
const invalidCode = "JDE-00000000-00000000-00000000-00000000";

test('émission : une confirmation perdue reste consultable après la date limite du code',async t=>{
 const {DB,sqlite}=setup(t),admin=await client(DB,'pilot-local-admin');
 const result=await issued(admin,{expiresAt:now()+3600});
 const expired=now()-3600;sqlite.prepare('UPDATE pilot_manual_codes SET expires_at=? WHERE id=?').run(expired,result.id);
 const replay=await admin.call(issue,{id:result.id,schoolId:'pilot-school-a',manualId,expiresAt:expired});
 assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);assert.equal(replay.data.code,null);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_manual_codes').get().n,1);
 assert.equal((await admin.call(issue,{id:crypto.randomUUID(),schoolId:'pilot-school-a',manualId,expiresAt:expired})).status,422);
});

test('administration manuels : inventaire sans secrets, vrais compteurs et droits réservés',async t=>{
 const {DB}=setup(t),admin=await client(DB,'pilot-local-admin'),student=await client(DB);
 const secret=await issued(admin),list=await admin.call('/admin/manuals');
 assert.equal(list.status,200);assert.equal(list.data.userId,'pilot-local-admin');
 assert.equal(list.data.manuals.length,1);assert.equal(list.data.codes.length,1);
 assert.deepEqual(list.data.counts,{total:1,revoked:0,activated:0,available:1,expired:0});
 assert.equal(JSON.stringify(list.data).includes(secret.code),false);
 assert.equal(JSON.stringify(list.data).includes('code_hash'),false);
 for(const id of ['pilot-a-student','pilot-a-parent','pilot-a-teacher'])assert.equal((await (await client(DB,id)).call('/admin/manuals')).status,403);
 assert.equal((await student.call(activate,{code:secret.code})).status,201);
 assert.equal((await admin.call('/admin/manuals')).data.counts.activated,1);
});

test('administration manuels : révocation confirmée, idempotente et accès retiré',async t=>{
 const {DB,sqlite}=setup(t),admin=await client(DB,'pilot-local-admin'),student=await client(DB);
 const secret=await issued(admin);await student.call(activate,{code:secret.code});
 assert.equal((await admin.call('/admin/manual-code-revoke',{id:secret.id})).status,200);
 assert.equal((await admin.call('/admin/manual-code-revoke',{id:secret.id})).data.replayed,true);
 assert.equal((await student.call()).data.manuals.length,0);
 assert.equal((await student.call(activate,{code:secret.code})).status,422);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_admin_events WHERE action='manual_code_revoked'").get().n,1);
 assert.equal((await admin.call('/admin/manuals')).data.counts.revoked,1);
 assert.equal((await admin.call('/admin/manual-code-revoke',{id:secret.id,studentId:'pilot-b-student'})).status,422);
});

test('administration manuels : révocation pendant la lecture refuse toute donnée',async t=>{
 const {DB,sqlite}=setup(t),admin=await client(DB,'pilot-local-admin');await issued(admin);
 const change=beforeSql(DB,sql=>sql.includes('FROM pilot_manual_codes code JOIN pilot_manuals'),()=>sqlite.exec("UPDATE pilot_admins SET active=0 WHERE user_id='pilot-local-admin'"));
 const result=await admin.call('/admin/manuals',undefined,{binding:change.binding});
 assert.equal(change.wasChanged(),true);assert.equal(result.status,403);assert.equal(result.data.codes,undefined);
});

function setup(t, { catalogue = true } = {}) {
  const store = openPilotDatabase();
  seedLocalPilot(store.sqlite);
  if (catalogue) store.sqlite.prepare("INSERT INTO pilot_manuals(id,title,level,active) VALUES (?,?,?,1)")
    .run(manualId, "Manuel fictif en mémoire · non publié", "5e AEP · test");
  t.after(() => store.close());
  return store;
}

async function client(db, id = "pilot-a-student") {
  const session = await issueSession(db, id, "local_fixture", true);
  const cookie = session.cookie.split(";")[0];
  return {
    async call(path = "/manuals", body, { binding = db, headers = {} } = {}) {
      const response = await handleLocalPilot(new Request(origin + "/api/pilot" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { cookie, origin, "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken, ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }), binding);
      return { status: response.status, data: await response.json(), headers: response.headers };
    },
  };
}

async function issued(admin, extra = {}) {
  const input = { id: crypto.randomUUID(), schoolId: "pilot-school-a", manualId, expiresAt: null, ...extra };
  const result = await admin.call(issue, input);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.match(result.data.code, /^JDE-(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/);
  return { ...result.data, input };
}

function snapshot(sqlite) {
  return Object.fromEntries(sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, sqlite.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all().map(row => ({ ...row }))]));
}

function beforeSql(db, predicate, change) {
  let changed = false;
  return {
    binding: { ...db, prepare(sql) {
      if (!changed && predicate(sql)) { changed = true; change(); }
      return db.prepare(sql);
    } },
    wasChanged: () => changed,
  };
}

test("manuels : catalogue vide par défaut, aucune publication ou licence inventée", async t => {
  const { DB, sqlite } = setup(t, { catalogue: false }), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_manuals").get().n, 0);
  const before = snapshot(sqlite), list = await student.call();
  assert.equal(list.status, 200);
  assert.deepEqual(list.data, { userId: "pilot-a-student", schoolId: "pilot-school-a", manuals: [] });
  assert.deepEqual(snapshot(sqlite), before);
  const unavailable = await admin.call(issue, { id: crypto.randomUUID(), schoolId: "pilot-school-a", manualId, expiresAt: null });
  assert.equal(unavailable.status, 409);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_manual_codes").get().n, 0);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_admin_events").get().n, 0);
  assert.equal((await admin.call("/manuals", { id: manualId, title: "Publication interdite" })).status, 403);
});

test("activation : une confirmation perdue au dixième essai reste rejouable sans nouveau quota ni attribution",async t=>{
  const {DB,sqlite}=setup(t),admin=await client(DB,'pilot-local-admin'),student=await client(DB);
  const token=await issued(admin);
  for(let index=0;index<9;index++)assert.equal((await student.call(activate,{code:invalidCode})).status,422);
  const first=await student.call(activate,{code:token.code});
  assert.equal(first.status,201);
  const response=await student.call(activate,{code:token.code});
  assert.equal(response.status,200);assert.equal(response.data.replayed,true);
  assert.deepEqual(response.data.manual,first.data.manual);
  assert.equal(sqlite.prepare('SELECT attempts FROM pilot_manual_attempts').get().attempts,10);
  assert.equal((await student.call(activate,{code:invalidCode})).status,429);
  assert.equal((await student.call()).data.manuals.length,1);
});

test("codes administrateur : secret à usage de remise, seul son condensat enregistré et rejeu sans réaffichage", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin");
  const first = await issued(admin), second = await issued(admin);
  assert.notEqual(first.code, second.code);
  const stored = sqlite.prepare("SELECT * FROM pilot_manual_codes WHERE id=?").get(first.id);
  assert.equal(stored.code_hash, await hash(first.code));
  assert.equal(stored.student_id, null);
  assert.equal(stored.activated_at, null);
  assert.equal(stored.created_by, "pilot-local-admin");
  assert.equal(stored.school_id, "pilot-school-a");
  assert.equal(stored.manual_id, manualId);
  assert.equal(stored.expires_at, null);
  assert.equal(JSON.stringify(snapshot(sqlite)).includes(first.code), false, "Ni table ni journal ne stocke le code secret.");
  const before = snapshot(sqlite), replay = await admin.call(issue, first.input);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.code, null);
  assert.deepEqual(snapshot(sqlite), before);
  for (const extra of [{ schoolId: "pilot-school-b" }, { manualId: "another-manual" }, { expiresAt: now() + 3600 }])
    assert.equal((await admin.call(issue, { ...first.input, ...extra })).status, 409);
  const events = sqlite.prepare("SELECT action,target_id FROM pilot_admin_events ORDER BY rowid").all();
  assert.deepEqual(events.map(event => event.action), ["manual_code_issued", "manual_code_issued"]);
  assert.deepEqual(events.map(event => event.target_id), [first.id, second.id]);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});

test("activation : compte élève existant uniquement, attribution persistante et aucune création ni changement d’identité", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
  const token = await issued(admin), before = snapshot(sqlite);
  const result = await student.call(activate, { code: "  " + token.code.toLowerCase().replaceAll("-", "- ") + "  " });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.replayed, false);
  assert.equal(result.data.userId, "pilot-a-student");
  assert.equal(result.data.schoolId, "pilot-school-a");
  assert.deepEqual(Object.keys(result.data.manual).sort(), ["activatedAt", "id", "level", "manualId", "title"]);
  assert.equal(result.data.manual.id, token.id);
  assert.equal(result.data.manual.manualId, manualId);
  assert.equal(result.data.manual.title, "Manuel fictif en mémoire · non publié");
  assert.ok(result.data.manual.activatedAt > 0);
  const stored = sqlite.prepare("SELECT student_id,activated_at FROM pilot_manual_codes WHERE id=?").get(token.id);
  assert.equal(stored.student_id, "pilot-a-student");
  assert.equal(stored.activated_at, result.data.manual.activatedAt);
  for (const table of ["pilot_users", "pilot_memberships", "pilot_identities", "pilot_admins", "pilot_class_members", "pilot_schools", "pilot_family_links"])
    assert.deepEqual(snapshot(sqlite)[table], before[table], table);
  const fresh = await client(DB), beforeRead = snapshot(sqlite), list = await fresh.call();
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.manuals, [result.data.manual]);
  assert.equal(list.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(snapshot(sqlite), beforeRead);
  assert.equal(JSON.stringify(list.data).includes(token.code), false);
  assert.equal(JSON.stringify(list.data).includes(await hash(token.code)), false);
  const replay = await fresh.call(activate, { code: token.code });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.deepEqual(replay.data.manual, result.data.manual);
});

test("activation : même classe et autre école ne peuvent ni lire ni récupérer le manuel d’un autre élève", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
  const sameClass = await client(DB, "pilot-a-other"), otherSchool = await client(DB, "pilot-b-student");
  const token = await issued(admin);
  assert.equal((await student.call(activate, { code: token.code })).status, 201);
  const used = await sameClass.call(activate, { code: token.code });
  assert.equal(used.status, 409);
  assert.equal(used.data.error.code, "code_used");
  assert.equal(used.data.manual, undefined);
  const foreign = await otherSchool.call(activate, { code: token.code });
  assert.equal(foreign.status, 422);
  assert.equal(foreign.data.error.code, "code_invalid");
  assert.equal(foreign.data.manual, undefined);
  for (const actor of [sameClass, otherSchool]) assert.deepEqual((await actor.call()).data.manuals, []);
  const unclaimed = await issued(admin);
  assert.equal((await otherSchool.call(activate, { code: unclaimed.code })).status, 422);
  assert.equal(sqlite.prepare("SELECT student_id FROM pilot_manual_codes WHERE id=?").get(unclaimed.id).student_id, null);
});

test("activation : un seul droit par manuel, deuxième code non consommé et concurrence sans doublon", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
  const first = await issued(admin), second = await issued(admin);
  const results = await Promise.all([student.call(activate, { code: first.code }), student.call(activate, { code: second.code })]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 201]);
  assert.equal(new Set(results.map(result => result.data.manual.id)).size, 1);
  const claimed = sqlite.prepare("SELECT id FROM pilot_manual_codes WHERE student_id='pilot-a-student'").all();
  assert.equal(claimed.length, 1);
  const unused = claimed[0].id === first.id ? second : first;
  const remaining = sqlite.prepare("SELECT student_id,activated_at FROM pilot_manual_codes WHERE id=?").get(unused.id);
  assert.equal(remaining.student_id, null);
  assert.equal(remaining.activated_at, null);
  const other = await client(DB, "pilot-a-other");
  assert.equal((await other.call(activate, { code: unused.code })).status, 201, "Le deuxième code reste utilisable par un autre élève autorisé.");
  const sameReplay = await Promise.all([student.call(activate, { code: first.code }), student.call(activate, { code: second.code })]);
  assert.deepEqual(sameReplay.map(result => result.status).sort(), [200, 409]);
  assert.equal((await student.call()).data.manuals.length, 1);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});

test("activation : même code présenté simultanément ne délivre qu’un seul droit", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
  const token = await issued(admin);
  const responses = await Promise.all([student.call(activate, { code: token.code }), student.call(activate, { code: token.code })]);
  assert.deepEqual(responses.map(result => result.status).sort(), [200, 201]);
  assert.deepEqual(responses.map(result => result.data.replayed).sort(), [false, true]);
  assert.equal(new Set(responses.map(result => result.data.manual.activatedAt)).size, 1);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_manual_codes WHERE student_id IS NOT NULL").get().n, 1);
});

test("codes : date expirée, révocation et catalogue inactif interdisent toute nouvelle attribution", async t => {
  for (const [kind, mutate, expected] of [
    ["expiré", (db, id) => db.prepare("UPDATE pilot_manual_codes SET expires_at=1 WHERE id=?").run(id), 410],
    ["révoqué", (db, id) => db.prepare("UPDATE pilot_manual_codes SET revoked_at=1 WHERE id=?").run(id), 422],
    ["manuel inactif", db => db.prepare("UPDATE pilot_manuals SET active=0").run(), 422],
  ]) {
    const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
    const token = await issued(admin, { expiresAt: now() + 3600 });
    mutate(sqlite, token.id);
    const result = await student.call(activate, { code: token.code });
    assert.equal(result.status, expected, kind);
    assert.equal(result.data.manual, undefined);
    assert.equal(sqlite.prepare("SELECT student_id FROM pilot_manual_codes WHERE id=?").get(token.id).student_id, null);
    assert.deepEqual((await student.call()).data.manuals, []);
  }
});

test("manuel acquis : expiration du code ne supprime pas le droit, révocation le retire", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
  const token = await issued(admin, { expiresAt: now() + 3600 });
  assert.equal((await student.call(activate, { code: token.code })).status, 201);
  sqlite.prepare("UPDATE pilot_manual_codes SET expires_at=1 WHERE id=?").run(token.id);
  assert.equal((await student.call(activate, { code: token.code })).status, 200);
  assert.equal((await student.call()).data.manuals.length, 1);
  sqlite.prepare("UPDATE pilot_manual_codes SET revoked_at=1 WHERE id=?").run(token.id);
  assert.equal((await student.call(activate, { code: token.code })).status, 422);
  assert.deepEqual((await student.call()).data.manuals, []);
  const replacement = await issued(admin);
  assert.equal((await student.call(activate, { code: replacement.code })).status, 201);
  assert.deepEqual((await student.call()).data.manuals.map(item => item.id), [replacement.id]);
});

test("activation : absence de session, CSRF ou origine tierce ne touche ni codes ni quota", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB);
  const token = await issued(admin), before = snapshot(sqlite);
  for (const path of ["/manuals", activate]) {
    const result = await handleLocalPilot(new Request(origin + "/api/pilot" + path, {
      method: path === activate ? "POST" : "GET", headers: { origin, "Content-Type": "application/json" },
      ...(path === activate ? { body: JSON.stringify({ code: token.code }) } : {}),
    }), DB);
    assert.equal(result.status, 401);
  }
  for (const headers of [{ "X-CSRF-Token": "" }, { "X-CSRF-Token": "forged" }, { origin: "https://evil.example" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await student.call(activate, { code: token.code }, { headers })).status, 403);
    assert.equal((await admin.call(issue, { id: crypto.randomUUID(), schoolId: "pilot-school-a", manualId, expiresAt: null }, { headers })).status, 403);
  }
  assert.deepEqual(snapshot(sqlite), before);
});

test("activation : refus des rôles autres qu’élève, même administrateur avec rattachement élève", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), token = await issued(admin);
  for (const id of ["pilot-a-parent", "pilot-a-teacher", "pilot-local-admin"]) {
    const actor = await client(DB, id);
    assert.equal((await actor.call()).status, 403, id);
    assert.equal((await actor.call(activate, { code: token.code })).status, 403, id);
    if (id !== "pilot-local-admin") assert.equal((await actor.call(issue, token.input)).status, 403, id);
  }
  sqlite.prepare("UPDATE pilot_memberships SET role='directeur' WHERE user_id='pilot-a-parent'").run();
  const director = await client(DB, "pilot-a-parent");
  assert.equal((await director.call(activate, { code: token.code })).status, 403);
  sqlite.prepare("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-a','pilot-local-admin','eleve')").run();
  const overlap = await client(DB, "pilot-local-admin");
  const denied = await overlap.call(activate, { code: token.code });
  assert.equal(denied.status, 403);
  assert.equal(denied.data.error.code, "profile_mismatch");
  assert.equal(sqlite.prepare("SELECT student_id FROM pilot_manual_codes WHERE id=?").get(token.id).student_id, null);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_manual_attempts").get().n, 0);
});

test("activation : aucune identité ni école choisie par le formulaire, champs et codes invalides refusés", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB), token = await issued(admin);
  const before = snapshot(sqlite);
  for (const extra of [{ userId: "pilot-a-other" }, { studentId: "pilot-a-other" }, { schoolId: "pilot-school-b" }, { role: "admin" }, { manualId }, { email: "new@example.test" }])
    assert.equal((await student.call(activate, { code: token.code, ...extra })).status, 422);
  for (const code of [undefined, null, 123, "", " ", "A".repeat(101)])
    assert.equal((await student.call(activate, { code })).status, 422);
  assert.deepEqual(snapshot(sqlite), before, "Les champs invalides sont rejetés avant les écritures.");
  for (const code of ["JDE-DEMO-2026", "<script>", invalidCode]) {
    const result = await student.call(activate, { code });
    assert.equal(result.status, 422);
    assert.equal(result.data.error.code, "code_invalid");
  }
  assert.equal(sqlite.prepare("SELECT student_id FROM pilot_manual_codes WHERE id=?").get(token.id).student_id, null);
  for (const table of ["pilot_users", "pilot_memberships", "pilot_identities", "pilot_admins"])
    assert.deepEqual(snapshot(sqlite)[table], before[table]);
});

test("quota activation : dix essais maximum même en concurrence, compte et école indépendants", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB);
  const results = await Promise.all(Array.from({ length: 15 }, () => student.call(activate, { code: invalidCode })));
  assert.equal(results.filter(result => result.status === 422).length, 10);
  assert.equal(results.filter(result => result.status === 429).length, 5);
  assert.equal(sqlite.prepare("SELECT attempts FROM pilot_manual_attempts WHERE student_id='pilot-a-student'").get().attempts, 10);
  const sameSchool = await client(DB, "pilot-a-other"), otherSchool = await client(DB, "pilot-b-student");
  assert.equal((await sameSchool.call(activate, { code: invalidCode })).status, 422);
  assert.equal((await otherSchool.call(activate, { code: invalidCode })).status, 422);
  // Local SQL fixture only: the same existing identity moves to another active school context.
  sqlite.prepare("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-b','pilot-a-student','eleve')").run();
  sqlite.prepare("UPDATE pilot_memberships SET active=0 WHERE school_id='pilot-school-a' AND user_id='pilot-a-student'").run();
  const moved = await client(DB);
  assert.equal((await moved.call(activate, { code: invalidCode })).status, 422);
  const quotas = sqlite.prepare("SELECT school_id,student_id,attempts FROM pilot_manual_attempts ORDER BY school_id,student_id").all();
  assert.deepEqual(quotas.map(row => [row.school_id, row.student_id, row.attempts]), [
    ["pilot-school-a", "pilot-a-other", 1], ["pilot-school-a", "pilot-a-student", 10],
    ["pilot-school-b", "pilot-a-student", 1], ["pilot-school-b", "pilot-b-student", 1],
  ]);
});

test("quota activation : nouvelle période ouvre dix essais, horloge reculée ne réinitialise pas la limite", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB);
  const bucket = Math.floor(now() / 900);
  sqlite.prepare("INSERT INTO pilot_manual_attempts(school_id,student_id,bucket,attempts) VALUES ('pilot-school-a','pilot-a-student',?,10)").run(bucket - 1);
  assert.equal((await student.call(activate, { code: invalidCode })).status, 422);
  assert.deepEqual(Object.values(sqlite.prepare("SELECT bucket,attempts FROM pilot_manual_attempts").get()), [bucket, 1]);
  for (let attempt = 1; attempt < 10; attempt++) assert.equal((await student.call(activate, { code: invalidCode })).status, 422);
  assert.equal((await student.call(activate, { code: invalidCode })).status, 429);
  sqlite.prepare("UPDATE pilot_manual_attempts SET bucket=?,attempts=10").run(bucket + 1);
  assert.equal((await student.call(activate, { code: invalidCode })).status, 429);
  assert.deepEqual(Object.values(sqlite.prepare("SELECT bucket,attempts FROM pilot_manual_attempts").get()), [bucket + 1, 10]);
});

test("activation : révocation entre validation et attribution ne consomme pas le code", async t => {
  for (const mutation of [
    "UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_memberships SET role='parent' WHERE user_id='pilot-a-student'",
    "UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'",
    "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'",
    "INSERT INTO pilot_admins(user_id) VALUES ('pilot-a-student')",
  ]) {
    const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB), token = await issued(admin);
    const change = beforeSql(DB, sql => sql.startsWith("UPDATE pilot_manual_codes SET student_id"), () => sqlite.exec(mutation));
    const result = await student.call(activate, { code: token.code }, { binding: change.binding });
    assert.equal(change.wasChanged(), true);
    assert.ok([401, 403, 422].includes(result.status), mutation + ": " + result.status);
    assert.equal(result.data.manual, undefined);
    const stored = sqlite.prepare("SELECT student_id,activated_at FROM pilot_manual_codes WHERE id=?").get(token.id);
    assert.equal(stored.student_id, null, mutation);
    assert.equal(stored.activated_at, null, mutation);
  }
});

test("manuels : révocation pendant une lecture refuse le résultat entier sans écriture GET", async t => {
  for (const mutation of [
    "UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'",
    "INSERT INTO pilot_admins(user_id) VALUES ('pilot-a-student')",
  ]) {
    const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin"), student = await client(DB), token = await issued(admin);
    assert.equal((await student.call(activate, { code: token.code })).status, 201);
    let checks = 0;
    const change = beforeSql(DB, sql => sql.startsWith("SELECT 1 allowed WHERE") && ++checks === 2, () => sqlite.exec(mutation));
    const result = await student.call("/manuals", undefined, { binding: change.binding });
    assert.equal(change.wasChanged(), true);
    assert.equal(result.status, 403, mutation);
    assert.equal(result.data.manuals, undefined);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_manual_codes WHERE student_id IS NOT NULL").get().n, 1);
  }
});

test("émission administrateur : droits retirés avant le lot SQL ne créent ni code ni journal", async t => {
  for (const mutation of [
    "UPDATE pilot_admins SET active=0 WHERE user_id='pilot-local-admin'",
    "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-local-admin'",
    "UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'",
    "UPDATE pilot_manuals SET active=0",
  ]) {
    const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin");
    let changed = false;
    const binding = { ...DB, async batch(statements) { changed = true; sqlite.exec(mutation); return DB.batch(statements); } };
    const result = await admin.call(issue, { id: crypto.randomUUID(), schoolId: "pilot-school-a", manualId, expiresAt: null }, { binding });
    assert.equal(changed, true);
    assert.equal(result.status, 409, mutation);
    assert.equal(result.data.code, undefined);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_manual_codes").get().n, 0);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_admin_events").get().n, 0);
  }
});

test("émission administrateur : saisies invalides et manuel ou école indisponibles ne créent rien", async t => {
  const { DB, sqlite } = setup(t), admin = await client(DB, "pilot-local-admin");
  const input = { id: crypto.randomUUID(), schoolId: "pilot-school-a", manualId, expiresAt: null };
  for (const extra of [{ id: "short" }, { id: "Z".repeat(36) }, { schoolId: "" }, { manualId: "" },
    { expiresAt: undefined }, { expiresAt: now() - 1 }, { expiresAt: "2027-01-01" }, { expiresAt: 1.5 }])
    assert.equal((await admin.call(issue, { ...input, ...extra })).status, 422);
  for (const extra of [{ schoolId: "missing-school" }, { manualId: "missing-manual" }])
    assert.equal((await admin.call(issue, { ...input, ...extra })).status, 409);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_manual_codes").get().n, 0);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_admin_events").get().n, 0);
});

test("migration manuels : toutes les données préexistantes conservées, catalogue vide et contraintes effectives", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("PRAGMA foreign_keys=ON");
    const directory = new URL("../drizzle/", import.meta.url);
    for (const name of readdirSync(directory).filter(name => name.endsWith(".sql") && name < "0006").sort())
      sqlite.exec(readFileSync(new URL(name, directory), "utf8"));
    seedLocalPilot(sqlite);
    sqlite.prepare("INSERT INTO pilot_auth_flows(state_hash,browser_hash,verifier,nonce,expires_at,requested_role) VALUES (?,?,?,?,?,?)")
      .run("old-flow", "old-browser", "old-verifier", "old-nonce", 2000000000, "eleve");
    sqlite.prepare(`INSERT INTO pilot_assignments(id,school_id,class_id,teacher_id,title,instructions,due_date,created_at,request_key,request_hash)
      VALUES ('old-assignment','pilot-school-a','pilot-class-a','pilot-a-teacher','Devoir conservé','Consigne conservée','2026-10-01',100,'old-key','old-hash')`).run();
    sqlite.prepare(`INSERT INTO pilot_submissions(id,school_id,assignment_id,student_id,body,request_hash,submitted_at)
      VALUES ('old-submission','pilot-school-a','old-assignment','pilot-a-student','Réponse à conserver.','old-answer-hash',101)`).run();
    sqlite.prepare(`INSERT INTO pilot_reviews(submission_id,school_id,teacher_id,score,feedback,request_hash,reviewed_at)
      VALUES ('old-submission','pilot-school-a','pilot-a-teacher',0,'Correction conservée.','old-review-hash',102)`).run();
    const before = snapshot(sqlite);
    sqlite.exec(readFileSync(new URL("0006_student_manual_activation.sql", directory), "utf8"));
    const after = snapshot(sqlite);
    for (const [table, rows] of Object.entries(before)) {
      const comparable = table === "pilot_auth_flows" ? after[table].map(({ return_path, ...row }) => row) : after[table];
      assert.deepEqual(comparable, rows, table);
    }
    assert.equal(sqlite.prepare("SELECT return_path FROM pilot_auth_flows").get().return_path, null);
    for (const table of ["pilot_manuals", "pilot_manual_codes", "pilot_manual_attempts"]) assert.deepEqual(after[table], []);
    sqlite.prepare("INSERT INTO pilot_manuals(id,title,level,active) VALUES ('fixture-manual','Test','Test',1)").run();
    const insert = sqlite.prepare(`INSERT INTO pilot_manual_codes(id,school_id,manual_id,code_hash,created_by,created_at,student_id,activated_at)
      VALUES (?,'pilot-school-a','fixture-manual',?,'pilot-local-admin',1,?,?)`);
    insert.run("valid-code", "a".repeat(64), "pilot-a-student", 1);
    assert.throws(() => insert.run("duplicate-permission", "b".repeat(64), "pilot-a-student", 2), /UNIQUE constraint failed/);
    assert.throws(() => insert.run("invalid-claim", "c".repeat(64), "pilot-a-other", null), /CHECK constraint failed/);
    assert.throws(() => insert.run("invalid-digest", "short", null, null), /CHECK constraint failed/);
    assert.throws(() => insert.run("nonexistent-student", "d".repeat(64), "does-not-exist", 1), /FOREIGN KEY constraint failed/);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { sqlite.close(); }
});
