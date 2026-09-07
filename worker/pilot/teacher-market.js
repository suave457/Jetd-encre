import {MARKET_MISSIONS,MARKET_TIERS} from './market-content-v1.js';
import {first,fail,reply,LIVE_SESSION_SQL,liveValues} from './session.js';

const ROOT='/api/pilot/teacher/market',MAX_STUDENTS=1000,VERSION='market-2026-09-v1';
const tiers=MARKET_TIERS.map(t=>({id:t.id,label:t.label,cardTitle:t.cardTitle,missionIds:t.missionIds,theme:t.theme}));
function guard(c){return {sql:`EXISTS(SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id WHERE m.school_id=? AND m.user_id=? AND m.role='enseignant' AND m.active=1 AND s.active=1)
 AND NOT EXISTS(SELECT 1 FROM pilot_admins a WHERE a.user_id=? AND a.active=1) AND ${LIVE_SESSION_SQL}`,values:[c.schoolId,c.user.id,c.user.id,...liveValues(c.session)]};}
// One snapshot defines both classes and unique pupils. Sharing two authorized classes never duplicates a pupil.
function scope(c){const g=guard(c);return {sql:`WITH classes AS(SELECT cl.id,cl.name label FROM pilot_classes cl JOIN pilot_class_members cm ON cm.class_id=cl.id AND cm.school_id=cl.school_id
 WHERE cl.school_id=? AND cm.user_id=? AND cl.active=1 AND ${g.sql}),
 pupils AS(SELECT u.id,u.display_name name FROM pilot_users u JOIN pilot_memberships m ON m.user_id=u.id
 WHERE m.school_id=? AND m.role='eleve' AND m.active=1 AND u.active=1 AND NOT EXISTS(SELECT 1 FROM pilot_admins a WHERE a.user_id=u.id AND a.active=1)
 AND EXISTS(SELECT 1 FROM pilot_class_members cm JOIN classes cl ON cl.id=cm.class_id WHERE cm.school_id=m.school_id AND cm.user_id=u.id)),
 roster AS(SELECT p.*,(SELECT json_group_array(json_object('id',id,'label',label)) FROM (SELECT cl.* FROM classes cl JOIN pilot_class_members cm ON cm.class_id=cl.id
 WHERE cm.school_id=? AND cm.user_id=p.id ORDER BY cl.id)) classes_json FROM pupils p)
 `,values:[c.schoolId,c.user.id,...g.values,c.schoolId,c.schoolId]};}
const scopeSelect=`SELECT (SELECT json_group_array(json_object('id',id,'label',label)) FROM (SELECT * FROM classes ORDER BY id)) classes_json,
 (SELECT json_group_array(json_object('id',id,'name',name,'classes',json(classes_json))) FROM (SELECT * FROM roster ORDER BY id)) roster_json`;
