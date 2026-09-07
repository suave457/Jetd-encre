import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { issueSession } from '../worker/pilot/session.js';
import { handlePilot } from '../worker/pilot/api.js';
import { handlePublicArticles } from '../worker/public-articles.js';
import { emptyArticle } from '../src/features/editorial/articleCore.js';
import { PUBLIC_BLOG_ARTICLES } from '../src/publicContentArticles.js';

const origin = 'http://127.0.0.1:5173';
const base = '/api/pilot/admin/editorial';
const publicBase = '/api/public/articles';
const image = PUBLIC_BLOG_ARTICLES[0];
const article = overrides => ({ ...emptyArticle(), title: 'Parler français dans son quartier', excerpt: 'Un atelier de communication pour présenter un lieu familier et poser des questions.', body: 'À Rabat, les élèves préparent une visite de leur quartier. Chaque binôme choisit un lieu, le présente et invite les camarades à poser des questions.\n\nLa classe compare ensuite les itinéraires et formule des conseils.', category: 'Enseignants', theme: 'Interaction orale', author: 'Équipe de recette éditoriale', ...overrides });
const createCommand = overrides => ({ id: crypto.randomUUID(), operationId: crypto.randomUUID(), action: 'create', baseRevision: 0, article: article(), ...overrides });
async function client(DB, userId = 'pilot-local-admin') {
  const session = userId ? await issueSession(DB, userId, 'local_fixture', true) : null;
  return { async call(path = '', body, options = {}) {
    const method = options.method || (body === undefined ? 'GET' : 'POST');
    const request = new Request(origin + base + path, { method, headers: { origin, 'Content-Type': 'application/json', ...(session ? { cookie: session.cookie.split(';')[0], 'X-CSRF-Token': session.csrfToken } : {}), ...options.headers }, ...(['GET','HEAD'].includes(method) ? {} : { body: options.rawBody ?? JSON.stringify(body) }) });
    const response = await handlePilot(request, { DB: options.binding || DB }, { local: true });
    return { status: response.status, data: await response.json(), headers: response.headers };
  } };
}
async function setup(t) {
  const store = openPilotDatabase(); seedLocalPilot(store.sqlite); t.after(() => store.close());
  return { ...store, admin: await client(store.DB) };
}
const expect = (result, status = 201) => { assert.equal(result.status, status, JSON.stringify(result.data)); return result.data; };
const path = id => '/' + id + '/publication';
const slug = id => 'article-' + id;
const publish = (created, overrides = {}) => ({ operationId: crypto.randomUUID(), action: 'publish', basePublicationRevision: 0, confirmed: true, baseRevision: 1, sourceVersionId: created.operationId, imageId: image.slug, imageAlt: 'Illustration de lecture pour un atelier de communication en français', ...overrides });
const retract = (revision = 1, overrides = {}) => ({ operationId: crypto.randomUUID(), action: 'retract', basePublicationRevision: revision, confirmed: true, ...overrides });
const counts = sqlite => Object.fromEntries(['beta_editorial_items','beta_content_versions','beta_article_publication_events','pilot_admin_events'].map(table => [table, sqlite.prepare('SELECT count(*) n FROM ' + table).get().n]));
const historyRows = sqlite => sqlite.prepare('SELECT * FROM beta_content_versions ORDER BY content_id,version_no').all();
async function publicCall(DB, suffix = '', options = {}) {
  const response = await handlePublicArticles(new Request(origin + publicBase + suffix, { method: options.method || 'GET', headers: options.headers }), { DB: options.binding || DB });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function create(f, overrides) {
  const command = createCommand(overrides); expect(await f.admin.call('', command)); return command;
}
function afterRead(binding, match, effect) {
  return { ...binding, prepare(sql) {
    const wrap = statement => ({ ...statement, bind: (...values) => wrap(statement.bind(...values)), async first() { const row = await statement.first(); if (match(sql)) effect(); return row; }, async all() { const rows = await statement.all(); if (match(sql)) effect(); return rows; } });
    return wrap(binding.prepare(sql));
  } };
}

test('publication : brouillon, enregistrement et restauration restent privés par défaut', async t => {
  const f = await setup(t), a = await create(f);
  expect(await f.admin.call('', { id: a.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: article({ title: 'Nouvelle copie toujours privée' }) }));
  expect(await f.admin.call('', { id: a.id, operationId: crypto.randomUUID(), action: 'restore', baseRevision: 2, sourceVersionId: a.operationId }));
  const state = expect(await f.admin.call(path(a.id)), 200);
  assert.equal(state.publication.status, 'unpublished'); assert.equal(state.publication.revision, 0); assert.deepEqual(state.history, []);
  assert.deepEqual(expect(await publicCall(f.DB), 200).items, []);
  assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 404);
  assert.equal(counts(f.sqlite).beta_article_publication_events, 0);
});

