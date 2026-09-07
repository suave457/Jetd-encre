import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openPilotDatabase,seedLocalPilot} from '../scripts/pilot-local-store.mjs';
import {issueSession} from '../worker/pilot/session.js';
import {handlePilot} from '../worker/pilot/api.js';
import {MARKET_MISSIONS as missions,MARKET_TIERS as tiers} from '../worker/pilot/market-content-v1.js';
import {MARKET_MISSIONS as original} from '../src/features/games/market-shop/marketShopData.js';
import {MARKET_CONTENT_VERSION} from '../worker/pilot/market.js';
import {analyticsCsv} from '../src/features/pilote/adminAnalyticsCore.js';
const origin='http://127.0.0.1:5173',root='/games/souk-des-mots',uuid=()=>crypto.randomUUID();
async function setup(t){
 const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
 async function client(id='pilot-a-student',binding=store.DB){
  const session=id?await issueSession(store.DB,id,'local_fixture',true):null;
  async function call(path=root,body,extra={}){
   const response=await handlePilot(new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(session?{Cookie:session.cookie.split(';')[0]}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':session?.csrfToken??''}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:binding},{local:true});
   return {status:response.status,data:await response.json(),headers:response.headers};
  }
  const send=(b,action,data={},requestId=uuid())=>call(root+'/'+action,{requestId,revision:b.revision,...data});
  return {call,send};
 }
 return {...store,client,student:await client(),awards:()=>store.sqlite.prepare('SELECT count(*) n,coalesce(sum(xp),0) xp FROM pilot_market_awards').get()};
}
const active=b=>b.state.runs[b.state.activeTierId];
async function step(c,b,a,d={}){const r=await c.send(b,a,d);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function fill(c,b){
 const r=active(b),tier=tiers.find(t=>t.id===b.state.activeTierId),m=missions.find(m=>m.id===tier.missionIds[r.index]);
 for(const id of m.productIds){
  let difference=(m.expectedBasket[id]||0)-(r.basket[id]||0);
  while(difference){const delta=Math.sign(difference);b=await step(c,b,'quantity',{productId:id,delta});difference-=delta;}
 }
 return step(c,b,'formula',{formulaId:m.formulas.find(f=>f.correct).id});
}
async function solve(c,b){return step(c,await fill(c,b),'validate');}
async function tierRun(c,b,tierId,{help=false,review=false}={}){
 b=await step(c,b,'open',{tierId});
 for(let i=0;i<4;i++){
  assert.equal(active(b).index,i);
  if(help)b=await step(c,b,'help');b=await solve(c,b);b=await step(c,b,'next');
  if(i<3&&!review){assert.equal(b.state.screen,'journey');b=await step(c,b,'open',{tierId});}
 }
 return b;
}
test('Souk v1 preserves the twelve original commands and redacts corrections; GET does not allocate',async t=>{
 assert.deepEqual(missions,original);assert.equal(missions.length,12);assert.equal(MARKET_CONTENT_VERSION,'market-2026-09-v1');
 assert.equal(createHash('sha256').update(JSON.stringify(missions)).digest('hex'),'47ab7e5b9b3027a4013df0def1df3e10dc6906efdfc67f58c23a6dd042bc76c4');
 const f=await setup(t),r=await f.student.call();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.data.revision,0);assert.equal(r.data.xpTotal,0);
 assert.deepEqual(r.data.tiers.map(t=>t.unlocked),[true,false,false]);
 for(const m of r.data.missions){for(const field of ['expectedBasket','help','success','feedbackSteps'])assert.equal(Object.hasOwn(m,field),false);for(const formula of m.formulas)for(const field of ['correct','feedback','diagnosticCode'])assert.equal(Object.hasOwn(formula,field),false);}
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_game_progress').get().n,0);
});
for(let errors=0;errors<=3;errors++)test('Souk '+errors+' errors: escalating feedback and independent autonomy bonus',async t=>{
 const f=await setup(t),c=f.student;let b=await step(c,(await c.call()).data,'open',{tierId:tiers[0].id});
 for(let i=0;i<errors;i++)b=await step(c,b,'validate');
 if(errors===2)assert.match(active(b).feedback.text,/Produits à vérifier/);
 if(errors===3)assert.match(active(b).feedback.text,/Il manque/);
 b=await solve(c,b);assert.equal(active(b).missionXp,errors<3?15:10);assert.equal(f.awards().xp,errors<3?15:10);
 assert.equal(active(b).results[0].helpUsed,errors>=3);assert.equal(active(b).failureCount,errors);
 assert.equal((await c.send(b,'validate')).status,409);assert.deepEqual(b.missions[0].expectedBasket,missions[0].expectedBasket);
});
test('Souk all original missions unlock in order, total180 once; replays keep first summaries and add zero',async t=>{
 const f=await setup(t),c=f.student;let b=(await c.call()).data;
 for(const [i,tier]of tiers.entries()){
  if(i<2)assert.equal((await c.send(b,'open',{tierId:tiers[i+1].id})).status,403);
  b=await tierRun(c,b,tier.id);assert.equal(b.xpTotal,(i+1)*60);assert.equal(b.tiers[i].status,'completed');assert.equal(active(b).firstCompletion.badge.id,tier.badge.id);
  assert.equal(b.state.screen,i===2?'results':'journey');
 }
 const first=structuredClone(Object.fromEntries(tiers.map(t=>[t.id,b.state.runs[t.id].firstCompletion])));
 b=await step(c,b,'replay');
 for(const tier of tiers){b=await tierRun(c,b,tier.id,{review:true});assert.equal(b.state.screen,'results');assert.equal(active(b).summary.runMode,'revision');assert.equal(active(b).summary.xpEarned,0);assert.equal(active(b).summary.withoutHelpCount,4);assert.deepEqual(active(b).firstCompletion,first[tier.id]);b=await step(c,b,'replay');}
 assert.equal(b.xpTotal,180);assert.equal(f.awards().n,24);assert.equal(f.awards().xp,180);assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
});
test('Souk four aided masteries unlock next tier; autonomous review pays5 per mission then zero',async t=>{
 const f=await setup(t),c=f.student;let b=await tierRun(c,(await c.call()).data,tiers[0].id,{help:true});
 assert.equal(b.xpTotal,40);assert.equal(b.tiers[1].unlocked,true);const first=active(b).firstCompletion;assert.equal(first.withoutHelpCount,0);
 b=await tierRun(c,b,tiers[0].id,{review:true});assert.equal(b.xpTotal,60);assert.equal(active(b).summary.xpEarned,20);assert.deepEqual(active(b).firstCompletion,first);
 assert.equal(f.awards().n,8);b=await step(c,b,'replay');b=await tierRun(c,b,tiers[0].id,{review:true});assert.equal(b.xpTotal,60);
});
test('Souk retains draft, hints and failures across navigation, reload and session renewal',async t=>{
 const f=await setup(t),c=f.student;let b=await step(c,(await c.call()).data,'open',{tierId:tiers[0].id});
 b=await step(c,b,'quantity',{productId:'apple',delta:1});b=await step(c,b,'help');b=await step(c,b,'validate');
 assert.equal(active(b).feedback.tag,'Correction guidée');assert.match(active(b).feedback.text,/Il manque/);
 const before=structuredClone(active(b));b=await step(c,b,'journey');b=await step(c,b,'open',{tierId:tiers[0].id});assert.deepEqual(active(b),before);
 const other=await f.client();assert.deepEqual((await other.call()).data.state,b.state);b=await solve(other,b);assert.equal(b.xpTotal,10);
 b=await step(other,b,'next');b=await step(other,b,'open',{tierId:tiers[0].id});assert.equal(active(b).index,1);assert.equal(active(b).helpUsed,false);
 b=await solve(other,b);b=await step(other,b,'next');b=await step(other,b,'open',{tierId:tiers[0].id});b=await solve(other,b);b=await step(other,b,'next');b=await step(other,b,'open',{tierId:tiers[0].id});b=await solve(other,b);
 b=await step(other,b,'next');b=await step(other,b,'open',{tierId:tiers[0].id});b=await solve(other,b);b=await step(other,b,'next');assert.equal(active(b).index,1);assert.equal(active(b).review,true);
 b=await step(other,b,'quantity',{productId:missions[1].productIds[0],delta:1});const draft=structuredClone(active(b));b=await step(other,b,'journey');b=await step(other,b,'open',{tierId:tiers[0].id});assert.deepEqual(active(b),draft);
});
test('Souk solved review reopens at next mission, then retains final review result until explicit replay',async t=>{
 const f=await setup(t),c=f.student;let b=await tierRun(c,(await c.call()).data,tiers[0].id);
 b=await step(c,b,'open',{tierId:tiers[0].id});
 for(let i=0;i<4;i++){assert.equal(active(b).index,i);b=await solve(c,b);b=await step(c,b,'journey');b=await step(c,b,'open',{tierId:tiers[0].id});}
 assert.equal(b.state.screen,'results');assert.equal(active(b).summary.runMode,'revision');assert.equal(active(b).summary.results.length,4);const result=active(b).summary;
 assert.deepEqual((await c.call()).data.state.runs.discovery.summary,result);
 b=await step(c,b,'replay');b=await step(c,b,'open',{tierId:tiers[0].id});assert.equal(active(b).index,0);assert.equal(active(b).summary,null);assert.equal(b.xpTotal,60);
});
test('Souk exact uncertain retries, CAS, award rollback and concurrent confirmations',async t=>{
 const f=await setup(t),c=f.student,before=(await c.call()).data,id=uuid(),data={tierId:tiers[0].id};
 let b=(await c.send(before,'open',data,id)).data;
 assert.equal((await c.send(before,'open',data,id)).data.replayed,true);
 assert.equal((await c.send(before,'open',{tierId:tiers[1].id},id)).status,409);assert.equal((await c.send(before,'open',data)).status,409);
 b=await fill(c,b);const stored=f.sqlite.prepare('SELECT * FROM pilot_game_progress').all();
 f.sqlite.exec("CREATE TRIGGER fail_bonus BEFORE INSERT ON pilot_market_awards WHEN NEW.reward_type='autonomy' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
 assert.equal((await c.send(b,'validate')).status,503);assert.deepEqual(f.sqlite.prepare('SELECT * FROM pilot_game_progress').all(),stored);assert.equal(f.awards().n,0);
 f.sqlite.exec('DROP TRIGGER fail_bonus');
 const ids=[uuid(),uuid()],results=await Promise.all(ids.map(id=>c.send(b,'validate',{},id)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.awards().xp,15);assert.equal(f.awards().n,2);
 assert.equal((await c.send(b,'validate',{},ids[results.findIndex(r=>r.status===200)])).data.replayed,true);assert.equal(f.awards().xp,15);
});
test('Souk rejects forged fields/products/roles/owners, overflows, phase skips and CSRF',async t=>{
 const f=await setup(t),c=f.student,initial=(await c.call()).data;
 assert.equal((await c.send(initial,'next')).status,409);assert.equal((await c.send(initial,'open',{tierId:'unknown'})).status,422);
 const b=await step(c,initial,'open',{tierId:tiers[0].id});
 for(const data of [{xp:15},{studentId:'pilot-a-other'},{schoolId:'pilot-school-b'},{helpUsed:false},{basket:{}},{missionId:missions[11].id},{revision:-1},{revision:Number.MAX_SAFE_INTEGER},{requestId:'bad'}])assert.equal((await c.send(b,'validate',data)).status,422);
 for(const data of [{productId:'unknown',delta:1},{productId:'apple',delta:2},{productId:'apple',delta:'1'},{productId:'__proto__',delta:1}])assert.equal((await c.send(b,'quantity',data)).status,422);
 assert.equal((await c.send(b,'formula',{formulaId:'invalid'})).status,422);
 for(const extra of [{Origin:'https://example.com'},{'X-CSRF-Token':''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await c.call(root+'/validate',{requestId:uuid(),revision:b.revision},extra)).status,403);
 assert.equal((await (await f.client(null)).call()).status,401);
 for(const id of ['pilot-a-parent','pilot-a-teacher','pilot-local-admin']){const other=await f.client(id);assert.equal((await other.call()).status,403);assert.equal((await other.send(b,'validate')).status,403);}
 const completed=await solve(c,b);for(const id of ['pilot-a-other','pilot-b-student']){const other=await f.client(id),r=await other.call();assert.equal(r.data.revision,0);assert.equal(r.data.xpTotal,0);assert.equal((await other.send(completed,'validate')).status,409);}
 let q=(await c.call()).data;q=await step(c,q,'next');q=await step(c,q,'open',{tierId:tiers[0].id});
 const product=missions[1].productIds[0];for(let i=0;i<6;i++)q=await step(c,q,'quantity',{productId:product,delta:1});assert.equal(active(q).basket[product],missions[1].difficulty.maxSelectableQuantity);
});
test('Souk live access checks, last-moment revocation and unknown stored versions fail closed',async t=>{
 for(const sql of ["UPDATE pilot_users SET active=0 WHERE id='pilot-a-student'","UPDATE pilot_memberships SET active=0 WHERE user_id='pilot-a-student'","UPDATE pilot_classes SET active=0 WHERE id='pilot-class-a'","UPDATE pilot_schools SET active=0 WHERE id='pilot-school-a'","DELETE FROM pilot_class_members WHERE user_id='pilot-a-student'","DELETE FROM pilot_sessions WHERE user_id='pilot-a-student'"]){
  const f=await setup(t),b=(await f.student.call()).data,id=uuid(),data={tierId:tiers[0].id};await f.student.send(b,'open',data,id);f.sqlite.prepare(sql).run();assert.ok([401,403].includes((await f.student.call()).status));assert.ok([401,403].includes((await f.student.send(b,'open',data,id)).status));assert.equal(f.awards().xp,0);
 }
 const f=await setup(t),b=(await f.student.call()).data;
 const guarded=await f.client('pilot-a-student',{...f.DB,batch:async statements=>{f.sqlite.prepare("UPDATE pilot_sessions SET revoked_at=1 WHERE user_id='pilot-a-student'").run();return f.DB.batch(statements);}});
 assert.equal((await guarded.send(b,'open',{tierId:tiers[0].id})).status,403);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM pilot_game_progress').get().n,0);
 const g=await setup(t);const saved=await step(g.student,(await g.student.call()).data,'open',{tierId:tiers[0].id});g.sqlite.exec("UPDATE pilot_game_progress SET progress_json=json_set(progress_json,'$.contentVersion','future')");
 assert.equal((await g.student.call()).status,503);assert.equal((await g.student.send(saved,'help')).status,503);
});
test('Souk six balances, linked parent, school dashboard, dated admin counters and CSV agree without fake quizzes',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-09-07T12:00:00Z')});
 const f=await setup(t),c=f.student;let b=await tierRun(c,(await c.call()).data,tiers[0].id,{help:true});
 const self=(await c.call('/games/mots-fleches/summary')).data,parent=(await (await f.client('pilot-a-parent')).call('/games/mots-fleches/summary')).data;assert.deepEqual(self.children,parent.children);
 const child=self.children[0];assert.equal(child.xpTotal,40);assert.equal(child.marketCompletedCount,4);assert.equal(child.quizCompletedCount,0);assert.equal(child.startedCount,0);assert.deepEqual(child.grids,[]);assert.equal(child.latestMarket.withoutHelpCount,0);assert.equal(child.latestMarket.experienceType,'market-tier');
 assert.deepEqual((await c.call('/student/dashboard')).data.rewards,child);
 for(const path of [root,'/games/mission-zellige','/games/quiz/culture-generale','/games/quiz/defi-du-jour','/games/quiz/mot-juste','/games/mots-fleches/progress'])assert.equal((await c.call(path)).data.xpTotal,40,path);
 const admin=await f.client('pilot-local-admin'),a=(await admin.call('/admin/analytics')).data;
 assert.equal(a.totals.marketCompletions,4);assert.equal(a.totals.marketAutonomyBonuses,0);assert.equal(a.totals.marketXp,40);assert.equal(a.totals.xp,40);assert.equal(a.totals.participatingStudents,1);
 assert.match(analyticsCsv(a),/market_completions;4;/);assert.match(analyticsCsv(a),/market_xp;40;/);
 assert.equal((await admin.call('/admin/analytics?schoolId=pilot-school-b')).data.totals.xp,0);
 for(const secret of ['expectedBasket','pilot-a-student','firstCompletion',missions[0].id])assert.equal(JSON.stringify(a).includes(secret),false);
 t.mock.timers.setTime(new Date('2026-09-08T12:00:00Z').getTime());const fresh=await f.client();b=await tierRun(fresh,(await fresh.call()).data,tiers[0].id,{review:true});assert.equal(b.xpTotal,60);
 const freshAdmin=await f.client('pilot-local-admin');
 const today=(await freshAdmin.call('/admin/analytics?from=2026-09-08&to=2026-09-08')).data;
 assert.equal(today.totals.marketCompletions,0);assert.equal(today.totals.marketAutonomyBonuses,4);assert.equal(today.totals.marketXp,20);assert.equal(today.totals.participatingStudents,1);
 const yesterday=(await freshAdmin.call('/admin/analytics?from=2026-09-07&to=2026-09-07')).data;assert.equal(yesterday.totals.marketCompletions,4);assert.equal(yesterday.totals.marketXp,40);
});
test('0012 adds a constrained owner-bound ledger without changing any previous table or rows',()=>{
 const directory=new URL('../drizzle/',import.meta.url),db=new DatabaseSync(':memory:');try{
  db.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')&&n<'0012').sort())db.exec(readFileSync(new URL(name,directory),'utf8'));seedLocalPilot(db);
  const tables=db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' ORDER BY name").all(),before=tables.map(t=>db.prepare('SELECT * FROM "'+t.name+'"').all());
  db.exec(readFileSync(new URL('0012_souk_des_mots.sql',directory),'utf8'));for(const [i,t]of tables.entries()){assert.equal(db.prepare('SELECT sql FROM sqlite_schema WHERE name=?').get(t.name).sql,t.sql);assert.deepEqual(db.prepare('SELECT * FROM "'+t.name+'"').all(),before[i]);}
  db.prepare('INSERT INTO pilot_game_progress VALUES (?,?,?,?,?,0,1,?,?,1)').run('pilot-school-a','pilot-a-student','souk-des-mots','v1','{}',uuid(),'h'.repeat(64));
  const add=(student='pilot-a-student',type='mastery',xp=10)=>db.prepare('INSERT INTO pilot_market_awards VALUES (?,?,?,?,?,1,?,?,1)').run('pilot-school-a',student,'souk-des-mots','v1','mission-fruits',type,xp);
  add();add('pilot-a-student','autonomy',5);assert.throws(()=>add(),/UNIQUE/);assert.throws(()=>add('pilot-a-other'),/FOREIGN KEY/);assert.throws(()=>add('pilot-a-student','autonomy',10),/CHECK/);assert.throws(()=>add('pilot-a-student','invented',100),/CHECK/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
