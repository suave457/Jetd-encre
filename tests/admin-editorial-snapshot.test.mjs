import assert from 'node:assert/strict';
import test from 'node:test';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { issueSession } from '../worker/pilot/session.js';
import { handlePilot } from '../worker/pilot/api.js';
import { emptyArticle } from '../src/features/editorial/articleCore.js';

const origin = 'http://127.0.0.1:5173';
const basePath = '/api/pilot/admin/editorial';
async function setup(t, versionCount) {
  const store = openPilotDatabase(); seedLocalPilot(store.sqlite); t.after(() => store.close());
  const issued = await issueSession(store.DB, 'pilot-local-admin', 'local_fixture', true);
  const id = crypto.randomUUID(), operations = [];
  async function call(suffix = '', body, binding = store.DB) {
    const request = new Request(origin + basePath + suffix, { method: body === undefined ? 'GET' : 'POST', headers: { origin, cookie: issued.cookie.split(';')[0], 'content-type': 'application/json', 'X-CSRF-Token': issued.csrfToken }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const response = await handlePilot(request, { DB: binding }, { local: true });
    return { status: response.status, data: await response.json() };
  }
  async function append() {
    const operationId = crypto.randomUUID(), baseRevision = operations.length;
    const result = await call('', { id, operationId, action: baseRevision ? 'save' : 'create', baseRevision, article: { ...emptyArticle(), title: `Brouillon de contrôle : version ${baseRevision + 1}` } });
    assert.equal(result.status, 201, JSON.stringify(result.data)); operations.push(operationId); return operationId;
  }
  for (let index = 0; index < versionCount; index++) await append();
  return { ...store, id, operations, call, append };
}
function afterRecord(binding, effect) {
  let used = false;
  return { ...binding, prepare(sql) {
    const wrap = statement => ({ ...statement, bind: (...args) => wrap(statement.bind(...args)), async first() {
      const row = await statement.first();
      if (!used && sql.startsWith('SELECT e.*,v.payload_json')) { used = true; await effect(); }
      return row;
    } });
    return wrap(binding.prepare(sql));
  } };
}
const numbers = result => result.data.versions.map(version => version.versionNo);

test('editorial snapshot : v21 entre lectures ne contamine pas la première page ancrée à v20', async t => {
  const f = await setup(t, 20), version20 = f.operations[19];
  const result = await f.call('/' + f.id + '/versions', undefined, afterRecord(f.DB, () => f.append()));
  assert.equal(result.status, 200); assert.equal(result.data.currentRevision, 20); assert.equal(result.data.currentVersionId, version20);
  assert.deepEqual(numbers(result), Array.from({ length: 20 }, (_, index) => 20 - index)); assert.equal(result.data.nextOffset, null);
  assert.equal(f.sqlite.prepare('SELECT revision FROM beta_editorial_items WHERE id=?').get(f.id).revision, 21);
  const emptyNext = await f.call('/' + f.id + '/versions?offset=20&revision=20');
  assert.equal(emptyNext.status, 200); assert.deepEqual(numbers(emptyNext), []); assert.equal(emptyNext.data.nextOffset, null); assert.equal(emptyNext.data.currentVersionId, version20); assert.equal(emptyNext.data.currentRevision, 20);
  const latest = await f.call('/' + f.id + '/versions'); assert.equal(latest.data.currentRevision, 21); assert.equal(latest.data.currentVersionId, f.operations[20]);
  assert.deepEqual(numbers(latest), Array.from({ length: 20 }, (_, index) => 21 - index)); assert.equal(latest.data.nextOffset, 20);
});

test('editorial snapshot : deuxième page ancrée conserve v3-v1 après un enregistrement concurrent', async t => {
  const f = await setup(t, 23), version23 = f.operations[22];
  const first = await f.call('/' + f.id + '/versions'); assert.equal(first.status, 200); assert.equal(first.data.nextOffset, 20); assert.equal(first.data.currentRevision, 23);
  await f.append();
  const second = await f.call('/' + f.id + '/versions?offset=20&revision=23');
  assert.equal(second.status, 200); assert.deepEqual(numbers(second), [3, 2, 1]); assert.equal(second.data.nextOffset, null);
  assert.equal(second.data.currentRevision, 23); assert.equal(second.data.currentVersionId, version23);
  const combined = [...first.data.versions, ...second.data.versions]; assert.equal(new Set(combined.map(v => v.id)).size, 23); assert.deepEqual(combined.map(v => v.versionNo), Array.from({ length: 23 }, (_, index) => 23 - index));
  assert.equal(f.sqlite.prepare('SELECT revision FROM beta_editorial_items WHERE id=?').get(f.id).revision, 24);
  const staleRestore = await f.call('', { id: f.id, operationId: crypto.randomUUID(), action: 'restore', baseRevision: second.data.currentRevision, sourceVersionId: f.operations[0] });
  assert.equal(staleRestore.status, 409, 'La navigation dans un historique ancien ne permet pas d’écraser v24.');
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM beta_content_versions WHERE content_id=?').get(f.id).n, 24);
});

test('editorial snapshot : une borne explicite ancienne conserve le bon pointeur malgré une nouvelle écriture', async t => {
  const f = await setup(t, 22), version19 = f.operations[18];
  const result = await f.call('/' + f.id + '/versions?revision=19', undefined, afterRecord(f.DB, () => f.append()));
  assert.equal(result.status, 200); assert.equal(result.data.currentRevision, 19); assert.equal(result.data.currentVersionId, version19); assert.equal(result.data.nextOffset, null);
  assert.deepEqual(numbers(result), Array.from({ length: 19 }, (_, index) => 19 - index));
  assert.equal(f.sqlite.prepare('SELECT revision FROM beta_editorial_items WHERE id=?').get(f.id).revision, 23);
});

test('editorial snapshot : borne stricte, non ambiguë et réservée à la liste des versions', async t => {
  const f = await setup(t, 2), original = f.operations[0];
  for (const query of ['revision=', 'revision=0', 'revision=-1', 'revision=01', 'revision=1.0', 'revision=1e0', 'revision=%2B1', 'revision=3', 'revision=10000000', 'revision=1&revision=1', 'revision=1&revision=2', 'revision=%00']) {
    const result = await f.call('/' + f.id + '/versions?' + query); assert.equal(result.status, 400, query); assert.equal(result.data.versions, undefined);
  }
  assert.equal((await f.call('/' + f.id + '?revision=1')).status, 400);
  assert.equal((await f.call('/' + f.id + '/versions/' + original + '?revision=1')).status, 400);
  const oldest = await f.call('/' + f.id + '/versions?revision=1'); assert.equal(oldest.status, 200); assert.equal(oldest.data.currentVersionId, original); assert.equal(oldest.data.currentRevision, 1); assert.deepEqual(numbers(oldest), [1]);
});
