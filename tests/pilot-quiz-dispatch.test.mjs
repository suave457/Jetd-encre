import test from 'node:test';
import assert from 'node:assert/strict';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { handlePilot as handlePilotApi } from '../worker/pilot/api.js';
import { issueSession } from '../worker/pilot/session.js';
import { quizQuestionsV1 } from '../worker/pilot/quiz-content-v1.js';
import { MOTS_FLECHES_GRIDS } from '../src/features/games/mots-fleches/motsFlechesData.js';
import { buildGridModel } from '../src/features/games/mots-fleches/motsFlechesEngine.js';

const origin='http://127.0.0.1:5173',CULTURE='culture-generale',DAILY='defi-du-jour';
const quizPath=game=>'/games/quiz/'+game;
const answers=new Map(quizQuestionsV1.map(q=>[q.id,q.correctIndex]));
const uuid=()=>crypto.randomUUID();
const solved=grid=>Object.fromEntries([...buildGridModel(grid).cells].filter(([,cell])=>cell.type==='letter').map(([key,cell])=>[key,cell.solution]));

async function setup(t){
  // Applies every committed SQL migration, including the additive 0009 owner-FK
  // repair. No persistent SQLite file, local HTTP endpoint or OIDC request used.
  const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
  const client=async(userId=null)=>{
    const issued=userId?await issueSession(store.DB,userId,'local_fixture',true):null;
    return {userId,async call(path,body,extraHeaders={}){
      const request=new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',
        headers:{Origin:origin,...(issued?{Cookie:issued.cookie.split(';')[0]}:{}),
          ...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':issued?.csrfToken??''}),...extraHeaders},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      // Intentionally invoke the complete dispatcher: it derives identity,
      // school, roles and CSRF itself. No manually constructed actor context.
      const response=await handlePilotApi(request,{DB:store.DB},{local:true});
      return {status:response.status,data:await response.json(),headers:response.headers};
    }};
  };
  return {...store,client};
}
const start=(client,game=CULTURE)=>client.call(quizPath(game)+'/start',{requestId:uuid(),comfortMode:true});
const answerBody=attempt=>({requestId:uuid(),revision:attempt.revision,index:attempt.index,selectedIndex:answers.get(attempt.questions[attempt.index].id)});
const answer=(client,attempt,body=answerBody(attempt))=>client.call(quizPath(attempt.gameId)+'/attempts/'+attempt.id+'/answer',body);
const next=(client,attempt)=>client.call(quizPath(attempt.gameId)+'/attempts/'+attempt.id+'/next',{requestId:uuid(),revision:attempt.revision});
const completeGrid=(client,grid)=>client.call('/games/mots-fleches/'+grid.id+'/complete',{ownerId:client.userId,progress:solved(grid),hintCount:0,revision:0,requestId:uuid()});

test('quiz dispatcher authenticates every school entry before revealing questions or allocating attempts',async t=>{
  const f=await setup(t),anonymous=await f.client();
  for(const path of [quizPath(CULTURE),quizPath(DAILY),'/games/mots-fleches/progress','/games/mots-fleches/summary','/student/dashboard']){
    const r=await anonymous.call(path);assert.equal(r.status,401,path);assert.equal(r.data.attempt,undefined);assert.equal(r.data.children,undefined);assert.equal(r.data.rewards,undefined);
  }
  assert.equal((await start(anonymous)).status,401);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_attempts').get().n,0);
});

test('quiz dispatcher rejects parent, teacher and platform administrator without accepting a requested role override',async t=>{
  const f=await setup(t);
  for(const id of ['pilot-a-parent','pilot-a-teacher','pilot-local-admin']){
    const account=await f.client(id);
    for(const game of [CULTURE,DAILY]){
      const r=await account.call(quizPath(game)+'?profil=eleve');assert.equal(r.status,403,id);assert.equal(r.data.attempt,undefined);
      assert.equal((await start(account,game)).status,403,id);
    }
    assert.equal((await account.call('/session?profil=eleve')).status,403,id);
    assert.equal((await account.call('/student/dashboard')).status,403,id);
  }
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_attempts').get().n,0);
});

test('quiz dispatcher enforces mutation CSRF and origin before saving or rewarding',async t=>{
  const f=await setup(t),student=await f.client('pilot-a-student');
  for(const headers of [{'X-CSRF-Token':''},{Origin:'https://outside.example'},{'Sec-Fetch-Site':'cross-site'}]){
    assert.equal((await student.call(quizPath(CULTURE)+'/start',{requestId:uuid(),comfortMode:true},headers)).status,403);
  }
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_attempts').get().n,0);
  const initial=await start(student);assert.equal(initial.status,200);
  const attempt=initial.data.attempt,url=quizPath(CULTURE)+'/attempts/'+attempt.id+'/answer';
  assert.equal((await student.call(url,answerBody(attempt),{'X-CSRF-Token':''})).status,403);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_awards').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT revision FROM pilot_quiz_attempts WHERE id=?').get(attempt.id).revision,1);
});

