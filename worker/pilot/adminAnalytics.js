import { fail, first, LIVE_SESSION_SQL, liveValues, now, reply } from './session.js';

const DAY = 86400;
function isoDay(timestamp) { return new Date(timestamp * 1000).toISOString().slice(0, 10); }
function readDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'analytics_dates', 'Choisissez des dates valides au format année-mois-jour.');
  const stamp = Date.parse(value + 'T00:00:00Z') / 1000;
  if (!Number.isFinite(stamp) || isoDay(stamp) !== value) fail(400, 'analytics_dates', 'Cette date n’existe pas.');
  return stamp;
}

export function parseAnalyticsFilters(params, generatedAt = now()) {
  for (const key of params.keys()) if (!['from', 'to', 'schoolId'].includes(key) || params.getAll(key).length !== 1) fail(400, 'analytics_filters', 'Les filtres d’analyse sont invalides.');
  if (params.has('from') !== params.has('to')) fail(400, 'analytics_dates', 'Indiquez les deux bornes de la période.');
  const today = isoDay(generatedAt);
  const to = params.get('to') ?? today;
  const from = params.get('from') ?? isoDay(readDay(today) - 27 * DAY);
  const start = readDay(from), finish = readDay(to);
  if (finish < start || finish - start >= 366 * DAY || to > today) fail(400, 'analytics_dates', 'La période doit couvrir de 1 à 366 jours, sans date future.');
  const schoolId = params.get('schoolId') ?? '';
  if (schoolId.length > 120 || /[\u0000-\u001f\u007f]/.test(schoolId)) fail(400, 'analytics_school', 'Le périmètre scolaire est invalide.');
  return { from, to, schoolId, timezone: 'UTC', start, endExclusive: Math.min(finish + DAY, generatedAt + 1), generatedAt };
}

