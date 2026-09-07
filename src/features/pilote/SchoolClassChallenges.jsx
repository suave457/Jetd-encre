import {useEffect,useRef,useState} from 'react';
import ClassChallengesStudent from '../games/class-challenges/ClassChallengesStudent.jsx';
import ClassChallengesTeacher from '../games/class-challenges/ClassChallengesTeacher.jsx';
import {DEFAULT_EXPERIENCE,QuizTopbar,WelcomeScreen,QuestionScreen} from '../games/CultureQuiz.jsx';
import {schoolApi} from './schoolApi.js';
import './pilot.css';
import './school-quiz.css';

const root='/games/defis-classe';
export default function SchoolClassChallenges({role='eleve',expectedUser=null,classGuard=null}) {
  const [data,setData]=useState(null),[detail,setDetail]=useState(null),[mode,setMode]=useState('hub');
  const [error,setError]=useState(null),[busy,setBusy]=useState(false),[generation,setGeneration]=useState(0);
  const [refreshWarning,setRefreshWarning]=useState('');
  const [comfortMode,setComfortMode]=useState(false),[tick,setTick]=useState(Date.now());
  const session=useRef(null),controller=useRef(null),epoch=useRef(0),pending=useRef(null),running=useRef(false),current=useRef(null),list=useRef(null),modeRef=useRef(mode);
  const serial=useRef(0),passiveRunning=useRef(false),focusReturn=useRef(null),focusRequested=useRef(false),frame=useRef(null),sync=useRef(null),navigationApproved=useRef(false);
  modeRef.current=mode;
  const home='/pilote?profil='+role+'&section=jeux',exit=()=>window.location.assign(home);
  function forget(message){
    ++epoch.current;controller.current?.abort();pending.current?.resolve({ok:false,message});
    pending.current=null;session.current=null;current.current=null;list.current=null;running.current=false;
    setData(null);setDetail(null);setBusy(false);setError({message,status:403});
  }
  async function read(path,body){
    const owner=session.current;
    const result=await schoolApi(path,{body,csrf:owner?.csrfToken,signal:controller.current.signal});
    if(!owner||result.userId!==owner.user.id||result.schoolId!==owner.user.schoolId)throw Object.assign(new Error('Le compte a changé. Reviens à ton espace.'),{status:403});
    return {...result,clockOffset:result.serverNow-Date.now()};
  }
  function commitDetail(next){current.current=next;setDetail(next);setTick(Date.now());}
  function commitList(next){list.current=next;setData(next);}
  useEffect(()=>{
    const version=++epoch.current,abort=new AbortController();controller.current=abort;
    setData(null);setDetail(null);setError(null);setBusy(false);current.current=null;list.current=null;pending.current=null;running.current=false;setMode('hub');
    async function load(){
      try{
        const identity=await schoolApi('/session?profil='+role,{signal:abort.signal});
        if(!identity.authenticated||identity.user?.role!==role)throw Object.assign(new Error('Connecte-toi dans l’espace correspondant à ton compte.'),{status:403});
        if(expectedUser&&(identity.user.id!==expectedUser.id||identity.user.schoolId!==expectedUser.schoolId))throw Object.assign(new Error('Le compte scolaire a changé. Reviens à ton espace.'),{status:403});
        if(version!==epoch.current||abort.signal.aborted)return;
        session.current=identity;
        const boot=await read(root);
        const first=role==='enseignant'&&boot.challenges[0]?await read(root+'/'+boot.challenges[0].id):null;
        if(version!==epoch.current||abort.signal.aborted)return;
        commitList(boot);if(first)commitDetail(first);
      }catch(e){if(version===epoch.current&&!abort.signal.aborted)setError(e);}
    }
    const focus=async()=>{
      if(!session.current||running.current||pending.current)return;
      const owner=session.current;
      try{
        const identity=await schoolApi('/session?profil='+role,{signal:abort.signal});
        if(version!==epoch.current||abort.signal.aborted)return;
        if(!identity.authenticated||identity.user.id!==owner.user.id||identity.user.schoolId!==owner.user.schoolId||identity.csrfToken!==owner.csrfToken)forget('La session a changé. Reviens à ton espace avant de continuer.');
        else if(modeRef.current!=='quiz')refreshPassive();
      }catch(e){if(version===epoch.current&&!abort.signal.aborted){if([401,403].includes(e.status))forget(e.message);else setError(e);}}
    };
    const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('jde-pilot-session');
    if(channel)channel.onmessage=()=>forget('La session a changé dans un autre onglet. Reviens à ton espace.');
    const hasDraft=()=>Boolean(pending.current||frame.current?.querySelector('.cc-create-form'));
    const canLeave=()=>{
      if(!hasDraft())return true;
      const accepted=window.confirm(pending.current?'Un envoi attend sa confirmation. Quitter cette page ?':'Le formulaire du défi n’est pas encore envoyé. Quitter cette page ?');
      if(accepted)navigationApproved.current=true;return accepted;
    };
    if(classGuard)classGuard.current=canLeave;
    const leaving=e=>{if(hasDraft()&&!navigationApproved.current){e.preventDefault();e.returnValue='';}};
    const entryPath=window.location.pathname+window.location.search;
    const back=e=>{if(!canLeave()){e.stopImmediatePropagation();window.history.pushState(null,'',entryPath);}};
    const link=e=>{
      if(classGuard||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
      const anchor=e.target.closest?.('a');if(!anchor||anchor.target==='_blank')return;
      if(!canLeave()){e.preventDefault();e.stopPropagation();}
    };
    document.title='Défis de classe · Jet d’Encre';load();
    window.addEventListener('focus',focus);window.addEventListener('popstate',back,true);window.addEventListener('beforeunload',leaving);document.addEventListener('click',link,true);
    return()=>{if(classGuard)classGuard.current=()=>true;++epoch.current;abort.abort();channel?.close();pending.current?.resolve({ok:false,message:'La page a été fermée.'});window.removeEventListener('focus',focus);window.removeEventListener('popstate',back,true);window.removeEventListener('beforeunload',leaving);document.removeEventListener('click',link,true);};
  },[role,expectedUser?.id,expectedUser?.schoolId,generation]);
  async function recoverList(version,operation=serial.current){
    if(version!==epoch.current||operation!==serial.current)return;
    current.current=null;list.current=null;setDetail(null);setData(null);setMode('hub');
    const boot=await read(root);
    if(version===epoch.current&&operation===serial.current){commitList(boot);setError(null);setRefreshWarning('');}
  }
  async function readOperation(operation){
    if(running.current||pending.current||!session.current)return;
    const version=epoch.current;++serial.current;focusReturn.current=document.activeElement;focusRequested.current=true;running.current=true;setBusy(true);setError(null);
    try{await operation(version);}
    catch(e){if(version===epoch.current){
      if(e.status===404&&!e.responseUncertain){try{await recoverList(version);}catch(recovery){if(version===epoch.current)setError(recovery);}}
      else if([401,403].includes(e.status))forget(e.message);else setError(e);
    }}
    finally{if(version===epoch.current){running.current=false;setBusy(false);}}
  }
  function open(id,nextMode='result'){
    return readOperation(async version=>{
      const next=await read(root+'/'+id);if(version!==epoch.current)return;
      commitDetail(next);setComfortMode(false);
      setMode(nextMode==='quiz'&&next.challenge.canPlay?'quiz':'result');
    });
  }
  function refreshDetail(){
    return readOperation(async version=>{
      const id=current.current?.challenge.id;
      const next=id?await read(root+'/'+id):null,boot=await read(root);
      if(version!==epoch.current)return;
      commitList(boot);if(next){commitDetail(next);if(modeRef.current==='quiz'&&next.challenge.status==='termine'&&next.attempt?.answers.length!==5)setMode('result');}
    });
  }
  async function refreshPassive(){
    if(passiveRunning.current||running.current||pending.current||modeRef.current==='quiz'||!session.current||document.querySelector('.cc-create-form')||list.current?.challenges.length>25||current.current?.leaderboard.rows.length>200)return;
    const version=epoch.current,operation=serial.current,id=current.current?.challenge.id;
    passiveRunning.current=true;
    try{
      const next=id?await read(root+'/'+id):null,boot=await read(root);
      if(version!==epoch.current||operation!==serial.current||running.current||pending.current)return;
      commitList(boot);if(next)commitDetail(next);setRefreshWarning('');
    }catch(e){if(version===epoch.current&&operation===serial.current){if(e.status===404&&!e.responseUncertain){try{await recoverList(version,operation);}catch(recovery){if(version===epoch.current&&operation===serial.current)setError(recovery);}}
      else if([401,403].includes(e.status)&&!e.responseUncertain)forget(e.message);else setRefreshWarning('Actualisation indisponible. Les derniers résultats confirmés restent affichés.');}}
    finally{passiveRunning.current=false;}
  }
  function hub(){
    if(running.current||pending.current)return;
    setMode('hub');refreshDetail();
  }
  async function transmit(){
    const command=pending.current,version=epoch.current;
    if(!command||running.current||!session.current)return;
    ++serial.current;focusReturn.current=document.activeElement;focusRequested.current=true;
    running.current=true;setBusy(true);setError(null);
    try{
      const next=await read(command.path,command.body);
      const boot=role==='enseignant'?await read(root):null;
      if(version!==epoch.current)return;
      commitDetail(next);if(boot)commitList(boot);
      if(role==='eleve'&&next.attempt?.phase==='results')setMode('result');
      pending.current=null;command.resolve({ok:true,challenge:next.challenge});
    }catch(e){
      if(version!==epoch.current)return;
      if([401,403].includes(e.status)&&!e.responseUncertain){forget(e.message);return;}
      setError(e);
      if(e.status>=400&&e.status<500&&!e.responseUncertain){
        pending.current=null;command.resolve({ok:false,message:e.message});
        if(e.status===404){try{await recoverList(version);}catch(recovery){if(version===epoch.current)setError(recovery);}}
      }
      // Unknown outcomes keep both the original UUID and the original promise.
      // The same retry resolves the original form only after confirmation.
    }finally{if(version===epoch.current){running.current=false;setBusy(false);}}
  }
  function send(path,body){
    if(running.current||pending.current||error||!session.current)return Promise.resolve({ok:false,message:'Un envoi attend sa confirmation.'});
    return new Promise(resolve=>{pending.current={path,body:{requestId:crypto.randomUUID(),...body},resolve};transmit();});
  }
  function play(action,selectedIndex){
    const active=current.current;if(!active)return;
    return send(root+'/'+active.challenge.id+'/'+action,action==='start'?{comfortMode}:{revision:active.attempt.revision,...(action==='answer'?{index:active.attempt.index,selectedIndex}:{})});
  }
  function moreList(){
    return readOperation(async version=>{
      const prior=list.current,next=await read(root+'?offset='+prior.nextOffset);if(version!==epoch.current)return;
      if(JSON.stringify(next.classes)!==JSON.stringify(prior.classes)){await recoverList(version);return;}
      if(next.counts.total!==prior.counts.total||next.counts.active!==prior.counts.active)throw new Error('La liste des défis a changé. Actualise avant de poursuivre.');
      commitList({...next,challenges:[...prior.challenges,...next.challenges.filter(item=>!prior.challenges.some(p=>p.id===item.id))]});
    });
  }
  function moreRanking(){
    return readOperation(async version=>{
      const prior=current.current,next=await read(root+'/'+prior.challenge.id+'?rankingOffset='+prior.leaderboard.nextOffset+'&rankingVersion='+prior.leaderboard.version);
      if(version!==epoch.current)return;
      commitDetail({...next,leaderboard:{...next.leaderboard,rows:[...prior.leaderboard.rows,...next.leaderboard.rows]}});
    });
  }
  const attempt=detail?.attempt,phase=attempt?.phase??'welcome',playing=role==='eleve'&&mode==='quiz';
  useEffect(()=>{if(!playing||phase!=='question')return;const timer=setInterval(()=>setTick(Date.now()),250);return()=>clearInterval(timer);},[playing,phase,attempt?.index]);
  const duration=attempt?.durationSeconds??(comfortMode?20:10);
  const remaining=phase==='question'?Math.min(duration,Math.max(0,Math.ceil((attempt.questionStartedAt+duration*1000-(tick+(detail?.clockOffset??0)))/1000))):attempt?.answers.at(-1)?.remainingSeconds??0;
  useEffect(()=>{if(playing&&phase==='question'&&remaining===0&&!busy&&!error)play('answer',null);},[playing,phase,remaining,busy,error,attempt?.revision]);
  useEffect(()=>{
    if(!playing||phase!=='question'||busy||error)return;
    const key=e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const index=Number(e.key)-1;if(index>=0&&index<4){e.preventDefault();play('answer',index);}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[playing,phase,busy,error,attempt?.revision]);
  // Refresh visible rankings, not timer state, without creating background writes.
  useEffect(()=>{const timer=setInterval(()=>{if(!playing&&!document.hidden&&!error)refreshPassive();},30000);return()=>clearInterval(timer);},[playing,error]);
  useEffect(()=>{
    if(busy||!focusRequested.current)return;
    focusRequested.current=false;
    const id=requestAnimationFrame(()=>{
      if(error){sync.current?.querySelector('button')?.focus();return;}
      const previous=focusReturn.current;
      if(previous?.isConnected&&previous.matches('button,a,input,select,textarea,[tabindex]')&&!previous.disabled&&!previous.closest('[inert]')){previous.focus({preventScroll:true});return;}
      const target=frame.current?.querySelector('.cq-next-button, h1');
      if(target){if(target.tagName==='H1')target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
    });
    return()=>cancelAnimationFrame(id);
  },[busy,error,mode,attempt?.phase,attempt?.index]);
  if(!data)return <main className="pilot-main"><h1>Défis de classe</h1><p role={error?'alert':'status'}>{error?.message||'Ouverture des défis de ta classe…'}</p>{error&&<button className="button button-light" onClick={()=>setGeneration(v=>v+1)}>Réessayer</button>}<a className="button button-dark" href={home}>Revenir à mon espace</a></main>;
  const challenge=detail?.challenge;
  const experience={...DEFAULT_EXPERIENCE,quizId:'defi-classe:'+challenge?.id,source:'defi-classe',
    welcomeKicker:'Défi de la classe',title:'Ensemble pour',titleEmphasis:' '+(challenge?.title??''),
    description:'Cinq questions de la banque « '+(challenge?.bankLabel??'')+' ». Ton score apparaîtra seulement sous un pseudonyme, dans '+(challenge?.classLabel??'')+'.',
    canRestart:false,completionBonus:0,illustrationSrc:'/assets/games/class-challenges/defis-classes-hero.webp'};
  let streak=0;for(const a of [...(attempt?.answers??[])].reverse()){if(!a.isCorrect)break;streak++;}
  const quiz=<div className={'culture-quiz cq-phase-'+phase}>
    <QuizTopbar phase={phase} questionNumber={(attempt?.index??0)+1} questionTotal={5} streak={streak} xp={attempt?.summary.xpEarned??0} onExit={hub}/>
    {phase==='welcome'&&<WelcomeScreen questionTotal={5} comfortMode={comfortMode} onComfortChange={setComfortMode} onStart={()=>play('start')} experience={experience}/>}
    {(phase==='question'||phase==='feedback')&&<QuestionScreen question={attempt.questions[attempt.index]} questionNumber={attempt.index+1} questionTotal={5} phase={phase} timeLeft={remaining} duration={duration} answer={phase==='feedback'?attempt.answers.at(-1):null} onSelect={i=>play('answer',i)} onContinue={()=>play('next')}/>}
  </div>;
  const model={...data,detail,mode,setMode:hub,open,quiz,
    listPages:data.nextOffset!==null?<button type="button" className="button button-light" onClick={moreList}>Voir les défis suivants</button>:null,
    rankingPages:detail?.leaderboard.nextOffset!=null?<button type="button" className="button button-light" onClick={moreRanking}>Voir la suite du classement</button>:null};
  return <>
    <div ref={frame} inert={busy||Boolean(error)?true:undefined} aria-busy={busy}>
      {role==='enseignant'?<ClassChallengesTeacher school={model} challenges={data.challenges}
        onCreate={draft=>send(root+'/create',{classId:draft.classId,title:draft.title,theme:draft.theme,bankId:draft.bankId,durationHours:draft.durationHours})}
        onFinish={id=>send(root+'/'+id+'/close',{revision:data.challenges.find(c=>c.id===id)?.revision})}/>:
        <ClassChallengesStudent school={model} challenges={data.challenges} currentXp={detail?.xpTotal??data.xpTotal} onExit={exit}/>}
    </div>
    {refreshWarning&&!error&&<p className="school-library-note" role="status">{refreshWarning}</p>}
    {(busy||error)&&<div ref={sync} className="pilot-game-sync school-quiz-sync" role={error?'alert':'status'}>{error?.message||'Confirmation auprès du serveur…'}
      {error&&<><button className="button button-light" onClick={()=>pending.current?transmit():refreshDetail()}>{pending.current?'Réessayer le même envoi':'Recharger le défi enregistré'}</button><a href={home}>Revenir à mon espace</a></>}
    </div>}
  </>;
}
