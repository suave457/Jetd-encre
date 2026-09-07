import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_EXPERIENCE, QuizTopbar, WelcomeScreen, QuestionScreen, ResultsScreen } from '../games/CultureQuiz.jsx';
import { DailyCompletedScreen } from '../games/DailyChallenge.jsx';
import { WordChoiceHeader, WordChoiceWelcome, WordChoiceQuestion, WordChoiceResults } from '../games/word-choice/WordChoiceGame.jsx';
import './pilot.css';
import './school-quiz.css';

const allowedGames=new Set(['culture-generale','defi-du-jour','mot-juste']);
const home='/pilote?profil=eleve&section=jeux';
async function call(path,{body,csrf,signal}={}) {
  const response=await fetch('/api/pilot'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,
    headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})}).catch(error=>{
      if(error.name==='AbortError')throw error;
      throw new Error('La connexion a été interrompue. Vérifie le réseau, puis réessaie le même envoi.');
    });
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error?.message||'La partie attend une confirmation. Réessaie.'),{status:response.status});
  return data;
}
function assertOwner(data,identity) {
  if(data.userId!==identity.user.id||data.schoolId!==identity.user.schoolId)throw Object.assign(new Error('Le compte a changé. Reviens à ton espace.'),{status:403});
  return data;
}
function dailyExperience(daily) {
  const dateLabel=new Intl.DateTimeFormat('fr-MA',{timeZone:'Africa/Casablanca',day:'numeric',month:'long'}).format(new Date(daily.dateKey+'T12:00:00Z'));
  return {...DEFAULT_EXPERIENCE,quizId:'defi-du-jour',source:'defi-du-jour',welcomeKicker:`Défi du ${dateLabel}`,
    title:'Cinq questions pour',titleEmphasis:' illuminer ta journée',
    description:`Aujourd’hui, la catégorie vedette est « ${daily.category} ». Réponds aux ${daily.questionCount} questions publiées, découvre une explication après chaque réponse et gagne un bonus en allant jusqu’au bout.`,
    resultKicker:'Défi du jour accompli',resultDescription:'Tes réponses sont enregistrées dans ton historique. Reviens demain pour découvrir une nouvelle catégorie vedette.',
    completionBonus:20,canRestart:false,illustrationSrc:'/assets/defi-du-jour-hero.webp',dailyKey:daily.dateKey,category:daily.category};
}

