import assert from 'node:assert/strict';
import test from 'node:test';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { issueSession } from '../worker/pilot/session.js';
import { handlePilot } from '../worker/pilot/api.js';
import { ARTICLE_FORMAT, emptyArticle, normalizeArticle } from '../src/features/editorial/articleCore.js';

const origin = 'http://127.0.0.1:5173';
const basePath = '/api/pilot/admin/editorial';
const draft = overrides => ({ ...emptyArticle(), title: 'Un atelier de français à Rabat', excerpt: 'Des échanges courts pour donner envie de parler.', body: 'Dans la classe, chaque enfant présente un lieu de son quartier et pose une question à son camarade.', theme: 'Oral en interaction', author: 'Équipe de test', ...overrides });
const createCommand = overrides => ({ id: crypto.randomUUID(), operationId: crypto.randomUUID(), action: 'create', baseRevision: 0, article: draft(), ...overrides });
async function client(DB, userId = 'pilot-local-admin') {
  const issued = userId ? await issueSession(DB, userId, 'local_fixture', true) : null;
  return { async call(suffix = '', body, options = {}) {
    const method = options.method || (body === undefined ? 'GET' : 'POST');
    const request = new Request(origin + basePath + suffix, { method, headers: { origin, 'content-type': 'application/json', ...(issued ? { cookie: issued.cookie.split(';')[0], 'X-CSRF-Token': issued.csrfToken } : {}), ...options.headers }, ...(method === 'GET' ? {} : { body: options.rawBody ?? JSON.stringify(body) }) });
    const response = await handlePilot(request, { DB: options.binding || DB }, { local: true });
    return { status: response.status, data: await response.json(), headers: response.headers };
  } };
}
async function setup(t) {
  const store = openPilotDatabase(); seedLocalPilot(store.sqlite); t.after(() => store.close());
  return { ...store, admin: await client(store.DB), counts() { return Object.fromEntries(['beta_editorial_items', 'beta_content_versions', 'pilot_admin_events'].map(table => [table, store.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n])); } };
}
const requireSuccess = (result, status = 201) => { assert.equal(result.status, status, JSON.stringify(result.data)); return result.data; };
function afterRead(binding, matches, effect) {
  return { ...binding, prepare(sql) {
    const wrap = statement => ({ ...statement, bind: (...args) => wrap(statement.bind(...args)), async first() { const row = await statement.first(); if (matches(sql)) effect(); return row; } });
    return wrap(binding.prepare(sql));
  } };
}

