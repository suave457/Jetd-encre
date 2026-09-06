import { useCallback, useEffect, useRef, useState } from 'react';
import MotsFlechesGame from '../games/mots-fleches/MotsFlechesGame.jsx';
import { MOTS_FLECHES_GRIDS } from '../games/mots-fleches/motsFlechesData.js';
import { buildMotsFlechesAwardId } from '../games/mots-fleches/motsFlechesEngine.js';
import { GameSync } from './gameSync.js';
import './pilot.css';

export async function gameApi(path,{signal,body,csrf}={}) {
  const response=await fetch('/api/pilot'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error?.message||'La sauvegarde attend la connexion. Réessaie.'),{status:response.status,data});
  return data;
}
export default function PilotCrosswords() {
  const [ready,setReady]=useState(null),[error,setError]=useState(''),[state,setState]=useState(null),[generation,setGeneration]=useState(0);
  const sync=useRef(null),timer=useRef(null),abort=useRef(null),session=useRef(null);
  useEffect(()=>{
    document.title='Mes mots fléchés · Jet d’Encre';document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,nofollow');
    const controller=new AbortController();abort.current=controller;let active=true;
    const invalidate=()=>{if(!active)return;sync.current?.dispose();controller.abort();setReady(null);setState(null);setError('Le compte a changé ou la session a expiré. Reviens à ton espace pour te reconnecter.');};
    async function load() {
      try {
        const identity=await gameApi('/session',{signal:controller.signal});
        if(!identity.authenticated||identity.user.role!=='eleve')throw new Error('Connecte-toi avec le compte élève fourni par ton école.');
        const initial=await gameApi('/games/mots-fleches/progress',{signal:controller.signal});
        if(!active)return;session.current=identity;
        // Pending answers belong to this tab: an idle second tab must not erase
        // them. sessionStorage survives reloads; only server saves survive closing.
        let storage;try{storage=window.sessionStorage;}catch{}
        const client=new GameSync({userId:identity.user.id,schoolId:identity.user.schoolId,initial,storage,onChange:next=>{if(active){setState(next);if([401,403].includes(next.error?.status))invalidate();}},send:(id,action,body)=>gameApi(`/games/mots-fleches/${id}/${action}`,{body,csrf:identity.csrfToken,signal:controller.signal})});
        sync.current=client;const snapshot=client.snapshot();setState(snapshot);setReady({identity,initial:snapshot});client.flush();
      } catch(e) {if(active&&e.name!=='AbortError')setError(e.message);}
    }
    const online=()=>sync.current?.flush();
    const focused=async()=>{if(!session.current||controller.signal.aborted)return;try{const next=await gameApi('/session',{signal:controller.signal});const old=session.current;if(!next.authenticated||next.user.id!==old.user.id||next.user.schoolId!==old.user.schoolId||next.csrfToken!==old.csrfToken)invalidate();}catch(e){if([401,403].includes(e.status))invalidate();}};
    const leaving=e=>{if(sync.current?.snapshot().pending){e.preventDefault();e.returnValue='';}};
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('jde-pilot-session'):null;if(channel)channel.onmessage=invalidate;
    load();window.addEventListener('online',online);window.addEventListener('focus',focused);window.addEventListener('beforeunload',leaving);
    return()=>{active=false;sync.current?.dispose();controller.abort();clearTimeout(timer.current);channel?.close();window.removeEventListener('online',online);window.removeEventListener('focus',focused);window.removeEventListener('beforeunload',leaving);};
  },[]);
  const changed=useCallback((progress,hints)=>{sync.current?.update(progress,hints);clearTimeout(timer.current);timer.current=setTimeout(()=>sync.current?.flush(),750);},[]);
  const confirm=useCallback(({gridId,progress,hintCount})=>{clearTimeout(timer.current);return sync.current.complete(gridId,progress,hintCount);},[]);
  function resolve(useLocal) {
    sync.current.resolveConflicts(useLocal);const initial=sync.current.snapshot();setReady(previous=>({...previous,initial}));setGeneration(value=>value+1);sync.current.flush();
  }
  if(!ready)return <main className="pilot-main"><h1>Mots fléchés</h1><p role={error?'alert':'status'}>{error||'Chargement de tes grilles sauvegardées…'}</p><a className="button button-dark" href="/pilote">Revenir à mon espace</a></main>;
  const {identity,initial}=ready;
  const awards=state.records.filter(record=>record.completedAt).map(record=>({userId:identity.user.id,id:buildMotsFlechesAwardId(identity.user.id,MOTS_FLECHES_GRIDS.find(grid=>grid.id===record.gridId))}));
  const status=state.conflicts.length?'Autre version à choisir':state.error?'En attente · garde cet onglet ouvert':state.pending?'Enregistrement en cours…':state.storageWarning?'Enregistré · copie locale indisponible':'Sauvegardé sur mon compte';
  return <>
    <MotsFlechesGame key={generation} studentId={identity.user.id} studentName={identity.user.name} currentXp={state.xpTotal} awardHistory={awards} initialProgressByGrid={initial.progressByGrid} initialHintCounts={initial.hintCounts} persistLocally={false} onProgressChange={changed} onConfirmGrid={confirm} onExit={()=>{window.location.assign('/pilote?section=jeux');}} connectionStatus={<span className="pilot-game-sync" role="status">{status}{state.error&&!state.conflicts.length&&<button onClick={()=>sync.current.flush()}>Réessayer</button>}</span>}/>
    {state.conflicts.length>0&&<div className="pilot-game-conflict" role="alert"><strong>Cette grille a changé sur un autre appareil.</strong><p>Ta copie est conservée ici. Choisis la version à garder avant de continuer.</p><button onClick={()=>resolve(false)}>Reprendre la version du compte</button><button onClick={()=>resolve(true)}>Garder mes réponses de cet appareil</button></div>}
  </>;
}