test('publication : confirmation explicite publie une projection publique exacte, sans modifier le brouillon', async t => {
  const f = await setup(t), a = await create(f), before = historyRows(f.sqlite), command = publish(a);
  const result = expect(await f.admin.call(path(a.id), command));
  assert.equal(result.replayed, false); assert.deepEqual(result.receipt, { id: command.operationId, revision: 1, action: 'publish' });
  assert.equal(result.publication.status, 'published'); assert.equal(result.publication.revision, 1);
  assert.equal(result.publication.sourceVersionId, a.operationId); assert.equal(result.publication.sourceVersionNo, 1);
  assert.deepEqual(historyRows(f.sqlite), before);
  const stored = f.sqlite.prepare('SELECT * FROM beta_editorial_items WHERE id=?').get(a.id); assert.equal(stored.status, 'draft'); assert.equal(stored.audience, 'private'); assert.equal(stored.revision, 1);
  const response = await publicCall(f.DB, '/' + slug(a.id)), dto = expect(response, 200).article;
  assert.deepEqual(Object.keys(dto).sort(), ['slug','title','excerpt','body','category','theme','author','image','imageAlt','date','readTime','publishedAt','source','sections'].sort());
  for (const field of ['title','excerpt','body','category','theme','author']) assert.equal(dto[field], a.article[field], field);
  assert.equal(dto.slug, slug(a.id)); assert.equal(dto.image, image.image); assert.equal(dto.imageAlt, command.imageAlt); assert.equal(dto.source, 'publication'); assert.deepEqual(dto.sections, []);
  assert.ok(Number.isFinite(Date.parse(dto.publishedAt))); assert.ok(dto.date); assert.ok(dto.readTime);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const listed = expect(await publicCall(f.DB), 200).items; assert.equal(listed.length, 1); assert.equal(listed[0].body, undefined);
  for (const secret of ['userId','sourceVersionId','sourceVersionNo','createdBy','actor_id','request_hash','operation','reason','status','checksum']) assert.equal(dto[secret], undefined, secret);
});

test('publication : les edits et restaurations ultérieurs ne changent jamais le snapshot public', async t => {
  const f = await setup(t), a = await create(f); expect(await f.admin.call(path(a.id), publish(a)));
  const original = expect(await publicCall(f.DB, '/' + slug(a.id)), 200).article;
  const save = { id: a.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: article({ title: 'Texte de travail confidentiel', author: 'Auteur du brouillon privé', body: 'Brouillon privé. '.repeat(20) }) };
  expect(await f.admin.call('', save));
  assert.deepEqual(expect(await publicCall(f.DB, '/' + slug(a.id)), 200).article, original);
  expect(await f.admin.call('', { id: a.id, operationId: crypto.randomUUID(), action: 'restore', baseRevision: 2, sourceVersionId: a.operationId }));
  assert.deepEqual(expect(await publicCall(f.DB, '/' + slug(a.id)), 200).article, original);
  assert.equal(counts(f.sqlite).beta_article_publication_events, 1);
});

test('publication : mise à jour publique explicite, retrait puis republication conservent leurs traces', async t => {
  const f = await setup(t), a = await create(f); expect(await f.admin.call(path(a.id), publish(a)));
  const save = { id: a.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: article({ title: 'Texte relu pour une nouvelle publication' }) }; expect(await f.admin.call('', save));
  const before = historyRows(f.sqlite);
  expect(await f.admin.call(path(a.id), publish(a, { basePublicationRevision: 1, baseRevision: 2, sourceVersionId: save.operationId })));
  assert.equal(expect(await publicCall(f.DB, '/' + slug(a.id)), 200).article.title, save.article.title);
  expect(await f.admin.call(path(a.id), retract(2)));
  assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 404); assert.deepEqual(expect(await publicCall(f.DB), 200).items, []);
  const again = expect(await f.admin.call(path(a.id), publish(a, { basePublicationRevision: 3, baseRevision: 2, sourceVersionId: save.operationId })));
  assert.equal(again.publication.revision, 4); assert.equal(again.publication.status, 'published');
  assert.equal(expect(await publicCall(f.DB, '/' + slug(a.id)), 200).article.title, save.article.title);
  assert.deepEqual(historyRows(f.sqlite), before);
  const state = expect(await f.admin.call(path(a.id)), 200); assert.equal(state.history.length, 4);
  assert.deepEqual(f.sqlite.prepare('SELECT action FROM beta_article_publication_events ORDER BY publication_no').all().map(x => x.action), ['publish','publish','retract','publish']);
});

