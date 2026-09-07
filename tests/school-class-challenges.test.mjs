import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openPilotDatabase,seedLocalPilot} from '../scripts/pilot-local-store.mjs';
import {issueSession} from '../worker/pilot/session.js';
import {handlePilot} from '../worker/pilot/api.js';
import {classBanks,classLevel,classQuestionMetadata,selectClassQuestions,resolveClassQuestions,CLASS_CONTENT_VERSION} from '../worker/pilot/class-challenge-content-v1.js';
import {getPublishedClassChallengeBanks,resolveClassChallengeQuestions,selectClassChallengeQuestionIds} from '../src/features/games/class-challenges/classChallengeData.js';
import {seedQuestionBank} from '../src/features/question-bank/questionBankSeed.js';
import {prepareQuizQuestions} from '../src/features/games/quizEngine.js';
import {analyticsCsv} from '../src/features/pilote/adminAnalyticsCore.js';
const origin='http://127.0.0.1:5173',root='/games/defis-classe',uuid=()=>crypto.randomUUID();
async function setup(t){
 const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
 async function client(id='pilot-a-student',DB=store.DB){
  const session=id?await issueSession(store.DB,id,'local_fixture',true):null;
  const call=async(path=root,body,headers={})=>{
   const r=await handlePilot(new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(session?{Cookie:session.cookie.split(';')[0]}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':session?.csrfToken??''}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB},{local:true});
   return {status:r.status,data:await r.json(),headers:r.headers};
  };
  return {call,session,start:(id,comfortMode=true,requestId=uuid())=>call(root+'/'+id+'/start',{requestId,comfortMode}),
   step:(b,action,body={},requestId=uuid())=>call(root+'/'+b.challenge.id+'/'+action,{requestId,revision:b.attempt.revision,...body}),
   close:(b,requestId=uuid())=>call(root+'/'+b.challenge.id+'/close',{requestId,revision:b.challenge.revision}),
   create:(overrides={})=>call(root+'/create',{requestId:uuid(),classId:'pilot-class-a',title:'Le défi des explorateurs',theme:'Culture marocaine',bankId:classBanks[0].id,durationHours:72,...overrides})};
 }
 const teacher=await client('pilot-a-teacher'),student=await client(),adam=await client('pilot-a-other');
 return {...store,client,teacher,student,adam,create:async()=>ok(await teacher.create()),awards:()=>store.sqlite.prepare('SELECT count(*) n,coalesce(sum(xp),0) xp FROM pilot_class_awards').get()};
}
function ok(r){assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
function selection(b,correct=true){const ids=b.challenge.questionIds,q=resolveClassQuestions(CLASS_CONTENT_VERSION,ids)[b.attempt.index];return {index:b.attempt.index,selectedIndex:correct?q.correctIndex:(q.correctIndex+1)%4};}
async function answer(c,b,correct=true){return ok(await c.step(b,'answer',selection(b,correct)));}
async function complete(c,b,n=5,{finalNext=true}={}){for(let i=0;i<5;i++){b=await answer(c,b,i<n);if(i<4||finalNext)b=ok(await c.step(b,'next'));}return b;}
test('class corpus is exactly the original published 10/7/5 selection and common order',()=>{
 assert.deepEqual(classBanks,getPublishedClassChallengeBanks(seedQuestionBank));
 assert.deepEqual(classBanks.map(b=>b.questionCount),[10,7,5]);assert.equal(classQuestionMetadata.length,10);
 for(const bank of classBanks)for(const level of ['4e AEP','5e AEP','6e AEP'])for(const theme of ['Culture marocaine','Langue française','Sciences & découvertes','Culture générale']){
  const id='fixed-class',ids=selectClassChallengeQuestionIds({bank,level,theme,questions:seedQuestionBank});
  const expected=prepareQuizQuestions(resolveClassChallengeQuestions({questionIds:ids},seedQuestionBank),{seed:'defi-classe:'+id,limit:5});
  assert.deepEqual(selectClassQuestions({id,bankId:bank.id,level,theme}).map(q=>q.id),expected.map(q=>q.id));
 }
 assert.equal(classLevel('5e AEP · classe de test'),'5e AEP');assert.equal(classLevel('La première'),null);
});
test('GET does not allocate and exposes only own class metadata, no corrections',async t=>{
 const f=await setup(t),r=await f.student.call(),teacher=ok(await f.teacher.call());
 assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(ok(r).challenges,[]);
 assert.equal(teacher.classes[0].level,'5e AEP');assert.equal(teacher.banks.length,3);
 assert.doesNotMatch(JSON.stringify(teacher),/correctIndex|explanation|pilot-a-student|pilot-b-/);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_class_attempts').get().n,0);
});
test('creation validates server-owned scope, published bank, level, fields, quota and exact receipts after closure',async t=>{
 const f=await setup(t),requestId=uuid(),b=ok(await f.teacher.create({requestId}));
 assert.equal(b.challenge.questionIds.length,5);assert.equal(b.challenge.level,'5e AEP');
 assert.equal(ok(await f.teacher.create({requestId})).replayed,true);
 assert.equal((await f.teacher.create({requestId,title:'Autre défi interdit'})).status,409);
 assert.equal((await f.teacher.create({classId:'pilot-class-b'})).status,404);
 for(const overrides of [{bankId:'draft'},{theme:'secret'},{durationHours:2},{score:500},{questionIds:[]}])assert.equal((await f.teacher.create(overrides)).status,422);
 const closed=ok(await f.teacher.close(b));assert.equal(closed.challenge.status,'termine');
 assert.equal(ok(await f.teacher.create({requestId})).challenge.status,'termine');
 for(let i=1;i<20;i++)ok(await f.teacher.create());
 assert.equal((await f.teacher.create()).status,429);
 assert.equal(ok(await f.teacher.create({requestId})).replayed,true);
 f.sqlite.prepare("UPDATE pilot_classes SET name='Niveau à confirmer' WHERE id='pilot-class-a'").run();
 assert.equal((await f.teacher.create()).data.error.code,'class_level_missing');
});
test('same class sees no peer account identifiers; foreign and nonstudent roles cannot play',async t=>{
 const f=await setup(t),b=await f.create(),id=b.challenge.id;
 const nora=await f.client('pilot-b-student'),foreign=await f.client('pilot-b-teacher');
 for(const c of [nora,foreign]){assert.deepEqual(ok(await c.call()).challenges,[]);assert.equal((await c.call(root+'/'+id)).status,404);assert.equal((await c.start(id)).status,404);}
 for(const who of ['pilot-a-parent','pilot-local-admin']){const c=await f.client(who);assert.equal((await c.call()).status,403);}
 assert.equal((await f.student.create()).status,403);assert.equal((await f.student.close(b)).status,403);
 const first=ok(await f.student.start(id)),peer=ok(await f.adam.call(root+'/'+id));
 assert.equal(peer.attempt,null);assert.equal(peer.challenge.ownResult,null);assert.equal(peer.leaderboard.rows.length,1);
 assert.doesNotMatch(JSON.stringify(peer.leaderboard),/studentId|participantId|pilot-|Lina|Adam|correctIndex|email/i);
 assert.equal(peer.leaderboard.rows[0].rank,null);assert.equal(peer.leaderboard.rows[0].isViewer,false);
 assert.equal(first.leaderboard.rows[0].isViewer,true);
});
test('two classes in one school remain isolated at every endpoint',async t=>{
 const f=await setup(t),b=await f.create(),id=b.challenge.id;
 f.sqlite.exec("INSERT INTO pilot_classes(id,school_id,name) VALUES('second','pilot-school-a','6e AEP · B')");
 f.sqlite.exec("DELETE FROM pilot_class_members WHERE user_id='pilot-a-other'; INSERT INTO pilot_class_members VALUES('pilot-school-a','second','pilot-a-other')");
 assert.deepEqual(ok(await f.adam.call()).challenges,[]);
 for(const [suffix,body] of [['',undefined],['/start',{requestId:uuid(),comfortMode:true}],['/answer',{requestId:uuid(),revision:1,index:0,selectedIndex:0}]])assert.equal((await f.adam.call(root+'/'+id+suffix,body)).status,404);
 assert.equal((await f.teacher.create({classId:'second'})).status,404);
 f.sqlite.exec("INSERT INTO pilot_class_members VALUES('pilot-school-a','second','pilot-a-teacher')");
 const other=ok(await f.teacher.create({classId:'second'}));assert.equal(other.challenge.level,'6e AEP');
 assert.equal((await f.student.call(root+'/'+other.challenge.id)).status,404);
 assert.equal(ok(await f.teacher.call()).classes.length,2);
});
test('start resumes once, preserves delay and alias, rejects UUID reuse with changed comfort',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id,requestId=uuid();
 const a=ok(await f.student.start(id,true,requestId)),b=ok(await f.adam.start(id,false));
 assert.equal(a.attempt.durationSeconds,20);assert.equal(b.attempt.durationSeconds,10);
 assert.deepEqual(a.attempt.questions.map(q=>q.id),b.attempt.questions.map(q=>q.id));
 assert.doesNotMatch(JSON.stringify(a.attempt.questions),/correctIndex|explanation/);
 assert.notEqual(a.attempt.pseudonym,b.attempt.pseudonym);
 const resumed=ok(await f.student.start(id,false));assert.equal(resumed.attempt.id,a.attempt.id);assert.equal(resumed.attempt.questionStartedAt,a.attempt.questionStartedAt);assert.equal(resumed.attempt.durationSeconds,20);
 assert.equal((await f.student.start(id,false,requestId)).status,409);
});
test('answer receipts survive later transitions and closure; no rollback, duplicate XP or altered replay',async t=>{
 const f=await setup(t),created=await f.create();let b=ok(await f.student.start(created.challenge.id));
 const before=b,requestId=uuid(),payload=selection(b);b=ok(await f.student.step(b,'answer',payload,requestId));
 assert.equal(b.xpTotal,10);assert.equal(b.attempt.questions[0].correctIndex,payload.selectedIndex);assert.equal(b.attempt.questions[1].correctIndex,undefined);
 b=ok(await f.student.step(b,'next'));ok(await f.teacher.close(created));
 const receipt=ok(await f.student.step(before,'answer',payload,requestId));assert.equal(receipt.replayed,true);assert.equal(receipt.attempt.revision,b.attempt.revision);
 assert.equal((await f.student.step(before,'answer',{...payload,selectedIndex:(payload.selectedIndex+1)%4},requestId)).status,409);
 assert.equal((await f.student.step(before,'answer',payload)).status,409);
 assert.equal(f.awards().xp,10);
});
test('timer is server-owned including exact expiration, no extra delay on GET',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id;let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 let b=ok(await f.student.start(id,false));clock+=10000;
 const r=ok(await f.student.call(root+'/'+id));assert.equal(r.attempt.questionStartedAt,b.attempt.questionStartedAt);
 b=await answer(f.student,b);assert.equal(b.attempt.answers[0].timedOut,true);assert.equal(b.attempt.answers[0].selectedIndex,null);assert.equal(b.xpTotal,0);
});
test('five correct answers complete before final navigation, late next survives closure, replay never repays',async t=>{
 const f=await setup(t),created=await f.create();let b=ok(await f.student.start(created.challenge.id));
 b=await complete(f.student,b,5,{finalNext:false});assert.equal(b.attempt.phase,'feedback');assert.equal(b.challenge.ownResult.status,'termine');assert.equal(b.leaderboard.viewerRank.rank,1);assert.equal(b.xpTotal,50);
 ok(await f.teacher.close(created));b=ok(await f.student.step(b,'next'));assert.equal(b.attempt.phase,'results');assert.equal(b.xpTotal,50);
 assert.equal(ok(await f.student.start(created.challenge.id)).attempt.id,b.attempt.id);assert.equal(f.awards().n,5);
 assert.equal((await f.student.step(b,'next')).status,409);
});
test('closed untouched challenge has no result; partial completion stays unranked with earned XP',async t=>{
 const f=await setup(t),created=await f.create();let b=ok(await f.student.start(created.challenge.id));b=await answer(f.student,b);
 ok(await f.teacher.close(created));assert.equal((await f.student.step(b,'next')).status,410);
 b=ok(await f.student.call(root+'/'+created.challenge.id));assert.equal(b.challenge.canPlay,false);assert.equal(b.challenge.ownResult.status,'en_cours');assert.equal(b.leaderboard.viewerRank.rank,null);assert.equal(b.xpTotal,10);
 const untouched=ok(await f.adam.call(root+'/'+created.challenge.id));assert.equal(untouched.challenge.ownResult,null);assert.equal(untouched.attempt,null);assert.equal((await f.adam.start(created.challenge.id)).status,410);
});
test('ties use correct answers only, completed zero outranks unfinished, and pagination keeps global ranks',async t=>{
 const f=await setup(t),created=await f.create();let a=ok(await f.student.start(created.challenge.id)),b=ok(await f.adam.start(created.challenge.id));
 a=await complete(f.student,a,4);b=await complete(f.adam,b,4);assert.deepEqual(b.leaderboard.rows.map(r=>r.rank),[1,1]);assert.ok(b.leaderboard.rows.every(r=>r.tied));
 const page=ok(await f.student.call(root+'/'+created.challenge.id+'?rankingOffset=1&rankingVersion='+b.leaderboard.version));assert.equal(page.leaderboard.rows[0].rank,1);assert.equal(page.leaderboard.total,2);
});
test('pseudonyms are distinct for 30 pupils and independent of names; no answer keys in collective DTO',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id,aliases=new Set();
 for(let i=0;i<30;i++){
  const student='synthetic-'+i;f.sqlite.prepare('INSERT INTO pilot_users VALUES(?,?,1,?)').run(student,'SAME NAME',Math.floor(Date.now()/1000));
  f.sqlite.prepare("INSERT INTO pilot_memberships VALUES('pilot-school-a',?,'eleve',1)").run(student);
  f.sqlite.prepare("INSERT INTO pilot_class_members VALUES('pilot-school-a','pilot-class-a',?)").run(student);
  const c=await f.client(student),b=ok(await c.start(id));aliases.add(b.attempt.pseudonym);
 }
 assert.equal(aliases.size,30);
 const dto=ok(await f.teacher.call(root+'/'+id));assert.equal(dto.leaderboard.rows.length,30);assert.ok(dto.leaderboard.rows.every(r=>r.rank===null));
 assert.doesNotMatch(JSON.stringify(dto),/synthetic-|SAME NAME|correctIndex|explanation|studentId/);
});
test('csrf and inactive access block exact replays and writes',async t=>{
 const f=await setup(t),created=await f.create(),id=created.challenge.id,requestId=uuid();const b=ok(await f.student.start(id,true,requestId));
 assert.equal((await f.student.call(root+'/'+id+'/answer',{requestId:uuid(),revision:1,...selection(b)},{'X-CSRF-Token':'wrong'})).status,403);
 f.sqlite.exec("DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'");
 assert.equal((await f.student.start(id,true,requestId)).status,404);assert.equal((await f.student.call(root+'/'+id)).status,404);assert.equal(f.awards().xp,0);
});
test('invalid choices, revisions and forged score or owner fields never mutate',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id,b=ok(await f.student.start(id));
 for(const selectedIndex of [-1,4,0.5,'0',false])assert.equal((await f.student.step(b,'answer',{index:0,selectedIndex})).status,422);
 for(const body of [{...selection(b),xp:500},{...selection(b),studentId:'pilot-a-other'},{...selection(b),revision:1.5},{index:5,selectedIndex:0}])assert.equal((await f.student.step(b,'answer',body)).status,422);
 assert.equal(ok(await f.student.call(root+'/'+id)).attempt.revision,1);assert.equal(f.awards().xp,0);
});
test('closure just before answer batch is authoritative and awards are not written',async t=>{
 const f=await setup(t),created=await f.create(),id=created.challenge.id,b=ok(await f.student.start(id));
 const DB={...f.DB,batch:async statements=>{f.sqlite.prepare('UPDATE pilot_class_challenges SET closed_at=? WHERE id=?').run(Math.floor(Date.now()/1000),id);return f.DB.batch(statements);}};
 const c=await f.client('pilot-a-student',DB);assert.equal((await c.step(b,'answer',selection(b))).status,410);
 assert.equal(ok(await f.student.call(root+'/'+id)).attempt.revision,1);assert.equal(f.awards().xp,0);
});
test('SQL award failure rolls back the answer and exact retry can recover',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id,b=ok(await f.student.start(id)),requestId=uuid(),payload=selection(b);
 f.sqlite.exec("CREATE TRIGGER reject_class_award BEFORE INSERT ON pilot_class_awards BEGIN SELECT RAISE(ABORT,'test rollback'); END");
 assert.equal((await f.student.step(b,'answer',payload,requestId)).status,503);
 assert.equal(ok(await f.student.call(root+'/'+id)).attempt.revision,1);assert.equal(f.awards().xp,0);
 f.sqlite.exec('DROP TRIGGER reject_class_award');assert.equal(ok(await f.student.step(b,'answer',payload,requestId)).xpTotal,10);
});
test('same-revision concurrent answers and starts cannot allocate twice',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id;
 const starts=await Promise.all([f.student.start(id),f.student.start(id)]);starts.forEach(ok);
 assert.equal(starts[0].data.attempt.id,starts[1].data.attempt.id);
 const b=starts[0].data,outcomes=await Promise.all([f.student.step(b,'answer',selection(b)),f.student.step(b,'answer',selection(b))]);
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);assert.equal(f.awards().xp,10);
});
test('new migration is additive and uses owner-bound reward foreign keys',async t=>{
 const sql=readFileSync(new URL('../drizzle/0013_class_challenges.sql',import.meta.url),'utf8');assert.doesNotMatch(sql,/^(DROP TABLE|DELETE FROM|UPDATE )/im);
 const f=await setup(t),id=(await f.create()).challenge.id,b=ok(await f.student.start(id));await answer(f.student,b);
 assert.throws(()=>f.sqlite.prepare("INSERT INTO pilot_class_awards VALUES(?,'pilot-school-a','pilot-a-other',1,10,?)").run(b.attempt.id,Math.floor(Date.now()/1000)),/FOREIGN KEY/);
 assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('natural expiry after fifth correction preserves completion with a renewed session',async t=>{
 let clock=Date.now();t.mock.method(Date,'now',()=>clock);
 const f=await setup(t),id=(await f.create()).challenge.id;
 let b=await complete(f.student,ok(await f.student.start(id)),5,{finalNext:false});
 const completedAt=b.attempt.completedAt;clock=Date.parse(b.challenge.endAt)+1;
 assert.equal((await f.student.call(root+'/'+id)).status,401);
 const renewed=await f.client('pilot-a-student'),expired=ok(await renewed.call(root+'/'+id));
 assert.equal(expired.challenge.status,'termine');assert.equal(expired.attempt.phase,'feedback');
 const requestId=uuid();b=ok(await renewed.step(expired,'next',{},requestId));
 assert.equal(b.attempt.phase,'results');assert.equal(b.attempt.completedAt,completedAt);assert.equal(b.xpTotal,50);
 assert.equal(ok(await renewed.step(expired,'next',{},requestId)).replayed,true);
 assert.equal(f.awards().n,5);assert.equal(ok(await renewed.start(id)).attempt.id,b.attempt.id);
});
test('competition ranks 1,2,2,4 preserve complete zero before unfinished four',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id,clients=[f.student,f.adam];
 for(let i=0;i<4;i++){
  const sid='ranks-'+i;f.sqlite.prepare('INSERT INTO pilot_users VALUES(?,?,1,?)').run(sid,'Élève fictif',Math.floor(Date.now()/1000));
  f.sqlite.prepare("INSERT INTO pilot_memberships VALUES('pilot-school-a',?,'eleve',1)").run(sid);
  f.sqlite.prepare("INSERT INTO pilot_class_members VALUES('pilot-school-a','pilot-class-a',?)").run(sid);clients.push(await f.client(sid));
 }
 const counts=[5,4,4,3,0];for(let i=0;i<5;i++)await complete(clients[i],ok(await clients[i].start(id,i!==2)),counts[i]);
 let partial=ok(await clients[5].start(id));for(let i=0;i<4;i++){partial=await answer(clients[5],partial);if(i<3)partial=ok(await clients[5].step(partial,'next'));}
 const b=ok(await f.student.call(root+'/'+id));
 assert.deepEqual(b.leaderboard.rows.map(r=>[r.score,r.rank,r.tied,r.status,r.progressPercent]),[
  [500,1,false,'termine',100],[400,2,true,'termine',100],[400,2,true,'termine',100],[300,4,false,'termine',100],[0,5,false,'termine',100],[400,null,false,'en_cours',80]]);
 assert.equal(b.leaderboard.completed,5);assert.equal(f.awards().xp,200);
 assert.equal(ok(await clients[4].call(root+'/'+id)).challenge.ownResult.status,'termine');
});
test('revoked session or class transfer immediately before batch cannot persist',async t=>{
 for(const change of ['session','class']){
  const f=await setup(t),id=(await f.create()).challenge.id,b=ok(await f.student.start(id));
  const before=f.sqlite.prepare('SELECT * FROM pilot_class_attempts').all();
  const DB={...f.DB,batch:async statements=>{
   if(change==='session')f.sqlite.exec("UPDATE pilot_sessions SET revoked_at=0 WHERE user_id='pilot-a-student'");
   else f.sqlite.exec("DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'");
   return f.DB.batch(statements);
  }};
  const stale=await f.client('pilot-a-student',DB);assert.equal((await stale.step(b,'answer',selection(b))).status,404);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM pilot_class_attempts').all(),before);assert.equal(f.awards().xp,0);
 }
});
test('malformed request ids remain client errors, not server failures',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id,b=ok(await f.student.start(id));
 for(const requestId of [[uuid()],{},null,42])for(const r of [await f.teacher.create({requestId}),await f.student.start(id,true,requestId),await f.student.step(b,'answer',selection(b),requestId)])assert.equal(r.status,422);
});
test('class XP reconcile in all seven games, parent scope, admin periods and CSV',async t=>{
 const f=await setup(t),id=(await f.create()).challenge.id;
 await complete(f.student,ok(await f.student.start(id)),4);
 const parent=await f.client('pilot-a-parent'),admin=await f.client('pilot-local-admin');
 for(const path of ['/games/mots-fleches/summary','/student/dashboard','/games/mots-fleches/progress','/games/quiz/culture-generale','/games/quiz/defi-du-jour','/games/quiz/mot-juste','/games/mission-zellige','/games/souk-des-mots']){
  const b=ok(await f.student.call(path)),xp=b.xpTotal??b.rewards?.xpTotal??b.children?.[0].xpTotal;assert.equal(xp,40,path);
 }
 const family=ok(await parent.call('/games/mots-fleches/summary'));assert.equal(family.children.length,1);assert.equal(family.children[0].classCompletedCount,1);assert.equal(family.children[0].xpTotal,40);
 assert.equal((await parent.call(root+'/'+id)).status,403);
 const snapshot=ok(await admin.call('/admin/analytics'));
 assert.equal(snapshot.totals.classChallengesCreated,1);assert.equal(snapshot.totals.classAnswers,5);assert.equal(snapshot.totals.classCompletions,1);assert.equal(snapshot.totals.classXp,40);assert.equal(snapshot.totals.xp,40);assert.equal(snapshot.totals.participatingStudents,1);
 assert.doesNotMatch(JSON.stringify(snapshot),/pilot-a-student|correctIndex|pseudonym/);
 assert.match(analyticsCsv(snapshot),/class_xp;40/);assert.equal(ok(await admin.call('/admin/analytics?schoolId=pilot-school-b')).totals.classXp,0);
 f.sqlite.exec('UPDATE pilot_class_awards SET awarded_at=1');
 const later=ok(await admin.call('/admin/analytics'));assert.equal(later.totals.classXp,0);assert.equal(later.totals.classCompletions,1);
});
