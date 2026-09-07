import {all,first,run,reply,fail,readInput,requiredText,hash,now,checkCsrf,LIVE_SESSION_SQL,liveValues} from './session.js';
import {CLASS_CONTENT_VERSION,classBanks,classThemes,classLevel,classQuestionMetadata,selectClassQuestions,resolveClassQuestions} from './class-challenge-content-v1.js';
import {SAFE_CLASS_PSEUDONYMS} from '../../src/features/games/class-challenges/classChallengeEngine.js';

const ROOT='/api/pilot/games/defis-classe',UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const conflict=()=>fail(409,'class_challenge_conflict','Une autre action est déjà enregistrée. Recharge le défi pour retrouver son état confirmé.');
const missing=()=>fail(404,'class_challenge_unavailable','Ce défi n’est pas disponible pour ce compte.');
function guard(c,classId=null) {
  return {sql:`EXISTS(SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
    WHERE m.school_id=? AND m.user_id=? AND m.active=1 AND m.role=? AND s.active=1)
    AND NOT EXISTS(SELECT 1 FROM pilot_admins ad WHERE ad.user_id=? AND ad.active=1)
    AND ${LIVE_SESSION_SQL}${classId===null?'':` AND EXISTS(SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id
      WHERE cm.school_id=? AND cm.user_id=? AND cm.class_id=? AND cl.active=1)`}`,
    values:[c.schoolId,c.user.id,c.role,c.user.id,...liveValues(c.session),...(classId===null?[]:[c.schoolId,c.user.id,classId])]};
}
async function access(db,c,classId=null) {
  const g=guard(c,classId);if(!await first(db,'SELECT 1 ok WHERE '+g.sql,...g.values)){
    if(classId!==null)missing();
    fail(403,'class_access_changed','Ton accès scolaire a changé. Reconnecte-toi pour continuer.');
  }
}
function fields(input,keys) {
  if(!input||Object.keys(input).length!==keys.length||Object.keys(input).some(k=>!keys.includes(k))||typeof input.requestId!=='string'||!UUID.test(input.requestId))fail(422,'class_invalid_input','Informations du défi invalides.');
}
function pageOffset(url,key='offset') {
  const values=url.searchParams.getAll(key);
  if(values.length>1||(values.length&&!/^(0|[1-9][0-9]{0,6})$/.test(values[0])))fail(422,'class_invalid_page','Page du défi invalide.');
  return values.length?Number(values[0]):0;
}
async function challenge(db,c,id) {
  const row=await first(db,'SELECT * FROM pilot_class_challenges WHERE id=? AND school_id=?',id,c.schoolId);
  if(!row||(c.role==='enseignant'&&row.teacher_id!==c.user.id))missing();
  await access(db,c,row.class_id);return row;
}
const closed=row=>row.closed_at!==null||row.end_at<=now();
const ownAttempt=(db,c,id)=>first(db,'SELECT * FROM pilot_class_attempts WHERE challenge_id=? AND school_id=? AND student_id=?',id,c.schoolId,c.user.id);
const stateOf=row=>JSON.parse(row.state_json);
function questions(row) {
  const set=resolveClassQuestions(row.content_version,JSON.parse(row.question_ids_json));
  if(!set)fail(503,'class_content_unavailable','Le contenu de ce défi ne peut pas être confirmé. Aucun résultat n’a été modifié.');
  return set;
}
function resultOf(row) {
  if(!row)return null;
  const state=stateOf(row),correctCount=state.answers.filter(a=>a.isCorrect).length;
  return {status:row.completed_at===null?'en_cours':'termine',correctCount,questionCount:5,score:correctCount*100,
    scorePercent:correctCount*20,progressPercent:row.completed_at===null?Math.min(99,state.answers.length*20):100,
    xpEarned:correctCount*10,completedAt:row.completed_at===null?null:new Date(row.completed_at*1000).toISOString()};
}
function attemptView(row,owner) {
  if(!row)return null;
  const state=stateOf(row);
  return {id:row.id,revision:row.revision,pseudonym:row.pseudonym,phase:state.phase,index:state.index,
    answers:state.answers,startingXp:state.startingXp,durationSeconds:state.durationSeconds,questionStartedAt:state.questionStartedAt,
    completedAt:row.completed_at,summary:resultOf(row),questions:questions(owner).map((q,i)=>({
      id:q.id,theme:q.theme,level:q.level,prompt:q.prompt,choices:q.choices,
      ...(i<state.answers.length?{correctIndex:q.correctIndex,explanation:q.explanation}:{})
    }))};
}
async function xpTotal(db,c) {
  const row=await first(db,`SELECT coalesce(sum(xp),0) xp FROM (
    SELECT xp FROM pilot_game_awards WHERE school_id=? AND student_id=? UNION ALL
    SELECT xp FROM pilot_quiz_awards WHERE school_id=? AND student_id=? UNION ALL
    SELECT xp FROM pilot_market_awards WHERE school_id=? AND student_id=? UNION ALL
    SELECT xp FROM pilot_class_awards WHERE school_id=? AND student_id=?)`,...Array.from({length:4},()=>[c.schoolId,c.user.id]).flat());
  return row.xp;
}
// Only currently active pupils of this exact class appear, never former or foreign members.
const participantsFrom=`FROM pilot_class_attempts a JOIN pilot_memberships m ON m.school_id=a.school_id AND m.user_id=a.student_id
  JOIN pilot_users u ON u.id=a.student_id JOIN pilot_class_members cm ON cm.school_id=a.school_id AND cm.user_id=a.student_id AND cm.class_id=a.class_id
  WHERE a.challenge_id=? AND a.school_id=? AND m.active=1 AND m.role='eleve' AND u.active=1
  AND NOT EXISTS(SELECT 1 FROM pilot_admins ad WHERE ad.user_id=a.student_id AND ad.active=1)`;