test('publication : double clic et confirmation réseau rejouée créent un reçu et un journal uniques', async t => {
  const f = await setup(t), a = await create(f), command = publish(a), before = counts(f.sqlite);
  const results = await Promise.all([f.admin.call(path(a.id), command), f.admin.call(path(a.id), command)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200,201]); assert.deepEqual(results.map(r => r.data.replayed).sort(), [false,true]);
  assert.equal(counts(f.sqlite).beta_article_publication_events, 1); assert.equal(counts(f.sqlite).pilot_admin_events, before.pilot_admin_events + 1);
  const withdrawal = retract(); expect(await f.admin.call(path(a.id), withdrawal));
  const withdrawnCounts = counts(f.sqlite);
  const old = expect(await f.admin.call(path(a.id), command), 200);
  assert.equal(old.receipt.revision, 1); assert.equal(old.receipt.action, 'publish'); assert.equal(old.publication.revision, 2); assert.equal(old.publication.status, 'retracted');
  expect(await f.admin.call(path(a.id), withdrawal), 200);
  assert.deepEqual(counts(f.sqlite), withdrawnCounts); assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 404);
});

test('publication : même référence avec autre intention ou acteur est rejetée sans effet', async t => {
  const f = await setup(t), a = await create(f), b = await create(f), command = publish(a); expect(await f.admin.call(path(a.id), command)); const before = counts(f.sqlite);
  for (const changed of [{ ...command, imageAlt: 'Autre description de la même illustration' }, { ...command, imageId: PUBLIC_BLOG_ARTICLES[1].slug }, { ...command, basePublicationRevision: 1 }, retract(1, { operationId: command.operationId })]) assert.equal((await f.admin.call(path(a.id), changed)).status, 409);
  assert.equal((await f.admin.call(path(b.id), { ...command, sourceVersionId: b.operationId })).status, 409);
  f.sqlite.prepare("INSERT INTO pilot_users(id,display_name,active,created_at) VALUES ('another-publication-admin','Autre équipe de test',1,1)").run();
  f.sqlite.prepare("INSERT INTO pilot_admins(user_id,active) VALUES ('another-publication-admin',1)").run();
  assert.equal((await (await client(f.DB, 'another-publication-admin')).call(path(a.id), command)).status, 409);
  assert.deepEqual(counts(f.sqlite), before);
});

test('publication : référence déjà utilisée pour le brouillon refusée en conflit, sans erreur serveur', async t => {
  const f = await setup(t), a = await create(f), before = counts(f.sqlite);
  assert.equal((await f.admin.call(path(a.id), publish(a, { operationId: a.operationId }))).status, 409);
  assert.deepEqual(counts(f.sqlite), before);
});

test('publication : deux onglets et publication contre retrait ne peuvent pas gagner ensemble', async t => {
  const f = await setup(t), a = await create(f);
  const initial = await Promise.all([f.admin.call(path(a.id), publish(a)), f.admin.call(path(a.id), publish(a))]);
  assert.deepEqual(initial.map(r => r.status).sort(), [201,409]); assert.equal(counts(f.sqlite).beta_article_publication_events, 1);
  const save = { id: a.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: article({ title: 'Nouvelle version concurrente à publier' }) }; expect(await f.admin.call('', save));
  const crossed = await Promise.all([f.admin.call(path(a.id), publish(a, { basePublicationRevision: 1, baseRevision: 2, sourceVersionId: save.operationId })), f.admin.call(path(a.id), retract(1))]);
  assert.deepEqual(crossed.map(r => r.status).sort(), [201,409]); assert.equal(counts(f.sqlite).beta_article_publication_events, 2);
  const state = expect(await f.admin.call(path(a.id)), 200).publication;
  assert.equal(state.revision, 2);
});

