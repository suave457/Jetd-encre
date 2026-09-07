import {useEffect,useRef,useState} from 'react';
import {MarketShopView,DEFAULT_ASSETS} from '../games/market-shop/MarketShopGame.jsx';
import {getMarketProduct} from '../games/market-shop/marketShopData.js';
import {schoolApi as call} from './schoolApi.js';
import './pilot.css';
import './school-quiz.css';

const home='/pilote?profil=eleve&section=jeux',prefix='/games/souk-des-mots';
function owner(data,session){
 if(data.userId!==session.user.id||data.schoolId!==session.user.schoolId)throw Object.assign(new Error('Le compte a changé. Reviens à ton espace.'),{status:403});
 return data;
}
// Original presentation; all progress and rewards are confirmed by the school service.
export default function SchoolMarket(){
 const [ready,setReady]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const [speaking,setSpeaking]=useState(false),[audioNotice,setAudioNotice]=useState('');
 const identity=useRef(null),snapshot=useRef(null),abort=useRef(null),epoch=useRef(0),pending=useRef(null),running=useRef(false),audioEpoch=useRef(0),pendingFocus=useRef(null);
 const stopAudio=()=>{++audioEpoch.current;if('speechSynthesis' in window)window.speechSynthesis.cancel();setSpeaking(false);};
 const invalidate=message=>{++epoch.current;abort.current?.abort();identity.current=null;snapshot.current=null;pending.current=null;running.current=false;stopAudio();setReady(null);setBusy(false);setError(message);};
 useEffect(()=>{
  const version=++epoch.current,controller=new AbortController();abort.current=controller;
  identity.current=null;snapshot.current=null;pending.current=null;running.current=false;setReady(null);setBusy(false);setError('');setSpeaking(false);setAudioNotice('');
  async function load(){try{
   const session=await call('/session?profil=eleve',{signal:controller.signal});
   if(!session.authenticated||session.user?.role!=='eleve')throw new Error('Connecte-toi avec ton compte élève pour retrouver tes missions.');
   const data=owner(await call(prefix,{signal:controller.signal}),session);
   if(version!==epoch.current||controller.signal.aborted)return;
   identity.current=session;snapshot.current=data;setReady(data);pendingFocus.current='main';
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
  document.title='Le Souk des mots · Jet d’Encre';load();window.addEventListener('focus',focused);window.addEventListener('beforeunload',leaving);
  return()=>{++epoch.current;controller.abort();channel?.close();++audioEpoch.current;if('speechSynthesis' in window)window.speechSynthesis.cancel();window.removeEventListener('focus',focused);window.removeEventListener('beforeunload',leaving);};
 },[retry]);
 async function transmit(){
  if(running.current||!pending.current||!identity.current)return;
  const operation=pending.current,session=identity.current,version=epoch.current;running.current=true;setBusy(true);setError('');
  try{
   const data=owner(await call(operation.path,{body:operation.body,csrf:session.csrfToken,signal:abort.current.signal}),session);
   if(version!==epoch.current||abort.current.signal.aborted)return;
   const before=snapshot.current.state;
   pendingFocus.current=data.state.screen!==before.screen||operation.action==='open'||operation.action==='next'?'main':operation.focus;
   snapshot.current=data;setReady(data);pending.current=null;
  }catch(e){
   if(version!==epoch.current||abort.current.signal.aborted)return;
   if([401,403].includes(e.status)&&!e.responseUncertain){invalidate(e.message);return;}
   setError(e.message);
   // Keep the identical payload for network failures and uncertain responses.
   if(e.status>=400&&e.status<500&&!e.responseUncertain)pending.current=null;
  }finally{if(version===epoch.current){running.current=false;setBusy(false);}}
 }
 function perform(action,data={}){
  if(running.current||pending.current||error||!identity.current)return;
  if(['open','next','journey','replay'].includes(action)){stopAudio();setAudioNotice('');}
  pending.current={action,path:prefix+'/'+action,body:{requestId:crypto.randomUUID(),revision:snapshot.current.revision,...data},focus:document.activeElement};
  transmit();
 }
 useEffect(()=>{
  if(busy||error||!ready)return;
  const target=pendingFocus.current;pendingFocus.current=null;
  if(target==='main'){const main=document.getElementById('ms-main');if(main){main.tabIndex=-1;main.focus({preventScroll:true});}}
  else if(target instanceof HTMLElement&&target.isConnected&&!target.disabled)target.focus({preventScroll:true});
  else if(target instanceof HTMLElement){(target.isConnected&&target.parentElement?.querySelector('button:not(:disabled)')||document.querySelector('.ms-next')||document.querySelector('.ms-basket-dock button:not(:disabled)'))?.focus({preventScroll:true});}
 },[ready,busy,error]);
 if(!ready)return <main className="pilot-main"><h1>Le Souk des mots</h1><p role={error?'alert':'status'}>{error||'Ouverture de tes paliers…'}</p>{error&&<button className="button button-light" onClick={()=>setRetry(v=>v+1)}>Réessayer</button>}<a className="button button-dark" href={home}>Revenir à mes jeux</a></main>;
 const state=ready.state,activeTier=ready.tiers.find(t=>t.id===state.activeTierId),r=state.runs[state.activeTierId];
 const mission=activeTier&&ready.missions.find(m=>m.id===activeTier.missionIds[r.index]);
 function listenToMission(){
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){setAudioNotice('La lecture audio n’est pas disponible sur cet appareil. Tu peux lire la consigne affichée.');return;}
  if(speaking){stopAudio();return;}
  stopAudio();const version=audioEpoch.current,utterance=new SpeechSynthesisUtterance(mission.audioInstruction||mission.instruction);utterance.lang='fr-MA';utterance.rate=0.88;
  utterance.onend=()=>{if(version===audioEpoch.current)setSpeaking(false);};
  utterance.onerror=()=>{if(version!==audioEpoch.current)return;setSpeaking(false);setAudioNotice('L’audio s’est interrompu. Tu peux lire la consigne affichée.');};
  try{window.speechSynthesis.speak(utterance);setSpeaking(true);}catch{setAudioNotice('La lecture audio est indisponible. Tu peux lire la consigne affichée.');}
 }
 const model={...state,...(r||{}),profileXp:ready.xpTotal,sessionXp:r?.results.reduce((n,x)=>n+x.xpEarned,0)||0,assets:DEFAULT_ASSETS,
  completedTierCount:ready.tiers.filter(t=>t.status==='completed').length,tierProgress:ready.tiers,
  reviewTierId:r?.review?activeTier.id:null,mission,activeTier,activeTierMissionIndex:r?.index??0,
  products:mission?mission.productIds.slice(0,mission.difficulty.visibleProductCount).map(getMarketProduct).filter(Boolean):[],
  isReviewMode:Boolean(r?.review),isLastTierMission:r?.index===activeTier?.missionIds.length-1,isFinalTier:activeTier?.id===ready.tiers.at(-1).id,
  speaking,audioNotice,listenToMission,exitGame:()=>{stopAudio();window.location.assign(home);},
  openTier:id=>perform('open',{tierId:typeof id==='string'?id:id.id}),showJourney:()=>perform('journey'),replay:()=>perform('replay'),
  changeQuantity:(productId,delta)=>perform('quantity',{productId,delta}),changeFormula:formulaId=>perform('formula',{formulaId}),
  revealHelp:()=>perform('help'),validateMission:()=>perform('validate'),advance:()=>perform('next')};
 return <><div inert={busy||Boolean(error)?true:undefined} aria-busy={busy}><MarketShopView model={model}/></div>
  {(busy||error)&&<div className="pilot-game-sync school-quiz-sync" role={error?'alert':'status'}>{error||'Enregistrement sur ton compte…'}
   {error&&<><button className="button button-light" onClick={()=>pending.current?transmit():setRetry(v=>v+1)}>{pending.current?'Réessayer le même envoi':'Recharger la partie enregistrée'}</button><a href={home}>Revenir à mes jeux</a></>}
  </div>}</>;
}
