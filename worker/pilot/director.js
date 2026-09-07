import { first, fail, reply, LIVE_SESSION_SQL, liveValues } from './session.js';

const ROOT='/api/pilot/director';
function guard(c){return {sql:`EXISTS(SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id WHERE m.user_id=? AND m.school_id=? AND m.role='directeur' AND m.active=1 AND s.active=1)
 AND NOT EXISTS(SELECT 1 FROM pilot_admins a WHERE a.user_id=? AND a.active=1) AND ${LIVE_SESSION_SQL}`,values:[c.user_id,c.school_id,c.user_id,...liveValues(c)]};}
function scope(c){return {sql:`WITH p AS(SELECT ? school_id),
 members AS(SELECT u.id,u.display_name name,m.role FROM pilot_memberships m JOIN pilot_users u ON u.id=m.user_id,p
 WHERE m.school_id=p.school_id AND m.active=1 AND u.active=1 AND m.role IN('eleve','enseignant') AND NOT EXISTS(SELECT 1 FROM pilot_admins a WHERE a.user_id=u.id AND a.active=1)),
 classes AS(SELECT cl.id,cl.name FROM pilot_classes cl,p WHERE cl.school_id=p.school_id AND cl.active=1),
 links AS(SELECT cm.class_id classId,cm.user_id userId FROM pilot_class_members cm JOIN classes cl ON cl.id=cm.class_id JOIN members m ON m.id=cm.user_id,p WHERE cm.school_id=p.school_id)
 `,values:[c.school_id]};}
const scopeSelect=`SELECT (SELECT count(*) FROM members WHERE role='eleve') pupil_count,(SELECT count(*) FROM members WHERE role='enseignant') staff_count,
 (SELECT count(*) FROM classes) class_count,(SELECT count(*) FROM links) link_count,
 (SELECT json_group_array(json_object('id',id,'name',name,'role',role)) FROM (SELECT * FROM members ORDER BY id LIMIT 1201)) members_json,
 (SELECT json_group_array(json_object('id',id,'name',name)) FROM (SELECT * FROM classes ORDER BY id LIMIT 201)) classes_json,
 (SELECT json_group_array(json_object('classId',classId,'userId',userId)) FROM (SELECT * FROM links ORDER BY classId,userId LIMIT 5001)) links_json`;
const iso=value=>value?new Date(value*1000).toISOString():null;