test('publication : version de brouillon périmée ou étrangère ne peut pas être publiée', async t => {
  const f = await setup(t), a = await create(f), b = await create(f);
  const save = { id: a.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: article({ title: 'Modification faite dans un autre onglet' }) }; expect(await f.admin.call('', save));
  const before = counts(f.sqlite);
  assert.equal((await f.admin.call(path(a.id), publish(a))).status, 409);
  assert.ok([404,409].includes((await f.admin.call(path(a.id), publish(a, { baseRevision: 2, sourceVersionId: b.operationId }))).status));
  assert.equal((await f.admin.call(path(a.id), publish(a, { baseRevision: 2 }))).status, 409);
  assert.deepEqual(counts(f.sqlite), before);
});

test('publication : modification concurrente juste avant le batch interdit le snapshot dépassé', async t => {
  const f = await setup(t), a = await create(f);
  const save = { id: a.id, operationId: crypto.randomUUID(), action: 'save', baseRevision: 1, article: article({ title: 'Texte enregistré pendant la confirmation' }) };
  let changed = false;
  const binding = { ...f.DB, batch: async statements => { if (!changed) { changed = true; expect(await f.admin.call('', save)); } return f.DB.batch(statements); } };
  assert.equal((await f.admin.call(path(a.id), publish(a), { binding })).status, 409);
  assert.equal(counts(f.sqlite).beta_article_publication_events, 0);
  assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 404);
});

test('publication : article public non archivable avant retrait explicite, article archivé non publiable', async t => {
  const f = await setup(t), a = await create(f); expect(await f.admin.call(path(a.id), publish(a)));
  const archive = { id: a.id, operationId: crypto.randomUUID(), action: 'archive', baseRevision: 1 }, before = counts(f.sqlite);
  assert.equal((await f.admin.call('', archive)).status, 409); assert.deepEqual(counts(f.sqlite), before);
  assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 200);
  expect(await f.admin.call(path(a.id), retract())); expect(await f.admin.call('', archive));
  assert.ok([409,422].includes((await f.admin.call(path(a.id), publish(a, { basePublicationRevision: 2, baseRevision: 2, sourceVersionId: archive.operationId }))).status));
  assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 404);
});

test('publication : publication et archivage concurrents ont un seul gagnant', async t => {
  const f = await setup(t), a = await create(f);
  const archive = { id: a.id, operationId: crypto.randomUUID(), action: 'archive', baseRevision: 1 };
  const results = await Promise.all([f.admin.call(path(a.id), publish(a)), f.admin.call('', archive)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201,409]);
  const current = expect(await f.admin.call('/' + a.id), 200).item;
  if (results[0].status === 201) {
    assert.equal(current.article.status, 'draft'); assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 200);
  } else {
    assert.equal(current.article.status, 'archived'); assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 404);
  }
});

test('publication : champs complets, confirmation et image approuvée sont obligatoires', async t => {
  const f = await setup(t), a = await create(f), command = publish(a), before = counts(f.sqlite);
  for (const change of [{ confirmed: false }, { confirmed: undefined }, { operationId: 'bad' }, { basePublicationRevision: -1 }, { basePublicationRevision: 0.5 }, { baseRevision: 0 }, { sourceVersionId: 'bad' }, { imageId: '/assets/arbitraire.png' }, { imageId: 'https://foreign.example/image.png' }, { imageAlt: '' }, { imageAlt: 'Image\u0000invalide' }, { actor: 'forged' }, { sourceVersionNo: 1 }]) {
    const result = await f.admin.call(path(a.id), { ...command, ...change }); assert.equal(result.status, 422, JSON.stringify(change));
  }
  assert.deepEqual(counts(f.sqlite), before);
  const incomplete = await create(f, { article: article({ excerpt: '', body: '', author: '', theme: '' }) });
  assert.equal((await f.admin.call(path(incomplete.id), publish(incomplete))).status, 422);
  const withdrawal = retract();
  for (const extra of [{ baseRevision: 1 }, { sourceVersionId: a.operationId }, { imageId: image.slug }, { imageAlt: 'Description indue lors du retrait' }]) assert.equal((await f.admin.call(path(a.id), { ...withdrawal, ...extra })).status, 422);
});