async function ranking(db,c,row,offset=0) {
  // Rank all completed participants before pagination; an incomplete participant has no rank.
  const cte=`WITH participants AS (SELECT a.pseudonym,a.student_id,a.completed_at,a.revision,
    json_array_length(a.state_json,'$.answers') answered,
    (SELECT count(*) FROM json_each(a.state_json,'$.answers') ans WHERE json_extract(ans.value,'$.isCorrect')=1) correct_count
    ${participantsFrom}),
    ranked AS (SELECT *,CASE WHEN completed_at IS NOT NULL THEN rank() OVER(ORDER BY (completed_at IS NOT NULL) DESC,correct_count DESC) ELSE NULL END ranking,
      CASE WHEN completed_at IS NOT NULL THEN count(*) OVER(PARTITION BY (completed_at IS NOT NULL),correct_count)>1 ELSE 0 END tied
      FROM participants)`;
  const values=[row.id,c.schoolId];
  const snapshot=await first(db,cte+` SELECT
    (SELECT json_group_array(json_object('pseudonym',pseudonym,'ranking',ranking,'tied',tied,'answered',answered,
      'correct_count',correct_count,'completed_at',completed_at,'is_viewer',student_id=?))
      FROM (SELECT * FROM ranked ORDER BY (completed_at IS NOT NULL) DESC,
        CASE WHEN completed_at IS NOT NULL THEN correct_count END DESC,
        CASE WHEN completed_at IS NULL THEN answered END DESC,pseudonym LIMIT 200 OFFSET ?)) rows_json,
    (SELECT count(*) FROM ranked) total,(SELECT count(completed_at) FROM ranked) completed,
    (SELECT ranking FROM ranked WHERE student_id=?) own_rank,
    (SELECT tied FROM ranked WHERE student_id=?) own_tied,
    (SELECT group_concat(pseudonym||':'||revision,',') FROM (SELECT * FROM ranked ORDER BY pseudonym)) signature`,
    ...values,c.user.id,offset,c.user.id,c.user.id);
  const rows=JSON.parse(snapshot.rows_json),totals={total:snapshot.total,completed:snapshot.completed};
  const own=snapshot.own_tied===null?null:{ranking:snapshot.own_rank,tied:snapshot.own_tied};
  const version=await hash(snapshot.signature??'');
  return {rows:rows.map(r=>({rank:r.ranking,tied:Boolean(r.tied),pseudonym:r.pseudonym,score:r.correct_count*100,correctCount:r.correct_count,
    questionCount:5,progressPercent:r.completed_at===null?Math.min(99,r.answered*20):100,status:r.completed_at===null?'en_cours':'termine',isViewer:Boolean(r.is_viewer)})),
    ...totals,version,viewerRank:own?{rank:own.ranking,tied:Boolean(own.tied)}:null,nextOffset:offset+rows.length<totals.total?offset+rows.length:null};
}
function challengeView(row,attempt=null) {
  return {id:row.id,classId:row.class_id,classLabel:row.class_label,title:row.title,level:row.level,theme:row.theme,
    bankId:row.bank_id,bankLabel:classBanks.find(b=>b.id===row.bank_id)?.label??'Banque publiée',
    questionIds:JSON.parse(row.question_ids_json),questionCount:5,revision:row.revision,
    startAt:new Date(row.created_at*1000).toISOString(),endAt:new Date(row.end_at*1000).toISOString(),
    status:closed(row)?'termine':'en_cours',pseudonym:attempt?.pseudonym??null,ownResult:resultOf(attempt),
    canPlay:!closed(row)&&attempt?.completed_at==null};
}
async function detail(db,c,id,extra={},offset=0,expectedVersion=null) {
  const row=await challenge(db,c,id),attempt=c.role==='eleve'?await ownAttempt(db,c,id):null;
  const leaderboard=await ranking(db,c,row,offset),xp=c.role==='eleve'?await xpTotal(db,c):null;
  if(offset>0&&leaderboard.version!==expectedVersion)conflict();
  // Check membership/ownership again after dependent reads.
  const current=await challenge(db,c,id);
  if(c.role==='eleve'&&(await ownAttempt(db,c,id))?.revision!==attempt?.revision)conflict();
  return reply({userId:c.user.id,schoolId:c.schoolId,serverNow:Date.now(),challenge:challengeView(current,attempt),
    attempt:attemptView(attempt,row),leaderboard,xpTotal:xp,...extra});
}
async function list(db,c,url) {
  const offset=pageOffset(url),g=guard(c);
  const scope=`d.school_id=? AND EXISTS(SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id
    WHERE cm.school_id=d.school_id AND cm.class_id=d.class_id AND cm.user_id=? AND cl.active=1)
    ${c.role==='enseignant'?'AND d.teacher_id=?':''} AND ${g.sql}`;
  const values=[c.schoolId,c.user.id,...(c.role==='enseignant'?[c.user.id]:[]),...g.values];
  const counts=await first(db,`SELECT count(*) total,coalesce(sum(closed_at IS NULL AND end_at>?),0) active FROM pilot_class_challenges d WHERE ${scope}`,now(),...values);
  const rows=await all(db,`SELECT d.* FROM pilot_class_challenges d WHERE ${scope} ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET ?`,...values,offset);
  const classes=await all(db,`SELECT cl.id,cl.name label FROM pilot_classes cl JOIN pilot_class_members cm ON cm.school_id=cl.school_id AND cm.class_id=cl.id
    WHERE cl.school_id=? AND cm.user_id=? AND cl.active=1 AND ${g.sql} ORDER BY cl.name,cl.id`,c.schoolId,c.user.id,...g.values);
  const challenges=[];
  for(const row of rows){
    const own=c.role==='eleve'?await ownAttempt(db,c,row.id):null;
    const totals=await first(db,'SELECT count(*) total,count(a.completed_at) completed '+participantsFrom,row.id,c.schoolId);
    challenges.push({...challengeView(row,own),participantCount:totals.total,completedCount:totals.completed});
  }
  const unique=c.role==='enseignant'?await first(db,`SELECT count(DISTINCT a.student_id) total FROM pilot_class_attempts a
    JOIN pilot_class_challenges d ON d.id=a.challenge_id WHERE ${scope}
    AND EXISTS(SELECT 1 FROM pilot_class_members cm JOIN pilot_memberships m ON m.school_id=cm.school_id AND m.user_id=cm.user_id
      JOIN pilot_users u ON u.id=m.user_id WHERE cm.class_id=a.class_id AND cm.school_id=a.school_id AND cm.user_id=a.student_id AND m.active=1 AND m.role='eleve' AND u.active=1)
    AND NOT EXISTS(SELECT 1 FROM pilot_admins ad WHERE ad.user_id=a.student_id AND ad.active=1)`,...values):null;
  for(const row of rows)await challenge(db,c,row.id);
  await access(db,c);
  return reply({userId:c.user.id,schoolId:c.schoolId,serverNow:Date.now(),challenges,counts:{...counts,finished:counts.total-counts.active,participants:unique?.total??null},
    nextOffset:offset+rows.length<counts.total?offset+rows.length:null,
    classes:classes.map(cl=>({...cl,level:classLevel(cl.label)})),
    ...(c.role==='enseignant'?{banks:classBanks,questionMetadata:classQuestionMetadata,themes:classThemes}:{}),
    xpTotal:c.role==='eleve'?await xpTotal(db,c):null});
}
async function create(request,db,c) {
  if(c.role!=='enseignant')fail(403,'teacher_required','Seul l’enseignant peut créer un défi.');
  const input=await readInput(request,2048);fields(input,['requestId','classId','title','theme','bankId','durationHours']);
  const classId=requiredText(input.classId,'Classe',1,100),title=requiredText(input.title,'Titre',5,80);
  if(!classThemes.includes(input.theme)||!classBanks.some(b=>b.id===input.bankId)||![24,72,168].includes(input.durationHours))fail(422,'class_invalid_draft','Choisissez une banque publiée, un thème et une durée proposés.');
  const requestId=input.requestId.toLowerCase(),requestHash=await hash(JSON.stringify([classId,title,input.theme,input.bankId,input.durationHours]));
  const prior=await first(db,'SELECT id,create_request_hash FROM pilot_class_challenges WHERE school_id=? AND teacher_id=? AND create_request_id=?',c.schoolId,c.user.id,requestId);
  if(prior){await challenge(db,c,prior.id);if(prior.create_request_hash!==requestHash)conflict();return detail(db,c,prior.id,{replayed:true});}
  await access(db,c,classId);
  const cl=await first(db,'SELECT name FROM pilot_classes WHERE id=? AND school_id=?',classId,c.schoolId),level=classLevel(cl?.name);
  if(!level)fail(422,'class_level_missing','Le niveau de cette classe n’est pas renseigné dans son libellé. L’administration doit le confirmer avant le lancement.');
  const id=crypto.randomUUID(),selected=selectClassQuestions({id,bankId:input.bankId,theme:input.theme,level});
  if(selected.length!==5)fail(503,'class_bank_incomplete','La banque ne contient pas cinq questions publiées utilisables.');
  const time=now(),g=guard(c,classId);
  await run(db,`INSERT INTO pilot_class_challenges(id,school_id,class_id,teacher_id,title,class_label,level,theme,bank_id,content_version,question_ids_json,created_at,end_at,revision,create_request_id,create_request_hash)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,? WHERE ${g.sql}
    AND (SELECT count(*) FROM pilot_class_challenges WHERE school_id=? AND teacher_id=? AND created_at>?)<20
    ON CONFLICT(school_id,teacher_id,create_request_id) DO NOTHING`,
    id,c.schoolId,classId,c.user.id,title,cl.name,level,input.theme,input.bankId,CLASS_CONTENT_VERSION,JSON.stringify(selected.map(q=>q.id)),time,time+input.durationHours*3600,requestId,requestHash,
    ...g.values,c.schoolId,c.user.id,time-3600);
  await access(db,c,classId);
  const saved=await first(db,'SELECT id,create_request_hash FROM pilot_class_challenges WHERE school_id=? AND teacher_id=? AND create_request_id=?',c.schoolId,c.user.id,requestId);
  if(!saved)fail(429,'class_create_limit','Beaucoup de défis ont été lancés. Reprenez un défi existant ou réessayez plus tard.');
  if(saved.create_request_hash!==requestHash)conflict();
  return detail(db,c,saved.id,{replayed:saved.id!==id});
}
async function close(request,db,c,id) {
  if(c.role!=='enseignant')fail(403,'teacher_required','Seul l’enseignant peut clôturer son défi.');
  const input=await readInput(request,2048);fields(input,['requestId','revision']);
  if(!Number.isSafeInteger(input.revision)||input.revision<1)fail(422,'class_invalid_revision','Version de défi invalide.');
  const row=await challenge(db,c,id),requestId=input.requestId.toLowerCase(),requestHash=await hash(JSON.stringify(['close',input.revision]));
  if(row.close_request_id===requestId){if(row.close_request_hash!==requestHash)conflict();return detail(db,c,id,{replayed:true});}
  if(row.revision!==input.revision||closed(row))conflict();
  const g=guard(c,row.class_id),time=now();
  await run(db,`UPDATE pilot_class_challenges SET closed_at=?,revision=revision+1,close_request_id=?,close_request_hash=?
    WHERE id=? AND school_id=? AND teacher_id=? AND revision=? AND closed_at IS NULL AND end_at>? AND ${g.sql}`,
    time,requestId,requestHash,id,c.schoolId,c.user.id,row.revision,time,...g.values);
  const saved=await challenge(db,c,id);
  if(saved.close_request_id!==requestId||saved.close_request_hash!==requestHash)conflict();
  return detail(db,c,id,{replayed:false});
}
function randomAlias() {
  const bytes=crypto.getRandomValues(new Uint32Array(2));
  return SAFE_CLASS_PSEUDONYMS[bytes[0]%SAFE_CLASS_PSEUDONYMS.length]+' '+bytes[1].toString(16).padStart(8,'0').toUpperCase();
}
async function start(request,db,c,id) {
  const input=await readInput(request,2048);fields(input,['requestId','comfortMode']);
  if(typeof input.comfortMode!=='boolean')fail(422,'class_invalid_comfort','Choisissez le mode de lecture avant de commencer.');
  const row=await challenge(db,c,id),requestId=input.requestId.toLowerCase(),requestHash=await hash(JSON.stringify(['start',input.comfortMode]));
  const prior=await ownAttempt(db,c,id);
  if(prior){if(prior.start_request_id===requestId&&prior.start_request_hash!==requestHash)conflict();return detail(db,c,id,{replayed:true});}
  if(closed(row))fail(410,'class_closed','Ce défi est terminé. Son classement reste consultable.');
  questions(row);
  const g=guard(c,row.class_id),time=now(),attemptId=crypto.randomUUID();
  const state={phase:'question',index:0,answers:[],receipts:[],startingXp:await xpTotal(db,c),durationSeconds:input.comfortMode?20:10,questionStartedAt:Date.now()};
  for(let tries=0;tries<4;tries++){
    await run(db,`INSERT INTO pilot_class_attempts(id,school_id,class_id,challenge_id,student_id,pseudonym,state_json,revision,start_request_id,start_request_hash,last_request_id,last_request_hash,created_at)
      SELECT ?,?,?,?,?,?,?,1,?,?,?,?,? WHERE ${g.sql}
      AND EXISTS(SELECT 1 FROM pilot_class_challenges d WHERE d.id=? AND d.closed_at IS NULL AND d.end_at>max(?,unixepoch()))
      ON CONFLICT DO NOTHING`,attemptId,c.schoolId,row.class_id,id,c.user.id,randomAlias(),JSON.stringify(state),requestId,requestHash,requestId,requestHash,time,...g.values,id,now());
    await challenge(db,c,id);
    const saved=await ownAttempt(db,c,id);
    if(saved){if(saved.start_request_id===requestId&&saved.start_request_hash!==requestHash)conflict();return detail(db,c,id,{replayed:saved.id!==attemptId});}
    if(closed(await challenge(db,c,id)))fail(410,'class_closed','Le défi vient de se terminer. Aucune participation n’a été créée.');
  }
  fail(503,'class_alias_unavailable','Le pseudonyme n’a pas pu être attribué. Réessaie le même envoi.');
}
async function transition(request,db,c,id,action) {
  const input=await readInput(request,2048);fields(input,action==='answer'?['requestId','revision','index','selectedIndex']:['requestId','revision']);
  if(!Number.isSafeInteger(input.revision)||input.revision<1)fail(422,'class_invalid_revision','Version de participation invalide.');
  if(action==='answer'&&(!Number.isInteger(input.index)||input.index<0||input.index>4||!(input.selectedIndex===null||Number.isInteger(input.selectedIndex)&&input.selectedIndex>=0&&input.selectedIndex<4)))fail(422,'class_invalid_answer','Réponse invalide.');
  const owner=await challenge(db,c,id),row=await ownAttempt(db,c,id);if(!row)missing();
  const requestId=input.requestId.toLowerCase(),requestHash=await hash(JSON.stringify([action,input.revision,input.index??null,input.selectedIndex??null]));
  const state=stateOf(row),receipt=state.receipts.find(r=>r.id===requestId);
  if(requestId===row.start_request_id)conflict();
  if(receipt){if(receipt.hash!==requestHash)conflict();return detail(db,c,id,{replayed:true});}
  if(row.revision!==input.revision)conflict();
  // Five accepted answers constitute completion. Reading the last correction and
  // opening the result remain possible after closure, without changing the score.
  const finalNext=action==='next'&&state.phase==='feedback'&&state.answers.length===5;
  if(state.phase==='results')conflict();
  if(closed(owner)&&!finalNext)fail(410,'class_closed','Ce défi est terminé. Tes réponses déjà enregistrées et tes XP sont conservés.');
  let award=0,completedAt=row.completed_at;const time=now();
  if(action==='answer'){
    if(state.phase!=='question'||input.index!==state.index)conflict();
    const q=questions(owner)[state.index],timedOut=Date.now()>=state.questionStartedAt+state.durationSeconds*1000;
    const selectedIndex=timedOut?null:input.selectedIndex,isCorrect=selectedIndex===q.correctIndex;award=isCorrect?10:0;
    state.answers.push({questionId:q.id,selectedIndex,correctIndex:q.correctIndex,isCorrect,xp:award,timedOut,
      remainingSeconds:Math.max(0,Math.ceil((state.questionStartedAt+state.durationSeconds*1000-Date.now())/1000)),answeredAt:time});
    state.phase='feedback';if(state.answers.length===5)completedAt=time;
  }else{
    if(state.phase!=='feedback')conflict();
    if(finalNext)state.phase='results';else{state.index++;state.phase='question';state.questionStartedAt=Date.now();}
  }
  state.receipts.push({id:requestId,hash:requestHash});
  const g=guard(c,owner.class_id),next=row.revision+1;
  const write=db.prepare(`UPDATE pilot_class_attempts SET state_json=?,revision=?,last_request_id=?,last_request_hash=?,completed_at=?
    WHERE id=? AND school_id=? AND student_id=? AND revision=? AND ${g.sql}
    AND EXISTS(SELECT 1 FROM pilot_class_challenges d WHERE d.id=? AND (?=1 OR (d.closed_at IS NULL AND d.end_at>max(?,unixepoch()))))`)
    .bind(JSON.stringify(state),next,requestId,requestHash,completedAt,row.id,c.schoolId,c.user.id,row.revision,...g.values,id,finalNext?1:0,now());
  const statements=[write];
  if(award)statements.push(db.prepare(`INSERT INTO pilot_class_awards(attempt_id,school_id,student_id,question_index,xp,awarded_at)
    SELECT ?,?,?,?,?,? WHERE ${g.sql} AND EXISTS(SELECT 1 FROM pilot_class_attempts a WHERE a.id=? AND a.revision=? AND a.last_request_id=? AND a.last_request_hash=?)
    ON CONFLICT DO NOTHING`).bind(row.id,c.schoolId,c.user.id,state.index,award,time,...g.values,row.id,next,requestId,requestHash));
  await db.batch(statements);const current=await challenge(db,c,id),saved=await ownAttempt(db,c,id);
  if(!saved||!stateOf(saved).receipts.some(r=>r.id===requestId&&r.hash===requestHash)){
    if(closed(current))fail(410,'class_closed','La clôture a été enregistrée avant cette réponse. Les résultats précédents sont conservés.');
    conflict();
  }
  return detail(db,c,id,{replayed:false});
}
export async function handleClassChallenges(request,env,c,path=new URL(request.url).pathname) {
  if(!c?.user?.id||c.session?.user_id!==c.user.id||!c.session?.token_hash)fail(401,'session_required','Reconnecte-toi pour ouvrir les défis.');
  if(!['eleve','enseignant'].includes(c.role))fail(403,'class_role_required','Les défis sont réservés aux élèves de la classe et à leur enseignant.');
  await access(env.DB,c);if(request.method!=='GET')checkCsrf(request,c.session);
  if(path===ROOT&&request.method==='GET')return list(env.DB,c,new URL(request.url));
  if(path===ROOT+'/create'&&request.method==='POST')return create(request,env.DB,c);
  const parts=path.slice(ROOT.length+1).split('/'),[id,action]=parts;
  if(!path.startsWith(ROOT+'/')||parts.length>2||!UUID.test(id??''))missing();
  if(request.method==='GET'&&parts.length===1)return detail(env.DB,c,id,{},pageOffset(new URL(request.url),'rankingOffset'),new URL(request.url).searchParams.get('rankingVersion'));
  if(request.method==='POST'&&action==='close')return close(request,env.DB,c,id);
  if(request.method==='POST'&&c.role==='eleve'){
    if(action==='start')return start(request,env.DB,c,id);
    if(['answer','next'].includes(action))return transition(request,env.DB,c,id,action);
  }
  missing();
}
