import test from 'node:test';
import assert from 'node:assert/strict';
import {openPilotDatabase,seedLocalPilot} from '../scripts/pilot-local-store.mjs';
import {issueSession} from '../worker/pilot/session.js';
import {handlePilot} from '../worker/pilot/api.js';
const origin='http://127.0.0.1:5173';
async function fixture(t){
 const f=openPilotDatabase();seedLocalPilot(f.sqlite);t.after(()=>f.close());
 async function client(id='pilot-local-admin',binding=f.DB){
  const s=id?await issueSession(f.DB,id,'local_fixture',true):null;
  return async(path,body,headers={})=>{const r=await handlePilot(new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(s?{Cookie:s.cookie.split(';')[0]}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':s?.csrfToken||''}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:binding},{local:true});return {status:r.status,data:await r.json()};};
 }
 return {...f,client,admin:await client()};
}
const input={id:'new-director',name:'Direction test privé',schoolId:'pilot-school-a',role:'directeur'};
test('admin creates school-only Direction without classes, identity, family or platform grants',async t=>{
 const f=await fixture(t);f.sqlite.exec("INSERT INTO pilot_schools VALUES('empty-school','École sans classe',1)");
 const data={...input,schoolId:'empty-school'};
 assert.equal((await f.admin('/admin/accounts',data)).status,200);
 for(const table of ['pilot_class_members','pilot_identities','pilot_admins'])assert.equal(f.sqlite.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').get(input.id).n,0);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_family_links WHERE parent_id=?').get(input.id).n,0);
 const account=(await f.admin('/admin')).data.accounts.find(a=>a.id===input.id);assert.equal(account.role,'directeur');assert.equal(account.connected,0);
 assert.equal((await f.admin('/admin/accounts',data)).status,409);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_admin_events WHERE target_id=?').get(input.id).n,1);
 const call=await f.client(input.id);assert.equal((await call('/director')).data.schoolId,'empty-school');assert.equal((await call('/admin')).status,403);assert.equal((await call('/session?profil=eleve')).status,403);
 await f.admin('/admin/account-status',{id:input.id,active:false});await f.admin('/admin/account-status',{id:input.id,active:true});assert.equal((await call('/director')).status,401);
 assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('admin Direction creation rejects foreign associations, roles, nonadmins and CSRF',async t=>{
 const f=await fixture(t);
 for(const patch of [{classId:'pilot-class-a'},{childId:'pilot-a-student'},{classId:false},{childId:0},{role:'admin'},{role:'unknown'},{schoolId:'missing'}])assert.equal((await f.admin('/admin/accounts',{...input,...patch})).status,422);
 for(const id of ['pilot-a-director','pilot-a-teacher','pilot-a-parent','pilot-a-student'])assert.equal((await(await f.client(id))('/admin/accounts',input)).status,403);
 assert.equal((await f.admin('/admin/accounts',input,{'X-CSRF-Token':'no'})).status,403);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_users WHERE id=?').get(input.id).n,0);
});
for(const sql of ["UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'","UPDATE pilot_admins SET active=0","UPDATE pilot_sessions SET revoked_at=1"]){
 test('admin Direction creation rechecks scope inside batch: '+sql,async t=>{
  const f=await fixture(t),binding={...f.DB,batch:async statements=>{f.sqlite.exec(sql);return f.DB.batch(statements);}},call=await f.client('pilot-local-admin',binding);
  assert.equal((await call('/admin/accounts',input)).status,409);
  for(const [table,column]of [['pilot_users','id'],['pilot_memberships','user_id'],['pilot_admin_events','target_id']])assert.equal(f.sqlite.prepare('SELECT count(*) n FROM '+table+' WHERE '+column+'=?').get(input.id).n,0);
 });
}