test('publication : anonyme, rôles scolaires, origine étrangère et CSRF ne peuvent publier', async t => {
  const f = await setup(t), a = await create(f), command = publish(a);
  for (const id of [null,'pilot-a-student','pilot-a-teacher','pilot-a-parent']) {
    const c = await client(f.DB, id), expected = id ? 403 : 401;
    assert.equal((await c.call(path(a.id))).status, expected); assert.equal((await c.call(path(a.id), command)).status, expected);
  }
  for (const headers of [{ 'X-CSRF-Token': '' }, { origin: 'https://foreign.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await f.admin.call(path(a.id), command, { headers })).status, 403);
  assert.equal(counts(f.sqlite).beta_article_publication_events, 0);
});

test('publication : révocation avant le batch annule publication et journal', async t => {
  for (const sql of ["UPDATE pilot_admins SET active=0 WHERE user_id='pilot-local-admin'","UPDATE pilot_users SET active=0 WHERE id='pilot-local-admin'","UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-local-admin'"]) await t.test(sql.split(' ')[1], async t => {
    const f = await setup(t), a = await create(f), before = counts(f.sqlite);
    const binding = { ...f.DB, batch: async statements => { f.sqlite.exec(sql); return f.DB.batch(statements); } };
    assert.equal((await f.admin.call(path(a.id), publish(a), { binding })).status, 403);
    assert.deepEqual(counts(f.sqlite), before); assert.deepEqual(expect(await publicCall(f.DB), 200).items, []);
  });
});

test('publication : confirmation privée relue après révocation ne révèle pas les métadonnées', async t => {
  const f = await setup(t), a = await create(f), command = publish(a); expect(await f.admin.call(path(a.id), command));
  const binding = afterRead(f.DB, sql => sql.includes('beta_article_publication_events'), () => f.sqlite.exec("UPDATE pilot_admins SET active=0 WHERE user_id='pilot-local-admin'"));
  const result = await f.admin.call(path(a.id), undefined, { binding }); assert.equal(result.status, 403); assert.equal(result.data.publication, undefined); assert.equal(result.data.history, undefined);
  assert.equal((await f.admin.call(path(a.id), command)).status, 403);
});

test('publication : échec du journal annule intégralement la publication et permet le même réessai', async t => {
  const f = await setup(t), a = await create(f), command = publish(a), before = counts(f.sqlite);
  f.sqlite.exec("CREATE TRIGGER publication_test_reject_audit BEFORE INSERT ON pilot_admin_events BEGIN SELECT RAISE(ABORT,'publication audit rollback test'); END;");
  assert.equal((await f.admin.call(path(a.id), command)).status, 503);
  assert.deepEqual(counts(f.sqlite), before); assert.equal((await publicCall(f.DB, '/' + slug(a.id))).status, 404);
  f.sqlite.exec('DROP TRIGGER publication_test_reject_audit'); expect(await f.admin.call(path(a.id), command));
});

test('publication : texte ressemblant à du HTML reste du texte, seuls des champs autorisés sont publics', async t => {
  const f = await setup(t), body = 'Un texte de classe. '.repeat(8) + '<script>alert("secret")</script><img src=x onerror=alert(1)>', a = await create(f, { article: article({ body }) });
  expect(await f.admin.call(path(a.id), publish(a)));
  const dto = expect(await publicCall(f.DB, '/' + slug(a.id)), 200).article;
  assert.equal(dto.body, body); assert.equal(dto.payload_json, undefined);
  assert.equal((await publicCall(f.DB, '/' + a.operationId)).status, 404);
  assert.equal((await publicCall(f.DB, '/' + slug(a.id) + '/versions')).status, 404);
});

test('publication : retrait entre lecture publique et réponse retire le détail et filtre la liste', async t => {
  for (const kind of ['detail','list']) await t.test(kind, async t => {
    const f = await setup(t), a = await create(f); expect(await f.admin.call(path(a.id), publish(a)));
    let invoked = false;
    const withdraw = async () => { if (!invoked) { invoked = true; expect(await f.admin.call(path(a.id), retract())); } };
    const binding = { ...f.DB, prepare(sql) {
      const wrap = statement => ({ ...statement, bind: (...args) => wrap(statement.bind(...args)), async first() { const row = await statement.first(); if (sql.includes('beta_article_publication_events') && row) await withdraw(); return row; }, async all() { const result = await statement.all(); if (sql.includes('beta_article_publication_events') && result.results?.length) await withdraw(); return result; } });
      return wrap(f.DB.prepare(sql));
    } };
    const response = await publicCall(f.DB, kind === 'detail' ? '/' + slug(a.id) : '', { binding });
    assert.equal(invoked, true);
    if (kind === 'detail') assert.equal(response.status, 404); else assert.deepEqual(expect(response, 200).items, []);
  });
});

test('publication : pagination et catégories ne révèlent que les publications, sans dupliquer les pages', async t => {
  const f = await setup(t);
  for (let i = 0; i < 27; i++) { const a = await create(f, { article: article({ title: 'Atelier publié numéro ' + String(i).padStart(2,'0'), category: i === 3 ? 'Parents' : 'Enseignants' }) }); expect(await f.admin.call(path(a.id), publish(a))); }
  await create(f, { article: article({ title: 'Atelier privé invisible dans la recherche' }) });
  const first = expect(await publicCall(f.DB), 200); assert.equal(first.items.length, 25); assert.equal(first.nextOffset, 25);
  const second = expect(await publicCall(f.DB, '?offset=25&revision='+first.revision), 200); assert.equal(second.items.length, 2); assert.equal(second.nextOffset, null); assert.equal(new Set([...first.items,...second.items].map(x => x.slug)).size, 27);
  assert.equal(expect(await publicCall(f.DB, '?category=Parents'), 200).items.length, 1);
  assert.equal(expect(await publicCall(f.DB, '?q=numéro%2003'), 200).items.length, 1);
  assert.equal(expect(await publicCall(f.DB, '?q=privé'), 200).items.length, 0);
  for (const suffix of ['?offset=-1','?offset=1.5','?offset=100001','?offset=1&offset=2','?category=Admin','?category=Parents&category=Enfants','?q=%00','?q='+'a'.repeat(101),'?unknown=1']) assert.equal((await publicCall(f.DB, suffix)).status, 400, suffix);
});

test('publication : API anonyme stricte, indisponibilité explicite et articles statiques préservés', async t => {
  const f = await setup(t), staticBefore = structuredClone(PUBLIC_BLOG_ARTICLES);
  assert.equal((await publicCall(f.DB, '', { method: 'POST' })).status, 405);
  assert.equal((await publicCall(undefined)).status, 503);
  for (const existing of PUBLIC_BLOG_ARTICLES) assert.equal((await publicCall(f.DB, '/' + existing.slug)).status, 404);
  const a = await create(f); expect(await f.admin.call(path(a.id), publish(a))); expect(await f.admin.call(path(a.id), retract()));
  assert.deepEqual(PUBLIC_BLOG_ARTICLES, staticBefore);
});

test('publication : migration additive vide préserve toutes les données précédentes et impose ses clés étrangères', () => {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
  try {
    const directory = new URL('../drizzle/', import.meta.url), migrations = readdirSync(directory).filter(name => name.endsWith('.sql')).sort();
    const publicationMigration = migrations.find(name => name.startsWith('0010'));
    assert.ok(publicationMigration, 'Une migration additive 0010 est attendue');
    for (const name of migrations.filter(name => name < publicationMigration)) sqlite.exec(readFileSync(new URL(name, directory), 'utf8'));
    seedLocalPilot(sqlite);
    const names = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x => x.name);
    const before = Object.fromEntries(names.map(name => [name, sqlite.prepare('SELECT * FROM "' + name + '"').all()]));
    sqlite.exec(readFileSync(new URL(publicationMigration, directory), 'utf8'));
    for (const name of names) assert.deepEqual(sqlite.prepare('SELECT * FROM "' + name + '"').all(), before[name], name);
    assert.equal(sqlite.prepare('SELECT count(*) n FROM beta_article_publication_events').get().n, 0);
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    const constraints = sqlite.prepare('PRAGMA foreign_key_list(beta_article_publication_events)').all();
    assert.ok(constraints.some(row => row.table === 'beta_content_versions' && row.from === 'content_id' && row.to === 'content_id'));
    assert.ok(constraints.some(row => row.table === 'beta_content_versions' && row.from === 'source_version_no' && row.to === 'version_no'));
  } finally { sqlite.close(); }
});