// gameId is an allowlisted route choice, never an identity or a permission.
export default function SchoolQuiz({gameId}) {
  const [ready,setReady]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const [comfortMode,setComfortMode]=useState(false),[tick,setTick]=useState(Date.now());
  const [level,setLevel]=useState('Tous'),[category,setCategory]=useState('Toutes');
  const [preparing,setPreparing]=useState(false);
  const word=gameId==='mot-juste';
  const title=word?'Le Mot juste':gameId==='defi-du-jour'?'Défi du jour':'Culture générale';
  const identity=useRef(null),abort=useRef(null),epoch=useRef(0),pending=useRef(null),running=useRef(false),snapshot=useRef(null);
  const prefix='/games/quiz/'+gameId;
  const exit=()=>window.location.assign(home);
  const invalidate=message=>{++epoch.current;abort.current?.abort();identity.current=null;snapshot.current=null;pending.current=null;running.current=false;setReady(null);setBusy(false);setError(message);};
  useEffect(()=>{
    const version=++epoch.current,controller=new AbortController();abort.current=controller;
    identity.current=null;snapshot.current=null;pending.current=null;running.current=false;setReady(null);setBusy(false);setError('');setPreparing(false);
    if(!allowedGames.has(gameId)){setError('Ce jeu n’est pas disponible.');return()=>controller.abort();}
    const commit=data=>{snapshot.current=data;setTick(Date.now());setReady(data);};
    async function load(){
      try{
        const session=await call('/session?profil=eleve',{signal:controller.signal});
        if(!session.authenticated||session.user?.role!=='eleve')throw new Error('Connecte-toi avec ton compte élève pour retrouver tes jeux.');
        const boot=assertOwner(await call(prefix,{signal:controller.signal}),session);
        if(version!==epoch.current||controller.signal.aborted)return;
        identity.current=session;
        setLevel(boot.attempt?.selection?.level??'Tous');setCategory(boot.attempt?.selection?.category??'Toutes');
        commit({...boot,clockOffset:boot.serverNow-Date.now(),openedCompleted:gameId==='defi-du-jour'&&boot.attempt?.phase==='results'});
      }catch(e){if(version===epoch.current&&!controller.signal.aborted)setError(e.message);}
    }
    const focused=async()=>{
      if(!identity.current||controller.signal.aborted)return;
      const previous=identity.current;
      try{const next=await call('/session?profil=eleve',{signal:controller.signal});
        if(version!==epoch.current||controller.signal.aborted)return;
        if(!next.authenticated||next.user.id!==previous.user.id||next.user.schoolId!==previous.user.schoolId||next.csrfToken!==previous.csrfToken)invalidate('Le compte a changé. Reviens à ton espace avant de continuer.');
      }catch(e){if(version===epoch.current&&!controller.signal.aborted){if([401,403].includes(e.status))invalidate(e.message);else setError('Le compte ne peut pas être revérifié. Réessaie avant de continuer.');}}
    };
    const changed=()=>invalidate('La session a changé dans un autre onglet. Reviens à ton espace.');
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('jde-pilot-session'):null;if(channel)channel.onmessage=changed;
    const leaving=e=>{if(pending.current){e.preventDefault();e.returnValue='';}};
    document.title=title+' · Jet d’Encre';
    load();window.addEventListener('focus',focused);window.addEventListener('beforeunload',leaving);
    return()=>{++epoch.current;controller.abort();channel?.close();window.removeEventListener('focus',focused);window.removeEventListener('beforeunload',leaving);};
  },[gameId,retry]);
  async function transmit(){
    if(running.current||!pending.current||!identity.current)return;
    const operation=pending.current,session=identity.current,version=epoch.current;running.current=true;setBusy(true);setError('');
    try{
      const result=assertOwner(await call(operation.path,{body:operation.body,csrf:session.csrfToken,signal:abort.current.signal}),session);
      if(version!==epoch.current||abort.current.signal.aborted)return;
      const next={...snapshot.current,...result,clockOffset:result.serverNow-Date.now(),openedCompleted:false};
      snapshot.current=next;setTick(Date.now());setReady(next);pending.current=null;setPreparing(false);
    }catch(e){
      if(version!==epoch.current||abort.current.signal.aborted)return;
      if([401,403].includes(e.status)){invalidate(e.message);return;}
      setError(e.message);
      // Unknown network outcomes keep the exact UUID and payload. A conflict
      // requires an explicit reload instead of silently replacing another tab.
      if(e.status>=400&&e.status<500)pending.current=null;
    }finally{if(version===epoch.current){running.current=false;setBusy(false);}}
  }
  function perform(action,selectedIndex){
    if(running.current||pending.current||error||!identity.current)return;
    const attempt=snapshot.current?.attempt,requestId=crypto.randomUUID();
    if(action==='start')pending.current={path:prefix+'/start',body:{requestId,...(word?{level,category}:{comfortMode})}};
    else if(attempt)pending.current={path:prefix+'/attempts/'+attempt.id+'/'+action,
      body:{requestId,revision:attempt.revision,...(action==='answer'?{index:attempt.index,selectedIndex}: {})}};
    if(pending.current)transmit();
  }
  const attempt=preparing?null:ready?.attempt,phase=attempt?.phase??'welcome';
  useEffect(()=>{if(phase!=='question')return;const timer=window.setInterval(()=>setTick(Date.now()),250);return()=>window.clearInterval(timer);},[phase,attempt?.index,attempt?.id]);
  const duration=attempt?.durationSeconds??(comfortMode?20:10);
  const remaining=phase==='question'?Math.min(duration,Math.max(0,Math.ceil((attempt.questionStartedAt+duration*1000-(tick+(ready?.clockOffset??0)))/1000))):(attempt?.answers.at(-1)?.remainingSeconds??0);
  useEffect(()=>{if(phase==='question'&&remaining===0&&!busy&&!error)perform('answer',null);},[phase,remaining,busy,error,attempt?.revision]);
  useEffect(()=>{
    if(phase!=='question'||busy||error)return;
    const key=e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const index=Number(e.key)-1;if(index>=0&&index<4){e.preventDefault();perform('answer',index);}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[phase,busy,error,attempt?.revision]);
  const experience=useMemo(()=>ready?.daily?dailyExperience(ready.daily):DEFAULT_EXPERIENCE,[ready?.daily]);
  if(!ready)return <main className="pilot-main"><h1>{title}</h1><p role={error?'alert':'status'}>{error||'Ouverture de ta partie…'}</p>{error&&<button className="button button-light" onClick={()=>setRetry(v=>v+1)}>Réessayer</button>}<a className="button button-dark" href={home}>Revenir à mes jeux</a></main>;
  const summary=attempt?.summary,sessionXp=summary?summary.answerXp+summary.completionXp:0;
  const lastAnswer=attempt?.answers.at(-1),streak=(()=>{let n=0;for(const a of [...(attempt?.answers??[])].reverse()){if(!a.isCorrect)break;n++;}return n;})();
  const completed=ready.openedCompleted?ready.history.find(row=>row.id===attempt.id):null;
  const wordCount=Math.min(10,(ready.catalogue?.counts??[]).filter(row=>(level==='Tous'||row.level===level)&&(category==='Toutes'||row.category===category)).reduce((sum,row)=>sum+row.count,0));
  return <>
    <div inert={busy||Boolean(error)?true:undefined} aria-busy={busy}>
      {word?<div className={`word-choice-game wj-phase-${phase}`}>
        <WordChoiceHeader phase={phase} questionNumber={(attempt?.index??0)+1} total={attempt?.questions.length??wordCount} streak={streak} sessionXp={sessionXp} onExit={exit}/>
        {phase==='welcome'&&<WordChoiceWelcome level={level} category={category} questionCount={wordCount} onLevelChange={setLevel} onCategoryChange={setCategory} onStart={()=>perform('start')}/>}
        {(phase==='question'||phase==='feedback')&&<WordChoiceQuestion item={attempt.questions[attempt.index]} index={attempt.index} total={attempt.questions.length} timeLeft={remaining} answer={phase==='feedback'?lastAnswer:null} onAnswer={index=>perform('answer',index)} onContinue={()=>perform('next')}/>}
        {phase==='results'&&<WordChoiceResults summary={summary} profileXpStart={attempt.startingXp} profileXpTotal={ready.xpTotal} onRestart={()=>setPreparing(true)} onExit={exit}/>}
        <p className="wj-sr-only" aria-live="polite" aria-atomic="true">{phase==='question'?`Phrase ${attempt.index+1} sur ${attempt.questions.length}. ${attempt.questions[attempt.index].prompt.replace('___','mot manquant')}`:phase==='results'?`Parcours terminé. ${summary.correctCount} bonnes réponses sur ${summary.questionCount}. ${summary.xpEarned} XP gagnés.`:phase==='welcome'?'Choisis ton niveau et ta compétence, puis commence.':''}</p>
      </div>:completed?<DailyCompletedScreen challenge={ready.daily} completion={completed} history={ready.history} currentXp={ready.xpTotal} onExit={exit}/>:<div className={`culture-quiz cq-phase-${phase}`}>
        <QuizTopbar phase={phase} questionNumber={(attempt?.index??0)+1} questionTotal={attempt?.questions.length??ready.questionCount} streak={streak} xp={sessionXp} onExit={exit}/>
        {phase==='welcome'&&<WelcomeScreen questionTotal={ready.questionCount} comfortMode={comfortMode} onComfortChange={setComfortMode} onStart={()=>perform('start')} experience={experience}/>}
        {(phase==='question'||phase==='feedback')&&<QuestionScreen question={attempt.questions[attempt.index]} questionNumber={attempt.index+1} questionTotal={attempt.questions.length} phase={phase} timeLeft={remaining} duration={duration} answer={phase==='feedback'?lastAnswer:null} onSelect={index=>perform('answer',index)} onContinue={()=>perform('next')}/>}
        {phase==='results'&&<ResultsScreen summary={{...summary,xpEarned:summary.answerXp}} questionTotal={attempt.questions.length} profileXpStart={attempt.startingXp} profileXpTotal={ready.xpTotal} onRestart={()=>perform('start')} onExit={exit} experience={{...experience,completionBonus:summary.completionXp}}/>}
      </div>}
    </div>
    {(busy||error)&&<div className="pilot-game-sync school-quiz-sync" role={error?'alert':'status'}>{error||'Enregistrement sur ton compte…'}
      {error&&<><button className="button button-light" onClick={()=>pending.current?transmit():setRetry(v=>v+1)}>{pending.current?'Réessayer le même envoi':'Recharger la partie enregistrée'}</button><a href={home}>Revenir à mes jeux</a></>}
    </div>}
  </>;
}
