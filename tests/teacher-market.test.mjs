import test from 'node:test';
import assert from 'node:assert/strict';
import {openPilotDatabase,seedLocalPilot} from '../scripts/pilot-local-store.mjs';
import {issueSession} from '../worker/pilot/session.js';
import {handlePilot} from '../worker/pilot/api.js';
import {MARKET_MISSIONS as missions,MARKET_TIERS as tiers} from '../worker/pilot/market-content-v1.js';
import {summarizeSchoolMarket,filterSchoolMarket,schoolMarketCsv} from '../src/features/pilote/teacherMarketCore.js';
const origin='http://127.0.0.1:5173',root='/teacher/market',game='/games/souk-des-mots';
async function fixture(t){
 const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
 async function client(id,binding=store.DB){
  const session=id?await issueSession(store.DB,id,'local_fixture',true):null;
  const call=async(path=root,body)=>{const response=await handlePilot(new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(session?{Cookie:session.cookie.split(';')[0]}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:binding},{local:true});return {status:response.status,data:await response.json(),headers:response.headers};};
  return {call,session};
 }
 return {...store,client,teacher:await client('pilot-a-teacher'),student:await client('pilot-a-student')};
}
async function action(c,b,operation,body={}){const r=await c.call(game+'/'+operation,{requestId:crypto.randomUUID(),revision:b.revision,...body});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function solve(c,b,help=false){
 const run=b.state.runs[b.state.activeTierId],m=missions.find(m=>m.id===tiers.find(t=>t.id===b.state.activeTierId).missionIds[run.index]);
 if(help)b=await action(c,b,'help');
 for(const [productId,count]of Object.entries(m.expectedBasket))for(let i=0;i<count;i++)b=await action(c,b,'quantity',{productId,delta:1});
 b=await action(c,b,'formula',{formulaId:m.formulas.find(f=>f.correct).id});return action(c,b,'validate');
}
async function finishTier(c,b,tier,help=false){b=await action(c,b,'open',{tierId:tier.id});for(let i=0;i<4;i++){b=await solve(c,b,help);b=await action(c,b,'next');if(i<3&&b.state.screen==='journey')b=await action(c,b,'open',{tierId:tier.id});}return b;}
test('teacher market is read-only, scoped, no-store and never seeded from demo analytics',async t=>{
 const f=await fixture(t),before=f.sqlite.prepare('SELECT count(*) n FROM pilot_game_progress').get().n,r=await f.teacher.call();
 assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.data.source,'pilot_local_fixture');
 assert.deepEqual(r.data.students.map(s=>s.id).sort(),['pilot-a-other','pilot-a-student']);assert.equal(r.data.classes.length,1);
 assert.ok(r.data.students.every(s=>!s.started&&s.helpCount===0&&s.soukXp===0&&s.status==='not-started'));
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_game_progress').get().n,before);
 assert.equal((await f.teacher.call(root,{})).status,405);assert.equal((await f.teacher.call(root+'?studentId=pilot-b-student')).status,422);
 assert.equal((await f.teacher.call(root+'/anything')).status,404);
 const data=summarizeSchoolMarket(r.data.students,r.data.tiers);assert.equal(data.summary.studentCount,2);assert.equal(data.summary.startedCount,0);assert.equal(data.summary.averageAutonomy,null);
});
test('teacher market denies anonymous, pupils, parent, administrator and teacher play',async t=>{
 const f=await fixture(t);assert.equal((await (await f.client(null)).call()).status,401);
 for(const id of ['pilot-a-student','pilot-a-parent','pilot-local-admin'])assert.equal((await(await f.client(id)).call()).status,403);
 assert.equal((await f.teacher.call(game)).status,403);
});
test('teacher sees only assigned classes, unique pupils, and no foreign classes on shared pupils',async t=>{
 const f=await fixture(t),db=f.sqlite;
 db.prepare("INSERT INTO pilot_classes(id,school_id,name) VALUES('same-school-hidden','pilot-school-a','Classe privée')").run();
 db.prepare("INSERT INTO pilot_class_members(school_id,class_id,user_id) VALUES('pilot-school-a','same-school-hidden','pilot-a-student')").run();
 let r=(await f.teacher.call()).data;assert.equal(r.students.length,2);assert.doesNotMatch(JSON.stringify(r),/same-school-hidden|Classe privée|Nora/);
 db.prepare("INSERT INTO pilot_class_members(school_id,class_id,user_id) VALUES('pilot-school-a','same-school-hidden','pilot-a-teacher')").run();
 r=(await f.teacher.call()).data;assert.equal(r.classes.length,2);assert.equal(r.students.length,2);assert.equal(r.students.find(s=>s.id==='pilot-a-student').classIds.length,2);
 const other=(await(await f.client('pilot-b-teacher')).call()).data;assert.deepEqual(other.students.map(s=>s.id),['pilot-b-student']);
});
test('opening a mission counts as started before any award; no answers or session data enter DTO',async t=>{
 const f=await fixture(t);await action(f.student,(await f.student.call(game)).data,'open',{tierId:tiers[0].id});
 const s=(await f.teacher.call()).data.students.find(s=>s.id==='pilot-a-student');assert.equal(s.started,true);assert.equal(s.completedCount,0);assert.equal(s.status,'on-track');assert.equal(s.tiers[0].started,true);
 for(const forbidden of ['basket','formulaId','feedback','runId','csrf','token_hash','email','progress_json'])assert.equal(JSON.stringify(s).includes('"'+forbidden+'"'),false,forbidden);
});
test('first guided successes survive autonomous reviews while XP and autonomy use award ledger',async t=>{
 const f=await fixture(t);let b=await finishTier(f.student,(await f.student.call(game)).data,tiers[0],true);
 let data=(await f.teacher.call()).data,s=data.students.find(s=>s.id==='pilot-a-student');assert.equal(s.completedCount,4);assert.equal(s.helpCount,4);assert.equal(s.autonomyCount,0);assert.equal(s.soukXp,40);assert.equal(s.status,'support');
 b=await finishTier(f.student,b,tiers[0]);data=(await f.teacher.call()).data;s=data.students.find(s=>s.id==='pilot-a-student');
 assert.equal(s.helpCount,4);assert.equal(s.autonomyCount,4);assert.equal(s.soukXp,60);assert.equal(s.completedCount,4);
 const snapshot=JSON.stringify(data.students);await f.teacher.call();assert.equal(JSON.stringify((await f.teacher.call()).data.students),snapshot);
});
test('complete old parcours never becomes an inactivity alert; all twelve rewards reconcile',async t=>{
 const f=await fixture(t);let b=(await f.student.call(game)).data;for(const tier of tiers)b=await finishTier(f.student,b,tier);
 const old=Math.floor(Date.now()/1000)-30*86400;f.sqlite.prepare('UPDATE pilot_game_progress SET updated_at=?').run(old);f.sqlite.prepare('UPDATE pilot_market_awards SET awarded_at=?').run(old);
 const r=(await f.teacher.call()).data,s=r.students.find(s=>s.id==='pilot-a-student');assert.equal(s.status,'completed');assert.equal(s.soukXp,180);assert.equal(s.completedCount,12);assert.equal(s.daysSinceActivity,30);
 const summary=summarizeSchoolMarket(r.students,r.tiers).summary;assert.equal(summary.startedCount,1);assert.equal(summary.totalMasteries,12);assert.equal(summary.totalAutonomousMasteries,12);assert.equal(summary.supportCount,0);
 assert.equal(filterSchoolMarket(r.students,{period:'7'},r.generatedAt).length,0);
});
test('inactive unfinished draft is support, but unstarted pupils are not labelled inactive',async t=>{
 const f=await fixture(t);await action(f.student,(await f.student.call(game)).data,'open',{tierId:tiers[0].id});f.sqlite.prepare('UPDATE pilot_game_progress SET updated_at=?').run(Math.floor(Date.now()/1000)-8*86400);
 const r=(await f.teacher.call()).data;assert.equal(r.students.find(s=>s.id==='pilot-a-student').status,'support');assert.equal(r.students.find(s=>s.id==='pilot-a-other').status,'not-started');
});
test('unknown content version blocks a misleading partial report',async t=>{
 const f=await fixture(t);await action(f.student,(await f.student.call(game)).data,'open',{tierId:tiers[0].id});f.sqlite.prepare("UPDATE pilot_game_progress SET progress_json=json_set(progress_json,'$.contentVersion','future')").run();assert.equal((await f.teacher.call()).status,503);
});
test('live teacher role, class and pupil visibility are rechecked',async t=>{
 const f=await fixture(t);f.sqlite.prepare("UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-other'").run();assert.equal((await f.teacher.call()).data.students.length,1);
 f.sqlite.prepare("DELETE FROM pilot_class_members WHERE user_id='pilot-a-teacher'").run();const empty=await f.teacher.call();assert.equal(empty.status,200);assert.deepEqual(empty.data.students,[]);assert.deepEqual(empty.data.classes,[]);
 f.sqlite.prepare("UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-teacher'").run();assert.equal((await f.teacher.call()).status,403);
});
test('scope change during query prevents disclosure of stale pupil list',async t=>{
 const f=await fixture(t);let changed=false;
 const binding={...f.DB,prepare(sql){const prepared=f.DB.prepare(sql);return {bind(...values){const bound=prepared.bind(...values);return {...bound,async first(){const row=await bound.first();if(sql.includes(' data_json')&&!changed){changed=true;f.sqlite.prepare("DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'").run();}return row;}};}};}};
 const teacher=await f.client('pilot-a-teacher',binding);const r=await teacher.call();assert.equal(changed,true);assert.equal(r.status,403);assert.equal(r.data.students,undefined);
});
test('all filters apply to cohort cards, tiers and CSV with injection-safe cells and no empty percentages',async t=>{
 const f=await fixture(t);await action(f.student,(await f.student.call(game)).data,'open',{tierId:tiers[0].id});let data=(await f.teacher.call()).data;
 const filters={classId:data.classes[0].id,status:'on-track',period:'7',query:'lína'};let rows=filterSchoolMarket(data.students,filters,data.generatedAt);assert.equal(rows.length,1);
 const summary=summarizeSchoolMarket(rows,data.tiers);assert.equal(summary.summary.studentCount,1);assert.equal(summary.summary.startedCount,1);
 rows=[{...rows[0],name:'=1+1\r\nNom;"'}];const csv=schoolMarketCsv(data,rows,filters);assert.match(csv,/'=1\+1/);assert.match(csv,/pilot_local_fixture/);assert.equal(csv.includes('Adam'),false);
 const empty=summarizeSchoolMarket([],data.tiers);assert.equal(empty.summary.averageProgress,null);assert.equal(empty.tierSummaries[0].completionPercent,null);assert.equal(empty.summary.averageAutonomy,null);
});
test('missing first-success evidence is unknown, not zero hints or inferred guidance',async t=>{
 const f=await fixture(t);let b=await action(f.student,(await f.student.call(game)).data,'open',{tierId:tiers[0].id});await solve(f.student,b,true);
 f.sqlite.prepare("UPDATE pilot_game_progress SET progress_json=json_set(progress_json,'$.runs.discovery.results',json('[]'))").run();
 const s=(await f.teacher.call()).data.students.find(s=>s.id==='pilot-a-student');assert.equal(s.completedCount,1);assert.equal(s.helpCount,null);assert.equal(s.partialData,true);assert.equal(s.soukXp,10);
});
test('administrator grants exclude nominal pupil or teacher memberships',async t=>{
 const f=await fixture(t);f.sqlite.prepare("INSERT INTO pilot_admins(user_id) VALUES('pilot-a-other')").run();assert.equal((await f.teacher.call()).data.students.length,1);
 f.sqlite.prepare("INSERT INTO pilot_admins(user_id) VALUES('pilot-a-teacher')").run();assert.equal((await f.teacher.call()).status,403);
});
test('oversized cohort fails explicitly rather than presenting a truncated denominator',async t=>{
 const f=await fixture(t),db=f.sqlite;const user=db.prepare('INSERT INTO pilot_users(id,display_name,created_at) VALUES(?,?,0)'),member=db.prepare("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES('pilot-school-a',?,'eleve')"),group=db.prepare("INSERT INTO pilot_class_members(school_id,class_id,user_id) VALUES('pilot-school-a','pilot-class-a',?)");
 db.exec('BEGIN');for(let i=0;i<999;i++){const id='bounded-test-'+i;user.run(id,'Élève fictif '+i);member.run(id);group.run(id);}db.exec('COMMIT');
 const r=await f.teacher.call();assert.equal(r.status,503);assert.equal(r.data.error.code,'roster_too_large');assert.equal(r.data.students,undefined);
});
