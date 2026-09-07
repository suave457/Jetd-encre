import {MARKET_MISSIONS as MISSIONS,MARKET_TIERS as TIERS} from './market-content-v1.js';
import {buildMarketTierProgress,buildMarketTierSummary,buildMarketRewardClaims,evaluateMarketMission,getMarketMissionFeedback} from '../../src/features/games/market-shop/marketShopEngine.js';
import {all,checkCsrf,fail,first,hash,LIVE_SESSION_SQL,liveValues,now,readInput,reply} from './session.js';

export const MARKET_CONTENT_VERSION='market-2026-09-v1';
const GAME='souk-des-mots',GRID='v1',ROOT='/api/pilot/games/'+GAME;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const tierById=id=>TIERS.find(t=>t.id===id),missionAt=(tier,run)=>MISSIONS.find(m=>m.id===tier.missionIds[run.index]);
function guard(c){return {sql:`EXISTS(SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
 WHERE m.school_id=? AND m.user_id=? AND m.role='eleve' AND m.active=1 AND s.active=1)
 AND NOT EXISTS(SELECT 1 FROM pilot_admins a WHERE a.user_id=? AND a.active=1)
 AND EXISTS(SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id
 WHERE cm.school_id=? AND cm.user_id=? AND cl.active=1) AND ${LIVE_SESSION_SQL}`,
 values:[c.schoolId,c.user.id,c.user.id,c.schoolId,c.user.id,...liveValues(c.session)]};}
