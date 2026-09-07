import test from 'node:test';
import assert from 'node:assert/strict';
import {openPilotDatabase,seedLocalPilot,LOCAL_PROFILES} from '../scripts/pilot-local-store.mjs';
import {issueSession,now} from '../worker/pilot/session.js';
import {handlePilot} from '../worker/pilot/api.js';
import {byteRange} from '../worker/pilot/manual-reader.js';
const origin='http://127.0.0.1:5173',bytes=new TextEncoder().encode('%PDF-test-private');
async function fixture(t){
 const f=openPilotDatabase();seedLocalPilot(f.sqlite);t.after(()=>f.close());
 f.sqlite.prepare('INSERT INTO pilot_manuals VALUES(?,?,?,1)').run('book','Document privé de test','Test technique');
 f.sqlite.prepare('INSERT INTO pilot_manual_files VALUES(?,?,?,?,?,?,?)').run('book','a'.repeat(64)+'.pdf','a'.repeat(64),bytes.length,1,'local_test',now());
 f.sqlite.prepare('INSERT INTO pilot_manual_codes VALUES(?,?,?,?,?,?,?,?,?,?)').run('code','pilot-school-a','book','b'.repeat(64),'pilot-local-admin',now()-50,now()-10,null,'pilot-a-student',now()-20);
 let opened=0,cancelled=0,beforeOpen=null;
 const files={allowedUsers:new Set(LOCAL_PROFILES.map(p=>p.id)),async open(r,range,head){opened++;await beforeOpen?.();return {body:head?null:bytes.slice(range.start,range.end+1),cancel:async()=>{cancelled++;}};}};
 async function client(id){
  const s=id?await issueSession(f.DB,id,'local_fixture',true):null;
  return async(path='/reader',options={})=>handlePilot(new Request(origin+'/api/pilot'+path,{method:options.method||'GET',headers:{...(s?{Cookie:s.cookie.split(';')[0]}:{}),...options.headers}}),{DB:f.DB,LOCAL_MANUAL_FILES:files,...options.env},{local:options.local??true});
 }
 return {...f,client,files,opened:()=>opened,cancelled:()=>cancelled,setBeforeOpen:fn=>{beforeOpen=fn;}};
}
test('manual reader: five authorized roles, private catalogue and byte ranges',async t=>{
 const f=await fixture(t);
 for(const id of ['pilot-a-student','pilot-a-parent','pilot-a-teacher','pilot-a-director','pilot-local-admin']){
  const call=await f.client(id),list=await call(),data=await list.json();
  assert.equal(list.status,200);assert.equal(data.manuals[0].id,'book');assert.equal(data.userId,id);assert.doesNotMatch(JSON.stringify(data),/storage_key|code_hash|csrf|token|student_id/);
  const file=await call('/reader/book/file',{headers:{Range:'bytes=0-4'}});assert.equal(file.status,206);assert.equal(await file.text(),'%PDF-');assert.equal(file.headers.get('Content-Range'),'bytes 0-4/17');
  for(const [h,v]of [['Cache-Control','no-store'],['Cross-Origin-Resource-Policy','same-origin'],['X-Content-Type-Options','nosniff']])assert.equal(file.headers.get(h),v);
  const head=await call('/reader/book/file',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }
});
test('manual reader: anonymous, no activation, unrelated parent and school see no private metadata',async t=>{
 const f=await fixture(t);assert.equal((await(await f.client())('/reader/book/file')).status,401);
 for(const id of ['pilot-a-other','pilot-b-parent','pilot-b-student','pilot-b-teacher','pilot-b-director']){
  const call=await f.client(id);assert.deepEqual((await(await call()).json()).manuals,[]);
  for(const p of ['/reader/book','/reader/book/file']){const r=await call(p);assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/Document privé|Content-Length|17/);}
 }
 assert.equal(f.opened(),0);
});
for(const [name,sql,id]of [
 ['code revoked',"UPDATE pilot_manual_codes SET revoked_at=1",'pilot-a-student'],
 ['manual suspended',"UPDATE pilot_manuals SET active=0",'pilot-a-student'],
 ['parent link removed',"UPDATE pilot_family_links SET active=0",'pilot-a-parent'],
 ['child suspended',"UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'",'pilot-a-parent'],
 ['school suspended',"UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'",'pilot-a-teacher'],
 ['session revoked',"UPDATE pilot_sessions SET revoked_at=1",'pilot-a-director'],
 ['admin revoked',"UPDATE pilot_admins SET active=0",'pilot-local-admin'],
 ['child elevated',"INSERT INTO pilot_admins VALUES('pilot-a-student',1)",'pilot-a-parent'],
]){
 test('manual reader: '+name+' between open and response yields no PDF',async t=>{
  const f=await fixture(t),call=await f.client(id);f.setBeforeOpen(()=>f.sqlite.exec(sql));
  const r=await call('/reader/book/file');assert.ok([401,403,404].includes(r.status),await r.clone().text());assert.equal(f.cancelled(),1);assert.notEqual(r.headers.get('content-type'),'application/pdf');
 });
}
test('manual reader: expired activation deadline keeps claim but expired unused code gives staff no right',async t=>{
 const f=await fixture(t),call=await f.client('pilot-a-teacher');assert.equal((await call('/reader/book')).status,200);
 f.sqlite.exec('UPDATE pilot_manual_codes SET student_id=NULL,activated_at=NULL');assert.equal((await call('/reader/book')).status,404);
});
test('manual reader: invalid routes/queries, read-only methods, ranges and remote exclusion',async t=>{
 const f=await fixture(t),call=await f.client('pilot-local-admin');
 assert.equal((await call('/reader?schoolId=x')).status,422);assert.equal((await call('/reader/book/other')).status,404);
 assert.equal((await call('/reader/book',{method:'HEAD'})).status,405);assert.equal((await call('/reader/book/file',{method:'POST'})).status,405);
 for(const range of ['bytes=17-','bytes=0-2,4-6','bytes=-0','bytes=999999999999999999999999-'])assert.equal((await call('/reader/book/file',{headers:{Range:range}})).status,416);
 assert.equal(await(await call('/reader/book/file',{headers:{Range:'bytes=-7'}})).text(),'private');
 // Calling the module through the local dispatcher with no byte binding remains closed.
 assert.equal((await call('/reader/book',{env:{LOCAL_MANUAL_FILES:null}})).status,404);
 const {handleManualReader}=await import('../worker/pilot/manual-reader.js');
 await assert.rejects(handleManualReader(new Request(origin+'/api/pilot/reader'),{DB:f.DB,LOCAL_MANUAL_FILES:f.files},{user_id:'pilot-local-admin',assurance:'local_fixture'},false),e=>e.status===404);
 assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('manual reader: current time guard refuses session expiring during open',async t=>{
 const f=await fixture(t),call=await f.client('pilot-a-student'),original=Date.now;
 f.setBeforeOpen(()=>{Date.now=()=>original()+4*60*60*1000;});
 try{assert.equal((await call('/reader/book/file')).status,403);assert.equal(f.cancelled(),1);}finally{Date.now=original;}
});
test('byteRange rejects unsafe/multipart and normalizes exact/suffix/end bounds',()=>{
 assert.deepEqual(byteRange(null,10),{start:0,end:9,partial:false});
 assert.deepEqual(byteRange('bytes=3-99',10),{start:3,end:9,partial:true});
 assert.deepEqual(byteRange('bytes=-99',10),{start:0,end:9,partial:true});
 for(const text of ['bytes=','bytes=-','bytes=5-4','Bytes=0-1','bytes=0-1,3-4','bytes=9007199254740993-','bytes=-9007199254740993'])assert.equal(byteRange(text,10),null);
});
