import {MISSION_ZELLIGE_MISSIONS as MISSIONS,getDailyMissionZellige} from './zellige-content-v1.js';
import {evaluateMissionHotspot,evaluateMissionSentence,buildMissionZelligeSummary} from '../../src/features/games/mission-zellige/missionZelligeEngine.js';
import {all,checkCsrf,fail,first,hash,LIVE_SESSION_SQL,liveValues,now,readInput,reply} from './session.js';

export const ZELLIGE_CONTENT_VERSION='zellige-2026-09-v1';
const GAME='mission-zellige',ROOT='/api/pilot/games/'+GAME;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BANK=new Map(MISSIONS.map(m=>[m.id,m]));
const key=(day,mission)=>day+':'+mission.id;
function guard(c){return {sql:`EXISTS(SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
 WHERE m.school_id=? AND m.user_id=? AND m.role='eleve' AND m.active=1 AND s.active=1)
 AND NOT EXISTS(SELECT 1 FROM pilot_admins a WHERE a.user_id=? AND a.active=1)
 AND EXISTS(SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id
 WHERE cm.school_id=? AND cm.user_id=? AND cl.active=1) AND ${LIVE_SESSION_SQL}`,
 values:[c.schoolId,c.user.id,c.user.id,c.schoolId,c.user.id,...liveValues(c.session)]};}
async function access(db,c){const g=guard(c);if(!await first(db,`SELECT 1 allowed WHERE ${g.sql}`,...g.values))fail(403,'zellige_access_changed','Ton accès a changé. Reconnecte-toi pour continuer.');}
function dailyFor(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z'))||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)fail(404,'zellige_date','Mission introuvable.');
  return getDailyMissionZellige(day+'T12:00:00Z');
}
function initial(day,mission){return {contentVersion:ZELLIGE_CONTENT_VERSION,dailyKey:day,missionId:mission.id,openedAt:now(),
 phase:'location',selectedHotspot:'',locationSolved:false,locationAttempts:0,locationHadError:false,orderedPieces:[],sentenceSolved:false,sentenceAttempts:0,sentenceHadError:false,
 feedback:null,result:null,firstCompletion:null,isReplay:false};}
