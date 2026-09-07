import assert from 'node:assert/strict';
import test from 'node:test';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { authenticate, issueSession } from '../worker/pilot/session.js';
import { handleAdminAnalytics } from '../worker/pilot/adminAnalytics.js';
import { analyticsCards, analyticsCsv, analyticsGameRows } from '../src/features/pilote/adminAnalyticsCore.js';

const stamp=day=>Date.parse(day+'T00:00:00Z')/1000;
const period='?from=2025-01-01&to=2025-01-02';
async function setup(t){
  const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
  const login=await issueSession(store.DB,'pilot-local-admin','local_fixture',true);
  const session=await authenticate(new Request('http://127.0.0.1:5173',{headers:{cookie:login.cookie}}),store.DB,true);
  return {...store,async read(query=period){
    const response=await handleAdminAnalytics(new Request('http://127.0.0.1:5173/api/pilot/admin/analytics'+query),{DB:store.DB},session);
    assert.equal(response.status,200);return response.json();
  }};
}
function attempt(db,{id,user='pilot-a-student',game='culture-generale',answers=[],completedAt=null}){
  const school=user.startsWith('pilot-b-')?'pilot-school-b':'pilot-school-a';
  db.prepare(`INSERT INTO pilot_quiz_attempts(id,school_id,student_id,game_id,content_version,daily_key,question_ids_json,state_json,revision,start_request_id,start_request_hash,last_request_id,last_request_hash,created_at,expires_at,completed_at)
    VALUES (?,?,?,?,?,?,?, ?,1,?,?,?, ?,?,?,?)`).run(id,school,user,game,'test-analytics',game==='defi-du-jour'?'2025-01-01':null,'["private-question"]',JSON.stringify({phase:completedAt?'results':'feedback',answers,startingXp:999999,scorePercent:100}),id,'h'.repeat(64),id,'h'.repeat(64),stamp('2024-12-31'),stamp('2025-01-10'),completedAt);
}
function answer(day,isCorrect=false){return {questionId:'private-question',selectedIndex:3,correctIndex:1,isCorrect,xp:999999,timedOut:!isCorrect,answeredAt:stamp(day)};}
function award(db,{id,user='pilot-a-student',game='culture-generale',key='0',xp=10,day='2025-01-01'}){
  db.prepare('INSERT OR IGNORE INTO pilot_quiz_awards VALUES (?,?,?,?,?,?,?)').run(user.startsWith('pilot-b-')?'pilot-school-b':'pilot-school-a',user,game,id+':'+key,id,xp,stamp(day));
}
function facts(db){
  db.prepare('INSERT INTO pilot_game_progress VALUES (?,?,?,?,?,0,1,?,?,?)').run('pilot-school-a','pilot-a-student','mots-fleches','grid-test','{}','r'.repeat(36),'h'.repeat(64),stamp('2025-01-01'));
  db.prepare('INSERT INTO pilot_game_awards VALUES (?,?,?,?,20,?)').run('pilot-school-a','pilot-a-student','mots-fleches','grid-test',stamp('2025-01-01'));
  attempt(db,{id:'culture-1',answers:[answer('2025-01-01',true),answer('2025-01-02'),answer('2025-01-03',true)],completedAt:stamp('2025-01-03')});
  award(db,{id:'culture-1'});award(db,{id:'culture-1',key:'2',day:'2025-01-03'});
  attempt(db,{id:'daily-1',game:'defi-du-jour',answers:[answer('2025-01-01',true),answer('2025-01-02')],completedAt:stamp('2025-01-02')});
  award(db,{id:'daily-1',game:'defi-du-jour'});award(db,{id:'daily-1',game:'defi-du-jour',key:'completion',xp:20,day:'2025-01-02'});
  attempt(db,{id:'culture-2',answers:[answer('2025-01-02')],completedAt:stamp('2025-01-02')});
  attempt(db,{id:'wrong-only',user:'pilot-a-other',answers:[answer('2025-01-02')]});
  attempt(db,{id:'old-undated',user:'pilot-b-student',answers:[{questionId:'old-private-question',isCorrect:true,xp:10}]});
  award(db,{id:'old-undated',user:'pilot-b-student'});
}

test('analytics quiz : réponse incorrecte confirmée ou fin de tentative = participation ; simple ouverture exclue',async t=>{
  const store=await setup(t);
  attempt(store.sqlite,{id:'opened'});
  assert.equal((await store.read()).totals.participatingStudents,0);
  attempt(store.sqlite,{id:'wrong-only',user:'pilot-a-other',answers:[answer('2025-01-02')]});
  let s=await store.read();
  assert.equal(s.totals.participatingStudents,1);assert.equal(s.totals.cultureAnswers,1);assert.equal(s.totals.cultureCompletions,0);assert.equal(s.totals.xp,0);
  attempt(store.sqlite,{id:'old-complete',answers:[{isCorrect:false}],completedAt:stamp('2025-01-01')});
  s=await store.read();assert.equal(s.totals.participatingStudents,2);assert.equal(s.totals.cultureCompletions,1);assert.equal(s.totals.cultureAnswers,1);assert.equal(s.totals.undatedQuizAnswers,1);
});

