import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolApi } from '../src/features/pilote/schoolApi.js';

test('réponse perdue ou JSON incorrect : ne jamais confirmer une opération',async t=>{
  for(const body of ['<html>Maintenance</html>','null','[]','"ok"']){
    t.mock.method(globalThis,'fetch',async()=>new Response(body,{status:200}));
    await assert.rejects(schoolApi('/test',{body:{}}),error=>error.responseUncertain===true);
    t.mock.restoreAll();
  }
});
test('erreur métier : conserve son code, son statut et le mode sans faux succès',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:{code:'profile_mismatch',message:'Mauvais espace'},mode:'local_fixture'},{status:403}));
  await assert.rejects(schoolApi('/session'),error=>error.status===403&&error.code==='profile_mismatch'&&error.mode==='local_fixture');
});