test('editorial : création privée, texte conservé, relecture et acteur serveur', async t => {
  const f = await setup(t), command = createCommand({ article: draft({ body: 'Premier paragraphe.\r\n\r\nDeuxième paragraphe. <script>alert(1)</script>' }) });
  const saved = requireSuccess(await f.admin.call('', command));
  assert.equal(saved.item.id, command.id); assert.equal(saved.item.revision, 1); assert.equal(saved.item.currentVersionId, command.operationId);
  assert.equal(saved.item.article.body, 'Premier paragraphe.\n\nDeuxième paragraphe. <script>alert(1)</script>');
  assert.equal(saved.userId, 'pilot-local-admin'); assert.equal(saved.replayed, false);
  const reloaded = await (await client(f.DB)).call('/' + command.id);
  assert.equal(reloaded.status, 200); assert.deepEqual(reloaded.data.item, saved.item); assert.equal(reloaded.headers.get('cache-control'), 'no-store');
  const row = f.sqlite.prepare('SELECT * FROM beta_editorial_items').get(); assert.equal(row.audience, 'private'); assert.equal(row.item_type, 'article'); assert.equal(row.status, 'draft');
  const version = f.sqlite.prepare('SELECT * FROM beta_content_versions').get(); assert.equal(version.created_by, 'pilot-local-admin'); assert.equal(JSON.parse(version.payload_json).format, ARTICLE_FORMAT);
  assert.deepEqual(f.counts(), { beta_editorial_items: 1, beta_content_versions: 1, pilot_admin_events: 1 });
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('editorial : une création concurrente identique produit un seul reçu et un seul journal', async t => {
  const f = await setup(t), command = createCommand();
  const responses = await Promise.all([f.admin.call('', command), f.admin.call('', command)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  assert.deepEqual(responses.map(r => r.data.replayed).sort(), [false, true]);
  assert.deepEqual(f.counts(), { beta_editorial_items: 1, beta_content_versions: 1, pilot_admin_events: 1 });
  for (const result of responses) assert.equal(result.data.savedVersion.id, command.operationId);
});

test('editorial : UUID réutilisé avec autre texte, article ou acteur est refusé sans effet', async t => {
  const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command)); const before = f.counts();
  for (const changed of [{ ...command, article: draft({ title: 'Un autre titre incompatible' }) }, { ...command, id: crypto.randomUUID() }]) {
    const result = await f.admin.call('', changed); assert.equal(result.status, 409); assert.equal(result.data.error.code, 'operation_conflict');
  }
  f.sqlite.prepare('INSERT INTO pilot_users(id,display_name,active,created_at) VALUES (?,?,1,1)').run('other-test-admin', 'Autre administrateur de test');
  f.sqlite.prepare('INSERT INTO pilot_admins(user_id,active) VALUES (?,1)').run('other-test-admin');
  assert.equal((await (await client(f.DB, 'other-test-admin')).call('', command)).status, 409);
  assert.deepEqual(f.counts(), before);
});

test('editorial : conflit entre onglets sans écrasement et rejeu tardif distinct du courant', async t => {
  const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command));
  const left = { id: command.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: draft({ title: 'Version du premier onglet' }) };
  const right = { ...left, operationId: crypto.randomUUID(), article: draft({ title: 'Version du deuxième onglet' }) };
  const results = await Promise.all([f.admin.call('', left), f.admin.call('', right)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const winner = results[0].status === 201 ? left : right;
  const next = { ...winner, operationId: crypto.randomUUID(), baseRevision: 2, article: draft({ title: 'Modification ultérieure confirmée' }) };
  requireSuccess(await f.admin.call('', next));
  const replay = requireSuccess(await f.admin.call('', winner), 200);
  assert.equal(replay.replayed, true); assert.equal(replay.savedVersion.versionNo, 2); assert.equal(replay.item.revision, 3); assert.equal(replay.item.article.title, next.article.title);
  assert.equal(f.counts().beta_content_versions, 3); assert.equal(f.counts().pilot_admin_events, 3);
});

test('editorial : restauration crée N+1, conserve les versions et rejoue sans nouveau journal', async t => {
  const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command));
  requireSuccess(await f.admin.call('', { id: command.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: draft({ title: 'Une version à relire', status: 'review' }) }));
  const history = f.sqlite.prepare('SELECT * FROM beta_content_versions ORDER BY version_no').all();
  const restore = { id: command.id, operationId: crypto.randomUUID(), action: 'restore', baseRevision: 2, sourceVersionId: command.operationId, reason: 'Retour au texte initial pour relecture.' };
  const saved = requireSuccess(await f.admin.call('', restore)); assert.equal(saved.item.revision, 3); assert.deepEqual(saved.item.article, command.article); assert.equal(saved.item.article.status, 'draft');
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM beta_content_versions WHERE version_no<3 ORDER BY version_no').all(), history);
  const before = f.counts(); const replay = requireSuccess(await f.admin.call('', restore), 200); assert.equal(replay.replayed, true); assert.deepEqual(f.counts(), before);
  const versions = requireSuccess(await f.admin.call('/' + command.id + '/versions'), 200); assert.deepEqual(versions.versions.map(v => v.versionNo), [3, 2, 1]);
  const original = requireSuccess(await f.admin.call('/' + command.id + '/versions/' + command.operationId), 200); assert.deepEqual(original.version.article, command.article);
});

