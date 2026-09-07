import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openPilotDatabase,seedLocalPilot} from '../scripts/pilot-local-store.mjs';
import {issueSession} from '../worker/pilot/session.js';
import {handlePilot} from '../worker/pilot/api.js';
import {MISSION_ZELLIGE_MISSIONS as missions,getDailyMissionZellige} from '../worker/pilot/zellige-content-v1.js';
import {MISSION_ZELLIGE_MISSIONS as original} from '../src/features/games/mission-zellige/missionZelligeData.js';
import {ZELLIGE_CONTENT_VERSION} from '../worker/pilot/zellige.js';
import {analyticsCsv} from '../src/features/pilote/adminAnalyticsCore.js';

const origin='http://127.0.0.1:5173',root='/games/mission-zellige',uuid=()=>crypto.randomUUID();
async function setup(t){
  const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
  async function client(id='pilot-a-student',binding=store.DB){
    const session=id?await issueSession(store.DB,id,'local_fixture',true):null;
    async function call(path=root,body,extra={}){
      const response=await handlePilot(new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(session?{Cookie:session.cookie.split(';')[0]}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':session?.csrfToken??''}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:binding},{local:true});
      return {status:response.status,data:await response.json(),headers:response.headers};
    }
    const send=(boot,index,action,data={},requestId=uuid())=>call(`${root}/${boot.daily.dateKey}/${missions[index].id}/${action}`,{requestId,revision:boot.missions[index].state.revision,...data});
    return {call,send};
  }
  return {...store,client,student:await client(),awards:()=>store.sqlite.prepare("SELECT count(*) n,coalesce(sum(xp),0) xp FROM pilot_game_awards WHERE game_id='mission-zellige'").get()};
}
async function successful(client,boot,index,errors=0){
  const mission=missions[index];
  async function step(action,data){const r=await client.send(boot,index,action,data);assert.equal(r.status,200,JSON.stringify(r.data));boot=r.data;return boot;}
  if(errors&1)await step('location',{hotspotId:mission.hotspots.find(h=>!h.correct).id});
  await step('location',{hotspotId:mission.hotspots.find(h=>h.correct).id});
  if(errors&2)await step('sentence',{orderedPieces:[...mission.correctOrder].reverse()});
  await step('sentence',{orderedPieces:mission.correctOrder});
  assert.equal(boot.missions[index].state.phase,'sentence');assert.equal(boot.missions[index].state.result,null);
  return step('finish');
}

test('Zellige v1 keeps all four original scenes and readonly opening allocates nothing',async t=>{
  assert.deepEqual(missions,original);assert.equal(missions.length,4);assert.equal(ZELLIGE_CONTENT_VERSION,'zellige-2026-09-v1');
  for(const m of missions){assert.ok(Object.isFrozen(m));assert.ok(Object.isFrozen(m.hotspots));assert.ok(Object.isFrozen(m.pieces));}
  assert.equal(createHash('sha256').update(JSON.stringify(missions)).digest('hex'),'9c57b144cadde0fd7ea4117e3ad10f955f757a9296aa83b38c313b995fba4a9f','Never change the published answer bank under the same content version');
  const f=await setup(t),r=await f.student.call();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(r.data.xpTotal,0);assert.equal(r.data.fragmentCount,0);assert.equal(r.data.daily.dateKey,getDailyMissionZellige().dateKey);
  for(const entry of r.data.missions){assert.equal(entry.state.revision,0);assert.equal(entry.state.phase,'location');for(const field of ['correctOrder','answer','extraHint','sentenceHint','success'])assert.equal(Object.hasOwn(entry.mission,field),false);for(const h of entry.mission.hotspots)assert.equal(Object.hasOwn(h,'correct'),false);}
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_game_progress').get().n,0);
});
for(let errors=0;errors<4;errors++)test(`Zellige four scenes / assistance ${errors}: daily +20 once, practice +0, immutable first result`,async t=>{
  const f=await setup(t);let boot=(await f.student.call()).data;
  for(let index=0;index<4;index++){
    boot=await successful(f.student,boot,index,errors);const first=boot.missions[index].state.firstCompletion;
    assert.equal(first.scorePercent,100-50*Number(Boolean(errors&1))-50*Number(Boolean(errors&2)));
    assert.equal(first.xpEarned,index===boot.daily.missionIndex?20:0);assert.equal(boot.missions[index].mission.answer,missions[index].answer);
    boot=(await f.student.send(boot,index,'restart')).data;
    boot=await successful(f.student,boot,index,3-errors);assert.deepEqual(boot.missions[index].state.firstCompletion,first);assert.equal(boot.missions[index].state.result.xpEarned,0);
  }
  assert.equal(f.awards().n,1);assert.equal(f.awards().xp,20);assert.equal(boot.xpTotal,20);assert.equal(boot.fragmentCount,1);assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
});
test('Zellige saves draft, exact retries, separate scene progress, competing revisions and no early reward',async t=>{
  const f=await setup(t);let b=(await f.student.call()).data;const i=b.daily.missionIndex,m=missions[i],id=uuid(),old=b;
  assert.equal((await f.student.send(b,i,'finish')).status,409);
  b=(await f.student.send(b,i,'draft',{selectedHotspot:m.hotspots[0].id},id)).data;
  assert.equal((await f.student.send(old,i,'draft',{selectedHotspot:m.hotspots[0].id},id)).data.replayed,true);
  assert.equal((await f.student.send(old,i,'draft',{selectedHotspot:m.hotspots[1].id},id)).status,409);
  assert.equal((await f.student.send(old,i,'draft',{selectedHotspot:m.hotspots[1].id})).status,409);
  b=(await f.student.send(b,i,'location',{hotspotId:m.hotspots.find(h=>h.correct).id})).data;
  b=(await f.student.send(b,i,'draft',{orderedPieces:m.correctOrder.slice(0,2)})).data;
  const renewed=await f.client();assert.deepEqual((await renewed.call()).data.missions[i].state,b.missions[i].state);
  b=(await renewed.send(b,(i+1)%4,'draft',{selectedHotspot:missions[(i+1)%4].hotspots[0].id})).data;
  assert.deepEqual(b.missions[i].state.orderedPieces,m.correctOrder.slice(0,2));
  b=(await renewed.send(b,i,'sentence',{orderedPieces:m.correctOrder})).data;assert.equal(f.awards().xp,0);
  const finishId=uuid(),before=b;b=(await renewed.send(b,i,'finish',{},finishId)).data;
  assert.equal((await renewed.send(before,i,'finish',{},finishId)).data.replayed,true);assert.equal(f.awards().xp,20);
  assert.equal((await renewed.send(before,i,'finish')).status,409);assert.deepEqual((await renewed.call()).data.missions[i].state,b.missions[i].state);
});
test('Zellige rejects forged fields, missing session, wrong roles, other scopes and CSRF',async t=>{
  const f=await setup(t),b=(await f.student.call()).data,i=b.daily.missionIndex,m=missions[i];
  for(const data of [{xp:20},{schoolId:'pilot-school-b'},{userId:'pilot-b-student'},{phase:'complete'},{selectedHotspot:'unknown'},{selectedHotspot:m.hotspots[0].id,orderedPieces:[]},{revision:-1},{revision:Number.MAX_SAFE_INTEGER},{requestId:'unknown'}])assert.equal((await f.student.send(b,i,'draft',data)).status,422,JSON.stringify(data));
  for(const extra of [{Origin:'https://example.com'},{'X-CSRF-Token':''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.student.call(`${root}/${b.daily.dateKey}/${m.id}/draft`,{requestId:uuid(),revision:0,selectedHotspot:m.hotspots[0].id},extra)).status,403);
  assert.equal((await (await f.client(null)).call()).status,401);
  for(const id of ['pilot-a-parent','pilot-a-teacher','pilot-local-admin']){const c=await f.client(id);assert.equal((await c.call(root+'?profil=eleve')).status,403);assert.equal((await c.send(b,i,'draft',{selectedHotspot:m.hotspots[0].id})).status,403);}
  const completed=await successful(f.student,b,i);
  for(const id of ['pilot-a-other','pilot-b-student']){const other=await f.client(id),r=await other.call();assert.equal(r.data.xpTotal,0);assert.equal(r.data.missions[i].state.revision,0);assert.equal((await other.send(completed,i,'restart')).status,409);}
  assert.equal(f.awards().xp,20);
});
test('Zellige revocations fail closed before reads, writes and replay',async t=>{
  for(const sql of ["UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'","UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'","UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'","UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'","DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'","DELETE FROM pilot_sessions WHERE user_id='pilot-a-student'"]){
    const f=await setup(t),b=(await f.student.call()).data,i=b.daily.missionIndex,id=uuid(),data={selectedHotspot:missions[i].hotspots[0].id};await f.student.send(b,i,'draft',data,id);f.sqlite.prepare(sql).run();
    assert.ok([401,403].includes((await f.student.call()).status),sql);assert.ok([401,403].includes((await f.student.send(b,i,'draft',data,id)).status),sql);assert.equal(f.awards().xp,0);
  }
});
test('Zellige partial sentences and unknown stored versions remain unawarded',async t=>{
  const f=await setup(t);let b=(await f.student.call()).data;const i=b.daily.missionIndex,m=missions[i];b=(await f.student.send(b,i,'location',{hotspotId:m.hotspots.find(h=>h.correct).id})).data;
  for(const orderedPieces of [null,{},[],['unknown'],[m.correctOrder[0],m.correctOrder[0],m.correctOrder[0]],m.correctOrder.slice(0,2)])assert.equal((await f.student.send(b,i,'sentence',{orderedPieces})).status,422);
  f.sqlite.prepare("UPDATE pilot_game_progress SET progress_json=json_set(progress_json,'$.contentVersion','unknown')").run();assert.equal((await f.student.call()).status,503);assert.equal((await f.student.send(b,i,'sentence',{orderedPieces:m.correctOrder})).status,503);assert.equal(f.awards().xp,0);
});
test('Zellige Casablanca midnight pins opened progress, blocks forged days and keeps four distinct fragments',async t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-09-07T22:58:00Z')});
  const f=await setup(t);let b=(await f.student.call()).data;const i=b.daily.missionIndex,m=missions[i];b=(await f.student.send(b,i,'location',{hotspotId:m.hotspots.find(h=>h.correct).id})).data;
  t.mock.timers.setTime(new Date('2026-09-07T23:01:00Z').getTime());
  b=(await f.student.send(b,i,'sentence',{orderedPieces:m.correctOrder})).data;b=(await f.student.send(b,i,'finish')).data;assert.equal(b.daily.dateKey,'2026-09-07');assert.equal(b.xpTotal,20);
  assert.equal((await f.student.call()).data.daily.dateKey,'2026-09-08');
  for(const day of ['2026-09-06','2026-09-09','2026-02-30'])assert.ok([404,409].includes((await f.student.call(`${root}/${day}/${missions[(i+1)%4].id}/draft`,{requestId:uuid(),revision:0,selectedHotspot:missions[(i+1)%4].hotspots[0].id})).status));
  for(let day=8;day<=11;day++){
    t.mock.timers.setTime(new Date(`2026-09-${String(day).padStart(2,'0')}T12:00:00Z`).getTime());const c=await f.client();let boot=(await c.call()).data;boot=await successful(c,boot,boot.daily.missionIndex);assert.equal(boot.fragmentCount,Math.min(day-6,4));
  }
  assert.equal(f.awards().xp,100);assert.equal(f.awards().n,5);
});
test('Zellige matches learner, linked parent, all game balances, admin totals and CSV without disclosing answers',async t=>{
  const f=await setup(t),b=(await f.student.call()).data;await successful(f.student,b,b.daily.missionIndex,3);
  const self=(await f.student.call('/games/mots-fleches/summary')).data,parent=(await (await f.client('pilot-a-parent')).call('/games/mots-fleches/summary')).data;assert.deepEqual(self.children,parent.children);
  const child=self.children[0];assert.equal(child.xpTotal,20);assert.equal(child.completedCount,0);assert.equal(child.startedCount,0);assert.equal(child.zelligeCompletedCount,1);assert.equal(child.latestZellige.scorePercent,0);assert.equal(child.latestZellige.experienceType,'guided-mission');assert.deepEqual(child.grids,[]);
  for(const path of [root,'/games/quiz/culture-generale','/games/quiz/defi-du-jour','/games/quiz/mot-juste','/games/mots-fleches/progress'])assert.equal((await f.student.call(path)).data.xpTotal,20,path);
  assert.deepEqual((await f.student.call('/student/dashboard')).data.rewards,child);
  assert.equal((await (await f.client('pilot-b-parent')).call('/games/mots-fleches/summary')).data.children[0].xpTotal,0);
  const admin=await f.client('pilot-local-admin'),r=await admin.call('/admin/analytics'),totals=r.data.totals;assert.equal(r.status,200);assert.equal(totals.zelligeCompletions,1);assert.equal(totals.zelligeXp,20);assert.equal(totals.xp,20);assert.equal(totals.gameCompletions,0);assert.equal(totals.participatingStudents,1);
  assert.equal((await admin.call('/admin/analytics?schoolId=pilot-school-b')).data.totals.xp,0);
  for(const secret of ['correctOrder','firstCompletion','pilot-a-student',missions[b.daily.missionIndex].id])assert.equal(JSON.stringify(r.data).includes(secret),false);
  assert.match(analyticsCsv(r.data),/zellige_completions;1;/);assert.match(analyticsCsv(r.data),/zellige_xp;20;/);
});

test('Zellige concurrent finish and rollback preserve the unique daily reward',async t=>{
  const f=await setup(t);let b=(await f.student.call()).data;const i=b.daily.missionIndex,m=missions[i];
  b=(await f.student.send(b,i,'location',{hotspotId:m.hotspots.find(h=>h.correct).id})).data;
  b=(await f.student.send(b,i,'sentence',{orderedPieces:m.correctOrder})).data;
  const before=f.sqlite.prepare('SELECT * FROM pilot_game_progress').all();
  f.sqlite.exec("CREATE TRIGGER test_award_failure BEFORE INSERT ON pilot_game_awards BEGIN SELECT RAISE(ABORT,'test forced rollback'); END");
  assert.equal((await f.student.send(b,i,'finish')).status,503);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM pilot_game_progress').all(),before);assert.equal(f.awards().n,0);
  f.sqlite.exec('DROP TRIGGER test_award_failure');
  const ids=[uuid(),uuid()],results=await Promise.all(ids.map(id=>f.student.send(b,i,'finish',{},id)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.awards().n,1);
  assert.equal((await f.student.send(b,i,'finish',{},ids[results.findIndex(r=>r.status===200)])).data.replayed,true);
  assert.equal(f.awards().xp,20);
});

test('Zellige access revoked immediately before atomic persistence writes no progress',async t=>{
  const f=await setup(t),b=(await f.student.call()).data,i=b.daily.missionIndex;
  const guarded=await f.client('pilot-a-student',{...f.DB,batch:async statements=>{
    f.sqlite.prepare("UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'").run();return f.DB.batch(statements);
  }});
  assert.equal((await guarded.send(b,i,'draft',{selectedHotspot:missions[i].hotspots[0].id})).status,403);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_game_progress').get().n,0);assert.equal(f.awards().n,0);
});

test('Zellige expired progress permits only exact confirmed replay, without a new effect',async t=>{
  const f=await setup(t),b=(await f.student.call()).data,i=b.daily.missionIndex,id=uuid(),data={selectedHotspot:missions[i].hotspots[0].id};
  const saved=(await f.student.send(b,i,'draft',data,id)).data;
  f.sqlite.prepare("UPDATE pilot_game_progress SET progress_json=json_set(progress_json,'$.openedAt',0)").run();
  assert.equal((await f.student.send(b,i,'draft',data,id)).data.replayed,true);
  assert.equal((await f.student.send(saved,i,'location',{hotspotId:missions[i].hotspots[0].id})).status,410);assert.equal(f.awards().n,0);
});