test('quiz dispatcher binds persisted attempt reads and writes to its actual owner and school',async t=>{
  const f=await setup(t),student=await f.client('pilot-a-student'),initial=await start(student);assert.equal(initial.status,200);
  const attempt=initial.data.attempt,url=quizPath(CULTURE)+'/attempts/'+attempt.id;
  for(const id of ['pilot-a-other','pilot-b-student']){
    const other=await f.client(id);
    assert.equal((await other.call(url)).status,404,id);assert.equal((await answer(other,attempt)).status,404,id);
    const own=await other.call(quizPath(CULTURE));assert.equal(own.status,200);assert.equal(own.data.attempt,null);assert.equal(own.data.xpTotal,0);
  }
  assert.equal((await student.call(quizPath('unknown-game'))).status,404);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM pilot_quiz_awards').get().n,0);
});

test('quiz and crossword rewards reconcile in student, parent, dashboard and all three game responses without multiplying joins',async t=>{
  const f=await setup(t),student=await f.client('pilot-a-student'),parent=await f.client('pilot-a-parent');
  const session=await student.call('/session?profil=eleve');assert.equal(session.status,200);assert.equal(session.data.user.id,student.userId);assert.equal(session.data.user.schoolId,'pilot-school-a');
  let culture=await start(student);assert.equal(culture.status,200);
  assert.equal(Object.hasOwn(culture.data.attempt.questions[0],'correctIndex'),false);
  const body=answerBody(culture.data.attempt);
  culture=await answer(student,culture.data.attempt,body);assert.equal(culture.status,200);assert.equal(culture.data.xpTotal,10);
  const replay=await student.call(quizPath(CULTURE)+'/attempts/'+culture.data.attempt.id+'/answer',body);assert.equal(replay.status,200);assert.equal(replay.data.xpTotal,10);
  let gridXp=0;
  for(const grid of MOTS_FLECHES_GRIDS.slice(0,2)){
    const finished=await completeGrid(student,grid);assert.equal(finished.status,200,JSON.stringify(finished.data));gridXp+=grid.xp;assert.equal(finished.data.xpTotal,10+gridXp);
  }
  culture=await next(student,culture.data.attempt);assert.equal(culture.status,200);assert.equal(culture.data.xpTotal,10+gridXp);
  culture=await answer(student,culture.data.attempt);assert.equal(culture.status,200);assert.equal(culture.data.xpTotal,20+gridXp);
  let daily=await start(student,DAILY);assert.equal(daily.status,200);assert.equal(daily.data.xpTotal,20+gridXp);
  for(let i=0;i<5;i++){
    daily=await answer(student,daily.data.attempt);assert.equal(daily.status,200);
    daily=await next(student,daily.data.attempt);assert.equal(daily.status,200);
  }
  const expected=gridXp+20+50+20;assert.equal(daily.data.xpTotal,expected);assert.equal(daily.data.attempt.phase,'results');
  assert.equal((await start(student,DAILY)).data.xpTotal,expected);
  for(const path of [quizPath(CULTURE),quizPath(DAILY),'/games/mots-fleches/progress']){
    const r=await student.call(path);assert.equal(r.status,200,path);assert.equal(r.data.xpTotal,expected,path);assert.equal(r.headers.get('Cache-Control'),'no-store');
  }
  const self=await student.call('/games/mots-fleches/summary'),family=await parent.call('/games/mots-fleches/summary'),dashboard=await student.call('/student/dashboard');
  assert.equal(self.status,200);assert.equal(family.status,200);assert.equal(dashboard.status,200);
  assert.equal(self.data.children.length,1);assert.equal(family.data.children.length,1);
  assert.deepEqual(family.data.children[0],self.data.children[0]);assert.deepEqual(dashboard.data.rewards,self.data.children[0]);
  for(const data of [self.data.children[0],family.data.children[0],dashboard.data.rewards]){
    assert.equal(data.studentId,student.userId);assert.equal(data.xpTotal,expected);assert.equal(data.startedCount,2);assert.equal(data.completedCount,2);assert.equal(data.quizStartedCount,2);assert.equal(data.quizCompletedCount,1);
    assert.equal(data.grids.length,2);assert.equal('answers' in data,false);assert.equal('questions' in data,false);
  }
  assert.equal(f.sqlite.prepare('SELECT SUM(xp) total FROM pilot_game_awards').get().total,gridXp);
  assert.equal(f.sqlite.prepare('SELECT SUM(xp) total FROM pilot_quiz_awards').get().total,90);
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('shared game totals include only the requested student or an actually linked child, not same-school peers or another school',async t=>{
  const f=await setup(t),student=await f.client('pilot-a-student'),peer=await f.client('pilot-a-other'),other=await f.client('pilot-b-student');
  for(const account of [student,peer,other]){const started=await start(account);assert.equal(started.status,200);assert.equal((await answer(account,started.data.attempt)).status,200);}
  // A peer earns an additional reward; neither family nor school totals may absorb it.
  let peerAttempt=(await peer.call(quizPath(CULTURE))).data.attempt;peerAttempt=(await next(peer,peerAttempt)).data.attempt;assert.equal((await answer(peer,peerAttempt)).data.xpTotal,20);
  for(const [id,childId] of [['pilot-a-parent','pilot-a-student'],['pilot-b-parent','pilot-b-student']]){
    const parent=await f.client(id),family=await parent.call('/games/mots-fleches/summary?studentId=pilot-a-other&schoolId=pilot-school-a');
    assert.equal(family.status,200);assert.equal(family.data.children.length,1);assert.equal(family.data.children[0].studentId,childId);assert.equal(family.data.children[0].xpTotal,10);
  }
  assert.equal((await student.call('/student/dashboard')).data.rewards.xpTotal,10);
  assert.equal((await peer.call('/student/dashboard')).data.rewards.xpTotal,20);
  assert.equal((await other.call('/student/dashboard')).data.rewards.xpTotal,10);
});

test('revoked family relationship stops shared quiz totals and revoked session stops all game entry points',async t=>{
  const f=await setup(t),student=await f.client('pilot-a-student'),parent=await f.client('pilot-a-parent');
  const attempt=(await start(student)).data.attempt;assert.equal((await answer(student,attempt)).status,200);
  f.sqlite.prepare("UPDATE pilot_family_links SET active=0 WHERE parent_id='pilot-a-parent'").run();
  const denied=await parent.call('/games/mots-fleches/summary');assert.equal(denied.status,200);assert.deepEqual(denied.data.children,[]);
  assert.equal((await student.call('/logout',{})).status,200);
  for(const path of [quizPath(CULTURE),quizPath(DAILY),'/games/mots-fleches/progress','/games/mots-fleches/summary','/student/dashboard'])assert.equal((await student.call(path)).status,401,path);
  assert.equal((await answer(student,attempt)).status,401);
  assert.equal(f.sqlite.prepare('SELECT SUM(xp) total FROM pilot_quiz_awards').get().total,10);
});

test('published HTTPS dispatcher accepts only the server OIDC session cookie, requires enabled configuration and keeps quiz rewards server-derived',async t=>{
  const f=await setup(t),publishedOrigin='https://pilot.example';
  // Pure handler test: this is a synthetic assurance record, not an Auth0 login.
  // These reserved example domains and placeholder values are never contacted.
  const env={DB:f.DB,PILOT_ENABLED:'true',PILOT_ORIGIN:publishedOrigin,OIDC_ISSUER:'https://identity.example/',OIDC_CLIENT_ID:'test-client',OIDC_CLIENT_SECRET:'test-only-placeholder'};
  const issued=await issueSession(f.DB,'pilot-a-student','oidc',false);
  const call=async(path,body,headers={},overrides={})=>{
    const request=new Request(publishedOrigin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',
      headers:{Origin:publishedOrigin,Cookie:issued.cookie.split(';')[0],...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':issued.csrfToken}),...headers},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    const response=await handlePilotApi(request,{...env,...overrides});return {status:response.status,data:await response.json()};
  };
  assert.equal((await call(quizPath(CULTURE),undefined,{}, {PILOT_ENABLED:'false'})).status,503);
  assert.equal((await call(quizPath(CULTURE),undefined,{Cookie:''})).status,401);
  const fixture=await issueSession(f.DB,'pilot-a-student','local_fixture',true);
  assert.equal((await call(quizPath(CULTURE),undefined,{Cookie:fixture.cookie.split(';')[0]})).status,401);
  const session=await call('/session?profil=eleve');assert.equal(session.status,200);assert.equal(session.data.mode,'oidc');assert.equal(session.data.user.id,'pilot-a-student');
  let result=await call(quizPath(CULTURE)+'/start',{requestId:uuid(),comfortMode:true});assert.equal(result.status,200);
  const attempt=result.data.attempt,path=quizPath(CULTURE)+'/attempts/'+attempt.id+'/answer';
  assert.equal((await call(path,answerBody(attempt),{'X-CSRF-Token':''})).status,403);
  result=await call(path,answerBody(attempt));assert.equal(result.status,200);assert.equal(result.data.xpTotal,10);
  assert.equal((await call('/student/dashboard')).data.rewards.xpTotal,10);
  assert.equal((await call('/games/mots-fleches/progress')).data.xpTotal,10);
});
