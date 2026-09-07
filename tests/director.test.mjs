import test from 'node:test';
import assert from 'node:assert/strict';
import {openPilotDatabase,seedLocalPilot} from '../scripts/pilot-local-store.mjs';
import {issueSession,now} from '../worker/pilot/session.js';
import {handlePilot} from '../worker/pilot/api.js';
import {handleLocalPilot} from '../scripts/pilot-local-api.mjs';
import {LOCAL_CREDENTIALS} from '../scripts/pilot-local-credentials.mjs';
import {directorModel,directorCsv,directorSelection,directorPercent} from '../src/features/pilote/directorCore.js';
import {parseCsv} from '../src/features/beta-data/csvImportCore.js';
const origin='http://127.0.0.1:5173';
async function fixture(t){const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
 async function client(id,binding=store.DB){const session=id?await issueSession(store.DB,id,'local_fixture',true):null;
  return {session,call:async(path='/director',body)=>{const response=await handlePilot(new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(session?{Cookie:session.cookie.split(';')[0]}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:binding},{local:true});return {status:response.status,data:await response.json(),headers:response.headers};}};
 }
 return {...store,client,director:await client('pilot-a-director')};
}
test('Direction: current school roster, no-store and read-only, no private game payload',async t=>{
 const f=await fixture(t),r=await f.director.call();assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.data.source,'pilot_local_fixture');assert.equal(r.data.role,'directeur');
 assert.deepEqual(r.data.students.map(s=>s.id),['pilot-a-other','pilot-a-student']);assert.deepEqual(r.data.teachers.map(s=>s.id),['pilot-a-teacher']);assert.equal(r.data.classes.length,1);
 assert.doesNotMatch(JSON.stringify(r.data),/Nora|Oliviers|token_hash|csrf_token|code_hash|state_json|selectedIndex|feedback|email/);
 assert.equal((await f.director.call('/director',{})).status,405);assert.equal((await f.director.call('/director?schoolId=pilot-school-b')).status,422);assert.equal((await f.director.call('/director/classes')).status,404);
 const tables=f.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(r=>r.name),before=tables.map(name=>JSON.stringify(f.sqlite.prepare('SELECT * FROM '+name).all()));
 await f.director.call();assert.deepEqual(tables.map(name=>JSON.stringify(f.sqlite.prepare('SELECT * FROM '+name).all())),before);
});
test('Direction: anonymous and all other roles denied; director cannot administer, teach, activate or play',async t=>{
 const f=await fixture(t);assert.equal((await(await f.client()).call()).status,401);
 for(const id of ['pilot-local-admin','pilot-a-teacher','pilot-a-student','pilot-a-parent'])assert.equal((await(await f.client(id)).call()).status,403,id);
 for(const path of ['/admin','/manuals','/teacher/market','/games/souk-des-mots','/games/defis-classe','/workspace'])assert.equal((await f.director.call(path)).status,403,path);
 assert.equal((await f.director.call('/assignments',{})).status,403);
});
test('Direction: other school, unattached pupil and deduplicated multi-class pupils',async t=>{
 const f=await fixture(t),db=f.sqlite;db.exec("INSERT INTO pilot_classes(id,school_id,name) VALUES('second','pilot-school-a','6e B');INSERT INTO pilot_class_members VALUES('pilot-school-a','second','pilot-a-student')");
 let data=(await f.director.call()).data,model=directorModel(data);assert.equal(model.totals.students,2);assert.equal(model.classes.length,2);assert.equal(model.totals.unassigned,1);assert.equal(data.students.find(p=>p.id==='pilot-a-student').classIds.length,2);
 db.exec("DELETE FROM pilot_class_members WHERE user_id='pilot-a-other'");data=(await f.director.call()).data;assert.equal(directorModel(data).totals.unplaced,1);assert.equal(data.students.length,2);
 const other=(await(await f.client('pilot-b-director')).call()).data;assert.deepEqual(other.students.map(s=>s.id),['pilot-b-student']);assert.doesNotMatch(JSON.stringify(other),/Lina|Adam|second|Atlas/);
});
test('Direction: accounts/manual activations/activity are distinct; expired redemption deadline keeps already activated access',async t=>{
 const f=await fixture(t),db=f.sqlite,time=now();db.exec("INSERT INTO pilot_manuals VALUES('manual','Manuel test','5e AEP',1)");
 db.prepare('INSERT INTO pilot_manual_codes VALUES(?,?,?,?,?,?,?,?,?,?)').run('code','pilot-school-a','manual','a'.repeat(64),'pilot-local-admin',time-10000,time-5000,null,'pilot-a-student',time-8000);
 let model=directorModel((await f.director.call()).data);assert.equal(model.totals.students,2);assert.equal(model.totals.activated,1);assert.equal(model.totals.recent,0);
 db.exec("UPDATE pilot_manual_codes SET revoked_at=1 WHERE id='code'");assert.equal(directorModel((await f.director.call()).data).totals.activated,0);
 db.exec("UPDATE pilot_manual_codes SET revoked_at=NULL;UPDATE pilot_manuals SET active=0");assert.equal(directorModel((await f.director.call()).data).totals.activated,0);
});
test('Direction: XP and 7/30-day activity do not reset totals or count future traces',async t=>{
 const f=await fixture(t),db=f.sqlite,time=now();for(const id of ['pilot-a-student','pilot-a-other'])db.prepare('INSERT INTO pilot_game_progress VALUES(?,?,?,?,?,0,1,?,?,?)').run('pilot-school-a',id,'mots-fleches','facile','{}','r'.repeat(36),'h'.repeat(64),id==='pilot-a-student'?time-10*86400:time+86400);db.prepare('INSERT INTO pilot_game_awards VALUES(?,?,?,?,20,?)').run('pilot-school-a','pilot-a-student','mots-fleches','facile',time-10*86400);
 db.prepare('INSERT INTO pilot_game_awards VALUES(?,?,?,?,20,?)').run('pilot-school-a','pilot-a-other','mots-fleches','facile',time+86400);
 const data=(await f.director.call()).data;assert.equal(directorModel(data,{days:'7'}).totals.recent,0);assert.equal(directorModel(data,{days:'30'}).totals.recent,1);assert.equal(directorModel(data).totals.xp,20);
});
test('Direction: inactive pupils/classes/teachers and admin-granted memberships excluded',async t=>{
 const f=await fixture(t);f.sqlite.exec("UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-other';UPDATE pilot_users SET active=0 WHERE id='pilot-a-teacher';UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'");
 let data=(await f.director.call()).data;assert.equal(data.students.length,1);assert.equal(data.teachers.length,0);assert.equal(data.classes.length,0);
 f.sqlite.exec("INSERT INTO pilot_admins VALUES('pilot-a-student',1)");data=(await f.director.call()).data;assert.equal(data.students.length,0);assert.equal(directorPercent(0,0),null);
});
for(const [label,sql]of [['membership',"UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-director'"],['school',"UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'"],['user',"UPDATE pilot_users SET active=0 WHERE id='pilot-a-director'"],['admin grant',"INSERT INTO pilot_admins VALUES('pilot-a-director',1)"],['session',"UPDATE pilot_sessions SET revoked_at=1"]])test('Direction: live '+label+' revocation denies access',async t=>{
 const f=await fixture(t);f.sqlite.exec(sql);assert.ok([401,403].includes((await f.director.call()).status));
});
test('Direction: roster change mid-read fails closed',async t=>{
 const f=await fixture(t);let changed=false;
 const wrapped={...f.DB,prepare(sql){if(!changed&&sql.includes('pupil_count')&&!sql.includes('awards AS')){changed=true;f.sqlite.exec("UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'");}return f.DB.prepare(sql);}};
 const r=await(await f.client('pilot-a-director',wrapped)).call();assert.equal(changed,true);assert.equal(r.status,403);assert.equal(r.data.students,undefined);
});
test('Direction: explicit capacity limit instead of truncated school totals',async t=>{
 const f=await fixture(t);for(let i=0;i<201;i++)f.sqlite.prepare('INSERT INTO pilot_classes(id,school_id,name) VALUES(?,?,?)').run('extra'+i,'pilot-school-a','Classe '+i);
 const r=await f.director.call();assert.equal(r.status,503);assert.equal(r.data.error.code,'school_too_large');assert.equal(r.data.classes,undefined);
});
test('Direction: session expiring during snapshot is rejected by final current-time guard',async t=>{
 const f=await fixture(t),originalNow=Date.now;let shifted=false;
 const wrapped={...f.DB,prepare(sql){if(!shifted&&sql.includes('pupil_count')&&!sql.includes('awards AS')){shifted=true;Date.now=()=>originalNow()+4*3600*1000;}return f.DB.prepare(sql);}};
 try{const r=await(await f.client('pilot-a-director',wrapped)).call();assert.equal(shifted,true);assert.equal(r.status,403);}finally{Date.now=originalNow;}
});
test('Direction: route validation, accent search, coherent CSV and safe spreadsheet text',async t=>{
 const f=await fixture(t),data=(await f.director.call()).data;assert.equal(directorModel(data,{query:'sálmá'}).visibleTeachers.length,1);
 for(const search of ['?section=jeux','?section=classes&section=eleves','?section=classes&fiche=a&fiche=b','?section=accueil&fiche=a'])assert.equal(directorSelection(search).invalid,true);
 assert.equal(directorSelection('?section=classes&fiche=pilot-class-a').detail,'pilot-class-a');
 data.students[0].name='=2+3;\nélève';
 for(const kind of ['summary','classes','activation']){const rows=parseCsv(directorCsv(data,{kind,days:'30'}));assert.ok(rows.every(r=>r.length===rows[0].length));assert.ok(rows.slice(1).every(r=>r.at(-1)==='30 jours glissants'));assert.ok(rows.slice(1).every(r=>r.at(-2)==='pilot_local_fixture'));if(kind==='activation')assert.equal(rows[1][0],"'=2+3;\nélève");}
});
test('Direction: two precreated fictional logins keep original school roles and create no classroom membership',async t=>{
 const f=await fixture(t);for(const id of ['pilot-a-director','pilot-b-director']){const a=LOCAL_CREDENTIALS.find(a=>a.profileId===id);const req=profile=>new Request(origin+'/api/pilot/local/credential-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Local-Pilot':'1'},body:JSON.stringify({identifier:a.identifier,password:a.password,profile})});
 const wrong=await handleLocalPilot(req('enseignant'),f.DB);assert.equal(wrong.status,403);const good=await handleLocalPilot(req('directeur'),f.DB);assert.equal(good.status,200);assert.equal((await good.json()).destination,'/pilote?profil=directeur');assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_class_members WHERE user_id=?').get(id).n,0);}
});