test('editorial : archive explicitement, refuse modification/réarchivage, permet restauration', async t => {
  const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command));
  const archive = { id: command.id, operationId: crypto.randomUUID(), action: 'archive', baseRevision: 1 };
  const saved = requireSuccess(await f.admin.call('', archive)); assert.equal(saved.item.article.status, 'archived'); assert.ok(f.sqlite.prepare('SELECT archived_at FROM beta_editorial_items').get().archived_at);
  assert.equal((await f.admin.call('', archive)).status, 200, 'rejouer l’archivage confirmé est sûr');
  const oldConfirmation = requireSuccess(await f.admin.call('', command), 200); assert.equal(oldConfirmation.savedVersion.versionNo, 1); assert.equal(oldConfirmation.item.article.status, 'archived');
  const before = f.counts();
  assert.equal((await f.admin.call('', { id: command.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 2, article: draft({ title: 'Tentative de réouverture implicite' }) })).status, 409);
  assert.equal((await f.admin.call('', { ...archive, operationId: crypto.randomUUID(), baseRevision: 2 })).status, 409);
  assert.deepEqual(f.counts(), before);
  const restored = requireSuccess(await f.admin.call('', { id: command.id, operationId: crypto.randomUUID(), action: 'restore', baseRevision: 2, sourceVersionId: command.operationId }));
  assert.equal(restored.item.article.status, 'draft'); assert.equal(restored.item.revision, 3); assert.equal(f.sqlite.prepare('SELECT archived_at FROM beta_editorial_items').get().archived_at, null);
});

test('editorial : une version étrangère ne peut être lue ni restaurée', async t => {
  const f = await setup(t), a = createCommand(), b = createCommand(); requireSuccess(await f.admin.call('', a)); requireSuccess(await f.admin.call('', b)); const before = f.counts();
  assert.equal((await f.admin.call('/' + a.id + '/versions/' + b.operationId)).status, 404);
  assert.equal((await f.admin.call('', { id: a.id, operationId: crypto.randomUUID(), action: 'restore', baseRevision: 1, sourceVersionId: b.operationId })).status, 404);
  assert.deepEqual(f.counts(), before);
});

test('editorial : session anonyme, rôles scolaires, origine et CSRF sont refusés', async t => {
  const f = await setup(t), command = createCommand();
  assert.equal((await (await client(f.DB, null)).call()).status, 401);
  for (const id of ['pilot-a-student', 'pilot-a-parent', 'pilot-a-teacher', 'pilot-b-teacher']) {
    const c = await client(f.DB, id); assert.equal((await c.call()).status, 403); assert.equal((await c.call('', command)).status, 403);
  }
  assert.equal((await f.admin.call('', command, { headers: { 'X-CSRF-Token': '' } })).status, 403);
  assert.equal((await f.admin.call('', command, { headers: { origin: 'https://foreign.example' } })).status, 403);
  assert.equal((await f.admin.call('', command, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal(f.counts().beta_editorial_items, 0);
});

test('editorial : révocation juste avant batch bloque article, version et journal', async t => {
  for (const sql of ["UPDATE pilot_admins SET active=0 WHERE user_id='pilot-local-admin'", "UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-local-admin'", "UPDATE pilot_users SET active=0 WHERE id='pilot-local-admin'"]) {
    await t.test(sql.split(' ')[1], async t => {
      const f = await setup(t), binding = { ...f.DB, batch: async statements => { f.sqlite.exec(sql); return f.DB.batch(statements); } };
      const result = await f.admin.call('', createCommand(), { binding }); assert.equal(result.status, 403); assert.deepEqual(f.counts(), { beta_editorial_items: 0, beta_content_versions: 0, pilot_admin_events: 0 });
    });
  }
});

test('editorial : droits révoqués après la lecture du détail ou d’une version, aucune réponse privée', async t => {
  for (const kind of ['detail', 'version']) await t.test(kind, async t => {
    const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command));
    const binding = afterRead(f.DB, sql => kind === 'detail' ? sql.startsWith('SELECT e.*,v.payload_json') : sql.startsWith('SELECT v.id,v.version_no,v.payload_json'), () => f.sqlite.exec("UPDATE pilot_admins SET active=0 WHERE user_id='pilot-local-admin'"));
    const suffix = '/' + command.id + (kind === 'version' ? '/versions/' + command.operationId : '');
    const result = await f.admin.call(suffix, undefined, { binding }); assert.equal(result.status, 403); assert.equal(result.data.item, undefined); assert.equal(result.data.version, undefined);
  });
});

test('editorial : révocation interdit aussi le rejeu d’une confirmation', async t => {
  const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command)); const before = f.counts();
  f.sqlite.exec("UPDATE pilot_admins SET active=0 WHERE user_id='pilot-local-admin'");
  assert.equal((await f.admin.call('', command)).status, 403); assert.deepEqual(f.counts(), before);
});