// One SELECT = one coherent database snapshot. No identity, answer, code secret,
// session token, score or student-level record is returned. All filters are bound.
const ANALYTICS_SQL = `WITH
p(start, finish, school, stamp) AS (VALUES (?, ?, ?, ?)),
schools AS (SELECT s.* FROM pilot_schools s, p WHERE p.school='' OR s.id=p.school),
eligible AS (
 SELECT m.school_id, m.user_id FROM pilot_memberships m JOIN schools s ON s.id=m.school_id
 JOIN pilot_users u ON u.id=m.user_id WHERE s.active=1 AND m.active=1 AND u.active=1 AND m.role='eleve'
 AND NOT EXISTS (SELECT 1 FROM pilot_admins admin WHERE admin.user_id=m.user_id AND admin.active=1)
),
quiz_attempts AS (
 SELECT q.* FROM pilot_quiz_attempts q JOIN schools s ON s.id=q.school_id,p
 WHERE q.game_id IN ('culture-generale','defi-du-jour','mot-juste') AND q.created_at<=p.stamp
),
quiz_answers AS (
 SELECT q.school_id,q.student_id,q.game_id,
 CASE WHEN json_type(CASE WHEN a.type='object' THEN a.value ELSE '{}' END,'$.answeredAt')='integer'
 THEN json_extract(a.value,'$.answeredAt') ELSE NULL END answeredAt
 FROM quiz_attempts q,json_each(CASE WHEN json_type(q.state_json,'$.answers')='array' THEN json_extract(q.state_json,'$.answers') ELSE '[]' END) a
 WHERE a.type='object'
),
class_attempts AS (SELECT a.* FROM pilot_class_attempts a JOIN schools s ON s.id=a.school_id,p WHERE a.created_at<=p.stamp),
class_answers AS (SELECT a.school_id,a.student_id,CASE WHEN json_type(ans.value,'$.answeredAt')='integer' THEN json_extract(ans.value,'$.answeredAt') ELSE NULL END answeredAt
 FROM class_attempts a,json_each(a.state_json,'$.answers') ans),
activities AS (
 SELECT ca.school_id,ca.student_id FROM class_answers ca,p WHERE ca.answeredAt>=p.start AND ca.answeredAt<p.finish
 UNION
 SELECT ma.school_id,ma.student_id FROM pilot_market_awards ma JOIN schools s ON s.id=ma.school_id,p WHERE ma.awarded_at>=p.start AND ma.awarded_at<p.finish
 UNION
 SELECT sub.school_id,sub.student_id FROM pilot_submissions sub JOIN schools s ON s.id=sub.school_id,p WHERE sub.submitted_at>=p.start AND sub.submitted_at<p.finish
 UNION
 SELECT g.school_id,g.student_id FROM pilot_game_awards g JOIN schools s ON s.id=g.school_id,p WHERE g.game_id IN ('mots-fleches','mission-zellige') AND g.completed_at>=p.start AND g.completed_at<p.finish
 UNION
 SELECT q.school_id,q.student_id FROM quiz_answers q,p WHERE q.answeredAt>=p.start AND q.answeredAt<p.finish
 UNION
 SELECT q.school_id,q.student_id FROM quiz_attempts q,p WHERE q.completed_at>=p.start AND q.completed_at<p.finish
),
students AS (
 SELECT e.school_id,count(*) eligibleStudents,count(a.student_id) participatingStudents
 FROM eligible e LEFT JOIN activities a ON a.school_id=e.school_id AND a.student_id=e.user_id GROUP BY e.school_id
),
teachers AS (
 SELECT m.school_id,count(*) teachers FROM pilot_memberships m JOIN schools s ON s.id=m.school_id JOIN pilot_users u ON u.id=m.user_id
 WHERE s.active=1 AND m.active=1 AND u.active=1 AND m.role='enseignant'
 AND NOT EXISTS (SELECT 1 FROM pilot_admins admin WHERE admin.user_id=m.user_id AND admin.active=1) GROUP BY m.school_id
),
classes AS (SELECT c.school_id,count(*) classes FROM pilot_classes c JOIN schools s ON s.id=c.school_id WHERE c.active=1 AND s.active=1 GROUP BY c.school_id),
assignments AS (SELECT a.school_id,count(*) assignments FROM pilot_assignments a JOIN schools s ON s.id=a.school_id,p WHERE a.created_at>=p.start AND a.created_at<p.finish GROUP BY a.school_id),
submissions AS (
 SELECT sub.school_id,count(*) submissions,count(r.submission_id) reviewedSubmissions
 FROM pilot_submissions sub JOIN schools s ON s.id=sub.school_id CROSS JOIN p
 LEFT JOIN pilot_reviews r ON r.submission_id=sub.id AND r.school_id=sub.school_id AND r.reviewed_at<=p.stamp
 WHERE sub.submitted_at>=p.start AND sub.submitted_at<p.finish GROUP BY sub.school_id
),
games AS (SELECT g.school_id,count(*) gameCompletions,sum(g.xp) xp FROM pilot_game_awards g JOIN schools s ON s.id=g.school_id,p WHERE g.game_id='mots-fleches' AND g.completed_at>=p.start AND g.completed_at<p.finish GROUP BY g.school_id),
zellige AS (SELECT g.school_id,count(*) zelligeCompletions,sum(g.xp) zelligeXp FROM pilot_game_awards g JOIN schools s ON s.id=g.school_id,p WHERE g.game_id='mission-zellige' AND g.completed_at>=p.start AND g.completed_at<p.finish GROUP BY g.school_id),
market AS (SELECT ma.school_id,sum(CASE WHEN ma.reward_type='mastery' THEN 1 ELSE 0 END) marketCompletions,sum(CASE WHEN ma.reward_type='autonomy' THEN 1 ELSE 0 END) marketAutonomyBonuses,sum(ma.xp) marketXp FROM pilot_market_awards ma JOIN schools s ON s.id=ma.school_id,p WHERE ma.awarded_at>=p.start AND ma.awarded_at<p.finish GROUP BY ma.school_id),
class_created AS (SELECT c.school_id,count(*) classChallengesCreated FROM pilot_class_challenges c JOIN schools s ON s.id=c.school_id,p WHERE c.created_at>=p.start AND c.created_at<p.finish GROUP BY c.school_id),
class_answer_counts AS (SELECT a.school_id,count(*) classAnswers FROM class_answers a,p WHERE a.answeredAt>=p.start AND a.answeredAt<p.finish GROUP BY a.school_id),
class_completions AS (SELECT a.school_id,count(*) classCompletions FROM class_attempts a,p WHERE a.completed_at>=p.start AND a.completed_at<p.finish GROUP BY a.school_id),
class_rewards AS (SELECT a.school_id,sum(a.xp) classXp FROM pilot_class_awards a JOIN schools s ON s.id=a.school_id,p WHERE a.awarded_at>=p.start AND a.awarded_at<p.finish GROUP BY a.school_id),
quiz_answer_counts AS (
 SELECT q.school_id,
 sum(CASE WHEN q.game_id='culture-generale' AND q.answeredAt>=p.start AND q.answeredAt<p.finish THEN 1 ELSE 0 END) cultureAnswers,
 sum(CASE WHEN q.game_id='defi-du-jour' AND q.answeredAt>=p.start AND q.answeredAt<p.finish THEN 1 ELSE 0 END) dailyAnswers,
 sum(CASE WHEN q.game_id='mot-juste' AND q.answeredAt>=p.start AND q.answeredAt<p.finish THEN 1 ELSE 0 END) wordChoiceAnswers,
 sum(CASE WHEN q.answeredAt IS NULL THEN 1 ELSE 0 END) undatedQuizAnswers
 FROM quiz_answers q,p GROUP BY q.school_id
),
quiz_completion_counts AS (
 SELECT q.school_id,
 sum(CASE WHEN q.game_id='culture-generale' THEN 1 ELSE 0 END) cultureCompletions,
 sum(CASE WHEN q.game_id='defi-du-jour' THEN 1 ELSE 0 END) dailyCompletions,
 sum(CASE WHEN q.game_id='mot-juste' THEN 1 ELSE 0 END) wordChoiceCompletions
 FROM quiz_attempts q,p WHERE q.completed_at>=p.start AND q.completed_at<p.finish GROUP BY q.school_id
),
quiz_rewards AS (
 SELECT g.school_id,
 sum(CASE WHEN g.game_id='culture-generale' THEN g.xp ELSE 0 END) cultureXp,
 sum(CASE WHEN g.game_id='defi-du-jour' THEN g.xp ELSE 0 END) dailyXp,
 sum(CASE WHEN g.game_id='mot-juste' THEN g.xp ELSE 0 END) wordChoiceXp
 FROM pilot_quiz_awards g JOIN schools s ON s.id=g.school_id,p
 WHERE g.game_id IN ('culture-generale','defi-du-jour','mot-juste') AND g.awarded_at>=p.start AND g.awarded_at<p.finish GROUP BY g.school_id
),
codes AS (
 SELECT c.school_id,count(*) codesIssued,sum(CASE WHEN c.activated_at<=p.stamp THEN 1 ELSE 0 END) issuedCodesActivated
 FROM pilot_manual_codes c JOIN schools s ON s.id=c.school_id,p WHERE c.created_at>=p.start AND c.created_at<p.finish GROUP BY c.school_id
),
activations AS (SELECT c.school_id,count(*) activations FROM pilot_manual_codes c JOIN schools s ON s.id=c.school_id,p WHERE c.activated_at>=p.start AND c.activated_at<p.finish GROUP BY c.school_id),
rows AS (
 SELECT s.id,s.name,s.active,coalesce(st.eligibleStudents,0) eligibleStudents,coalesce(st.participatingStudents,0) participatingStudents,
 coalesce(t.teachers,0) teachers,coalesce(cl.classes,0) classes,coalesce(a.assignments,0) assignments,
 coalesce(sub.submissions,0) submissions,coalesce(sub.reviewedSubmissions,0) reviewedSubmissions,
 coalesce(g.gameCompletions,0) gameCompletions,coalesce(g.xp,0) crosswordXp,coalesce(z.zelligeCompletions,0) zelligeCompletions,coalesce(z.zelligeXp,0) zelligeXp,
 coalesce(mk.marketCompletions,0) marketCompletions,coalesce(mk.marketAutonomyBonuses,0) marketAutonomyBonuses,coalesce(mk.marketXp,0) marketXp,
 coalesce(crd.classChallengesCreated,0) classChallengesCreated,coalesce(can.classAnswers,0) classAnswers,coalesce(ccm.classCompletions,0) classCompletions,coalesce(crw.classXp,0) classXp,
 coalesce(qa.cultureAnswers,0) cultureAnswers,coalesce(qa.dailyAnswers,0) dailyAnswers,coalesce(qa.wordChoiceAnswers,0) wordChoiceAnswers,coalesce(qa.undatedQuizAnswers,0) undatedQuizAnswers,
 coalesce(qc.cultureCompletions,0) cultureCompletions,coalesce(qc.dailyCompletions,0) dailyCompletions,coalesce(qc.wordChoiceCompletions,0) wordChoiceCompletions,
 coalesce(qr.cultureXp,0) cultureXp,coalesce(qr.dailyXp,0) dailyXp,coalesce(qr.wordChoiceXp,0) wordChoiceXp,
 coalesce(g.xp,0)+coalesce(z.zelligeXp,0)+coalesce(mk.marketXp,0)+coalesce(qr.cultureXp,0)+coalesce(qr.dailyXp,0)+coalesce(qr.wordChoiceXp,0)+coalesce(crw.classXp,0) xp,coalesce(c.codesIssued,0) codesIssued,
 coalesce(c.issuedCodesActivated,0) issuedCodesActivated,coalesce(ac.activations,0) activations
 FROM schools s LEFT JOIN students st ON st.school_id=s.id LEFT JOIN teachers t ON t.school_id=s.id LEFT JOIN classes cl ON cl.school_id=s.id
 LEFT JOIN assignments a ON a.school_id=s.id LEFT JOIN submissions sub ON sub.school_id=s.id LEFT JOIN games g ON g.school_id=s.id LEFT JOIN zellige z ON z.school_id=s.id
 LEFT JOIN market mk ON mk.school_id=s.id
 LEFT JOIN class_created crd ON crd.school_id=s.id LEFT JOIN class_answer_counts can ON can.school_id=s.id LEFT JOIN class_completions ccm ON ccm.school_id=s.id LEFT JOIN class_rewards crw ON crw.school_id=s.id
 LEFT JOIN quiz_answer_counts qa ON qa.school_id=s.id LEFT JOIN quiz_completion_counts qc ON qc.school_id=s.id LEFT JOIN quiz_rewards qr ON qr.school_id=s.id
 LEFT JOIN codes c ON c.school_id=s.id LEFT JOIN activations ac ON ac.school_id=s.id ORDER BY s.name,s.id
)
SELECT json_object(
 'schools',json((SELECT json_group_array(json_object('id',id,'name',name,'active',active)) FROM (SELECT id,name,active FROM pilot_schools ORDER BY name,id))),
 'bySchool',json((SELECT json_group_array(json_object('id',id,'name',name,'active',active,'eligibleStudents',eligibleStudents,'participatingStudents',participatingStudents,
 'teachers',teachers,'classes',classes,'assignments',assignments,'submissions',submissions,'reviewedSubmissions',reviewedSubmissions,'gameCompletions',gameCompletions,'xp',xp,
 'classChallengesCreated',classChallengesCreated,'classAnswers',classAnswers,'classCompletions',classCompletions,'classXp',classXp,
 'marketCompletions',marketCompletions,'marketAutonomyBonuses',marketAutonomyBonuses,'marketXp',marketXp,'zelligeCompletions',zelligeCompletions,'zelligeXp',zelligeXp,'crosswordXp',crosswordXp,'cultureAnswers',cultureAnswers,'dailyAnswers',dailyAnswers,'cultureCompletions',cultureCompletions,'dailyCompletions',dailyCompletions,
 'cultureXp',cultureXp,'dailyXp',dailyXp,'wordChoiceAnswers',wordChoiceAnswers,'wordChoiceCompletions',wordChoiceCompletions,'wordChoiceXp',wordChoiceXp,'undatedQuizAnswers',undatedQuizAnswers,
 'codesIssued',codesIssued,'issuedCodesActivated',issuedCodesActivated,'activations',activations)) FROM rows))
) payload WHERE EXISTS (SELECT 1 FROM pilot_admins WHERE user_id=? AND active=1) AND ${LIVE_SESSION_SQL}`;