test('analytics quiz : grilles et quiz séparés, plusieurs réponses/jeux sans multiplication de participation ou XP',async t=>{
  const store=await setup(t);facts(store.sqlite);
  let s=await store.read(period+'&schoolId=pilot-school-a');
  assert.equal(s.schemaVersion,2);assert.equal(s.totals.participatingStudents,2);assert.equal(s.totals.eligibleStudents,2);
  assert.equal(s.totals.gameCompletions,1);assert.equal(s.totals.crosswordXp,20);
  assert.equal(s.totals.cultureAnswers,4);assert.equal(s.totals.dailyAnswers,2);
  assert.equal(s.totals.cultureCompletions,1);assert.equal(s.totals.dailyCompletions,1);
  assert.equal(s.totals.cultureXp,10);assert.equal(s.totals.dailyXp,30);assert.equal(s.totals.xp,60);
  const before=s.totals;
  award(store.sqlite,{id:'daily-1',game:'defi-du-jour',key:'completion',xp:20,day:'2025-01-02'});
  award(store.sqlite,{id:'culture-1'});
  assert.deepEqual((await store.read(period+'&schoolId=pilot-school-a')).totals,before,'rejouer les récompenses ne les multiplie pas');
  s=await store.read();assert.equal(s.totals.xp,70);assert.equal(s.totals.cultureXp,20);
  assert.equal(s.totals.xp,s.bySchool.reduce((sum,row)=>sum+row.xp,0));
  assert.equal(s.totals.xp,s.totals.crosswordXp+s.totals.cultureXp+s.totals.dailyXp);
  assert.deepEqual(store.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('analytics quiz : dates des réponses, récompenses et fins indépendantes ; aucune date ancienne inventée',async t=>{
  const store=await setup(t);facts(store.sqlite);
  const next=await store.read('?from=2025-01-03&to=2025-01-03&schoolId=pilot-school-a');
  assert.equal(next.totals.cultureAnswers,1);assert.equal(next.totals.cultureCompletions,1);assert.equal(next.totals.dailyCompletions,0);assert.equal(next.totals.xp,10);assert.equal(next.totals.participatingStudents,1);
  const old=await store.read(period+'&schoolId=pilot-school-b');
  assert.equal(old.totals.undatedQuizAnswers,1);assert.equal(old.totals.cultureAnswers,0);assert.equal(old.totals.participatingStudents,0);assert.equal(old.totals.cultureXp,10,'les vrais XP restent datables dans le registre de récompenses');
  const noPeriod=await store.read('?from=2024-12-31&to=2024-12-31&schoolId=pilot-school-b');
  assert.equal(noPeriod.totals.cultureAnswers,0);assert.equal(noPeriod.totals.participatingStudents,0,'created_at ne sert pas de date de réponse');
});

test('analytics quiz : exclusion admin et compte suspendu du dénominateur, historique préservé',async t=>{
  const store=await setup(t);facts(store.sqlite);
  store.sqlite.prepare('INSERT INTO pilot_admins VALUES (?,1)').run('pilot-a-other');
  let s=await store.read(period+'&schoolId=pilot-school-a');
  assert.equal(s.totals.eligibleStudents,1);assert.equal(s.totals.participatingStudents,1);assert.equal(s.totals.cultureAnswers,4);
  store.sqlite.prepare('UPDATE pilot_users SET active=0 WHERE id=?').run('pilot-a-student');
  s=await store.read(period+'&schoolId=pilot-school-a');
  assert.equal(s.totals.eligibleStudents,0);assert.equal(s.totals.participatingStudents,0);assert.equal(s.totals.xp,60);assert.equal(s.totals.cultureCompletions,1);
});

test('analytics quiz : export identique aux cartes, unités explicites, ni score ni réponse privée exposés',async t=>{
  const store=await setup(t);facts(store.sqlite);const s=await store.read();
  const rows=analyticsGameRows(s),csv=analyticsCsv(s);
  assert.equal(rows.length,21);assert.equal(csv.split('\r\n').length,26);
  for(const row of rows)assert.ok(csv.includes(row.key+';'+row.value+';;;2025-01-01;2025-01-02;UTC;reseau;'));
  assert.ok(csv.includes('undated_quiz_answers;1;;;;;UTC;reseau;'),'aucune période attribuée aux anciennes réponses non datées');
  assert.ok(analyticsCards(s)[0].detail.includes('sept jeux'));
  assert.ok(s.definitions.games.includes('ne mesurent pas la maîtrise'));
  assert.ok(s.definitions.games.includes('Mots fléchés, Culture générale, Défi du jour, Le Mot juste, Mission Zellige, Le Souk des mots et les Défis de classe'));
  const body=JSON.stringify({totals:s.totals,bySchool:s.bySchool,schools:s.schools});
  for(const privateValue of ['scorePercent','correctIndex','selectedIndex','correctCount','private-question','old-private-question','startingXp','999999','pilot-a-other'])assert.equal(body.includes(privateValue),false,privateValue);
});
