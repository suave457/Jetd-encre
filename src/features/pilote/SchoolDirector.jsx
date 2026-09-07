import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {ArrowsClockwise,Buildings,ChalkboardTeacher,FileText,Gauge,House,ListChecks,Student,Users,UsersThree} from '@phosphor-icons/react/ssr';
import SchoolShell from './SchoolShell.jsx';
import SchoolDirectorPages,{DIRECTOR_TITLES} from './SchoolDirectorPages.jsx';
import {directorCsv,directorPath,directorSelection} from './directorCore.js';
import {schoolApi} from './schoolApi.js';
import {announceSchoolLogout} from './schoolLogout.js';
import {getAutomaticSignInPath,getProfileQuery,getProfileSignInPath,getSignInFailure} from './schoolNavigationCore.js';
import {localRecipePath} from './localRecipePath.js';
import './director.css';

const menus=[['accueil',House],['actions',ListChecks],['classes',ChalkboardTeacher],['enseignants',UsersThree],['affectations',Users],['eleves',Student],['suivi-utilisation',Gauge],['etablissement',Buildings],['rapports',FileText]].map(([id,Icon])=>({id,Icon,label:DIRECTOR_TITLES[id],href:directorPath(id)}));
const DirectorNavigation=createContext(null);
function DirectorLink({to,children,...props}){const navigate=useContext(DirectorNavigation);return <a href={to} {...props} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate(to);}}}>{children}</a>;}
const identity=value=>value?.authenticated?[value.user.id,value.user.schoolId,value.user.role].join(':'):null;
export default function SchoolDirector(){
 const [session,setSession]=useState(null),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(window.location.search),[days,setDays]=useState('7');
 const selection=directorSelection(search),epoch=useRef(0),abort=useRef(null),running=useRef(false),sessionRef=useRef(null),logoutSession=useRef(null),refreshRef=useRef(null),returnFocus=useRef(null),heading=useRef(null);
 const user=session?.authenticated?session.user:null;
 function clear({preserveLogout=false}={}){if(!preserveLogout)logoutSession.current=null;sessionRef.current=null;setSession(null);setSnapshot(null);setNotice('');}
 async function refresh({passive=false}={}){
  if(running.current&&passive)return null;
  const ticket=++epoch.current,controller=new AbortController();abort.current?.abort();abort.current=controller;running.current=true;
  if(!passive){returnFocus.current=document.activeElement;setBusy(true);}setError('');
  try{
   const failure=getSignInFailure(window.location.search);if(failure)throw new Error(failure);
   const next=await schoolApi('/session'+getProfileQuery(window.location.search),{signal:controller.signal});
   if(ticket!==epoch.current||controller.signal.aborted)return null;
   const start=getAutomaticSignInPath(next,window.location.search,'directeur');
   if(start){window.location.replace(start);return null;}
   if(!next.authenticated){clear();setSession(next);return null;}
   if(next.user.role!=='directeur')throw new Error('Ce compte ne dispose pas d’un accès à cet espace Direction.');
   logoutSession.current=next;
   const clean=new URL(location.href);if(clean.searchParams.getAll('connexion').length===1&&clean.searchParams.get('connexion')==='1'){clean.searchParams.delete('connexion');history.replaceState(null,'',clean.pathname+clean.search);setSearch(clean.search);}
   if(identity(next)!==identity(sessionRef.current))setSnapshot(null);
   const data=await schoolApi('/director',{signal:controller.signal});
   if(ticket!==epoch.current||controller.signal.aborted)return null;
   if(data.userId!==next.user.id||data.schoolId!==next.user.schoolId||data.role!=='directeur'||!['pilot_local_fixture','pilot_database'].includes(data.source))throw new Error('Le suivi ne correspond pas au compte connecté.');
   sessionRef.current=next;setSession(next);setSnapshot(data);
   return {data,identity:identity(next),ticket};
  }catch(e){if(ticket===epoch.current&&!controller.signal.aborted){clear({preserveLogout:true});setError(e.message||'Le suivi ne peut pas être confirmé. Aucun ancien résultat n’est affiché.');}return null;}
  finally{if(ticket===epoch.current){running.current=false;setBusy(false);}}
 }
 refreshRef.current=refresh;
 useEffect(()=>{
  refreshRef.current();const update=()=>{setSearch(location.search);setSnapshot(null);refreshRef.current();};
  const focus=()=>refreshRef.current({passive:true}),timer=setInterval(()=>{if(!document.hidden)focus();},60000);
  const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('jde-pilot-session');
  if(channel)channel.onmessage=()=>{if(!sessionRef.current&&!logoutSession.current)return;++epoch.current;abort.current?.abort();running.current=false;clear();setBusy(false);setError('La session a changé dans un autre onglet. Reconnectez-vous dans votre espace.');};
  window.addEventListener('popstate',update);window.addEventListener('focus',focus);
  return()=>{++epoch.current;abort.current?.abort();running.current=false;clearInterval(timer);channel?.close();window.removeEventListener('popstate',update);window.removeEventListener('focus',focus);};
 },[]);
 useEffect(()=>{document.title=(DIRECTOR_TITLES[selection.section]||'Direction')+' · Jet d’Encre';document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,nofollow');},[search]);
 useEffect(()=>{if(busy)return;const frame=requestAnimationFrame(()=>{const element=returnFocus.current;if(document.activeElement===document.body&&element?.isConnected&&!element.disabled&&!element.closest('[inert],[hidden]'))element.focus({preventScroll:true});returnFocus.current=null;});return()=>cancelAnimationFrame(frame);},[busy]);
 function navigate(target){
  const url=new URL(target,location.origin);
  if(url.origin!==location.origin||url.pathname!=='/pilote'){location.assign(target);return;}
  if(busy)return;
  url.searchParams.set('profil','directeur');window.history.pushState(null,'',url.pathname+url.search);setSearch(url.search);setNotice('');setSnapshot(null);
  refresh().then(result=>{if(result){heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}});
 }
 async function exportReport(kind){
  if(busy)return;
  const expected=identity(sessionRef.current),path=location.pathname+location.search,period=days,result=await refresh();
  if(!result||result.identity!==expected||result.ticket!==epoch.current||path!==location.pathname+location.search)return;
  const csv=directorCsv(result.data,{kind,days:period}),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='jet-dencre-direction-'+kind+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Export actualisé : établissement connecté, source et période inclus. Conservez ce fichier dans un espace privé.');
 }
 async function logout(){
  if(busy||!logoutSession.current)return;
  const next=logoutSession.current,ticket=++epoch.current;abort.current?.abort();running.current=true;setBusy(true);setError('');
  try{await schoolApi('/logout',{body:{},csrf:next.csrfToken});if(ticket!==epoch.current)return;announceSchoolLogout();clear();setNotice('Déconnexion confirmée.');}
  catch(e){if(ticket===epoch.current){setSnapshot(null);setError('La déconnexion n’a pas été confirmée. Réessayez avant de quitter un appareil partagé.');}}
  finally{if(ticket===epoch.current){running.current=false;setBusy(false);}}
 }
 const signIn=localRecipePath('directeur')||getProfileSignInPath('','directeur');
 return <SchoolShell role="directeur" user={user} nav={menus} activeId={selection.section} onNavigate={navigate} onLogout={logout} busy={busy}>
  <main id="pilot-main" className="app-content director-connected" ref={heading} tabIndex={-1}>
   {error&&<section className="panel" role="alert"><h1>Suivi indisponible</h1><p>{error}</p><button className="button button-light" disabled={busy} onClick={()=>refresh()}>Réessayer</button>{logoutSession.current&&<button className="button button-light" disabled={busy} onClick={logout}>Réessayer la déconnexion</button>}</section>}
   {!user&&!busy&&<section className="panel"><h1>Espace Direction</h1><p>Connectez-vous avec le compte Direction précréé pour votre établissement.</p><a className="button button-dark" href={signIn}>Se connecter à la Direction</a><a className="button button-light" href="/connexion">Choisir un autre profil</a></section>}
   {notice&&<p className="school-library-note" role="status">{notice}</p>}
   {busy&&<p className="school-library-note" role="status">Vérification de l’accès et actualisation du suivi…</p>}
   {snapshot&&user&&<div inert={busy?true:undefined} aria-busy={busy}>
    <div className="director-source"><span>{snapshot.source==='pilot_local_fixture'?'Recette locale · données fictives':'Données scolaires enregistrées'} · actualisé le {new Date(snapshot.generatedAt).toLocaleString('fr-MA',{timeZone:'Africa/Casablanca'})}</span><button className="button button-light" onClick={()=>refresh()}><ArrowsClockwise/> Actualiser</button></div>
    <DirectorNavigation.Provider value={navigate}><SchoolDirectorPages key={selection.section+':'+(selection.detail||'')} snapshot={snapshot} user={user} selection={selection} days={days} onDays={setDays} onExport={exportReport} Link={DirectorLink}/></DirectorNavigation.Provider>
    <details className="school-library-note"><summary>Source et définitions des indicateurs</summary>{Object.entries(snapshot.definitions).map(([key,value])=><p key={key}>{value}</p>)}</details>
   </div>}
  </main>
 </SchoolShell>;
}