function profile(row,stamp){
 const classes=JSON.parse(row.classes_json),awards=JSON.parse(row.awards_json),state=row.state_json?JSON.parse(row.state_json):null;
 if(state&&state.contentVersion!==VERSION)fail(503,'market_version_unavailable','Une progression utilise une version non prise en charge. Aucun bilan partiel n’est affiché.');
 const valid=awards.filter(a=>MARKET_MISSIONS.some(m=>m.id===a.missionId&&m.version===a.version));
 if(valid.length!==awards.length)fail(503,'market_version_unavailable','Une récompense utilise une version non prise en charge.');
 const mastered=new Set(valid.filter(a=>a.type==='mastery').map(a=>a.missionId)),autonomous=new Set(valid.filter(a=>a.type==='autonomy').map(a=>a.missionId));
 if([...autonomous].some(id=>!mastered.has(id)))fail(503,'market_inconsistent','Les récompenses nécessitent une vérification avant affichage.');
 const count=mastered.size,autonomyCount=autonomous.size,documented=new Map();
 for(const t of tiers){const r=state?.runs?.[t.id];for(const result of (r?.firstCompletion?.results??r?.results??[]))if(mastered.has(result.missionId)&&typeof result.helpUsed==='boolean')documented.set(result.missionId,result.helpUsed);}
 const helpCount=documented.size===count?[...documented.values()].filter(Boolean).length:null;
 const lastSeconds=Math.max(row.updated_at??0,...valid.map(a=>a.at)),lastActiveAt=lastSeconds?new Date(lastSeconds*1000).toISOString():null;
 const started=Boolean(lastActiveAt),days=lastActiveAt?Math.max(0,Math.floor((stamp-lastSeconds*1000)/86400000)):null;
 const details=tiers.map(t=>{const completedMissionIds=t.missionIds.filter(id=>mastered.has(id)),autonomousMissionIds=t.missionIds.filter(id=>autonomous.has(id));
  return {...t,completedMissionIds,autonomousMissionIds,completedCount:completedMissionIds.length,autonomyCount:autonomousMissionIds.length,missionCount:t.missionIds.length,
   started:completedMissionIds.length>0||Boolean(state?.runs?.[t.id]?.runId)};});
 const current=details.find(t=>t.completedCount<t.missionCount)??details.at(-1);
 let status='on-track',statusLabel='En cours',supportReason='Le parcours a commencé.',recommendation='Inviter l’élève à reformuler une commande, puis poursuivre le palier en cours.';
 if(!started){status='not-started';statusLabel='À démarrer';supportReason='Aucune activité du Souk enregistrée.';recommendation='Vérifier l’accès au jeu et lancer la première mission en binôme, en faisant verbaliser la commande.';}
 else if(count===12){status='completed';statusLabel='Parcours terminé';supportReason='Les douze missions ont été réussies.';recommendation='Proposer un échange vendeur-client en classe et observer la reformulation et la politesse.';}
 else if(days>=7||(count>=2&&helpCount!==null&&helpCount/count>=0.5)){status='support';statusLabel='À accompagner';supportReason=days>=7?'Parcours inachevé sans activité depuis au moins sept jours.':`${helpCount} premières réussites guidées sur ${count} missions réussies.`;recommendation='Échanger avec l’élève, vérifier ses conditions d’accès et reprendre une commande avec des cartes-produits avant un nouvel essai.';}
 return {id:row.id,name:row.name,classIds:classes.map(c=>c.id),classLabel:classes.map(c=>c.label).join(' · '),started,lastActiveAt,daysSinceActivity:days,
  completedCount:count,totalMissions:12,progressPercent:Math.round(count/12*100),autonomyCount,autonomyPercent:count?Math.round(autonomyCount/count*100):null,
  helpCount,partialData:helpCount===null,soukXp:valid.reduce((n,a)=>n+a.xp,0),currentTierId:count===12?'completed':current.id,currentTierLabel:count===12?'Parcours terminé':current.label,
  tiers:details,status,statusLabel,supportReason,recommendation,connected:true};
}
export async function handleTeacherMarket(request,env,c,local=false){
 if(!c?.user?.id||c.session?.user_id!==c.user.id||!c.session?.token_hash)fail(401,'session_required','Connectez-vous pour consulter le suivi.');
 if(c.role!=='enseignant')fail(403,'teacher_required','Ce suivi est réservé à l’enseignant de la classe.');
 if(new URL(request.url).pathname!==ROOT)fail(404,'not_found','Suivi introuvable.');
 if(request.method!=='GET')return reply({error:{code:'method_not_allowed',message:'Ce suivi est en lecture seule.'}},405,{Allow:'GET'});
 if(new URL(request.url).search)fail(422,'invalid_filter','Les filtres s’appliquent à la vue autorisée.');
 const db=env.DB,g=guard(c),s=scope(c);if(!await first(db,'SELECT 1 ok WHERE '+g.sql,...g.values))fail(403,'teacher_access_changed','Votre accès a changé. Reconnectez-vous.');
 const stamp=Date.now(),snapshot=await first(db,s.sql+scopeSelect+`,(SELECT count(*) FROM roster) total,
 (SELECT json_group_array(json_object('id',id,'name',name,'classes_json',classes_json,'state_json',state_json,'updated_at',updated_at,'awards_json',awards_json)) FROM (
 SELECT r.*,(SELECT p.progress_json FROM pilot_game_progress p WHERE p.school_id=? AND p.student_id=r.id AND p.game_id='souk-des-mots' AND p.grid_id='v1') state_json,
 (SELECT p.updated_at FROM pilot_game_progress p WHERE p.school_id=? AND p.student_id=r.id AND p.game_id='souk-des-mots' AND p.grid_id='v1') updated_at,
 (SELECT json_group_array(json_object('missionId',a.mission_id,'version',a.mission_version,'type',a.reward_type,'xp',a.xp,'at',a.awarded_at)) FROM pilot_market_awards a WHERE a.school_id=? AND a.student_id=r.id AND a.game_id='souk-des-mots' AND a.grid_id='v1') awards_json
 FROM roster r ORDER BY r.id LIMIT ?)) data_json`,...s.values,c.schoolId,c.schoolId,c.schoolId,MAX_STUDENTS+1);
 if(snapshot.total>MAX_STUDENTS)fail(503,'roster_too_large','Le suivi dépasse la capacité de cette version. Aucun effectif partiel n’est présenté.');
 const students=JSON.parse(snapshot.data_json).map(r=>profile(r,stamp));
 const finalScope=await first(db,s.sql+scopeSelect,...s.values);
 if(snapshot.classes_json!==finalScope.classes_json||snapshot.roster_json!==finalScope.roster_json||!await first(db,'SELECT 1 ok WHERE '+g.sql,...g.values))fail(403,'teacher_access_changed','Les accès aux classes ont changé. Rechargez le suivi.');
 return reply({userId:c.user.id,schoolId:c.schoolId,role:'enseignant',source:local?'pilot_local_fixture':'pilot_database',generatedAt:new Date(stamp).toISOString(),
  classes:JSON.parse(snapshot.classes_json),tiers,students,definitions:{scope:'Élèves actifs des classes actuellement rattachées à cet enseignant, une seule fois par élève. Résultats cumulés du Souk dans cette école.',
   filters:'Tous les indicateurs et l’export portent sur les profils filtrés. Activité récente filtre la dernière action enregistrée ; les résultats affichés restent cumulés.',
   help:'Premières réussites guidées documentées : indice demandé ou correction après au moins trois essais incorrects. Ce n’est pas un nombre de clics. Une révision autonome ne réécrit pas la première réussite.',
   support:'Repère à confirmer : parcours inachevé sans action depuis sept jours, ou au moins deux missions réussies dont la moitié avec guidage documenté. Un parcours terminé n’est pas signalé pour inactivité.',
   limits:'Ni durée d’écoute, ni maîtrise générale du français ne sont mesurées. Les propositions sont des règles fixes, pas une analyse par IA.'}});
}
