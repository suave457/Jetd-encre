import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openPilotDatabase,seedLocalPilot,LOCAL_PROFILES} from '../scripts/pilot-local-store.mjs';
import {handlePilot} from '../worker/pilot/api.js';
import {issueSession,now,hash} from '../worker/pilot/session.js';
const origin='http://127.0.0.1:5173',base='/api/pilot';
async function fixture(t){
 const f=openPilotDatabase();seedLocalPilot(f.sqlite);t.after(()=>f.close());let afterReceive=null;
 const files={libraryEnabled:true,allowedUsers:new Set(LOCAL_PROFILES.map(p=>p.id)),async receive(request){const data=await request.text();const sha=createHash('sha256').update(data).digest('hex');await afterReceive?.();return {storage_key:sha+'.pdf',sha256:sha,byte_size:Buffer.byteLength(data),page_count:2};},async verify(){return true;},async open(r,range,head){return {body:head?null:new Uint8Array(range.end-range.start+1),cancel:async()=>{}};}};
 async function client(id='pilot-local-admin'){
  const session=await issueSession(f.DB,id,'local_fixture',true);
  return async(path,body,extra={})=>handlePilot(new Request(origin+base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:session.cookie.split(';')[0],Origin:origin,'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,...extra.headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),...extra.init}),{DB:f.DB,LOCAL_MANUAL_FILES:files,...extra.env},{local:extra.local??true});
 }
 const call=await client();
 async function upload({id,revision=0,bytes='%PDF-first',requestId=crypto.randomUUID(),...more}={}){
  const manualId=id||'manuel-test-'+requestId,c={requestId,manualId,expectedRevision:revision,title:'Manuel de recette',level:'Test privé',description:'Document de test',note:'Essai',fileSize:Buffer.byteLength(bytes),...more};
  const response=await call('/admin/library/imports',bytes,{headers:{'Content-Type':'application/pdf','X-Library-Command':encodeURIComponent(JSON.stringify(c))}});
  return {response,c,id:manualId,bytes};
 }
 const command=(id,revision,action,rest={})=>({requestId:crypto.randomUUID(),manualId:id,expectedRevision:revision,action,...rest});
 return {...f,call,client,upload,command,files,setAfterReceive:fn=>afterReceive=fn};
}
test('library: private import, catalogue, immutable versions, restore and duplicate-file rejection',async t=>{
 const f=await fixture(t),first=await f.upload();assert.equal(first.response.status,200,await first.response.clone().text());
 let detail=await(await f.call('/admin/library/'+first.id)).json();assert.equal(detail.document.pageCount,2);assert.equal(detail.document.assignmentMode,'explicit');assert.equal(detail.versions.length,1);assert.ok(detail.schools.every(s=>!s.assigned));
 const sha=detail.document.version,second=await f.upload({id:first.id,revision:1,bytes:'%PDF-second'});assert.equal(second.response.status,200,await second.response.clone().text());
 detail=await(await f.call('/admin/library/'+first.id)).json();assert.equal(detail.versions.length,2);assert.notEqual(detail.document.version,sha);
 const restore=f.command(first.id,2,'restore',{version:sha});assert.equal((await f.call('/admin/library',restore)).status,200);
 detail=await(await f.call('/admin/library/'+first.id)).json();assert.equal(detail.document.version,sha);assert.equal(detail.document.revision,3);assert.equal(detail.versions.length,2);
 assert.equal((await f.upload()).response.status,409);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_versions').get().n,2);
 assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('library: immutable command replay, lost upload receipt, conflicting identifier and stale revision',async t=>{
 const f=await fixture(t),initial=await f.upload();assert.equal(initial.response.status,200);
 const op=await(await f.call('/admin/library/operations/'+initial.c.requestId)).json();assert.equal(op.receipt.id,initial.id);
 const replay=await f.upload({...initial.c,id:initial.id,revision:0});assert.equal(replay.response.status,200,await replay.response.clone().text());
 assert.equal((await f.upload({...initial.c,id:initial.id,revision:0,bytes:'%PDF-changed'})).response.status,409);
 const c=f.command(initial.id,1,'describe',{title:'Titre révisé',level:'Recette',description:'Description'});
 assert.equal((await f.call('/admin/library',c)).status,200);assert.equal((await f.call('/admin/library',c)).status,200);
 assert.equal((await f.call('/admin/library',{...c,title:'Autre'})).status,409);
 assert.equal((await f.call('/admin/library',f.command(initial.id,1,'status',{active:false}))).status,409);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_admin_events WHERE action LIKE \'library_%\'').get().n,2);
});
test('library: school assignment never provisions accounts or activations; withdrawal overrides codes',async t=>{
 const f=await fixture(t),initial=await f.upload(),id=initial.id;
 const teachers=await f.client('pilot-a-teacher'),director=await f.client('pilot-a-director'),b=await f.client('pilot-b-teacher'),student=await f.client('pilot-a-student'),parent=await f.client('pilot-a-parent');
 const list=async call=>(await(await call('/reader')).json()).manuals;
 assert.deepEqual(await list(teachers),[]);
 const issue=()=>f.call('/admin/manual-codes',{id:crypto.randomUUID(),schoolId:'pilot-school-a',manualId:id,expiresAt:null});
 assert.equal((await issue()).status,409);
 assert.equal((await f.call('/admin/library',f.command(id,1,'assign',{schoolId:'pilot-school-a',active:true}))).status,200);
 assert.equal((await list(teachers)).length,1);assert.equal((await list(director)).length,1);assert.deepEqual(await list(student),[]);assert.deepEqual(await list(parent),[]);assert.deepEqual(await list(b),[]);
 const issued=await issue(),secret=(await issued.json()).code;assert.equal(issued.status,201);assert.ok(secret);
 assert.equal((await student('/manuals/activate',{code:secret})).status,201);
 assert.equal((await list(student)).length,1);assert.equal((await list(parent)).length,1);
 const codeBefore=f.sqlite.prepare('SELECT * FROM pilot_manual_codes WHERE manual_id=?').all(id);
 assert.equal((await f.call('/admin/library',f.command(id,2,'assign',{schoolId:'pilot-school-a',active:false}))).status,200);
 for(const client of [teachers,director,student,parent,b]){assert.deepEqual(await list(client),[]);assert.equal((await client('/reader/'+id)).status,404);}
 assert.equal((await student('/manuals/activate',{code:secret})).status,422);assert.deepEqual((await(await student('/manuals')).json()).manuals.filter(x=>x.manualId===id),[]);assert.equal((await issue()).status,409);
 assert.equal((await f.call('/admin/library',f.command(id,3,'assign',{schoolId:'pilot-school-a',active:true}))).status,200);
 assert.equal((await list(student)).length,1);assert.equal((await list(parent)).length,1);assert.deepEqual(f.sqlite.prepare('SELECT * FROM pilot_manual_codes WHERE manual_id=?').all(id),codeBefore);
 assert.equal((await f.call('/admin/library',f.command(id,4,'status',{active:false}))).status,200);assert.deepEqual(await list(student),[]);
 assert.equal((await f.call('/admin/library',f.command(id,5,'status',{active:true}))).status,200);assert.equal((await list(student)).length,1);
});
test('library: pinned file refuses obsolete Range; legacy range kept until adoption',async t=>{
 const f=await fixture(t),initial=await f.upload();
 const before=(await(await f.call('/reader/'+initial.id)).json()).manuals[0];assert.match(before.src,/versions\/[a-f0-9]{64}\/file$/);
 assert.equal((await f.call(before.src.slice(base.length),undefined,{headers:{Range:'bytes=0-4'}})).status,206);
 assert.equal((await f.call('/reader/'+initial.id+'/file',undefined,{headers:{Range:'bytes=0-4'}})).status,404);
 assert.equal((await f.upload({id:initial.id,revision:1,bytes:'%PDF-next'})).response.status,200);
 assert.equal((await f.call(before.src.slice(base.length),undefined,{headers:{Range:'bytes=0-4'}})).status,404);
});
test('library: session expiry/revocation and concurrent metadata during validation cannot commit',async t=>{
 for(const change of [f=>f.sqlite.exec("UPDATE pilot_sessions SET revoked_at=1"),f=>f.sqlite.exec("UPDATE pilot_admins SET active=0"),f=>f.sqlite.exec("UPDATE pilot_sessions SET expires_at=1")]){
  const f=await fixture(t);f.setAfterReceive(()=>change(f));const r=await f.upload();assert.equal(r.response.status,403);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_operations').get().n,0);
 }
 const f=await fixture(t),initial=await f.upload();f.setAfterReceive(()=>f.sqlite.prepare('UPDATE pilot_manuals SET title=? WHERE id=?').run('Concurrent',initial.id));
 assert.equal((await f.upload({id:initial.id,revision:1,bytes:'%PDF-next'})).response.status,409);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_versions').get().n,1);
});
test('library: non-admin, absent local binding, CSRF and malformed commands fail closed',async t=>{
 const f=await fixture(t);for(const id of ['pilot-a-student','pilot-a-parent','pilot-a-teacher','pilot-a-director']){const call=await f.client(id);assert.equal((await call('/admin/library')).status,403);}
 assert.equal((await f.call('/admin/library',undefined,{env:{LOCAL_MANUAL_FILES:null}})).status,404);
 assert.equal((await f.call('/admin/library',{} ,{headers:{'X-CSRF-Token':''}})).status,403);
 assert.equal((await f.call('/admin/library',{})).status,422);assert.equal((await f.call('/admin/library?school=x')).status,422);
 const {handleAdminLibrary}=await import('../worker/pilot/admin-library.js');
 await assert.rejects(handleAdminLibrary(new Request(origin+base+'/admin/library'),{DB:{prepare(){throw Error('Remote SQL must not run');}},LOCAL_MANUAL_FILES:f.files},{assurance:'oidc'},false),e=>e.status===404);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_documents').get().n,0);
});
test('library: legacy private document adopted without changing code rights or original bytes',async t=>{
 const f=await fixture(t),sha='a'.repeat(64),id='legacy';
 f.sqlite.prepare('INSERT INTO pilot_manuals VALUES(?,?,?,1)').run(id,'Original','Test');f.sqlite.prepare('INSERT INTO pilot_manual_files VALUES(?,?,?,?,?,?,?)').run(id,sha+'.pdf',sha,10,1,'local_test',now());
 f.sqlite.prepare('INSERT INTO pilot_manual_codes(id,school_id,manual_id,code_hash,created_by,created_at,student_id,activated_at) VALUES(?,?,?,?,?,?,?,?)').run('legacy-code','pilot-school-a',id,await hash('secret'),'pilot-local-admin',now(),'pilot-a-student',now());
 assert.equal((await f.call('/admin/library',f.command(id,0,'describe',{title:'Titre corrigé',level:'Test',description:''}))).status,200);
 const s=await f.client('pilot-a-student');assert.equal((await s('/reader/'+id)).status,200);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_versions WHERE manual_id=?').get(id).n,1);
 assert.equal((await f.call('/admin/library',f.command(id,1,'assign',{schoolId:'pilot-school-a',active:false}))).status,200);assert.equal((await s('/reader/'+id)).status,404);
});
test('library: race immediately before transaction cannot bypass revoked admin, school or expected state',async t=>{
 for(const kind of ['admin','school','document']){
  const f=await fixture(t),initial=await f.upload(),batch=f.DB.batch.bind(f.DB);
  f.DB.batch=async statements=>{
   if(kind==='admin')f.sqlite.exec('UPDATE pilot_admins SET active=0');
   if(kind==='school')f.sqlite.exec("UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'");
   if(kind==='document')f.sqlite.prepare('UPDATE pilot_manuals SET active=0 WHERE id=?').run(initial.id);
   return batch(statements);
  };
  const r=await f.call('/admin/library',f.command(initial.id,1,'assign',{schoolId:'pilot-school-a',active:true}));assert.equal(r.status,kind==='admin'?403:409);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_assignments').get().n,0);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_operations').get().n,1);
 }
});
test('library: concurrent imports/changes have one winner, immutable retry confirms without duplicate journal',async t=>{
 const f=await fixture(t),requestId=crypto.randomUUID(),pair=await Promise.all([f.upload({requestId}),f.upload({requestId})]);assert.equal(pair.filter(x=>x.response.status===200).length,1);assert.equal(pair.filter(x=>x.response.status===409).length,1);
 assert.equal((await f.upload({requestId})).response.status,200);const id=pair[0].id;
 const changes=await Promise.all([false,true].map(active=>f.call('/admin/library',f.command(id,1,'status',{active}))));assert.deepEqual(changes.map(r=>r.status).sort(),[200,409]);
 assert.equal(f.sqlite.prepare('SELECT revision FROM pilot_library_documents WHERE manual_id=?').get(id).revision,2);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_library_operations').get().n,2);
});
test('library: missing historical bytes refuse restore without changing current pointer or receipt',async t=>{
 const f=await fixture(t),first=await f.upload(),old=(await(await f.call('/admin/library/'+first.id)).json()).document.version;
 assert.equal((await f.upload({id:first.id,revision:1,bytes:'%PDF-next'})).response.status,200);f.files.verify=async()=>false;
 assert.equal((await f.call('/admin/library',f.command(first.id,2,'restore',{version:old}))).status,404);
 const doc=(await(await f.call('/admin/library/'+first.id)).json()).document;assert.notEqual(doc.version,old);assert.equal(doc.revision,2);
});
test('library: distant manual endpoints never require local-only tables',async t=>{
 const f=await fixture(t);f.sqlite.exec('DROP TABLE pilot_library_assignments; DROP TABLE pilot_library_versions; DROP TABLE pilot_library_documents; DROP TABLE pilot_library_operations;');
 const student=await f.client('pilot-a-student');assert.equal((await student('/manuals',undefined,{env:{LOCAL_MANUAL_FILES:null}})).status,200);
 assert.equal((await f.call('/admin/manual-codes',{id:crypto.randomUUID(),schoolId:'pilot-school-a',manualId:'unknown',expiresAt:null},{env:{LOCAL_MANUAL_FILES:null}})).status,409);
});
