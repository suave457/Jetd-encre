import assert from 'node:assert/strict';
import test from 'node:test';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { authenticate, issueSession } from '../worker/pilot/session.js';
import { handleAdminAnalytics, parseAnalyticsFilters } from '../worker/pilot/adminAnalytics.js';
import { analyticsCards, analyticsCsv, analyticsPercent, analyticsRatio, fetchAdminAnalytics } from '../src/features/pilote/adminAnalyticsCore.js';

const stamp = value => Date.parse(value + 'T00:00:00Z') / 1000;
const origin = 'http://127.0.0.1:5173';
const period = '?from=2025-01-01&to=2025-01-02';
async function setup(t, seeded = true) {
  const store = openPilotDatabase(); t.after(() => store.close());
  if (seeded) seedLocalPilot(store.sqlite);
  else {
    store.sqlite.prepare('INSERT INTO pilot_users VALUES (?,?,1,?)').run('pilot-local-admin','Administration test',stamp('2025-01-01'));
    store.sqlite.prepare('INSERT INTO pilot_admins VALUES (?,1)').run('pilot-local-admin');
  }
  const issued = await issueSession(store.DB, 'pilot-local-admin', 'local_fixture', true);
  const request = new Request(origin + '/api/pilot/admin/analytics', { headers: { cookie: issued.cookie.split(';')[0] } });
  const session = await authenticate(request, store.DB, true);
  return { ...store, session, async call(query = period, customSession = session) {
    try { const response = await handleAdminAnalytics(new Request(origin + '/api/pilot/admin/analytics' + query), { DB: store.DB }, customSession); return { status: response.status, data: await response.json(), headers: response.headers }; }
    catch (error) { if (error instanceof Response) return { status: error.status, data: await error.json() }; throw error; }
  } };
}
function addFacts(sqlite) {
  const assignment = sqlite.prepare('INSERT INTO pilot_assignments(id,school_id,class_id,teacher_id,title,instructions,due_date,created_at,request_key,request_hash) VALUES (?,?,?,?,?,?,?,?,?,?)');
  for (const [id, suffix, day] of [['a1','a','2025-01-01'],['a0','a','2024-12-31'],['b1','b','2025-01-02']]) assignment.run(id,'pilot-school-'+suffix,'pilot-class-'+suffix,'pilot-'+suffix+'-teacher','Devoir test','Consigne test','2025-02-01',stamp(day),id,'hash');
  const submission = sqlite.prepare('INSERT INTO pilot_submissions VALUES (?,?,?,?,?,?,?)');
  submission.run('sub-a1','pilot-school-a','a1','pilot-a-student','Texte privé A','hash',stamp('2025-01-01'));
  submission.run('sub-a0','pilot-school-a','a0','pilot-a-student','Texte privé B','hash',stamp('2025-01-02'));
  submission.run('sub-b1','pilot-school-b','b1','pilot-b-student','Texte privé C','hash',stamp('2025-01-02'));
  sqlite.prepare('INSERT INTO pilot_reviews VALUES (?,?,?,?,?,?,?)').run('sub-a1','pilot-school-a','pilot-a-teacher',0,'Retour privé','hash',stamp('2025-01-03'));
  for (const [user, grid, day] of [['pilot-a-student','g1','2025-01-01'],['pilot-a-student','g2','2025-01-02'],['pilot-a-other','g3','2025-01-03']]) {
    sqlite.prepare('INSERT INTO pilot_game_progress VALUES (?,?,?,?,?,0,1,?,?,?)').run('pilot-school-a',user,'mots-fleches',grid,'{}','r'.repeat(36),'h'.repeat(64),stamp(day));
    sqlite.prepare('INSERT INTO pilot_game_awards VALUES (?,?,?,?,20,?)').run('pilot-school-a',user,'mots-fleches',grid,stamp(day));
  }
  for (const id of ['m1','m2']) sqlite.prepare('INSERT INTO pilot_manuals VALUES (?,?,?,1)').run(id,'Manuel fictif de test','5e AEP');
  const code = sqlite.prepare('INSERT INTO pilot_manual_codes VALUES (?,?,?,?,?,?,?,?,?,?)');
  code.run('c1','pilot-school-a','m1','1'.repeat(64),'pilot-local-admin',stamp('2025-01-01'),null,stamp('2025-01-04'),'pilot-a-student',stamp('2025-01-03'));
  code.run('c2','pilot-school-a','m1','2'.repeat(64),'pilot-local-admin',stamp('2025-01-02'),stamp('2025-01-03'),null,null,null);
  code.run('c0','pilot-school-a','m2','0'.repeat(64),'pilot-local-admin',stamp('2024-12-31'),null,null,'pilot-a-student',stamp('2025-01-02'));
  code.run('c3','pilot-school-b','m1','3'.repeat(64),'pilot-local-admin',stamp('2025-01-02'),null,null,'pilot-b-student',stamp('2025-01-02'));
}

