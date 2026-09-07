import assert from "node:assert/strict";
import test from "node:test";
import { openPilotDatabase, seedLocalPilot } from "../scripts/pilot-local-store.mjs";
import { handleLocalPilot } from "../scripts/pilot-local-api.mjs";
import { issueSession } from "../worker/pilot/session.js";
import { MOTS_FLECHES_GRIDS } from "../src/features/games/mots-fleches/motsFlechesData.js";
import { buildGridModel } from "../src/features/games/mots-fleches/motsFlechesEngine.js";
import { schoolHomework, studentSchoolPath } from "../src/features/student/studentSchoolCore.js";

const origin = "http://127.0.0.1:5173";
const dashboard = "/student/dashboard";
const answer = "Notre école possède une cour ombragée. J’y retrouve mes camarades et nous lisons ensemble.";
const firstGrid = MOTS_FLECHES_GRIDS[0];

function setup(t) {
  const store = openPilotDatabase();
  seedLocalPilot(store.sqlite);
  t.after(() => store.close());
  return store;
}

async function client(db, id = "pilot-a-student") {
  const session = await issueSession(db, id, "local_fixture", true);
  const cookie = session.cookie.split(";")[0];
  return {
    async call(path = dashboard, body, binding = db) {
      const response = await handleLocalPilot(new Request(origin + "/api/pilot" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { cookie, origin, "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }), binding);
      return { status: response.status, data: await response.json(), headers: response.headers };
    },
  };
}

function assignment(sqlite, extra = {}) {
  const row = {
    id: crypto.randomUUID(), schoolId: "pilot-school-a", classId: "pilot-class-a", teacherId: "pilot-a-teacher",
    title: "Décrire un lieu de notre école", instructions: "Présente un lieu de notre école et explique pourquoi tu l’apprécies.",
    dueDate: "2026-10-01", createdAt: 100, ...extra,
  };
  sqlite.prepare(`INSERT INTO pilot_assignments
    (id,school_id,class_id,teacher_id,title,instructions,due_date,created_at,request_key,request_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.schoolId, row.classId, row.teacherId, row.title,
    row.instructions, row.dueDate, row.createdAt, "student-test-" + row.id, "fixture-only");
  return row;
}

function extraClass(sqlite, { id = "same-school-class", studentId = "same-school-student" } = {}) {
  sqlite.prepare("INSERT INTO pilot_classes(id,school_id,name) VALUES (?,'pilot-school-a',?)")
    .run(id, "Autre classe · test local");
  sqlite.prepare("INSERT INTO pilot_users(id,display_name,created_at) VALUES (?,?,0)")
    .run(studentId, "Autre élève · test local");
  sqlite.prepare("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-a',?,'eleve')")
    .run(studentId);
  sqlite.prepare("INSERT INTO pilot_class_members(school_id,class_id,user_id) VALUES ('pilot-school-a',?,?)")
    .run(id, studentId);
  return { id, studentId };
}

async function completeGrid(student, ownerId = "pilot-a-student") {
  const progress = Object.fromEntries([...buildGridModel(firstGrid).cells]
    .filter(([, cell]) => cell.type === "letter").map(([key, cell]) => [key, cell.solution]));
  const result = await student.call(`/games/mots-fleches/${firstGrid.id}/complete`, {
    ownerId, progress, hintCount: 0, revision: 0, requestId: crypto.randomUUID(),
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.awarded, true);
}

function snapshot(sqlite) {
  return Object.fromEntries(sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all()
    .map(({ name }) => [name, sqlite.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all()]));
}

// Simulates a committed access change between two awaited D1 reads, without mocking SQL results.
function beforeRead(db, predicate, change) {
  let changed = false;
  return {
    binding: { ...db, prepare(sql) {
      if (!changed && predicate(sql)) { changed = true; change(); }
      return db.prepare(sql);
    } },
    wasChanged: () => changed,
  };
}

test("accueil élève : données vides réelles, identité scolaire et aucune écriture à la lecture", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB);
  const before = snapshot(sqlite), response = await student.call();
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.data.userId, "pilot-a-student");
  assert.equal(response.data.schoolId, "pilot-school-a");
  assert.deepEqual(response.data.classes, [{ id: "pilot-class-a", name: "5e AEP · classe de test" }]);
  assert.deepEqual(response.data.assignments, {
    total: 0, submitted: 0, reviewed: 0, pending: 0, next: null, nextOffset: null, items: [],
  });
  assert.deepEqual(response.data.rewards, {
    studentId: "pilot-a-student", studentName: "Lina · élève", xpTotal: 0, classCompletedCount:0,
    completedCount: 0, startedCount: 0, grids: [], quizStartedCount: 0, quizCompletedCount: 0, latestQuiz: null, zelligeCompletedCount: 0, latestZellige: null, latestMarket: null, marketCompletedCount: 0,
  });
  assert.equal(response.data.csrfToken, undefined);
  assert.equal(response.data.session, undefined);
  assert.deepEqual(snapshot(sqlite), before);
});

test("accueil élève : remise et correction à zéro conservées, prochain devoir non remis, XP serveur uniquement", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB), teacher = await client(DB, "pilot-a-teacher");
  const reviewed = assignment(sqlite, { dueDate: "2026-09-10" });
  const pendingLater = assignment(sqlite, { dueDate: "2026-09-30" });
  const pendingFirst = assignment(sqlite, { dueDate: "2026-09-20" });
  const submitted = assignment(sqlite, { dueDate: "2026-09-15" });
  for (const item of [reviewed, submitted]) {
    const saved = await student.call(`/assignments/${item.id}/submission`, { body: answer });
    assert.equal(saved.status, 201);
    if (item === reviewed) {
      assert.equal((await teacher.call(`/submissions/${saved.data.id}/review`, {
        score: 0, feedback: "Relis la consigne et décris précisément la position du lieu.",
      })).status, 201);
    }
  }
  assert.equal((await student.call()).data.rewards.xpTotal, 0, "Les devoirs ne créent pas de faux XP.");
  await completeGrid(student);
  const before = snapshot(sqlite), response = await student.call();
  assert.equal(response.status, 200);
  const data = response.data.assignments;
  assert.deepEqual([data.total, data.submitted, data.reviewed, data.pending], [4, 2, 1, 2]);
  assert.equal(data.next.id, pendingFirst.id);
  assert.deepEqual(data.items.map(item => item.id), [reviewed.id, submitted.id, pendingFirst.id, pendingLater.id]);
  assert.equal(data.items[0].submission.score, 0);
  assert.ok(data.items[0].submission.reviewedAt > 0);
  assert.equal(data.items[0].submission.feedback, "Relis la consigne et décris précisément la position du lieu.");
  assert.equal(data.items[0].submission.body, undefined, "Le résumé ne reproduit pas les réponses rédigées.");
  assert.equal(data.items[1].submission.reviewedAt, null);
  assert.equal(data.items[2].submission, null);
  assert.deepEqual(schoolHomework(data.items).map(item => item.status), ["Corrigé", "Remis", "À faire", "À faire"]);
  assert.equal(response.data.rewards.xpTotal, firstGrid.xp);
  assert.equal(response.data.rewards.completedCount, 1);
  assert.equal(response.data.rewards.grids[0].gridId, firstGrid.id);
  assert.equal(response.data.rewards.grids[0].awardedXp, firstGrid.xp);
  assert.deepEqual(snapshot(sqlite), before);
});

test("accueil élève : 53 devoirs, compteurs complets et prochain devoir au-delà de la première page", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB);
  const items = Array.from({ length: 53 }, (_, index) => assignment(sqlite, {
    title: "Devoir de pagination " + index, dueDate: index < 50 ? "2026-09-01" : "2026-10-01", createdAt: index,
  }));
  for (const item of items.slice(0, 50)) sqlite.prepare(`INSERT INTO pilot_submissions
    (id,school_id,assignment_id,student_id,body,request_hash,submitted_at) VALUES (?,'pilot-school-a',?,'pilot-a-student',?,?,?)`)
    .run(crypto.randomUUID(), item.id, answer, "fixture-only", item.createdAt);
  const first = await student.call(), second = await student.call(dashboard + "?offset=50");
  for (const response of [first, second]) {
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.deepEqual([response.data.assignments.total, response.data.assignments.submitted,
      response.data.assignments.reviewed, response.data.assignments.pending], [53, 50, 0, 3]);
    assert.equal(response.data.assignments.next.id, items[50].id);
  }
  assert.equal(first.data.assignments.items.length, 50);
  assert.equal(first.data.assignments.nextOffset, 50);
  assert.equal(second.data.assignments.items.length, 3);
  assert.equal(second.data.assignments.nextOffset, null);
  assert.deepEqual([...first.data.assignments.items, ...second.data.assignments.items].map(item => item.id), items.map(item => item.id));
  const beyond = await student.call(dashboard + "?offset=100");
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.data.assignments.items, []);
  assert.equal(beyond.data.assignments.total, 53);
  assert.equal(beyond.data.assignments.nextOffset, null);
  for (const offset of ["-1", "1.5", "NaN", "Infinity", "100001", "9007199254740992"])
    assert.equal((await student.call(dashboard + "?offset=" + offset)).status, 422, offset);
});

test("accueil élève : séparation des réponses et récompenses entre élèves d’une même classe", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB), other = await client(DB, "pilot-a-other");
  const item = assignment(sqlite);
  assert.equal((await student.call(`/assignments/${item.id}/submission`, { body: answer })).status, 201);
  await completeGrid(student);
  const mine = await student.call(), theirs = await other.call();
  assert.equal(mine.data.assignments.submitted, 1);
  assert.equal(mine.data.rewards.xpTotal, firstGrid.xp);
  assert.equal(theirs.status, 200);
  assert.equal(theirs.data.userId, "pilot-a-other");
  assert.equal(theirs.data.assignments.total, 1);
  assert.equal(theirs.data.assignments.submitted, 0);
  assert.equal(theirs.data.assignments.pending, 1);
  assert.equal(theirs.data.assignments.items[0].submission, null);
  assert.equal(theirs.data.rewards.studentId, "pilot-a-other");
  assert.equal(theirs.data.rewards.xpTotal, 0);
  assert.deepEqual(theirs.data.rewards.grids, []);
  assert.equal(JSON.stringify(theirs.data).includes("pilot-a-student"), false);
});

test("accueil élève : classes et écoles restent cloisonnées, même avec identité forgée dans la requête", async t => {
  const { DB, sqlite } = setup(t), student = await client(DB);
  const extra = extraClass(sqlite), otherClass = await client(DB, extra.studentId), otherSchool = await client(DB, "pilot-b-student");
  const own = assignment(sqlite);
  const second = assignment(sqlite, { classId: extra.id });
  const foreign = assignment(sqlite, { schoolId: "pilot-school-b", classId: "pilot-class-b", teacherId: "pilot-b-teacher" });
  for (const [actor, expected, classId, schoolId] of [
    [student, own, "pilot-class-a", "pilot-school-a"],
    [otherClass, second, extra.id, "pilot-school-a"],
    [otherSchool, foreign, "pilot-class-b", "pilot-school-b"],
  ]) {
    const result = await actor.call(dashboard + "?userId=pilot-local-admin&schoolId=pilot-school-a&classId=pilot-class-a&role=admin");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.assignments.items.map(item => item.id), [expected.id]);
    assert.deepEqual(result.data.classes.map(group => group.id), [classId]);
    assert.equal(result.data.schoolId, schoolId);
    assert.equal(result.data.assignments.next.id, expected.id);
  }
  sqlite.prepare("UPDATE pilot_classes SET active=0 WHERE id=?").run(extra.id);
  const denied = await otherClass.call();
  assert.equal(denied.status, 403);
  assert.equal(denied.data.assignments, undefined);
  assert.deepEqual((await student.call()).data.assignments.items.map(item => item.id), [own.id]);
});

test("accueil élève : aucun autre rôle admis, y compris administrateur possédant un rattachement élève", async t => {
  const { DB, sqlite } = setup(t);
  for (const id of ["pilot-a-teacher", "pilot-a-parent", "pilot-local-admin"]) {
    const actor = await client(DB, id), response = await actor.call();
    assert.equal(response.status, 403, id);
    assert.equal(response.data.assignments, undefined);
    assert.equal(response.data.rewards, undefined);
  }
  sqlite.prepare("UPDATE pilot_memberships SET role='directeur' WHERE user_id='pilot-a-parent'").run();
  const director = await client(DB, "pilot-a-parent");
  assert.equal((await director.call()).status, 403);
  sqlite.prepare("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-a','pilot-local-admin','eleve')").run();
  sqlite.prepare("INSERT INTO pilot_class_members(school_id,class_id,user_id) VALUES ('pilot-school-a','pilot-class-a','pilot-local-admin')").run();
  const adminStudent = await client(DB, "pilot-local-admin"), result = await adminStudent.call();
  assert.equal(result.status, 403);
  assert.equal(result.data.error.code, "profile_mismatch");
  assert.equal(result.data.userId, undefined);
});

test("accueil élève : aucune lecture anonyme, après expiration, révocation ou désactivation du compte", async t => {
  const { DB, sqlite } = setup(t);
  const anonymous = await handleLocalPilot(new Request(origin + "/api/pilot" + dashboard), DB);
  assert.equal(anonymous.status, 401);
  for (const mutation of [
    "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_sessions SET expires_at=1 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'",
  ]) {
    sqlite.prepare("UPDATE pilot_users SET active=1 WHERE id='pilot-a-student'").run();
    const actor = await client(DB);
    sqlite.exec(mutation);
    const result = await actor.call();
    assert.equal(result.status, 401, mutation);
    assert.equal(result.data.assignments, undefined);
    assert.equal(result.data.rewards, undefined);
  }
});

test("accueil élève : retrait scolaire ou de classe refuse toute donnée après une connexion antérieure", async t => {
  for (const mutation of [
    "UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'",
    "UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'",
    "DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'",
  ]) {
    const { DB, sqlite } = setup(t), actor = await client(DB);
    assignment(sqlite);
    sqlite.exec(mutation);
    const result = await actor.call();
    assert.equal(result.status, 403, mutation);
    assert.equal(result.data.assignments, undefined);
    assert.equal(result.data.classes, undefined);
  }
});

test("accueil élève : révocation pendant les lectures refuse le résultat complet, même avec une seconde classe active", async t => {
  for (const mutation of [
    "UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'",
    "DELETE FROM pilot_class_members WHERE user_id='pilot-a-student' AND class_id='pilot-class-a'",
    "UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_memberships SET role='parent' WHERE user_id='pilot-a-student'",
    "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'",
    "UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'",
    "INSERT INTO pilot_admins(user_id) VALUES ('pilot-a-student')",
  ]) {
    const { DB, sqlite } = setup(t), actor = await client(DB);
    const extra = extraClass(sqlite);
    sqlite.prepare("INSERT INTO pilot_class_members(school_id,class_id,user_id) VALUES ('pilot-school-a',?,'pilot-a-student')").run(extra.id);
    assignment(sqlite);
    assignment(sqlite, { classId: extra.id });
    const change = beforeRead(DB, sql => sql.includes("SELECT u.id student_id,u.display_name student_name"), () => sqlite.exec(mutation));
    const result = await actor.call(dashboard, undefined, change.binding);
    assert.equal(change.wasChanged(), true, "La mutation doit survenir après la première lecture des classes.");
    assert.equal(result.status, 403, mutation);
    assert.equal(result.data.assignments, undefined, mutation);
    assert.equal(result.data.rewards, undefined, mutation);
  }
});

test("accueil élève : une classe retirée hors première page ne laisse pas de compteurs scolaires périmés", async t => {
  const { DB, sqlite } = setup(t), actor = await client(DB);
  const extra = extraClass(sqlite);
  sqlite.prepare("INSERT INTO pilot_class_members(school_id,class_id,user_id) VALUES ('pilot-school-a',?,'pilot-a-student')").run(extra.id);
  for (let index = 0; index < 50; index++) assignment(sqlite, { dueDate: "2026-09-01", createdAt: index });
  assignment(sqlite, { classId: extra.id, dueDate: "2026-12-01" });
  const change = beforeRead(DB, sql => sql.includes("SELECT a.*,sub.id submission_id"), () => {
    sqlite.prepare("UPDATE pilot_classes SET active=0 WHERE id=?").run(extra.id);
  });
  const result = await actor.call(dashboard, undefined, change.binding);
  assert.equal(change.wasChanged(), true, "La classe est retirée entre les compteurs et les lignes paginées.");
  assert.equal(result.status, 403);
  assert.equal(result.data.assignments, undefined);
  const fresh = await actor.call();
  assert.equal(fresh.status, 200);
  assert.equal(fresh.data.assignments.total, 50);
  assert.equal(fresh.data.assignments.nextOffset, null);
  assert.deepEqual(fresh.data.classes.map(group => group.id), ["pilot-class-a"]);
});

test("adaptation des devoirs : statut déterminé par la remise, date locale et note zéro sans mutation", () => {
  const items = [
    { id: "pending", dueDate: "2026-09-08", submission: null },
    { id: "submitted", dueDate: "2026-09-09", submission: { id: "submission", reviewedAt: null, score: null } },
    { id: "reviewed", dueDate: "2026-09-10", submission: { id: "review", reviewedAt: 0, score: 0 } },
  ];
  const before = structuredClone(items), result = schoolHomework(items);
  assert.deepEqual(items, before);
  assert.deepEqual(result.map(item => item.status), ["À faire", "Remis", "Corrigé"]);
  assert.deepEqual(result.map(item => item.dueAt), ["2026-09-08T12:00:00", "2026-09-09T12:00:00", "2026-09-10T12:00:00"]);
  assert.equal(result[2].submission.score, 0);
  assert.notEqual(result[0], items[0]);
  assert.deepEqual(schoolHomework([]), []);
});

test("navigation élève : seuls les liens d’origine connus sont raccordés, profil conservé et aucune élévation", () => {
  const routes = {
    "/eleve/tableau-de-bord": "accueil", "/eleve/manuels": "manuels", "/eleve/devoirs": "devoirs",
    "/eleve/mediatheque": "mediatheque", "/eleve/jeux": "jeux", "/eleve/progression": "progres",
    "/eleve/recompenses": "recompenses", "/eleve/profil": "aide",
  };
  for (const [path, section] of Object.entries(routes))
    assert.equal(studentSchoolPath(path), `/pilote?profil=eleve&section=${section}`);
  const id = "3f600df3-3b68-4d8c-88ac-de0b18cd50da";
  assert.equal(studentSchoolPath(`/eleve/devoirs/${id}`), `/pilote?profil=eleve&section=devoirs&devoir=${id}`);
  assert.equal(studentSchoolPath("/eleve/jeux/mots-fleches"), "/pilote/jeux/mots-fleches");
  for (const path of ["/", "/guide-ecole", "/admin/accueil", "/eleve/devoirs/inconnu", "/eleve/devoirs/../admin",
    "/eleve/devoirs?profil=admin", "/eleve/jeux/inconnu", "https://example.test/eleve/devoirs"])
    assert.equal(studentSchoolPath(path), path);
});