export function useSchoolGameSummary(user,refreshKey) {
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();setData(null);setError('');
    if(!user||!['eleve','parent'].includes(user.role))return;
    gameApi('/games/mots-fleches/summary',{signal:controller.signal}).then(result=>{if(controller.signal.aborted)return;if(result.userId!==user.id||result.schoolId!==user.schoolId)throw new Error('Le compte a changé. Actualise la page.');setData(result);}).catch(e=>{if(e.name!=='AbortError'&&!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[user?.id,user?.schoolId,user?.role,refreshKey]);
  return {data:data?.userId===user?.id&&data?.schoolId===user?.schoolId?data:null,error};
}

export function PilotGameSummary({user,summary}) {
  if(!['eleve','parent'].includes(user.role))return null;
  const {data,error}=summary;
  return <section className="pilot-panel pilot-game-summary"><span className="page-eyebrow">VOCABULAIRE ET RÉFLEXION</span><h2>Mots fléchés</h2><p>18 grilles pour découvrir des mots et jouer avec leurs définitions.</p><div className="school-quick-links" aria-label="Niveaux et récompenses"><div><strong>Facile</strong><p>20 XP par grille</p></div><div><strong>Normal</strong><p>35 XP par grille</p></div><div><strong>Difficile</strong><p>50 XP par grille</p></div></div>{error?<p role="alert">{error}</p>:data?data.children.map(child=><p key={child.studentId}><strong>{child.studentName} · {child.xpTotal} XP</strong> — {child.completedCount} grille{child.completedCount===1?'':'s'} terminée{child.completedCount===1?'':'s'}</p>):<p role="status">Chargement des progrès…</p>}{user.role==='eleve'&&<a className="button button-gold" href="/pilote/jeux/mots-fleches">Jouer aux mots fléchés</a>}<p className="school-library-note">Ta progression est sauvegardée sur ton compte. Chaque grille terminée rapporte sa récompense une seule fois.</p></section>;
}