async function access(db,c){const g=guard(c);if(!await first(db,`SELECT 1 allowed WHERE ${g.sql}`,...g.values))fail(403,'market_access_changed','Ton accès a changé. Reconnecte-toi pour continuer.');}
const draft=()=>({basket:{},selectedFormulaId:'',helpUsed:false,failureCount:0,solved:false,missionXp:0,feedback:null});
const run=()=>({runId:null,index:0,review:false,ended:false,...draft(),results:[],summary:null,firstCompletion:null});
const initial=()=>({contentVersion:MARKET_CONTENT_VERSION,screen:'journey',activeTierId:null,celebratingTierId:null,runs:Object.fromEntries(TIERS.map(t=>[t.id,run()]))});
function stateOf(row){
 if(!row)return initial();
 let s;try{s=JSON.parse(row.progress_json);}catch{}
 if(!s||s.contentVersion!==MARKET_CONTENT_VERSION||!['journey','game','results'].includes(s.screen)||
  (s.activeTierId!==null&&!tierById(s.activeTierId))||(s.screen!=='journey'&&!s.activeTierId)||
  TIERS.some(t=>{const r=s.runs?.[t.id];return !r||!Number.isInteger(r.index)||r.index<0||r.index>=t.missionIds.length||!Array.isArray(r.results)||!r.basket||typeof r.helpUsed!=='boolean'||!Number.isSafeInteger(r.failureCount)||r.failureCount<0;}))
  fail(503,'market_content_unavailable','Cette version du Souk n’est pas disponible. Ta progression est conservée.');
 return s;
}
async function owned(db,c){const g=guard(c);return first(db,`SELECT * FROM pilot_game_progress WHERE school_id=? AND student_id=? AND game_id=? AND grid_id=? AND ${g.sql}`,c.schoolId,c.user.id,GAME,GRID,...g.values);}
async function claimsOf(db,c){const g=guard(c);return all(db,`SELECT mission_id,mission_version,reward_type,xp,awarded_at FROM pilot_market_awards WHERE school_id=? AND student_id=? AND game_id=? AND grid_id=? AND ${g.sql}`,c.schoolId,c.user.id,GAME,GRID,...g.values);}
const mastered=claims=>claims.filter(a=>a.reward_type==='mastery'&&MISSIONS.some(m=>m.id===a.mission_id&&m.version===a.mission_version)).map(a=>a.mission_id);
function publicMission(m,state){
 const r=state.runs[m.tierId],current=missionAt(tierById(m.tierId),r)?.id===m.id,solved=current&&r.solved;
 const {expectedBasket,help,success,feedbackSteps,...visible}=m;
 return {...visible,formulas:m.formulas.map(({correct,feedback,diagnosticCode,...f})=>f),...(solved?{expectedBasket,success}:{}),...(current&&r.helpUsed?{help}:{})};
}
async function response(db,c,extra={}){
 const g=guard(c),row=await owned(db,c),state=stateOf(row),claims=await claimsOf(db,c);
 const totals=await first(db,`SELECT
 (SELECT coalesce(sum(xp),0) FROM pilot_game_awards WHERE school_id=? AND student_id=?)+
 (SELECT coalesce(sum(xp),0) FROM pilot_quiz_awards WHERE school_id=? AND student_id=?)+
 (SELECT coalesce(sum(xp),0) FROM pilot_market_awards WHERE school_id=? AND student_id=?)+
 (SELECT coalesce(sum(xp),0) FROM pilot_class_awards WHERE school_id=? AND student_id=?) xpTotal WHERE ${g.sql}`,
 c.schoolId,c.user.id,c.schoolId,c.user.id,c.schoolId,c.user.id,c.schoolId,c.user.id,...g.values);
 await access(db,c);
 return reply({userId:c.user.id,schoolId:c.schoolId,serverNow:Date.now(),...totals,revision:row?.revision??0,state,
 tiers:buildMarketTierProgress(TIERS,MISSIONS,mastered(claims)),missions:MISSIONS.map(m=>publicMission(m,state)),...extra});
}
function conflict(){fail(409,'market_conflict','Le Souk a changé dans un autre onglet. Recharge la progression enregistrée.');}
async function mutate(request,db,c,action){
 const input=await readInput(request,2048),allowed=['requestId','revision',...(action==='open'?['tierId']:action==='quantity'?['productId','delta']:action==='formula'?['formulaId']:[])];
 if(Object.keys(input).some(k=>!allowed.includes(k)))fail(422,'market_field','La requête contient un champ inattendu.');
 if(typeof input.requestId!=='string'||!UUID.test(input.requestId)||!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER)fail(422,'market_request','La référence de progression est invalide.');
 const requestId=input.requestId.toLowerCase(),requestHash=await hash(JSON.stringify([action,input.revision,input.tierId??null,input.productId??null,input.delta??null,input.formulaId??null]));
 const row=await owned(db,c);
 if(row?.last_request_id===requestId){if(row.last_request_hash!==requestHash)conflict();return response(db,c,{replayed:true});}
 if((row?.revision??0)!==input.revision)conflict();
 const state=stateOf(row),claims=await claimsOf(db,c),completed=mastered(claims),progress=buildMarketTierProgress(TIERS,MISSIONS,completed);
 let tier=tierById(state.activeTierId),r=tier&&state.runs[tier.id],awards=[];
 if(action==='open'){
  tier=tierById(input.tierId);if(!tier)fail(422,'market_tier','Choisis un palier proposé.');
  const p=progress.find(t=>t.id===tier.id);if(!p.unlocked)fail(403,'market_tier_locked','Termine le palier précédent pour continuer.');
  r=state.runs[tier.id];
  // Navigation never clears an unfinished draft, an explicit hint or error count.
  if(r.review&&!r.ended&&r.solved){
   if(r.summary){state.activeTierId=tier.id;state.screen='results';}
   else {r.index++;Object.assign(r,draft());}
  }
  if(!r.runId||r.ended||(r.solved&&!r.review)){
   const isComplete=p.status==='completed';
   if(isComplete){r={...run(),runId:requestId,review:true,firstCompletion:r.firstCompletion};state.runs[tier.id]=r;}
   else {Object.assign(r,draft(),{runId:r.runId||requestId,index:tier.missionIds.indexOf(p.nextMissionId)});}
  }
  state.activeTierId=tier.id;state.screen=r.review&&r.summary&&!r.ended?'results':'game';state.celebratingTierId=null;
 }else if(action==='journey'){
  if(!r||state.screen!=='game')conflict();state.screen='journey';
 }else if(action==='replay'){
  if(!r||state.screen!=='results'||!r.summary)conflict();r.ended=true;state.screen='journey';state.activeTierId=null;state.celebratingTierId=null;
 }else{
  if(!tier||!r||state.screen!=='game')conflict();
  const mission=missionAt(tier,r);
  if(action==='next'){
   if(!r.solved)conflict();
   if(r.review&&r.index<tier.missionIds.length-1){r.index++;Object.assign(r,draft());}
   else if(r.summary&&(r.review||tier.id===TIERS.at(-1).id))state.screen='results';
   else state.screen='journey';
  }else{
   if(r.solved)conflict();
   if(action==='quantity'){
    if(!mission.productIds.slice(0,mission.difficulty.visibleProductCount).includes(input.productId)||![1,-1].includes(input.delta))fail(422,'market_product','Choisis un produit et une quantité proposés.');
    const amount=Math.min(mission.difficulty.maxSelectableQuantity,Math.max(0,(r.basket[input.productId]||0)+input.delta));
    if(amount)r.basket[input.productId]=amount;else delete r.basket[input.productId];r.feedback=null;
   }else if(action==='formula'){
    if(!mission.formulas.some(f=>f.id===input.formulaId))fail(422,'market_formula','Choisis une formule proposée.');
    r.selectedFormulaId=input.formulaId;r.feedback=null;
   }else if(action==='help'){r.helpUsed=true;r.feedback={kind:'info',tag:'Indice',text:mission.help};}
   else if(action==='validate'){
    const evaluated=evaluateMarketMission(mission,r.basket,r.selectedFormulaId);
    if(!evaluated.correct){
     r.failureCount=Math.min(1000000,r.failureCount+1);
     const degree=r.helpUsed?Math.max(3,r.failureCount):r.failureCount;
     r.feedback={kind:'error',tag:degree>=3?'Correction guidée':`Essai ${r.failureCount}`,text:getMarketMissionFeedback(mission,evaluated,degree)};
    }else{
     const helpUsed=r.helpUsed||r.failureCount>=3;
     awards=buildMarketRewardClaims({studentId:c.user.id,mission,correct:true,helpUsed}).filter(a=>!claims.some(p=>p.mission_id===mission.id&&p.mission_version===mission.version&&p.reward_type===a.type));
     r.solved=true;r.missionXp=awards.reduce((n,a)=>n+a.amount,0);
     const result={missionId:mission.id,correct:true,helpUsed,helpRequested:r.helpUsed,validationAttempts:r.failureCount+1,basket:{...r.basket},formulaId:r.selectedFormulaId,awardedClaimTypes:awards.map(a=>a.type),failureCount:r.failureCount,xpEarned:r.missionXp,rewardStatus:r.missionXp?'awarded':'revision',completedAt:now()};
     r.results=r.results.filter(x=>x.missionId!==mission.id).concat(result);
     const rewardMessage=r.missionXp===15?'+15 XP : maîtrise +10 et autonomie +5.':r.missionXp===10?'+10 XP de maîtrise. Tu as réussi avec un coup de pouce ; tu pourras viser les +5 XP d’autonomie lors d’un prochain essai.':r.missionXp===5?'+5 XP d’autonomie : tu as progressé sans aide.':'+0 XP : révision réussie, ces récompenses étaient déjà acquises.';
     r.feedback={kind:'success',tag:r.missionXp?'Mission réussie':'Révision réussie',text:`${mission.success} ${rewardMessage}`};
     const nextCompleted=[...new Set([...completed,mission.id])];
     if(tier.missionIds.every(id=>nextCompleted.includes(id))&&r.index===tier.missionIds.length-1){
      r.summary={...buildMarketTierSummary(tier,MISSIONS,r.results,nextCompleted,r.runId),completedAt:now(),...(r.review?{runMode:'revision'}:{})};
      if(!r.firstCompletion){r.firstCompletion=r.summary;state.celebratingTierId=tier.id;}
     }
    }
   }else fail(404,'not_found','Action introuvable.');
  }
 }
 const g=guard(c),revision=input.revision+1,stamp=now();
 const save=db.prepare(`INSERT INTO pilot_game_progress(school_id,student_id,game_id,grid_id,progress_json,hint_count,revision,last_request_id,last_request_hash,updated_at)
 SELECT ?,?,?,?,?,0,?,?,?,? WHERE ${g.sql} AND (?=0 OR EXISTS(SELECT 1 FROM pilot_game_progress p WHERE p.school_id=? AND p.student_id=? AND p.game_id=? AND p.grid_id=? AND p.revision=?))
 ON CONFLICT(school_id,student_id,game_id,grid_id) DO UPDATE SET progress_json=excluded.progress_json,revision=excluded.revision,last_request_id=excluded.last_request_id,last_request_hash=excluded.last_request_hash,updated_at=excluded.updated_at
 WHERE pilot_game_progress.revision=? AND pilot_game_progress.last_request_id<>?`).bind(c.schoolId,c.user.id,GAME,GRID,JSON.stringify(state),revision,requestId,requestHash,stamp,...g.values,input.revision,c.schoolId,c.user.id,GAME,GRID,input.revision,input.revision,requestId);
 const statements=[save,...awards.map(a=>db.prepare(`INSERT INTO pilot_market_awards(school_id,student_id,game_id,grid_id,mission_id,mission_version,reward_type,xp,awarded_at)
 SELECT ?,?,?,?,?,?,?,?,? WHERE ${g.sql} AND EXISTS(SELECT 1 FROM pilot_game_progress p WHERE p.school_id=? AND p.student_id=? AND p.game_id=? AND p.grid_id=? AND p.revision=? AND p.last_request_id=? AND p.last_request_hash=?) ON CONFLICT DO NOTHING`)
 .bind(c.schoolId,c.user.id,GAME,GRID,a.missionId,Number(a.missionVersion),a.type,a.amount,stamp,...g.values,c.schoolId,c.user.id,GAME,GRID,revision,requestId,requestHash))];
 await db.batch(statements);await access(db,c);
 const saved=await owned(db,c);if(saved?.last_request_id!==requestId||saved.last_request_hash!==requestHash)conflict();
 return response(db,c,{replayed:false});
}
export async function handleMarket(request,env,c,path=new URL(request.url).pathname){
 if(!c?.user?.id||!c.schoolId||c.session?.user_id!==c.user.id||!c.session?.token_hash)fail(401,'session_required','Reconnecte-toi pour jouer.');
 if(c.role!=='eleve')fail(403,'student_required','Ce jeu est réservé à l’élève.');
 if(!env.DB)fail(503,'database_unavailable','Le serveur de jeux est indisponible.');
 if(request.method!=='GET')checkCsrf(request,c.session);
 await access(env.DB,c);
 if(request.method==='GET'&&path===ROOT)return response(env.DB,c);
 const match=path.match(/^\/api\/pilot\/games\/souk-des-mots\/(open|quantity|formula|help|validate|next|journey|replay)$/);
 if(request.method==='POST'&&match)return mutate(request,env.DB,c,match[1]);
 return reply({error:{code:'not_found',message:'Action introuvable.'}},404);
}
