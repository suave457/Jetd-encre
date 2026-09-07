import {useEffect,useRef,useState} from 'react';
import {MissionZelligeView} from '../games/mission-zellige/MissionZellige.jsx';
import {moveSentencePiece} from '../games/mission-zellige/missionZelligeEngine.js';
import {schoolApi as call} from './schoolApi.js';
import './pilot.css';
import './school-quiz.css';

const home='/pilote?profil=eleve&section=jeux',prefix='/games/mission-zellige';
function owner(data,session){
  if(data.userId!==session.user.id||data.schoolId!==session.user.schoolId)throw Object.assign(new Error('Le compte a changé. Reviens à ton espace.'),{status:403});
  return data;
}
function transcriptPreference(){try{return localStorage.getItem('jde.mission-zellige:transcript-visible')==='true';}catch{return false;}}

// The original view is shared with the demo. Identity, drafts, answers and XP
// here come exclusively from the school service, never from DemoProvider.
export default function SchoolZellige(){
  const [ready,setReady]=useState(null),[missionIndex,setMissionIndex]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const [speaking,setSpeaking]=useState(false),[showTranscript,setShowTranscript]=useState(transcriptPreference),[localFeedback,setLocalFeedback]=useState(null),[builderAnnouncement,setBuilderAnnouncement]=useState('');
  const identity=useRef(null),abort=useRef(null),epoch=useRef(0),pending=useRef(null),running=useRef(false),snapshot=useRef(null),selected=useRef(null),audioEpoch=useRef(0),pendingFocus=useRef(null);
  const finishButtonRef=useRef(null),missionTitleRef=useRef(null),sentenceHeadingRef=useRef(null),completionHeadingRef=useRef(null);
  const stopAudio=()=>{++audioEpoch.current;if('speechSynthesis' in window)window.speechSynthesis.cancel();setSpeaking(false);};
  const invalidate=message=>{++epoch.current;abort.current?.abort();identity.current=null;snapshot.current=null;pending.current=null;running.current=false;stopAudio();setReady(null);setBusy(false);setError(message);};
  useEffect(()=>{
    const version=++epoch.current,controller=new AbortController();abort.current=controller;
    identity.current=null;snapshot.current=null;pending.current=null;running.current=false;setReady(null);setBusy(false);setError('');setSpeaking(false);
    async function load(){try{
      const session=await call('/session?profil=eleve',{signal:controller.signal});
      if(!session.authenticated||session.user?.role!=='eleve')throw new Error('Connecte-toi avec ton compte élève pour retrouver tes missions.');
      const data=owner(await call(prefix,{signal:controller.signal}),session);
      if(version!==epoch.current||controller.signal.aborted)return;
      identity.current=session;snapshot.current=data;setReady(data);
      const index=selected.current??data.daily.missionIndex;selected.current=index;setMissionIndex(index);pendingFocus.current='mission';
    }catch(e){if(version===epoch.current&&!controller.signal.aborted)setError(e.message);}}
    const focused=async()=>{
      if(!identity.current||controller.signal.aborted)return;const previous=identity.current;
      try{const session=await call('/session?profil=eleve',{signal:controller.signal});
        if(version!==epoch.current||controller.signal.aborted)return;
        if(!session.authenticated||session.user?.role!=='eleve'||session.user.id!==previous.user.id||session.user.schoolId!==previous.user.schoolId||session.csrfToken!==previous.csrfToken)invalidate('Le compte a changé. Reviens à ton espace avant de continuer.');
      }catch(e){if(version===epoch.current&&!controller.signal.aborted){if([401,403].includes(e.status))invalidate(e.message);else setError('Le compte ne peut pas être revérifié. Réessaie avant de continuer.');}}
    };
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('jde-pilot-session'):null;
    if(channel)channel.onmessage=()=>invalidate('La session a changé dans un autre onglet. Reviens à ton espace.');
    const leaving=e=>{if(pending.current){e.preventDefault();e.returnValue='';}};
    document.title='Mission Zellige · Jet d’Encre';load();window.addEventListener('focus',focused);window.addEventListener('beforeunload',leaving);
    return()=>{++epoch.current;controller.abort();channel?.close();++audioEpoch.current;if('speechSynthesis' in window)window.speechSynthesis.cancel();window.removeEventListener('focus',focused);window.removeEventListener('beforeunload',leaving);};
  },[retry]);
  useEffect(()=>{try{localStorage.setItem('jde.mission-zellige:transcript-visible',String(showTranscript));}catch{/* Device preference only. */}},[showTranscript]);
  async function transmit(){
    if(running.current||!pending.current||!identity.current)return;
    const operation=pending.current,session=identity.current,version=epoch.current;running.current=true;setBusy(true);setError('');
    try{
      const data=owner(await call(operation.path,{body:operation.body,csrf:session.csrfToken,signal:abort.current.signal}),session);
      if(version!==epoch.current||abort.current.signal.aborted)return;
      const before=snapshot.current.missions[selected.current].state,after=data.missions[selected.current].state;
      snapshot.current=data;setReady(data);pending.current=null;setLocalFeedback(null);
      setBuilderAnnouncement(operation.announcement||'');
      pendingFocus.current=after.phase!==before.phase?after.phase==='location'?'mission':after.phase:after.sentenceSolved&&!before.sentenceSolved?'finish':operation.focus;
    }catch(e){
      if(version!==epoch.current||abort.current.signal.aborted)return;
      if([401,403].includes(e.status)&&!e.responseUncertain){invalidate(e.message);return;}
      setError(e.message);
      // An unknown outcome must retry the exact same UUID, revision and payload.
      if(e.status>=400&&e.status<500&&!e.responseUncertain)pending.current=null;
    }finally{if(version===epoch.current){running.current=false;setBusy(false);}}
  }
  function perform(action,data={},announcement='',focus=null){
    if(running.current||pending.current||error||!identity.current)return;
    const boot=snapshot.current,entry=boot?.missions[selected.current];if(!entry)return;
    pending.current={path:`${prefix}/${boot.daily.dateKey}/${entry.mission.id}/${action}`,body:{requestId:crypto.randomUUID(),revision:entry.state.revision,...data},announcement,focus:focus??document.activeElement};
    transmit();
  }
  const entry=ready?.missions[missionIndex],mission=entry?.mission,state=entry?.state,phase=state?.phase;
  useEffect(()=>{
    if(busy||error||!state)return;
    const target=pendingFocus.current;pendingFocus.current=null;
    if(typeof target==='string'&&target.startsWith('radio:'))document.querySelectorAll('.mz-option-list [role="radio"]')[Number(target.slice(6))]?.focus();
    else if(target==='finish')finishButtonRef.current?.focus({preventScroll:true});
    else if(target==='mission')missionTitleRef.current?.focus({preventScroll:true});
    else if(target==='sentence')sentenceHeadingRef.current?.focus({preventScroll:true});
    else if(target==='complete')completionHeadingRef.current?.focus({preventScroll:true});
    else if(target instanceof HTMLElement){
      if(target.isConnected&&!target.disabled)target.focus({preventScroll:true});
      else if(target.isConnected)target.parentElement?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
      else (document.querySelector('.mz-piece-bank button')||sentenceHeadingRef.current)?.focus({preventScroll:true});
    }
  },[busy,error,phase,state?.sentenceSolved,missionIndex,ready]);
  function resetForMission(index,{replay=false}={}){
    if(busy||error||pending.current)return;
    stopAudio();setLocalFeedback(null);setBuilderAnnouncement('');selected.current=index;setMissionIndex(index);pendingFocus.current='mission';
    if(replay)perform('restart',{},'','mission');
  }
  function toggleClue(){
    if(!('speechSynthesis' in window)){setShowTranscript(true);setLocalFeedback({kind:'info',text:'La lecture audio n’est pas disponible sur cet appareil. Le texte de l’indice est maintenant affiché.'});return;}
    if(speaking){stopAudio();return;}
    stopAudio();const version=audioEpoch.current,utterance=new SpeechSynthesisUtterance(mission.clue);utterance.lang='fr-MA';utterance.rate=0.9;
    utterance.onend=()=>{if(version===audioEpoch.current)setSpeaking(false);};
    utterance.onerror=()=>{if(version!==audioEpoch.current)return;setSpeaking(false);setShowTranscript(true);setLocalFeedback({kind:'info',text:'L’audio s’est interrompu. Tu peux lire le texte de l’indice à la place.'});};
    window.speechSynthesis.speak(utterance);setSpeaking(true);
  }
  function chooseHotspot(id,focus=null){if(phase==='location'&&!state.locationSolved)perform('draft',{selectedHotspot:id},'',focus);}
  function handleRadioKeyDown(event,id,index){
    if(['Enter',' '].includes(event.key)){event.preventDefault();chooseHotspot(id,`radio:${index}`);return;}
    const direction=['ArrowRight','ArrowDown'].includes(event.key)?1:['ArrowLeft','ArrowUp'].includes(event.key)?-1:0;
    const boundary=event.key==='Home'?0:event.key==='End'?mission.hotspots.length-1:null;if(!direction&&boundary===null)return;
    event.preventDefault();const next=boundary??(index+direction+mission.hotspots.length)%mission.hotspots.length;chooseHotspot(mission.hotspots[next].id,`radio:${next}`);
  }
  const draft=(pieces,announcement)=>{if(phase==='sentence'&&!state.sentenceSolved)perform('draft',{orderedPieces:pieces},announcement);};
  if(!ready)return <main className="pilot-main"><h1>Mission Zellige</h1><p role={error?'alert':'status'}>{error||'Ouverture de ta mission…'}</p>{error&&<button className="button button-light" onClick={()=>setRetry(v=>v+1)}>Réessayer</button>}<a className="button button-dark" href={home}>Revenir à mes jeux</a></main>;
  const {orderedPieces}=state,pieceText=id=>mission.pieces.find(p=>p.id===id)?.text||'Groupe de mots';
  const model={...state,currentXp:ready.xpTotal,daily:ready.daily,missionIndex,mission,missions:ready.missions.map(e=>e.mission),
    isDailyMission:missionIndex===ready.daily.missionIndex,studentName:identity.current.user.name?.split(/[ ·]/)[0]||'à toi',fragmentCount:ready.fragmentCount,
    availablePieces:mission.pieces.filter(p=>!orderedPieces.includes(p.id)),sentence:orderedPieces.map(pieceText).join(' ').replace(/\s+([?.!,])/g,'$1'),
    selectedOption:mission.hotspots.find(h=>h.id===state.selectedHotspot),phaseLabel:phase==='location'?'1 · Observer':phase==='sentence'?'2 · Construire':'Mission accomplie',
    builderAnnouncement,feedback:localFeedback||state.feedback,speaking,showTranscript,finishButtonRef,missionTitleRef,sentenceHeadingRef,completionHeadingRef,
    exitMission:()=>{stopAudio();window.location.assign(home);},resetForMission,toggleTranscript:()=>setShowTranscript(v=>!v),toggleClue,chooseHotspot,handleRadioKeyDown,
    validateLocation:()=>perform('location',{hotspotId:state.selectedHotspot}),validateSentence:()=>perform('sentence',{orderedPieces}),finishMission:()=>perform('finish'),
    addPiece:id=>{if(!orderedPieces.includes(id))draft([...orderedPieces,id],`« ${pieceText(id)} » ajouté, position ${orderedPieces.length+1} sur ${mission.pieces.length}.`);},
    removePiece:id=>draft(orderedPieces.filter(p=>p!==id),`« ${pieceText(id)} » retiré de la phrase.`),
    movePiece:(index,direction)=>{const next=moveSentencePiece(orderedPieces,index,direction);draft(next,`« ${pieceText(orderedPieces[index])} » déplacé en position ${next.indexOf(orderedPieces[index])+1} sur ${next.length}.`);},
    resetSentence:()=>draft([],'La phrase a été effacée. Recommence avec le premier groupe de mots.')};
  return <><div inert={busy||Boolean(error)?true:undefined} aria-busy={busy}><MissionZelligeView model={model}/></div>
    {(busy||error)&&<div className="pilot-game-sync school-quiz-sync" role={error?'alert':'status'}>{error||'Enregistrement sur ton compte…'}
      {error&&<><button className="button button-light" onClick={()=>pending.current?transmit():setRetry(v=>v+1)}>{pending.current?'Réessayer le même envoi':'Recharger la partie enregistrée'}</button><a href={home}>Revenir à mes jeux</a></>}
    </div>}</>;
}