test('editorial : erreur d’insertion du journal annule le CAS et la nouvelle version', async t => {
  const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command));
  const before = f.sqlite.prepare('SELECT * FROM beta_editorial_items').get(), counts = f.counts();
  f.sqlite.exec("CREATE TRIGGER editorial_test_reject_audit BEFORE INSERT ON pilot_admin_events WHEN NEW.action='article_save' BEGIN SELECT RAISE(ABORT,'test atomic rollback'); END;");
  const save = { id: command.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: draft({ title: 'Ne doit pas être enregistré partiellement' }) };
  assert.equal((await f.admin.call('', save)).status, 503);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM beta_editorial_items').get(), before); assert.deepEqual(f.counts(), counts);
  f.sqlite.exec('DROP TRIGGER editorial_test_reject_audit'); requireSuccess(await f.admin.call('', save));
});

test('editorial : contenus hérités ou publiés non convertis et non écrasés', async t => {
  const f = await setup(t);
  const legacy = [{ status: 'draft', audience: 'private', payload: { title: 'Ancien article', body: 'Texte historique à préserver' } }, { status: 'published', audience: 'public', payload: { format: ARTICLE_FORMAT, article: draft() } }];
  for (const item of legacy) {
    item.id = crypto.randomUUID(); item.versionId = crypto.randomUUID();
    f.sqlite.prepare('INSERT INTO beta_editorial_items(id,item_type,title,status,audience,revision,current_version_id,created_at,updated_at) VALUES (?,\'article\',?,?,?,1,?,\'2020-01-01\',\'2020-01-01\')').run(item.id, 'Contenu existant', item.status, item.audience, item.versionId);
    f.sqlite.prepare('INSERT INTO beta_content_versions(id,content_id,version_no,payload_json,checksum,created_by,created_at) VALUES (?,?,1,?,\'ancien-checksum\',\'beta-service-token\',\'2020-01-01\')').run(item.versionId, item.id, JSON.stringify(item.payload));
  }
  const before = f.sqlite.prepare('SELECT * FROM beta_content_versions ORDER BY id').all(); assert.equal((await f.admin.call()).data.items.length, 0);
  for (const item of legacy) {
    assert.equal((await f.admin.call('/' + item.id)).status, 404);
    assert.equal((await f.admin.call('', { id: item.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: draft() })).status, 409);
    assert.equal((await f.admin.call('', { id: item.id, operationId: crypto.randomUUID(), action: 'restore', baseRevision: 1, sourceVersionId: item.versionId })).status, 404);
  }
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM beta_content_versions ORDER BY id').all(), before); assert.equal(f.counts().pilot_admin_events, 0);
});

