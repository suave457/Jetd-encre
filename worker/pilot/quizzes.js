import { quizQuestionsV1 as cultureQuizQuestions } from './quiz-content-v1.js';
import { wordChoiceItems, WORD_CHOICE_LEVELS, WORD_CHOICE_CATEGORIES } from './word-choice-content-v1.js';
import { getDailyChallenge, getMoroccoDateKey } from '../../src/features/games/dailyChallengeData.js';
import { evaluateAnswer, prepareQuizQuestions } from '../../src/features/games/quizEngine.js';
import { all, checkCsrf, fail, first, hash, LIVE_SESSION_SQL, liveValues, now, readInput, reply } from './session.js';

export const QUIZ_CONTENT_VERSION = 'culture-2026-09-v1';
export const WORD_CHOICE_CONTENT_VERSION = 'mot-juste-2026-09-v1';
// Keep this immutable version available when adding a future corpus. Never read
// the browser editorial store, nor modify the answer key of an in-flight attempt.
const wordQuestions=wordChoiceItems.map(item=>({...item,theme:item.category}));
const CORPORA = new Map([[QUIZ_CONTENT_VERSION, new Map(cultureQuizQuestions.map(q => [q.id, q]))],[WORD_CHOICE_CONTENT_VERSION,new Map(wordQuestions.map(q=>[q.id,q]))]]);
const GAMES = new Set(['culture-generale', 'defi-du-jour', 'mot-juste']);
const wordCatalogue={levels:WORD_CHOICE_LEVELS,categories:WORD_CHOICE_CATEGORIES,counts:WORD_CHOICE_LEVELS.flatMap(level=>WORD_CHOICE_CATEGORIES.map(category=>({level,category,count:wordQuestions.filter(q=>q.level===level&&q.category===category).length})))};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const scopeValues = c => [c.schoolId, c.user.id];
function guard(c) {
  return { sql: `EXISTS (SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
    WHERE m.school_id=? AND m.user_id=? AND m.role='eleve' AND m.active=1 AND s.active=1)
    AND NOT EXISTS (SELECT 1 FROM pilot_admins a WHERE a.user_id=? AND a.active=1)
    AND EXISTS (SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.school_id=cm.school_id AND cl.id=cm.class_id
      WHERE cm.school_id=? AND cm.user_id=? AND cl.active=1) AND ${LIVE_SESSION_SQL}`,
    values: [...scopeValues(c), c.user.id, ...scopeValues(c), ...liveValues(c.session)] };
}
async function access(db, c) {
  const g = guard(c);
  if (!await first(db, `SELECT 1 allowed WHERE ${g.sql}`, ...g.values)) fail(403, 'quiz_access_changed', 'Ton accès a changé. Reconnecte-toi avant de continuer.');
}
function fields(input, allowed) {
  if (Object.keys(input).some(key => !allowed.includes(key))) fail(422, 'quiz_invalid_field', 'La requête contient un champ inattendu.');
  if (typeof input.requestId !== 'string' || !UUID.test(input.requestId)) fail(422, 'quiz_invalid_request', 'La référence de la requête est invalide.');
}
function questions(row) {
  if ((row.game_id==='mot-juste') !== (row.content_version===WORD_CHOICE_CONTENT_VERSION)) fail(503, 'quiz_content_unavailable', 'Cette version du quiz n’est pas disponible. Ton résultat n’a pas été modifié.');
  const bank = CORPORA.get(row.content_version);
  const dailyBank = row.daily_key && bank
    ? new Map(getDailyChallenge(row.daily_key, [...bank.values()]).questions.map(q => [q.id, q])) : bank;
  const selected = JSON.parse(row.question_ids_json).map(id => dailyBank?.get(id));
  if (!bank || !selected.length || selected.some(q => !q)) fail(503, 'quiz_content_unavailable', 'Cette version du quiz n’est pas disponible. Ton résultat n’a pas été modifié.');
  return selected;
}
function publicQuestion(q, answered) {
  return { id:q.id, theme:q.theme, level:q.level, prompt:q.prompt, choices:q.choices,
    ...(q.category?{category:q.category}:{}),
    ...(answered ? {correctIndex:q.correctIndex, explanation:q.explanation,...(q.learningGoal?{learningGoal:q.learningGoal}:{})} : {}) };
}
function view(row) {
  if (!row) return null;
  const state = JSON.parse(row.state_json), selected = questions(row);
  const correctCount = state.answers.filter(answer => answer.isCorrect).length;
  let streak=0, bestStreak=0;
  for (const answer of state.answers) { streak=answer.isCorrect?streak+1:0; bestStreak=Math.max(bestStreak,streak); }
  const categoryResults=Object.fromEntries(WORD_CHOICE_CATEGORIES.map(category=>[category,{total:selected.filter(q=>q.category===category).length,correct:state.answers.filter((answer,index)=>answer.isCorrect&&selected[index].category===category).length}]));
  return { id:row.id, gameId:row.game_id, contentVersion:row.content_version, dailyKey:row.daily_key,
    revision:row.revision, expiresAt:row.expires_at, completedAt:row.completed_at,
    ...state, questions:selected.map((q,index)=>publicQuestion(q,index<state.answers.length)),
    summary:{correctCount, questionCount:selected.length, bestStreak, scorePercent:Math.round(correctCount/selected.length*100),
      answerXp:correctCount*10, completionXp:state.phase==='results'&&row.game_id==='defi-du-jour'?20:0,
      ...(row.game_id==='mot-juste'?{categoryResults,xpEarned:correctCount*10}:{})},
  };
}
async function owned(db,c,id) {
  const g=guard(c);
  return first(db,`SELECT * FROM pilot_quiz_attempts WHERE id=? AND school_id=? AND student_id=? AND ${g.sql}`,id,...scopeValues(c),...g.values);
}
async function xp(db,c) {
  const g=guard(c);
  const row=await first(db,`SELECT
    (SELECT COALESCE(SUM(xp),0) FROM pilot_quiz_awards WHERE school_id=? AND student_id=?) +
    (SELECT COALESCE(SUM(xp),0) FROM pilot_game_awards WHERE school_id=? AND student_id=?) +
    (SELECT COALESCE(SUM(xp),0) FROM pilot_market_awards WHERE school_id=? AND student_id=?) +
    (SELECT COALESCE(SUM(xp),0) FROM pilot_class_awards WHERE school_id=? AND student_id=?) total WHERE ${g.sql}`,
  ...scopeValues(c),...scopeValues(c),...scopeValues(c),...scopeValues(c),...g.values);
  return row?.total ?? 0;
}
async function response(db,c,row,extra={}) {
  const total=await xp(db,c); await access(db,c);
  const attempt=view(row);
  const daily=row?.daily_key?getDailyChallenge(row.daily_key,[...CORPORA.get(row.content_version).values()]):null;
  return reply({userId:c.user.id,schoolId:c.schoolId,serverNow:Date.now(),xpTotal:total,attempt,
    ...(daily?{daily:{dateKey:daily.dateKey,category:daily.category,questionCount:daily.questions.length,completionXp:20}}:{}),...extra});
}
async function conflict(db,c,row,message='Cette partie a changé dans un autre onglet. Recharge la version enregistrée.') {
  await access(db,c);
  throw reply({error:{code:'quiz_conflict',message},userId:c.user.id,schoolId:c.schoolId,attempt:view(row)},409);
}
async function start(request,db,c,game) {
  const input=await readInput(request),word=game==='mot-juste'; fields(input,word?['requestId','level','category']:['requestId','comfortMode']);
  if(word){if(!['Tous',...WORD_CHOICE_LEVELS].includes(input.level)||!['Toutes',...WORD_CHOICE_CATEGORIES].includes(input.category))fail(422,'quiz_invalid_filters','Choisis un niveau et une compétence proposés.');}
  else if (typeof input.comfortMode!=='boolean') fail(422,'quiz_invalid_duration','Choisis le mode de lecture proposé.');
  const requestId=input.requestId.toLowerCase(), requestHash=await hash(JSON.stringify(word?[game,input.level,input.category]:[game,input.comfortMode]));
  const g=guard(c);
  const prior=await first(db,`SELECT * FROM pilot_quiz_attempts WHERE school_id=? AND student_id=? AND game_id=? AND start_request_id=? AND ${g.sql}`,...scopeValues(c),game,requestId,...g.values);
  if(prior){if(prior.start_request_hash!==requestHash)await conflict(db,c,prior);return response(db,c,prior,{replayed:true});}
  const time=now(), daily=game==='defi-du-jour'?getDailyChallenge(new Date(),cultureQuizQuestions):null;
  if(daily){
    const previous=await first(db,`SELECT * FROM pilot_quiz_attempts WHERE school_id=? AND student_id=? AND game_id=? AND daily_key=? AND ${g.sql}`,...scopeValues(c),game,daily.dateKey,...g.values);
    if(previous)return response(db,c,previous,{replayed:true});
  }
  const bank=word?wordQuestions.filter(q=>(input.level==='Tous'||q.level===input.level)&&(input.category==='Toutes'||q.category===input.category)):cultureQuizQuestions;
  if(word&&!bank.length)fail(422,'quiz_empty_filters','Aucune phrase ne correspond à ces filtres.');
  const id=crypto.randomUUID(), selected=daily?.questions || prepareQuizQuestions(bank,{seed:id,limit:10});
  if(!selected.length||selected.length!==(word?Math.min(10,bank.length):daily?5:10))fail(503,'quiz_content_unavailable','Le corpus du jeu est incomplet.');
  const state={phase:'question',index:0,answers:[],startingXp:await xp(db,c),durationSeconds:!word&&input.comfortMode?20:10,questionStartedAt:Date.now(),...(word?{selection:{level:input.level,category:input.category}}:{})};
  // Budget concerns allocations, not replay. One owner cannot fill D1 with start IDs.
  await db.prepare(`INSERT INTO pilot_quiz_attempts(id,school_id,student_id,game_id,content_version,daily_key,question_ids_json,state_json,
      revision,start_request_id,start_request_hash,last_request_id,last_request_hash,created_at,expires_at)
    SELECT ?,?,?,?,?,?,?,?,1,?,?,?,?,?,? WHERE ${g.sql}
    AND (SELECT COUNT(*) FROM pilot_quiz_attempts WHERE school_id=? AND student_id=? AND created_at>?)<20
    ON CONFLICT DO NOTHING`).bind(id,...scopeValues(c),game,word?WORD_CHOICE_CONTENT_VERSION:QUIZ_CONTENT_VERSION,daily?.dateKey??null,
      JSON.stringify(selected.map(q=>q.id)),JSON.stringify(state),requestId,requestHash,requestId,requestHash,time,time+86400,
      ...g.values,...scopeValues(c),time-3600).run();
  await access(db,c);
  const saved=await first(db,`SELECT * FROM pilot_quiz_attempts WHERE school_id=? AND student_id=? AND game_id=? AND
    (start_request_id=? OR (? IS NOT NULL AND daily_key=?)) AND ${g.sql}`,...scopeValues(c),game,requestId,daily?.dateKey??null,daily?.dateKey??null,...g.values);
  if(!saved)fail(429,'quiz_start_limit','Beaucoup de parties ont été ouvertes. Reprends une partie ou réessaie plus tard.');
  if(saved.start_request_id===requestId&&saved.start_request_hash!==requestHash)await conflict(db,c,saved);
  return response(db,c,saved,{replayed:saved.id!==id});
}
async function transition(request,db,c,game,id,action) {
  const input=await readInput(request);
  fields(input,action==='answer'?['requestId','revision','index','selectedIndex']:['requestId','revision']);
  if(!Number.isSafeInteger(input.revision)||input.revision<1)fail(422,'quiz_invalid_revision','Version de partie invalide.');
  if(action==='answer'&&(!Number.isInteger(input.index)||input.index<0||!(input.selectedIndex===null||Number.isInteger(input.selectedIndex)&&input.selectedIndex>=0&&input.selectedIndex<4)))fail(422,'quiz_invalid_answer','Réponse invalide.');
  const requestId=input.requestId.toLowerCase(), requestHash=await hash(JSON.stringify([action,input.revision,input.index??null,input.selectedIndex??null]));
  const row=await owned(db,c,id);
  if(!row||row.game_id!==game)fail(404,'quiz_not_found','Cette partie n’est pas disponible pour ce compte.');
  if(row.last_request_id===requestId){if(row.last_request_hash!==requestHash)await conflict(db,c,row);return response(db,c,row,{replayed:true});}
  if(row.revision!==input.revision)await conflict(db,c,row);
  if(row.expires_at<=now())fail(410,'quiz_expired','Cette partie a expiré. Ouvre une nouvelle partie.');
  const state=JSON.parse(row.state_json), selected=questions(row), time=now(); let award=0,rewardKey=null;
  if(action==='answer'){
    if(state.phase!=='question'||input.index!==state.index)await conflict(db,c,row,'La première réponse enregistrée est conservée.');
    const timedOut=Date.now()>=state.questionStartedAt+state.durationSeconds*1000;
    const selection=timedOut?null:input.selectedIndex, q=selected[state.index];
    const evaluated=evaluateAnswer(q,selection);
    const remainingSeconds=Math.max(0,Math.ceil((state.questionStartedAt+state.durationSeconds*1000-Date.now())/1000));
    state.answers.push({questionId:q.id,selectedIndex:selection,correctIndex:q.correctIndex,isCorrect:evaluated.isCorrect,xp:evaluated.xp,timedOut,remainingSeconds,answeredAt:time});
    state.phase='feedback';award=evaluated.xp;rewardKey=`${row.daily_key??id}:question:${state.index}`;
  }else{
    if(state.phase!=='feedback')await conflict(db,c,row);
    if(state.index===selected.length-1){state.phase='results';award=game==='defi-du-jour'?20:0;rewardKey=`${row.daily_key??id}:completion`;}
    else{state.index++;state.phase='question';state.questionStartedAt=Date.now();}
  }
  const g=guard(c), nextRevision=row.revision+1;
  const write=db.prepare(`UPDATE pilot_quiz_attempts SET state_json=?,revision=?,last_request_id=?,last_request_hash=?,completed_at=?
    WHERE id=? AND school_id=? AND student_id=? AND revision=? AND ${g.sql}`).bind(JSON.stringify(state),nextRevision,requestId,requestHash,
      state.phase==='results'?time:null,id,...scopeValues(c),row.revision,...g.values);
  const statements=[write];
  if(award)statements.push(db.prepare(`INSERT INTO pilot_quiz_awards(school_id,student_id,game_id,reward_key,attempt_id,xp,awarded_at)
    SELECT ?,?,?,?,?,?,? WHERE ${g.sql} AND EXISTS(SELECT 1 FROM pilot_quiz_attempts p WHERE p.id=? AND p.revision=?
      AND p.last_request_id=? AND p.last_request_hash=?) ON CONFLICT DO NOTHING`).bind(...scopeValues(c),game,rewardKey,id,award,time,...g.values,id,nextRevision,requestId,requestHash));
  await db.batch(statements);await access(db,c);
  const saved=await owned(db,c,id);
  if(!saved||saved.last_request_id!==requestId||saved.last_request_hash!==requestHash)await conflict(db,c,saved);
  return response(db,c,saved,{replayed:false});
}

