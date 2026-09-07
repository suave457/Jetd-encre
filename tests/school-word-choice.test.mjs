import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { issueSession } from '../worker/pilot/session.js';
import { handlePilot } from '../worker/pilot/api.js';
import { WORD_CHOICE_CONTENT_VERSION } from '../worker/pilot/quizzes.js';
import { wordChoiceItems,WORD_CHOICE_LEVELS,WORD_CHOICE_CATEGORIES } from '../worker/pilot/word-choice-content-v1.js';
import { wordChoiceItems as originalItems } from '../src/features/games/word-choice/wordChoiceData.js';

const origin='http://127.0.0.1:5173',path='/games/quiz/mot-juste',uuid=()=>crypto.randomUUID();
const keys=new Map(wordChoiceItems.map(q=>[q.id,q.correctIndex]));
async function setup(t){
  const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
  async function client(id='pilot-a-student'){
    const issued=id?await issueSession(store.DB,id,'local_fixture',true):null;
    const call=async(route,body,extraHeaders={})=>{
      const r=await handlePilot(new Request(origin+'/api/pilot'+route,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(issued?{Cookie:issued.cookie.split(';')[0]}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':issued?.csrfToken??''}),...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:store.DB},{local:true});
      return {status:r.status,headers:r.headers,data:await r.json()};
    };
    return {call,start:(body={})=>call(path+'/start',{requestId:uuid(),level:'Tous',category:'Toutes',...body}),answer:(a,selectedIndex=keys.get(a.questions[a.index].id),requestId=uuid())=>call(path+'/attempts/'+a.id+'/answer',{requestId,revision:a.revision,index:a.index,selectedIndex}),next:(a,requestId=uuid())=>call(path+'/attempts/'+a.id+'/next',{requestId,revision:a.revision})};
  }
  return {...store,client,student:await client(),awards:()=>store.sqlite.prepare('SELECT count(*) n,coalesce(sum(xp),0) xp FROM pilot_quiz_awards').get()};
}
test('Mot juste v1 preserves exactly all 20 original immutable phrases and choices',()=>{
  assert.deepEqual(wordChoiceItems,originalItems);assert.equal(wordChoiceItems.length,20);assert.equal(new Set(wordChoiceItems.map(q=>q.id)).size,20);
  assert.equal(WORD_CHOICE_CONTENT_VERSION,'mot-juste-2026-09-v1');
  assert.equal(createHash('sha256').update(JSON.stringify(wordChoiceItems)).digest('hex'),'f8604994a3e156b69199504090105384e11e4928eee22128e70b8df65877b9f5','Never edit the answer key under an already-published version');
  assert.ok(Object.isFrozen(wordChoiceItems));for(const q of wordChoiceItems){assert.ok(Object.isFrozen(q));assert.ok(Object.isFrozen(q.choices));assert.equal(q.choices.length,4);}
});
test('Mot juste catalogue and all 25 filter combinations match the published bank',async t=>{
  const f=await setup(t),boot=await f.student.call(path);assert.equal(boot.status,200);
  assert.deepEqual(boot.data.catalogue.levels,WORD_CHOICE_LEVELS);assert.deepEqual(boot.data.catalogue.categories,WORD_CHOICE_CATEGORIES);assert.equal(boot.data.catalogue.counts.reduce((s,r)=>s+r.count,0),20);
  let i=0;
  for(const level of ['Tous',...WORD_CHOICE_LEVELS])for(const category of ['Toutes',...WORD_CHOICE_CATEGORIES]){
    // Two separate fictitious owners keep this catalogue test below the per-owner hourly budget.
    const client=i++<15?f.student:await f.client('pilot-a-other');
    const expected=wordChoiceItems.filter(q=>(level==='Tous'||q.level===level)&&(category==='Toutes'||q.category===category));
    const result=await client.start({level,category});assert.equal(result.status,expected.length?200:422,level+'/'+category);
    if(!expected.length)continue;
    const a=result.data.attempt;assert.equal(a.questions.length,Math.min(10,expected.length));assert.equal(a.durationSeconds,10);assert.deepEqual(a.selection,{level,category});
    assert.equal(a.contentVersion,WORD_CHOICE_CONTENT_VERSION);assert.equal(a.dailyKey,null);
    for(const q of a.questions){assert.ok(expected.some(item=>item.id===q.id));for(const key of ['correctIndex','explanation','learningGoal'])assert.equal(Object.hasOwn(q,key),false);}
    assert.deepEqual((await client.call(path)).data.attempt,a);
  }
});
test('Mot juste rejects forged configuration, owner, score or answer key without allocating attempts',async t=>{
  const f=await setup(t);
  for(const fields of [{level:undefined},{category:undefined},{level:[]},{category:{}},{level:'7e AEP'},{category:'Secret'},{comfortMode:true},{durationSeconds:20},{limit:1},{xp:100},{correctIndex:1},{schoolId:'pilot-school-b'},{userId:'pilot-b-student'}])assert.equal((await f.student.start(fields)).status,422,JSON.stringify(fields));
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_quiz_attempts').get().n,0);
  for(const headers of [{Origin:'https://outside.example'},{'X-CSRF-Token':''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.student.call(path+'/start',{requestId:uuid(),level:'Tous',category:'Toutes'},headers)).status,403);
});
test('Mot juste single-phrase path saves +10 once, survives session renewal and exposes correction only after answer',async t=>{
  const f=await setup(t),requestId=uuid(),body={requestId,level:'3e AEP',category:'Lexique'};
  let r=await f.student.start(body);assert.equal(r.status,200);const first=r.data.attempt;
  assert.equal((await f.student.start(body)).data.attempt.id,first.id);
  assert.equal((await f.student.start({...body,category:'Accords'})).status,409);
  const renewed=await f.client();assert.deepEqual((await renewed.call(path)).data.attempt,first);
  const answerId=uuid();r=await renewed.answer(first,keys.get(first.questions[0].id),answerId);assert.equal(r.status,200);assert.equal(r.data.xpTotal,10);
  assert.equal(r.data.attempt.questions[0].learningGoal,wordChoiceItems.find(q=>q.id===first.questions[0].id).learningGoal);
  assert.equal((await renewed.answer(first,keys.get(first.questions[0].id),answerId)).data.xpTotal,10);
  const feedback=r.data.attempt,nextId=uuid();r=await renewed.next(feedback,nextId);assert.equal(r.status,200);assert.equal(r.data.attempt.phase,'results');
  assert.equal((await renewed.next(feedback,nextId)).data.xpTotal,10);
  assert.equal(r.data.attempt.summary.correctCount,1);assert.equal(r.data.attempt.summary.questionCount,1);assert.equal(r.data.attempt.summary.xpEarned,10);assert.equal(r.data.attempt.summary.completionXp,0);
  assert.deepEqual(r.data.attempt.summary.categoryResults.Lexique,{total:1,correct:1});assert.equal(f.awards().n,1);
});
test('Mot juste mixed results, timeout and competing tab keep only the first confirmed answer',async t=>{
  const f=await setup(t);let a=(await f.student.start({level:'3e AEP'})).data.attempt;
  for(let i=0;i<4;i++){
    if(i===2)f.sqlite.prepare("UPDATE pilot_quiz_attempts SET state_json=json_set(state_json,'$.questionStartedAt',?) WHERE id=?").run(Date.now()-10000,a.id);
    const selected=i===1?(keys.get(a.questions[i].id)+1)%4:keys.get(a.questions[i].id),prior=a;
    const r=await f.student.answer(a,selected);assert.equal(r.status,200);a=r.data.attempt;
    assert.equal((await f.student.answer(prior,selected)).status,409);
    if(i===2){assert.equal(a.answers[i].timedOut,true);assert.equal(a.answers[i].selectedIndex,null);assert.equal(a.answers[i].xp,0);}
    for(let future=i+1;future<a.questions.length;future++)assert.equal(Object.hasOwn(a.questions[future],'correctIndex'),false);
    a=(await f.student.next(a)).data.attempt;
  }
  assert.equal(a.phase,'results');assert.equal(a.summary.correctCount,2);assert.equal(a.summary.bestStreak,1);assert.equal(a.summary.scorePercent,50);assert.equal(a.summary.xpEarned,20);
  assert.equal(Object.values(a.summary.categoryResults).reduce((s,r)=>s+r.correct,0),2);assert.equal(Object.values(a.summary.categoryResults).reduce((s,r)=>s+r.total,0),4);assert.equal(f.awards().xp,20);
});
test('Mot juste roles, school, game, revoked access and expiry are enforced by the full dispatcher',async t=>{
  const f=await setup(t),a=(await f.student.start()).data.attempt;
  assert.equal((await (await f.client(null)).call(path)).status,401);
  for(const id of ['pilot-a-parent','pilot-a-teacher','pilot-local-admin']){const c=await f.client(id);assert.equal((await c.call(path+'?profil=eleve')).status,403);assert.equal((await c.start()).status,403);}
  for(const id of ['pilot-a-other','pilot-b-student']){const c=await f.client(id);assert.equal((await c.call(path+'/attempts/'+a.id)).status,404);assert.equal((await c.answer(a)).status,404);assert.equal((await c.call(path)).data.xpTotal,0);}
  assert.equal((await f.student.call('/games/quiz/culture-generale/attempts/'+a.id)).status,404);
  f.sqlite.prepare('UPDATE pilot_quiz_attempts SET expires_at=0 WHERE id=?').run(a.id);assert.equal((await f.student.answer(a)).status,410);
  f.sqlite.prepare("UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'").run();assert.equal((await f.student.start()).status,403);
  assert.equal(f.awards().xp,0);
});
test('Mot juste rejects unknown or mismatched stored corpus without changing attempts or XP',async t=>{
  const f=await setup(t),a=(await f.student.start()).data.attempt;
  for(const version of ['unknown','culture-2026-09-v1']){f.sqlite.prepare('UPDATE pilot_quiz_attempts SET content_version=? WHERE id=?').run(version,a.id);assert.equal((await f.student.call(path)).status,503);assert.equal((await f.student.answer(a)).status,503);}
  assert.equal(f.awards().xp,0);assert.equal(f.sqlite.prepare('SELECT revision FROM pilot_quiz_attempts WHERE id=?').get(a.id).revision,1);
});
test('Mot juste reward reconciles in learner, linked parent, admin indicators and CSV without exposing answer data',async t=>{
  const f=await setup(t);let a=(await f.student.start({level:'3e AEP',category:'Lexique'})).data.attempt;
  a=(await f.student.answer(a)).data.attempt;await f.student.next(a);
  const self=await f.student.call('/games/mots-fleches/summary'),family=await (await f.client('pilot-a-parent')).call('/games/mots-fleches/summary');
  assert.deepEqual(self.data.children,family.data.children);assert.equal(self.data.children[0].xpTotal,10);assert.equal(self.data.children[0].latestQuiz.gameId,'mot-juste');
  for(const route of [path,'/games/quiz/culture-generale','/games/quiz/defi-du-jour','/games/mots-fleches/progress'])assert.equal((await f.student.call(route)).data.xpTotal,10);
  assert.equal((await f.student.call('/student/dashboard')).data.rewards.xpTotal,10);
  const admin=await f.client('pilot-local-admin'),analytics=await admin.call('/admin/analytics');assert.equal(analytics.status,200);
  const totals=analytics.data.totals;assert.equal(totals.wordChoiceAnswers,1);assert.equal(totals.wordChoiceCompletions,1);assert.equal(totals.wordChoiceXp,10);assert.equal(totals.xp,10);assert.equal(totals.participatingStudents,1);
  assert.equal((await admin.call('/admin/analytics?schoolId=pilot-school-b')).data.totals.xp,0);
  assert.equal((await (await f.client('pilot-b-parent')).call('/games/mots-fleches/summary')).data.children[0].xpTotal,0);
  for(const word of ['correctIndex','learningGoal',a.id])assert.equal(JSON.stringify(analytics.data).includes(word),false);
  const {analyticsCsv}=await import('../src/features/pilote/adminAnalyticsCore.js');assert.match(analyticsCsv(analytics.data),/word_choice_xp;10;/);
});