const COUNTERS = ['classChallengesCreated','classAnswers','classCompletions','classXp','eligibleStudents','participatingStudents','teachers','classes','assignments','submissions','reviewedSubmissions','gameCompletions','marketCompletions','marketAutonomyBonuses','marketXp','zelligeCompletions','zelligeXp','xp','crosswordXp','cultureAnswers','dailyAnswers','cultureCompletions','dailyCompletions','cultureXp','dailyXp','wordChoiceAnswers','wordChoiceCompletions','wordChoiceXp','undatedQuizAnswers','codesIssued','issuedCodesActivated','activations'];
export const ANALYTICS_DEFINITIONS = Object.freeze({
  games: 'Sept jeux seulement : Mots fléchés, Culture générale, Défi du jour, Le Mot juste, Mission Zellige, Le Souk des mots et les Défis de classe. Défis de classe : lancements datés created_at ; réponses correctes, incorrectes ou expirées datées answeredAt ; participation terminée dès la cinquième réponse confirmée (completed_at), même avant l’ouverture du bilan ; XP datés awarded_at. Les relectures et les classements ne produisent aucune nouvelle activité. Souk : premières réussites de missions (mastery), bonus distincts d’autonomie et XP à leur date effective awarded_at ; un bonus ultérieur ne recompte pas la mission. Zellige : missions du jour récompensées, à la date effective completed_at ; aperçus et replays exclus, aucune date déduite de la clé quotidienne. Réponses de quiz correctes, incorrectes ou expirées : date answeredAt confirmée par le serveur. Tentatives terminées : completed_at, indépendamment du score. XP : somme des récompenses enregistrées une seule fois dans pilot_game_awards, pilot_quiz_awards, pilot_market_awards et pilot_class_awards, à leur date effective ; ni startingXp, ni XP déclarés dans la réponse, ni bonus recalculé. Un score ou des XP de jeu ne mesurent pas la maîtrise des compétences.',
  undatedQuizAnswers: 'Anciennes réponses sans date serveur exploitable, dans le périmètre scolaire et présentes à la date de calcul, toutes dates de partie confondues. Exclues des réponses et de la participation calculées sur la période ; la fin datée de la tentative et les XP réellement enregistrés restent comptés séparément. Aucune date n’est déduite de created_at, questionStartedAt ou daily_key.',
  participation: 'Inscriptions élèves actuellement actives (compte, rattachement et école actifs, hors administrateurs de plateforme) ayant remis un devoir, terminé une grille de Mots fléchés, obtenu une première réussite ou un bonus d’autonomie du Souk des mots, obtenu la récompense quotidienne de Mission Zellige, confirmé une réponse datée par le serveur ou terminé une tentative de Culture générale, Défi du jour, Le Mot juste ou Défis de classe pendant la période. Une inscription compte une fois par école, même avec plusieurs activités. Les anciennes réponses sans date sont exclues, sans date reconstituée. Les autres jeux, les connexions et les leçons ne sont pas mesurés ici.',
  reviews: 'Remises effectuées pendant la période, dont la correction est enregistrée à la date de calcul, même si elle est postérieure à la période. Les remises historiques de comptes ou écoles suspendus restent incluses.',
  activation: 'Codes émis pendant la période, dont une activation est enregistrée à la date de calcul, même si elle est postérieure à la période. Les codes expirés ou révoqués restent dans cette cohorte historique ; ce taux ne mesure pas les droits actuellement ouverts.',
});

