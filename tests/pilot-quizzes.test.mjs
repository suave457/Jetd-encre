import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { openPilotDatabase, seedLocalPilot, LOCAL_PROFILES } from '../scripts/pilot-local-store.mjs';
import { authenticate, issueSession } from '../worker/pilot/session.js';
import { handleQuizGames, QUIZ_CONTENT_VERSION } from '../worker/pilot/quizzes.js';
import { quizQuestionsV1 } from '../worker/pilot/quiz-content-v1.js';
import { cultureQuizQuestions } from '../src/features/games/cultureQuizData.js';
import { getDailyChallenge, getMoroccoDateKey } from '../src/features/games/dailyChallengeData.js';

const origin='http://127.0.0.1:5173';
const prefix=game=>'/api/pilot/games/quiz/'+game;
const UUID=()=>crypto.randomUUID();
const CULTURE='culture-generale', DAILY='defi-du-jour';
const keys=new Map(quizQuestionsV1.map(q=>[q.id,q.correctIndex]));

test('migration 0009 preserves existing quiz answers and rewards and rolls back incompatible ownership',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const directory=new URL('../drizzle/',import.meta.url);
    for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')&&n<'0009').sort())db.exec(readFileSync(new URL(name,directory),'utf8'));
    seedLocalPilot(db);
    const id=UUID(),request=UUID();
    db.prepare(`INSERT INTO pilot_quiz_attempts VALUES (?,?,?,?,?,NULL,?,?,1,?,?,?,?,0,9999999999,NULL)`)
      .run(id,'pilot-school-a','pilot-a-student',CULTURE,QUIZ_CONTENT_VERSION,'["fixture"]','{"phase":"feedback"}',request,'a'.repeat(64),request,'a'.repeat(64));
    db.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)').run('pilot-school-a','pilot-a-student',CULTURE,'q:0',id);
    const before=db.prepare('SELECT * FROM pilot_quiz_awards').all(),attempts=db.prepare('SELECT * FROM pilot_quiz_attempts').all();
    const sql=readFileSync(new URL('0009_quiz_award_owner.sql',directory),'utf8');
    // 0007 allowed a real but different owner; 0009 must fail without discarding that row.
    db.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)').run('pilot-school-a','pilot-a-other',CULTURE,'incompatible',id);
    db.exec('BEGIN');assert.throws(()=>db.exec(sql),/FOREIGN KEY/);db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM pilot_quiz_awards').get().n,2);
    db.prepare('DELETE FROM pilot_quiz_awards WHERE reward_key=?').run('incompatible');
    db.exec('BEGIN');db.exec(sql);db.exec('COMMIT');
    assert.deepEqual(db.prepare('SELECT * FROM pilot_quiz_awards').all(),before);
    assert.deepEqual(db.prepare('SELECT * FROM pilot_quiz_attempts').all(),attempts);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.throws(()=>db.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)').run('pilot-school-a','pilot-a-other',CULTURE,'wrong',id),/FOREIGN KEY/);
  } finally { db.close(); }
});
async function setup(t, id='pilot-a-student') {
  const db=openPilotDatabase();seedLocalPilot(db.sqlite);t.after(()=>db.close());
  const login=async userId=>{
    const profile=LOCAL_PROFILES.find(row=>row.id===userId);
    const credentials=await issueSession(db.DB,userId,'local_fixture',true);
    const request=new Request(origin,{headers:{cookie:credentials.cookie}});
    const session=await authenticate(request,db.DB,true);
    return {user:{id:userId},schoolId:profile.schoolId,role:profile.role,session,credentials};
  };
  const c=await login(id);
  const request=async(path,{body,actor=c,headers={},binding=db.DB,method=body===undefined?'GET':'POST'}={})=>{
    const r=new Request(origin+path,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':actor?.session.csrf_token??''}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    let response;try{response=await handleQuizGames(r,{DB:binding},actor);}catch(e){if(!(e instanceof Response))throw e;response=e;}
    return {status:response.status,headers:response.headers,data:await response.json()};
  };
  const start=async(game=CULTURE,options={})=>request(prefix(game)+'/start',{body:{requestId:UUID(),comfortMode:false},...options});
  const action=async(attempt,action,options={})=>request(prefix(attempt.gameId)+'/attempts/'+attempt.id+'/'+action,{body:{requestId:UUID(),revision:attempt.revision,...(action==='answer'?{index:attempt.index,selectedIndex:keys.get(attempt.questions[attempt.index].id)}:{})},...options});
  return {...db,c,login,request,start,action,countAwards:()=>db.sqlite.prepare('SELECT COUNT(*) n,COALESCE(SUM(xp),0) xp FROM pilot_quiz_awards').get()};
}

test('quiz corpus v1 is exactly the existing published ten-question corpus and remains immutable',()=>{
  assert.deepEqual(quizQuestionsV1,cultureQuizQuestions);assert.equal(quizQuestionsV1.length,10);
  assert.equal(QUIZ_CONTENT_VERSION,'culture-2026-09-v1');
  for(const q of quizQuestionsV1){assert.equal(q.choices.length,4);assert.ok(Object.isFrozen(q));assert.ok(Object.isFrozen(q.choices));assert.ok(Number.isInteger(q.correctIndex));}
});
test('school start returns only own public questions and reload resumes one server attempt',async t=>{
  const f=await setup(t),empty=await f.request(prefix(CULTURE));assert.equal(empty.status,200);assert.equal(empty.data.attempt,null);
  const r=await f.start();assert.equal(r.status,200);assert.equal(r.data.userId,f.c.user.id);assert.equal(r.data.schoolId,f.c.schoolId);assert.equal(r.data.attempt.revision,1);assert.equal(r.data.attempt.questions.length,10);assert.equal(r.data.attempt.durationSeconds,10);assert.equal(r.data.xpTotal,0);
  for(const q of r.data.attempt.questions){assert.equal(Object.hasOwn(q,'correctIndex'),false);assert.equal(Object.hasOwn(q,'explanation'),false);}
  const resumed=await f.request(prefix(CULTURE));assert.equal(resumed.data.attempt.id,r.data.attempt.id);assert.equal(resumed.headers.get('Cache-Control'),'no-store');
});
test('role, identity and server school bind every attempt, never JSON or another pupil',async t=>{
  const f=await setup(t),r=await f.start(),url=prefix(CULTURE)+'/attempts/'+r.data.attempt.id;
  assert.equal((await f.request(prefix(CULTURE),{actor:null})).status,401);
  for(const id of ['pilot-a-other','pilot-b-student']){const actor=await f.login(id);assert.equal((await f.request(url,{actor})).status,404);assert.equal((await f.action(r.data.attempt,'answer',{actor})).status,404);assert.equal((await f.request(prefix(CULTURE),{actor})).data.attempt,null);}
  for(const id of ['pilot-a-teacher','pilot-a-parent'])assert.equal((await f.request(prefix(CULTURE),{actor:await f.login(id)})).status,403);
  const admin=await f.login('pilot-local-admin');assert.equal((await f.request(prefix(CULTURE),{actor:{...admin,schoolId:'pilot-school-a'}})).status,403);
  assert.equal((await f.request(prefix(CULTURE),{actor:{...f.c,session:{...f.c.session,user_id:'pilot-b-student'}}})).status,401);
  assert.equal(f.countAwards().n,0);
});
test('body cannot choose owner, score, key, date, duration or XP',async t=>{
  const f=await setup(t);
  for(const [key,value] of Object.entries({userId:'pilot-b-student',schoolId:'pilot-school-b',xp:100000,correctIndex:1,dailyKey:'2020-01-01',durationSeconds:9999})){
    const r=await f.start(CULTURE,{body:{requestId:UUID(),comfortMode:false,[key]:value}});assert.equal(r.status,422,key);
  }
  for(const requestId of ['',[],[UUID()],{},'fake'])assert.equal((await f.start(CULTURE,{body:{requestId,comfortMode:false}})).status,422);
  assert.equal((await f.start(CULTURE,{body:{requestId:UUID(),comfortMode:1}})).status,422);
  const a=(await f.start()).data.attempt;
  for(const patch of [{revision:0},{revision:1.1},{index:-1},{selectedIndex:4},{selectedIndex:'0'},{xp:10}]){
    const body={requestId:UUID(),revision:a.revision,index:0,selectedIndex:0,...patch};
    assert.equal((await f.action(a,'answer',{body})).status,422);
  }
  assert.equal(f.countAwards().n,0);
});
test('CSRF and cross-origin protection reject mutation before allocation',async t=>{
  const f=await setup(t);
  for(const headers of [{'X-CSRF-Token':''},{Origin:'https://example.org'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.start(CULTURE,{headers})).status,403);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_attempts').get().n,0);
});
test('answer replay is identical and cannot award twice or change the first choice',async t=>{
  const f=await setup(t),a=(await f.start()).data.attempt;
  const body={requestId:UUID(),revision:a.revision,index:a.index,selectedIndex:keys.get(a.questions[0].id)};
  const one=await f.action(a,'answer',{body}),two=await f.action(a,'answer',{body});
  assert.equal(one.status,200);assert.equal(two.status,200);assert.equal(two.data.replayed,true);assert.equal(two.data.attempt.id,a.id);assert.equal(two.data.attempt.revision,2);assert.equal(two.data.xpTotal,10);assert.equal(f.countAwards().n,1);
  assert.equal(one.data.attempt.questions[0].correctIndex,body.selectedIndex);assert.equal(Object.hasOwn(one.data.attempt.questions[1],'correctIndex'),false);
  assert.ok(Number.isSafeInteger(one.data.attempt.answers[0].answeredAt));
  assert.ok(Math.abs(one.data.attempt.answers[0].answeredAt-Math.floor(Date.now()/1000))<5);
  assert.equal(two.data.attempt.answers[0].answeredAt,one.data.attempt.answers[0].answeredAt);
  assert.equal((await f.action(a,'answer',{body:{...body,selectedIndex:(body.selectedIndex+1)%4}})).status,409);
  assert.equal((await f.action(a,'answer')).status,409);assert.equal(f.countAwards().xp,10);
});
test('two overlapping correct requests serialize to one revision and one reward',async t=>{
  const f=await setup(t),a=(await f.start()).data.attempt;
  const responses=await Promise.all([f.action(a,'answer'),f.action(a,'answer')]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.countAwards().n,1);assert.equal(f.countAwards().xp,10);
  assert.equal((await f.request(prefix(CULTURE))).data.attempt.revision,2);
});
test('next cannot skip a question or replay an older answer as a new award',async t=>{
  const f=await setup(t),a=(await f.start()).data.attempt;
  assert.equal((await f.action(a,'next')).status,409);
  const body={requestId:UUID(),revision:a.revision,index:0,selectedIndex:keys.get(a.questions[0].id)};
  const answer=await f.action(a,'answer',{body}),next=await f.action(answer.data.attempt,'next');assert.equal(next.data.attempt.phase,'question');assert.equal(next.data.attempt.index,1);
  assert.equal((await f.action(a,'answer',{body})).status,409);assert.equal(f.countAwards().xp,10);
});
test('server clock enforces timeout and comfort mode, no client elapsed-time assertion',async t=>{
  const f=await setup(t),r=await f.start(CULTURE,{body:{requestId:UUID(),comfortMode:true}}),a=r.data.attempt;
  assert.equal(a.durationSeconds,20);
  f.sqlite.prepare("UPDATE pilot_quiz_attempts SET state_json=json_set(state_json,'$.questionStartedAt',?) WHERE id=?").run(Date.now()-21000,a.id);
  const answer=await f.action(a,'answer');assert.equal(answer.status,200);assert.equal(answer.data.attempt.answers[0].timedOut,true);assert.equal(answer.data.attempt.answers[0].selectedIndex,null);assert.equal(answer.data.attempt.answers[0].remainingSeconds,0);assert.equal(answer.data.xpTotal,0);
});
test('Culture completes with only ten server-evaluated question rewards',async t=>{
  const f=await setup(t);let r=await f.start();
  for(let i=0;i<10;i++){r=await f.action(r.data.attempt,'answer');assert.equal(r.status,200);r=await f.action(r.data.attempt,'next');assert.equal(r.status,200);}
  assert.equal(r.data.attempt.phase,'results');assert.equal(r.data.attempt.summary.answerXp,100);assert.equal(r.data.attempt.summary.completionXp,0);assert.equal(r.data.xpTotal,100);assert.equal(f.countAwards().n,10);
  const next=await f.start();assert.notEqual(next.data.attempt.id,r.data.attempt.id);assert.equal(next.data.attempt.startingXp,100);
});
test('daily date and selection come from Casablanca server date; same-day start and completion stay once only',async t=>{
  const f=await setup(t);let r=await f.start(DAILY);const id=r.data.attempt.id,today=getMoroccoDateKey(new Date()),daily=getDailyChallenge(today,quizQuestionsV1);
  assert.equal(r.data.attempt.dailyKey,today);assert.equal(r.data.attempt.questions.length,5);assert.deepEqual(r.data.attempt.questions.map(q=>q.id),daily.questions.map(q=>q.id));assert.ok(r.data.attempt.questions.every(q=>q.theme.startsWith('Défi du jour · ')));
  assert.equal((await f.start(DAILY)).data.attempt.id,id);
  for(let i=0;i<5;i++){r=await f.action(r.data.attempt,'answer');assert.equal(r.status,200);r=await f.action(r.data.attempt,'next');assert.equal(r.status,200);}
  assert.equal(r.data.attempt.phase,'results');assert.equal(r.data.attempt.summary.answerXp,50);assert.equal(r.data.attempt.summary.completionXp,20);assert.equal(r.data.xpTotal,70);
  assert.equal((await f.start(DAILY)).data.attempt.id,id);const boot=await f.request(prefix(DAILY));assert.equal(boot.data.history.length,1);assert.equal(boot.data.history[0].xpEarned,70);assert.equal(boot.data.daily.category,daily.category);assert.equal(f.countAwards().xp,70);
});
test('daily mutation and resume metadata use the pinned attempt date, not a stale client welcome or another server day',async t=>{
  const f=await setup(t),r=await f.start(DAILY);assert.equal(r.data.daily.dateKey,r.data.attempt.dailyKey);
  const yesterday=getMoroccoDateKey(new Date(Date.now()-86400000)),daily=getDailyChallenge(yesterday,quizQuestionsV1);
  f.sqlite.prepare('UPDATE pilot_quiz_attempts SET daily_key=?,question_ids_json=? WHERE id=?').run(yesterday,JSON.stringify(daily.questions.map(q=>q.id)),r.data.attempt.id);
  const resumed=await f.request(prefix(DAILY)+'/attempts/'+r.data.attempt.id);assert.equal(resumed.status,200);
  assert.equal(resumed.data.daily.dateKey,yesterday);assert.equal(resumed.data.daily.category,daily.category);assert.equal(resumed.data.daily.dateKey,resumed.data.attempt.dailyKey);
  const answered=await f.action(resumed.data.attempt,'answer');assert.equal(answered.status,200);assert.equal(answered.data.daily.dateKey,yesterday);
});
test('start replay survives exhausted account allocation quota and changed payload conflicts',async t=>{
  const f=await setup(t),requestId=UUID(),body={requestId,comfortMode:false};let first;
  for(let i=0;i<20;i++){const r=await f.start(CULTURE,i===0?{body}:{});assert.equal(r.status,200);if(i===0)first=r;}
  assert.equal((await f.start()).status,429);const replay=await f.start(CULTURE,{body});assert.equal(replay.status,200);assert.equal(replay.data.attempt.id,first.data.attempt.id);
  assert.equal((await f.start(CULTURE,{body:{...body,comfortMode:true}})).status,409);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_attempts').get().n,20);
});
test('expired attempt refuses transition and unsupported game/version fails closed',async t=>{
  const f=await setup(t),a=(await f.start()).data.attempt;
  f.sqlite.prepare('UPDATE pilot_quiz_attempts SET expires_at=0 WHERE id=?').run(a.id);assert.equal((await f.action(a,'answer')).status,410);
  assert.equal((await f.request(prefix('unknown'))).status,404);
  f.sqlite.prepare('UPDATE pilot_quiz_attempts SET content_version=? WHERE id=?').run('unknown-version',a.id);
  assert.equal((await f.request(prefix(CULTURE)+'/attempts/'+a.id)).status,503);assert.equal(f.countAwards().n,0);
});
for(const [label,sql] of [
  ['user',"UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'"],
  ['membership',"UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'"],
  ['school',"UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'"],
  ['class',"UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'"],
  ['class membership',"DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'"],
  ['role',"UPDATE pilot_memberships SET role='parent' WHERE user_id='pilot-a-student'"],
  ['administrator promotion',"INSERT INTO pilot_admins(user_id) VALUES ('pilot-a-student')"],
  ['session',"UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'"],
])test('revoked '+label+' cannot read, answer or mint rewards',async t=>{
  const f=await setup(t),a=(await f.start()).data.attempt;f.sqlite.exec(sql);
  assert.equal((await f.request(prefix(CULTURE))).status,403);assert.equal((await f.action(a,'answer')).status,403);assert.equal(f.countAwards().n,0);
});
test('revocation between checks and D1 batch prevents both answer and reward',async t=>{
  const f=await setup(t),a=(await f.start()).data.attempt;
  const binding={...f.DB,batch:async statements=>{f.sqlite.exec("UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'");return f.DB.batch(statements);}};
  assert.equal((await f.action(a,'answer',{binding})).status,403);assert.equal(f.countAwards().n,0);assert.equal(f.sqlite.prepare('SELECT revision FROM pilot_quiz_attempts WHERE id=?').get(a.id).revision,1);
});
test('quiz profile balance includes existing crossword rewards without moving them or counting another pupil',async t=>{
  const f=await setup(t);
  for(const [student,xp] of [['pilot-a-student',20],['pilot-a-other',50]]){
    f.sqlite.prepare("INSERT INTO pilot_game_progress VALUES ('pilot-school-a',?,'mots-fleches','fixture','{}',0,1,?,?,0)").run(student,UUID(),'a'.repeat(64));
    f.sqlite.prepare("INSERT INTO pilot_game_awards VALUES ('pilot-school-a',?,'mots-fleches','fixture',?,0)").run(student,xp);
  }
  const started=await f.start();assert.equal(started.data.xpTotal,20);assert.equal(started.data.attempt.startingXp,20);
  const answered=await f.action(started.data.attempt,'answer');assert.equal(answered.data.xpTotal,30);
  assert.equal(f.sqlite.prepare('SELECT SUM(xp) total FROM pilot_game_awards').get().total,70);assert.equal(f.countAwards().xp,10);
});
test('reward foreign key rejects a different existing owner, school or game for an existing attempt',async t=>{
  const f=await setup(t),attempt=(await f.start()).data.attempt;
  const insert=f.sqlite.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)');
  for(const [school,student,game] of [
    ['pilot-school-a','pilot-a-other',CULTURE],
    ['pilot-school-b','pilot-b-student',CULTURE],
    ['pilot-school-a','pilot-a-student',DAILY],
  ])assert.throws(()=>insert.run(school,student,game,UUID(),attempt.id),/FOREIGN KEY/);
  assert.equal(f.countAwards().n,0);
  insert.run(f.c.schoolId,f.c.user.id,CULTURE,'fixture-correct-owner',attempt.id);
  assert.equal(f.countAwards().n,1);assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('migration 0007 preserves every preexisting table and rejects nonexistent memberships or attempts',()=>{
  const sqlite=new DatabaseSync(':memory:');try{
    sqlite.exec('PRAGMA foreign_keys=ON');const dir=new URL('../drizzle/',import.meta.url);
    for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')&&n<'0007').sort())sqlite.exec(readFileSync(new URL(name,dir),'utf8'));
    seedLocalPilot(sqlite);
    const names=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
    const snapshots=new Map(names.map(name=>[name,JSON.stringify(sqlite.prepare('SELECT * FROM "'+name+'"').all())]));
    sqlite.exec(readFileSync(new URL('0007_school_quizzes.sql',dir),'utf8'));
    for(const [name,before] of snapshots)assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM "'+name+'"').all()),before,name);
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_awards').get().n,0);
    assert.throws(()=>sqlite.prepare("INSERT INTO pilot_quiz_awards VALUES ('pilot-school-a','pilot-b-student','culture-generale','bad','missing',10,0)").run());
  }finally{sqlite.close();}
});