test('analytics : dates réelles, bornes inclusives UTC, période bornée et filtres non ambigus', () => {
  const at = stamp('2026-09-06') + 43200;
  const defaults = parseAnalyticsFilters(new URLSearchParams(), at);
  assert.equal(defaults.from, '2026-08-10'); assert.equal(defaults.to, '2026-09-06');
  assert.equal(defaults.endExclusive, at + 1); assert.equal(defaults.timezone, 'UTC');
  const leap = parseAnalyticsFilters(new URLSearchParams('from=2024-02-29&to=2024-02-29'), at);
  assert.equal(leap.endExclusive - leap.start, 86400);
  for (const query of ['from=2025-02-29&to=2025-03-01','from=2025-01-02&to=2025-01-01','from=2025-01-01','to=2025-01-01','from=2024-01-01&to=2025-01-01','from=2026-09-07&to=2026-09-07','from=2025-01-01&to=2025-01-01&to=2025-01-02','scope=admin','schoolId=a&schoolId=b','schoolId=%00']) assert.throws(() => parseAnalyticsFilters(new URLSearchParams(query), at), error => error instanceof Response && error.status === 400, query);
});

test('analytics : agrégats dédupliqués, école exacte, cohortes corrigées/activées à date de calcul', async t => {
  const store = await setup(t); addFacts(store.sqlite);
  const before = Date.now(), response = await store.call(), after = Date.now();
  assert.equal(response.status, 200); const s = response.data;
  assert.deepEqual(s.totals, { classChallengesCreated:0,classAnswers:0,classCompletions:0,classXp:0,eligibleStudents: 3, participatingStudents: 2, teachers: 2, classes: 2, assignments: 2, submissions: 3, reviewedSubmissions: 1, gameCompletions: 2, marketCompletions: 0, marketAutonomyBonuses: 0, marketXp: 0, zelligeCompletions: 0, zelligeXp: 0, xp: 40, crosswordXp: 40, cultureAnswers: 0, dailyAnswers: 0, cultureCompletions: 0, dailyCompletions: 0, cultureXp: 0, dailyXp: 0, wordChoiceAnswers: 0, wordChoiceCompletions: 0, wordChoiceXp: 0, undatedQuizAnswers: 0, codesIssued: 3, issuedCodesActivated: 2, activations: 2 });
  assert.equal(s.source, 'pilot_local_fixture'); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(Date.parse(s.generatedAt) >= Math.floor(before / 1000) * 1000 && Date.parse(s.generatedAt) <= after);
  assert.equal(s.bySchool.length, 2); assert.equal(s.unavailable.length, 3);
  const a = (await store.call(period + '&schoolId=pilot-school-a')).data;
  assert.equal(a.bySchool.length, 1); assert.equal(a.totals.participatingStudents, 1); assert.equal(a.totals.eligibleStudents, 2);
  assert.equal(a.totals.submissions, 2); assert.equal(a.totals.assignments, 1); assert.equal(a.totals.activations, 1);
  const b = (await store.call(period + '&schoolId=pilot-school-b')).data;
  assert.equal(b.totals.participatingStudents, 1); assert.equal(b.totals.eligibleStudents, 1); assert.equal(b.totals.gameCompletions, 0);
  const following = (await store.call('?from=2025-01-03&to=2025-01-03&schoolId=pilot-school-a')).data;
  assert.equal(following.totals.gameCompletions, 1); assert.equal(following.totals.activations, 1); assert.equal(following.totals.codesIssued, 0); assert.equal(following.totals.reviewedSubmissions, 0, 'la correction du 3 janvier reste attachée à la cohorte des remises, pas à la période de correction');
  const body = JSON.stringify(s);
  for (const privateValue of ['Texte privé','Retour privé','pilot-a-student','1'.repeat(64),'csrf','token_hash','subject']) assert.equal(body.includes(privateValue), false);
  assert.deepEqual(store.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('analytics : population actuelle distincte de l’historique, sans jointures multiplicatrices', async t => {
  const store = await setup(t); addFacts(store.sqlite);
  store.sqlite.prepare('INSERT INTO pilot_classes VALUES (?,?,?,1)').run('class-extra','pilot-school-a','Autre classe');
  store.sqlite.prepare('INSERT INTO pilot_class_members VALUES (?,?,?)').run('pilot-school-a','class-extra','pilot-a-student');
  let s = (await store.call(period)).data;
  assert.equal(s.totals.eligibleStudents, 3); assert.equal(s.totals.participatingStudents, 2); assert.equal(s.totals.classes, 3);
  store.sqlite.prepare('INSERT INTO pilot_admins VALUES (?,1)').run('pilot-a-student');
  store.sqlite.prepare('INSERT INTO pilot_admins VALUES (?,1)').run('pilot-a-teacher');
  s = (await store.call(period)).data;
  assert.equal(s.totals.eligibleStudents, 2); assert.equal(s.totals.participatingStudents, 1); assert.equal(s.totals.teachers, 1); assert.equal(s.totals.submissions, 3);
  store.sqlite.prepare('UPDATE pilot_admins SET active=0 WHERE user_id<>?').run('pilot-local-admin');
  store.sqlite.prepare('UPDATE pilot_users SET active=0 WHERE id=?').run('pilot-a-student');
  s = (await store.call(period)).data;
  assert.equal(s.totals.eligibleStudents, 2); assert.equal(s.totals.participatingStudents, 1); assert.equal(s.totals.submissions, 3);
  store.sqlite.prepare('UPDATE pilot_schools SET active=0 WHERE id=?').run('pilot-school-b');
  s = (await store.call(period + '&schoolId=pilot-school-b')).data;
  assert.equal(s.totals.eligibleStudents, 0); assert.equal(s.totals.participatingStudents, 0); assert.equal(s.totals.submissions, 1); assert.equal(s.bySchool[0].active, 0);
});

test('analytics : absence de données distincte d’un taux nul', async t => {
  const store = await setup(t, false), s = (await store.call()).data;
  assert.deepEqual(s.bySchool, []); assert.deepEqual(s.schools, []);
  assert.ok(Object.values(s.totals).every(value => value === 0));
  assert.ok(analyticsCards(s).every(card => card.value === 'Non calculable'));
  assert.equal(analyticsRatio(0, 2), 0); assert.equal(analyticsPercent(0), '0 %');
  assert.equal(analyticsRatio(0, 0), null);
});

test('analytics : aucun accès anonyme, scolaire, révoqué ou usurpé', async t => {
  const store = await setup(t); addFacts(store.sqlite);
  assert.equal((await store.call(period, null)).status, 401);
  for (const userId of ['pilot-a-student','pilot-a-parent','pilot-a-teacher']) {
    const issued = await issueSession(store.DB, userId, 'local_fixture', true);
    const request = new Request(origin, { headers: { cookie: issued.cookie.split(';')[0] } });
    const session = await authenticate(request, store.DB, true);
    assert.equal((await store.call(period, session)).status, 403);
    assert.equal((await store.call(period, { ...session, user_id: 'pilot-local-admin' })).status, 403);
  }
  store.sqlite.exec('UPDATE pilot_admins SET active=0'); assert.equal((await store.call()).status, 403);
  store.sqlite.exec('UPDATE pilot_admins SET active=1; UPDATE pilot_sessions SET revoked_at=1'); assert.equal((await store.call()).status, 403);
});

test('analytics : refus des périmètres inconnus et absence d’injection SQL', async t => {
  const store = await setup(t);
  for (const schoolId of ['missing', "' OR 1=1 --"]) assert.equal((await store.call(period + '&schoolId=' + encodeURIComponent(schoolId))).status, 404);
  assert.equal((await store.call(period + '&generatedAt=1')).status, 400);
  assert.equal(store.sqlite.prepare('SELECT count(*) n FROM pilot_schools').get().n, 2);
});

test('analytics : export du même instantané, filtres, dénominateurs, fraîcheur et formules neutralisées', async t => {
  const store = await setup(t); addFacts(store.sqlite);
  const s = (await store.call(period + '&schoolId=pilot-school-a')).data;
  const csv = analyticsCsv(s);
  assert.ok(csv.startsWith('\uFEFF')); assert.equal(csv.split('\r\n').length, 26);
  assert.ok(csv.includes('2025-01-01;2025-01-02;UTC;pilot-school-a;pilot_local_fixture;'+s.generatedAt));
  assert.ok(csv.includes('participation;50;1;2')); assert.ok(csv.includes('reviews;50;1;2')); assert.ok(csv.includes('activation;50;1;2'));
  const hostile = analyticsCsv({ ...s, filters: { ...s.filters, schoolId: '=1+1' } });
  assert.ok(hostile.includes("'=1+1"));
});

test('analytics : le client refuse les erreurs, changements de compte et sources de remplacement', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let observed;
  const expected = { schemaVersion: 2, source: 'pilot_database', userId: 'admin-test' };
  globalThis.fetch = async (path, options) => { observed = { path, options }; return Response.json(expected); };
  assert.deepEqual(await fetchAdminAnalytics({ from: '2025-01-01', to: '2025-01-02', schoolId: 'school & test' }, { expectedUserId: 'admin-test' }), expected);
  assert.ok(observed.path.includes('schoolId=school+%26+test')); assert.equal(observed.options.cache, 'no-store'); assert.equal(observed.options.credentials, 'same-origin');
  await assert.rejects(fetchAdminAnalytics({}, { expectedUserId: 'other-admin' }), /compte a changé/);
  globalThis.fetch = async () => Response.json({ ...expected, source: 'fixture_beta' });
  await assert.rejects(fetchAdminAnalytics({}, { expectedUserId: 'admin-test' }), /source est incompatible/);
  globalThis.fetch = async () => Response.json({ error: { message: 'Accès refusé' } }, { status: 403 });
  await assert.rejects(fetchAdminAnalytics({}, { expectedUserId: 'admin-test' }), /Accès refusé/);
});