export async function handleAdminAnalytics(request, env, session) {
  if (request.method !== 'GET' || new URL(request.url).pathname !== '/api/pilot/admin/analytics') fail(404, 'not_found', 'Cette analyse n’est pas disponible.');
  // This independent handler remains fail-closed even if a dispatcher is changed.
  if (!session?.user_id || !session?.token_hash) fail(401, 'session_required', 'Connectez-vous avec votre compte administrateur.');
  const filters = parseAnalyticsFilters(new URL(request.url).searchParams);
  const record = await first(env.DB, ANALYTICS_SQL, filters.start, filters.endExclusive, filters.schoolId, filters.generatedAt, session.user_id, ...liveValues(session));
  if (!record) fail(403, 'admin_required', 'Cet espace est réservé à l’administration Jet d’Encre.');
  const { schools, bySchool } = JSON.parse(record.payload);
  if (filters.schoolId && !bySchool.length) fail(404, 'school_not_found', 'Cet établissement n’est pas disponible.');
  const totals = Object.fromEntries(COUNTERS.map(key => [key, bySchool.reduce((sum, row) => sum + row[key], 0)]));
  return reply({
    schemaVersion: 2, source: session.assurance === 'local_fixture' ? 'pilot_local_fixture' : 'pilot_database',
    userId: session.user_id, generatedAt: new Date(filters.generatedAt * 1000).toISOString(),
    filters: { from: filters.from, to: filters.to, schoolId: filters.schoolId, timezone: filters.timezone },
    schools, bySchool, totals, definitions: ANALYTICS_DEFINITIONS,
    unavailable: ['Connexions historiques et visites', 'Leçons consultées, autres jeux et progression comparable', 'Cycle éditorial, droits et préparation des médias'],
  });
}