// Integrate after authenticate()/context(); this handler never accepts a user ID from JSON.
export async function handleQuizGames(request,env,c,path=new URL(request.url).pathname) {
  const match=path.match(/^\/api\/pilot\/games\/quiz\/([a-z-]+)(?:\/(start|attempts)(?:\/([a-f0-9-]{36})(?:\/(answer|next))?)?)?$/);
  if(!match||!GAMES.has(match[1]))return reply({error:{code:'not_found',message:'Jeu introuvable.'}},404);
  if(!c?.user?.id||!c.schoolId||c.session?.user_id!==c.user.id||!c.session?.token_hash)fail(401,'session_required','Reconnecte-toi pour jouer.');
  if(c.role!=='eleve')fail(403,'student_required','Ce jeu est réservé à l’élève.');
  if(!env.DB)fail(503,'database_unavailable','Le serveur de jeux est indisponible.');
  if(request.method!=='GET')checkCsrf(request,c.session);
  await access(env.DB,c);const [,game,operation,id,action]=match;
  if(request.method==='POST'&&operation==='start'&&!id)return start(request,env.DB,c,game);
  if(request.method==='POST'&&operation==='attempts'&&UUID.test(id||'')&&action)return transition(request,env.DB,c,game,id,action);
  if(request.method==='GET'&&operation==='attempts'&&UUID.test(id||'')&&!action){const row=await owned(env.DB,c,id);if(!row||row.game_id!==game)fail(404,'quiz_not_found','Partie introuvable.');return response(env.DB,c,row);}
  if(request.method==='GET'&&!operation){
    const g=guard(c),today=getMoroccoDateKey(new Date());
    const rows=await all(env.DB,`SELECT * FROM pilot_quiz_attempts WHERE school_id=? AND student_id=? AND game_id=? AND ${g.sql}
      ORDER BY created_at DESC,rowid DESC LIMIT 40`,...scopeValues(c),game,...g.values);
    const current=rows.find(row=>game==='defi-du-jour'?row.daily_key===today:row.expires_at>now())??null;
    const history=game==='defi-du-jour'?rows.filter(row=>row.completed_at!==null).slice(0,7).map(row=>{const v=view(row);return {id:row.id,quizId:game,userId:c.user.id,dailyKey:row.daily_key,correctCount:v.summary.correctCount,questionCount:v.questions.length,xpEarned:v.summary.answerXp+v.summary.completionXp,category:getDailyChallenge(row.daily_key,cultureQuizQuestions).category};}):[];
    const daily=game==='defi-du-jour'?getDailyChallenge(today,cultureQuizQuestions):null;
    return response(env.DB,c,current,{gameId:game,contentVersion:game==='mot-juste'?WORD_CHOICE_CONTENT_VERSION:QUIZ_CONTENT_VERSION,questionCount:daily?5:10,
      ...(game==='mot-juste'?{catalogue:wordCatalogue}:{}),
      daily:daily?{dateKey:daily.dateKey,category:daily.category,questionCount:5,completionXp:20}:null,history});
  }
  return reply({error:{code:'not_found',message:'Route du jeu introuvable.'}},404);
}