test('editorial : filtres stricts, recherche et pagination sans confondre aperçu et base', async t => {
  const f = await setup(t);
  for (let i = 0; i < 27; i++) requireSuccess(await f.admin.call('', createCommand({ article: draft({ title: `Atelier numéro ${String(i).padStart(2, '0')}` }) })));
  const first = requireSuccess(await f.admin.call(), 200); assert.equal(first.items.length, 25); assert.equal(first.counts.total, 27); assert.equal(first.nextOffset, 25); assert.equal(first.source, 'local_fixture');
  const second = requireSuccess(await f.admin.call('?offset=25'), 200); assert.equal(second.items.length, 2); assert.equal(second.nextOffset, null); assert.equal(new Set([...first.items, ...second.items].map(x => x.id)).size, 27);
  const search = requireSuccess(await f.admin.call('?q=numéro%2003'), 200); assert.equal(search.items.length, 1); assert.equal(search.counts.total, 1);
  for (const suffix of ['?offset=-1', '?offset=1.5', '?offset=100001', '?offset=1&offset=2', '?status=published', '?status=draft&status=review', '?unknown=true', '?q=%00']) assert.equal((await f.admin.call(suffix)).status, 400, suffix);
});

test('editorial : historique paginé et filtres de version non ambigus', async t => {
  const f = await setup(t), command = createCommand(); requireSuccess(await f.admin.call('', command));
  for (let revision = 1; revision <= 22; revision++) requireSuccess(await f.admin.call('', { id: command.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: revision, article: draft({ title: `Révision numéro ${revision + 1}` }) }));
  const first = requireSuccess(await f.admin.call('/' + command.id + '/versions'), 200); assert.equal(first.versions.length, 20); assert.equal(first.nextOffset, 20); assert.equal(first.versions[0].versionNo, 23);
  const second = requireSuccess(await f.admin.call('/' + command.id + '/versions?offset=20'), 200); assert.deepEqual(second.versions.map(v => v.versionNo), [3, 2, 1]); assert.equal(second.nextOffset, null);
  for (const suffix of ['/versions?offset=1&offset=2', '/versions?offset=-1', '/versions?status=draft', '?offset=1', '/versions/' + command.operationId + '?offset=1']) assert.equal((await f.admin.call('/' + command.id + suffix)).status, 400, suffix);
});

test('editorial : entrée stricte, plafond 64 Kio et conservation du plafond scolaire 16 Kio', async t => {
  const f = await setup(t), command = createCommand();
  for (const change of [{ actor: 'forged' }, { status: 'published' }, { operationId: 'bad' }, { baseRevision: 1 }, { reason: 'Une ligne\nUne autre' }, { article: draft({ status: 'published' }) }, { article: draft({ visibility: 'public' }) }, { article: draft({ body: 'a\u0000b' }) }, { article: draft({ status: 'review', author: '' }) }]) assert.equal((await f.admin.call('', { ...command, ...change })).status, 422);
  assert.equal((await f.admin.call('', command, { rawBody: '{' })).status, 400);
  assert.equal((await f.admin.call('', command, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await f.admin.call('', command, { rawBody: JSON.stringify({ ...command, padding: 'x'.repeat(65536) }) })).status, 413);
  const multilingual = createCommand({ article: draft({ body: '界'.repeat(12000) }) }); requireSuccess(await f.admin.call('', multilingual));
  assert.equal(normalizeArticle(multilingual.article).body.length, 12000);
  const teacher = await issueSession(f.DB, 'pilot-a-teacher', 'local_fixture', true);
  const request = new Request(origin + '/api/pilot/assignments', { method: 'POST', headers: { origin, cookie: teacher.cookie.split(';')[0], 'content-type': 'application/json', 'X-CSRF-Token': teacher.csrfToken }, body: JSON.stringify({ instructions: '界'.repeat(6000) }) });
  assert.equal((await handlePilot(request, { DB: f.DB }, { local: true })).status, 413);
});