// Read-only school oversight: never calls the platform-admin endpoint or grants management powers.
export async function handleDirector(request,env,c,local=false){
 if(!c?.token_hash||!c.user_id)fail(401,'session_required','Connectez-vous à votre espace Direction.');
 if(c.role!=='directeur')fail(403,'director_required','Ce suivi est réservé à la direction de l’établissement.');
 const url=new URL(request.url);
 if(url.pathname!==ROOT)fail(404,'not_found','Cette page de suivi n’existe pas.');
 if(request.method!=='GET')return reply({error:{code:'read_only',message:'Les comptes et rattachements sont gérés par Jet d’Encre.'}},405,{Allow:'GET'});
 if(url.search)fail(422,'invalid_filter','Le périmètre vient du compte connecté, pas de l’adresse.');
 const db=env.DB,g=guard(c),s=scope(c);
 if(!await first(db,'SELECT 1 ok WHERE '+g.sql,...g.values))fail(403,'director_access_changed','Votre accès Direction a changé.');
 const stamp=Math.floor(Date.now()/1000);
 const data=await first(db,s.sql+`,
 awards AS(
 SELECT a.student_id,a.xp,a.completed_at awarded_at FROM pilot_game_awards a,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,a.xp,a.awarded_at FROM pilot_quiz_awards a,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,a.xp,a.awarded_at FROM pilot_market_awards a,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,a.xp,a.awarded_at FROM pilot_class_awards a,p WHERE a.school_id=p.school_id),
 traces AS(
 SELECT a.student_id,a.awarded_at at FROM awards a
 UNION ALL SELECT a.student_id,a.updated_at FROM pilot_game_progress a,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,a.created_at FROM pilot_quiz_attempts a,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,coalesce(a.completed_at,0) FROM pilot_quiz_attempts a,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,json_extract(j.value,'$.answeredAt') FROM pilot_quiz_attempts a,json_each(a.state_json,'$.answers') j,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,a.created_at FROM pilot_class_attempts a,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,json_extract(j.value,'$.answeredAt') FROM pilot_class_attempts a,json_each(a.state_json,'$.answers') j,p WHERE a.school_id=p.school_id
 UNION ALL SELECT a.student_id,a.submitted_at FROM pilot_submissions a,p WHERE a.school_id=p.school_id),
 pupils AS(SELECT m.*,
 (SELECT coalesce(sum(xp),0) FROM awards a WHERE a.student_id=m.id AND a.awarded_at<=?) xp,
 (SELECT max(at) FROM traces t WHERE t.student_id=m.id AND t.at<=?) last_at,
 (SELECT count(DISTINCT code.manual_id) FROM pilot_manual_codes code JOIN pilot_manuals manual ON manual.id=code.manual_id,p WHERE code.school_id=p.school_id AND code.student_id=m.id AND code.revoked_at IS NULL AND manual.active=1 AND code.activated_at<=?) manuals
 FROM members m WHERE m.role='eleve'),
 staff AS(SELECT m.*,(SELECT count(*) FROM pilot_assignments a,p WHERE a.school_id=p.school_id AND a.teacher_id=m.id AND a.created_at<=?) assignments,
 (SELECT count(*) FROM pilot_reviews r,p WHERE r.school_id=p.school_id AND r.teacher_id=m.id AND r.reviewed_at<=?) reviews FROM members m WHERE role='enseignant')
 `+scopeSelect+`,
 (SELECT name FROM pilot_schools,p WHERE id=p.school_id) school_name,
 (SELECT json_group_array(json_object('id',id,'name',name,'xp',xp,'lastAt',last_at,'manuals',manuals)) FROM (SELECT * FROM pupils ORDER BY id LIMIT 1001)) pupils_json,
 (SELECT json_group_array(json_object('id',id,'name',name,'assignments',assignments,'reviews',reviews)) FROM (SELECT * FROM staff ORDER BY id LIMIT 201)) staff_json`,...s.values,stamp,stamp,stamp,stamp,stamp);
 if(data.pupil_count>1000||data.staff_count>200||data.class_count>200||data.link_count>5000)fail(503,'school_too_large','L’établissement dépasse la capacité de cette version. Aucun bilan partiel n’est affiché.');
 const final=await first(db,s.sql+scopeSelect,...s.values),finalGuard=guard(c);
 if(['members_json','classes_json','links_json'].some(key=>data[key]!==final[key])||!await first(db,'SELECT 1 ok WHERE '+finalGuard.sql,...finalGuard.values))fail(403,'director_access_changed','Les accès à l’établissement ont changé. Actualisez le suivi.');
 const links=JSON.parse(data.links_json),classes=JSON.parse(data.classes_json);
 const classIds=id=>links.filter(l=>l.userId===id).map(l=>l.classId);
 return reply({userId:c.user_id,schoolId:c.school_id,role:'directeur',schoolName:data.school_name,generatedAt:iso(stamp),source:local?'pilot_local_fixture':'pilot_database',
 classes,students:JSON.parse(data.pupils_json).map(p=>({id:p.id,name:p.name,xp:p.xp,manuals:p.manuals,lastActiveAt:iso(p.lastAt),classIds:classIds(p.id)})),
 teachers:JSON.parse(data.staff_json).map(t=>({...t,classIds:classIds(t.id)})),
 definitions:{scope:'Comptes élèves et enseignants actifs de cet établissement, classes actives. Un élève est compté une seule fois au total, même s’il appartient à plusieurs classes.',
 activation:'Élève disposant d’au moins un manuel activé, non révoqué, dont le titre est encore actif. Ce n’est ni une première connexion, ni une preuve de lecture.',
 activity:'Dernière trace enregistrée : ouverture ou réponse de jeu, brouillon sauvegardé, récompense ou remise écrite. Les 7 et 30 jours sont des fenêtres glissantes. Une connexion seule ne compte pas.',
 xp:'Total cumulé des récompenses des sept jeux raccordés, dans cette école. Une relecture sans nouvelle récompense n’ajoute pas de points.',
 teachers:'Devoirs publiés et corrections enregistrées par les enseignants actuellement actifs, cumulés dans cette école. Aucune durée ni fréquence de connexion n’est mesurée.',
 limits:'Temps de lecture, santé du service, activation utile à J+7 et progression comparable en français : non mesurés. Les priorités sont des repères à vérifier, pas des diagnostics.'}});
}