function stateOf(row,day,mission){
  if(!row)return initial(day,mission);
  const state=JSON.parse(row.progress_json);
  if(state.contentVersion!==ZELLIGE_CONTENT_VERSION||state.missionId!==mission.id||state.dailyKey!==day||!['location','sentence','complete'].includes(state.phase))fail(503,'zellige_content_unavailable','Cette version de la mission n’est pas disponible. Ta progression est conservée.');
  return state;
}
function publicMission(m,state){
  const {correctOrder,answer,extraHint,sentenceHint,success,...visible}=m;
  return {...visible,hotspots:m.hotspots.map(({correct,...spot})=>({...spot,...(state.locationSolved?{correct:Boolean(correct)}:{})})),...(state.phase==='complete'?{answer}:{})};
}
async function owned(db,c,day,mission){const g=guard(c);return first(db,`SELECT * FROM pilot_game_progress WHERE school_id=? AND student_id=? AND game_id=? AND grid_id=? AND ${g.sql}`,c.schoolId,c.user.id,GAME,key(day,mission),...g.values);}
async function response(db,c,day,extra={}){
  const g=guard(c),daily=dailyFor(day);
  const rows=await all(db,`SELECT * FROM pilot_game_progress WHERE school_id=? AND student_id=? AND game_id=? AND grid_id IN (?,?,?,?) AND ${g.sql}`,c.schoolId,c.user.id,GAME,...MISSIONS.map(m=>key(day,m)),...g.values);
  const totals=await first(db,`SELECT
   (SELECT coalesce(sum(xp),0) FROM pilot_game_awards WHERE school_id=? AND student_id=? AND game_id IN ('mots-fleches','mission-zellige'))+
   (SELECT coalesce(sum(xp),0) FROM pilot_quiz_awards WHERE school_id=? AND student_id=?)+
   (SELECT coalesce(sum(xp),0) FROM pilot_market_awards WHERE school_id=? AND student_id=?)+
   (SELECT coalesce(sum(xp),0) FROM pilot_class_awards WHERE school_id=? AND student_id=?) xpTotal,
   (SELECT count(DISTINCT json_extract(p.progress_json,'$.missionId')) FROM pilot_game_awards a JOIN pilot_game_progress p
    ON p.school_id=a.school_id AND p.student_id=a.student_id AND p.game_id=a.game_id AND p.grid_id=a.grid_id
    WHERE a.school_id=? AND a.student_id=? AND a.game_id='mission-zellige') fragmentCount WHERE ${g.sql}`,
  c.schoolId,c.user.id,c.schoolId,c.user.id,c.schoolId,c.user.id,c.schoolId,c.user.id,c.schoolId,c.user.id,...g.values);
  await access(db,c);
  return reply({userId:c.user.id,schoolId:c.schoolId,serverNow:Date.now(),...totals,
    daily:{dateKey:day,missionIndex:daily.missionIndex,completionXp:20},
    missions:MISSIONS.map(mission=>{const row=rows.find(r=>r.grid_id===key(day,mission)),state=stateOf(row,day,mission);return {mission:publicMission(mission,state),state:{...state,revision:row?.revision??0}};}),...extra});
}
function conflict(){fail(409,'zellige_conflict','Cette mission a changé dans un autre onglet. Recharge la progression enregistrée.');}
function fields(input,allowed){
  if(Object.keys(input).some(k=>!allowed.includes(k)))fail(422,'zellige_field','La requête contient un champ inattendu.');
  if(typeof input.requestId!=='string'||!UUID.test(input.requestId)||!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER)fail(422,'zellige_request','La référence de progression est invalide.');
}
function pieces(input,mission,complete=false){
  if(!Array.isArray(input)||input.length>mission.pieces.length||complete&&input.length!==mission.pieces.length||new Set(input).size!==input.length||input.some(id=>typeof id!=='string'||!mission.pieces.some(p=>p.id===id)))fail(422,'zellige_pieces','Choisis les groupes de mots proposés, sans doublon.');
}
async function mutate(request,db,c,day,mission,action){
  const input=await readInput(request,2048);
  fields(input,['requestId','revision',...(action==='draft'?['selectedHotspot','orderedPieces']:action==='location'?['hotspotId']:action==='sentence'?['orderedPieces']:[])]);
  const requestId=input.requestId.toLowerCase();
  // Fixed field order makes retry equivalence independent of JSON property order.
  const requestHash=await hash(JSON.stringify([day,mission.id,action,input.revision,input.selectedHotspot??null,input.hotspotId??null,input.orderedPieces??null]));
  const row=await owned(db,c,day,mission);
  if(row?.last_request_id===requestId){if(row.last_request_hash!==requestHash)conflict();return response(db,c,day,{replayed:true});}
  if((row?.revision??0)!==input.revision)conflict();
  if(!row&&day!==getDailyMissionZellige().dateKey)fail(409,'zellige_day_changed','Une nouvelle mission du jour est disponible. Recharge tes jeux.');
  let state=stateOf(row,day,mission);
  if(row&&state.openedAt+86400<=now())fail(410,'zellige_expired','Cette progression a expiré. Ouvre la mission du jour.');
  const daily=dailyFor(day),isDaily=daily.mission.id===mission.id;
  let award=0;
  if(action==='restart'){
    if(!row||state.phase!=='complete')conflict();
    state={...initial(day,mission),openedAt:state.openedAt,firstCompletion:state.firstCompletion,isReplay:true};
  }else if(action==='draft'){
    if(state.phase==='location'&&!state.locationSolved){
      if(Object.hasOwn(input,'orderedPieces')||typeof input.selectedHotspot!=='string'||!mission.hotspots.some(h=>h.id===input.selectedHotspot))fail(422,'zellige_hotspot','Choisis un repère proposé.');
      state.selectedHotspot=input.selectedHotspot;
    }else if(state.phase==='sentence'&&!state.sentenceSolved){
      if(Object.hasOwn(input,'selectedHotspot'))fail(422,'zellige_field','La requête contient un champ inattendu.');
      pieces(input.orderedPieces,mission);state.orderedPieces=[...input.orderedPieces];
    }else conflict();
    state.feedback=null;
  }else if(action==='location'){
    if(state.phase!=='location'||state.locationSolved)conflict();
    const evaluated=evaluateMissionHotspot(mission,input.hotspotId);
    if(!evaluated.valid)fail(422,'zellige_hotspot','Choisis un repère proposé.');
    state.selectedHotspot=input.hotspotId;state.locationAttempts++;
    if(evaluated.correct){state.locationSolved=true;state.phase='sentence';state.feedback={kind:'success',text:`Bien vu ! ${evaluated.hotspot.description}. Construis maintenant ta phrase.`};}
    else{state.locationHadError=true;state.feedback={kind:'error',text:`Ce n’est pas encore le bon repère. ${mission.extraHint}`};}
  }else if(action==='sentence'){
    if(state.phase!=='sentence'||state.sentenceSolved||!state.locationSolved)conflict();
    pieces(input.orderedPieces,mission,true);
    const evaluated=evaluateMissionSentence(mission,input.orderedPieces);state.orderedPieces=[...input.orderedPieces];state.sentenceAttempts++;
    if(evaluated.correct){state.sentenceSolved=true;state.feedback={kind:'success',text:mission.success};}
    else{state.sentenceHadError=true;state.feedback={kind:'error',text:`Presque ! ${mission.sentenceHint}`};}
  }else if(action==='finish'){
    if(state.phase!=='sentence'||!state.locationSolved||!state.sentenceSolved)conflict();
    const prior=await first(db,'SELECT 1 awarded FROM pilot_game_awards WHERE school_id=? AND student_id=? AND game_id=? AND grid_id=?',c.schoolId,c.user.id,GAME,key(day,mission));
    award=isDaily&&!prior&&!state.isReplay?20:0;
    const summary={...buildMissionZelligeSummary({daily,mission,locationFirstTry:!state.locationHadError,sentenceFirstTry:!state.sentenceHadError,awardXp:Boolean(award)}),completedAt:now(),preview:!isDaily||state.isReplay,alreadyRecorded:Boolean(prior)};
    state.phase='complete';state.result=summary;
    // This first result remains immutable across practice replays.
    if(!state.firstCompletion)state.firstCompletion=summary;
    state.feedback={kind:'success',text:award?'Ta mission du jour est enregistrée et tes 20 XP ont rejoint ton profil.':prior?'Cette mission était déjà enregistrée aujourd’hui : aucun XP supplémentaire n’a été ajouté.':'Cette situation bêta est terminée. Elle ne donne pas d’XP supplémentaire.'};
  }else fail(404,'not_found','Action introuvable.');
  const g=guard(c),id=key(day,mission),revision=input.revision+1,stamp=now();
  const save=db.prepare(`INSERT INTO pilot_game_progress(school_id,student_id,game_id,grid_id,progress_json,hint_count,revision,last_request_id,last_request_hash,updated_at)
    SELECT ?,?,?,?,?,0,?,?,?,? WHERE ${g.sql} AND (?=0 OR EXISTS(SELECT 1 FROM pilot_game_progress p WHERE p.school_id=? AND p.student_id=? AND p.game_id=? AND p.grid_id=? AND p.revision=?))
    ON CONFLICT(school_id,student_id,game_id,grid_id) DO UPDATE SET progress_json=excluded.progress_json,revision=excluded.revision,last_request_id=excluded.last_request_id,last_request_hash=excluded.last_request_hash,updated_at=excluded.updated_at
    WHERE pilot_game_progress.revision=? AND pilot_game_progress.last_request_id<>?`).bind(c.schoolId,c.user.id,GAME,id,JSON.stringify(state),revision,requestId,requestHash,stamp,...g.values,input.revision,c.schoolId,c.user.id,GAME,id,input.revision,input.revision,requestId);
  const statements=[save];
  if(award)statements.push(db.prepare(`INSERT INTO pilot_game_awards(school_id,student_id,game_id,grid_id,xp,completed_at)
    SELECT ?,?,?,?,20,? WHERE ${g.sql} AND EXISTS(SELECT 1 FROM pilot_game_progress p WHERE p.school_id=? AND p.student_id=? AND p.game_id=? AND p.grid_id=? AND p.revision=? AND p.last_request_id=? AND p.last_request_hash=?) ON CONFLICT DO NOTHING`)
    .bind(c.schoolId,c.user.id,GAME,id,stamp,...g.values,c.schoolId,c.user.id,GAME,id,revision,requestId,requestHash));
  await db.batch(statements);await access(db,c);
  const saved=await owned(db,c,day,mission);
  if(saved?.last_request_id!==requestId||saved.last_request_hash!==requestHash)conflict();
  return response(db,c,day,{replayed:false});
}
export async function handleZellige(request,env,c,path=new URL(request.url).pathname){
  if(!c?.user?.id||!c.schoolId||c.session?.user_id!==c.user.id||!c.session?.token_hash)fail(401,'session_required','Reconnecte-toi pour jouer.');
  if(c.role!=='eleve')fail(403,'student_required','Cette mission est réservée à l’élève.');
  if(!env.DB)fail(503,'database_unavailable','Le serveur de jeux est indisponible.');
  if(request.method!=='GET')checkCsrf(request,c.session);
  await access(env.DB,c);
  if(request.method==='GET'&&path===ROOT)return response(env.DB,c,getDailyMissionZellige().dateKey);
  const match=path.match(/^\/api\/pilot\/games\/mission-zellige\/(\d{4}-\d{2}-\d{2})\/([a-z-]+)\/(draft|location|sentence|finish|restart)$/);
  if(request.method==='POST'&&match&&BANK.has(match[2])){dailyFor(match[1]);return mutate(request,env.DB,c,match[1],BANK.get(match[2]),match[3]);}
  return reply({error:{code:'not_found',message:'Mission introuvable.'}},404);
}
