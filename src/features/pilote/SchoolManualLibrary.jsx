import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Books,House,Buildings,Key,ChartBar,FileText,ListChecks,ChalkboardTeacher,UsersThree,Users,Student,Gauge} from '@phosphor-icons/react/ssr';
import SchoolShell from './SchoolShell.jsx';
import {schoolMenu} from './SchoolHome.jsx';
import {schoolApi} from './schoolApi.js';
import {announceSchoolLogout,endSchoolSession} from './schoolLogout.js';
import {PdfReader} from '../mediatheque/PdfReader.jsx';
import PageHeader from '../../PageHeader.jsx';
import {localRecipePath} from './localRecipePath.js';
import {DIRECTOR_TITLES} from './SchoolDirectorPages.jsx';
import {directorPath} from './directorCore.js';
import './private-manual.css';
import {libraryPath,privateReadingPath} from './PrivateManualEntry.jsx';

const identity=s=>s?.authenticated?[s.user.id,s.user.schoolId||'',s.user.role].join(':'):null;
function navigation(role){
 if(role==='admin')return [['home','Accueil','/admin/accueil',House],['schools','Écoles et accès','/admin/ecoles-acces',Buildings],['library','Bibliothèque','/admin/bibliotheque',Books],['licences','Licences & codes','/admin/licences',Key],['analytics','Analyses','/admin/analyses',ChartBar],['editorial','Blog & articles','/admin/blog',FileText]].map(([id,label,href,Icon])=>({id,label,href,Icon}));
 if(role==='directeur')return [['accueil',House],['actions',ListChecks],['classes',ChalkboardTeacher],['enseignants',UsersThree],['affectations',Users],['eleves',Student],['suivi-utilisation',Gauge],['etablissement',Buildings],['rapports',FileText]].map(([id,Icon])=>({id,label:DIRECTOR_TITLES[id],href:directorPath(id),Icon}));
 return schoolMenu(role);
}
export default function SchoolManualLibrary(){
 const path=window.location.pathname.replace(/\/$/,''),params=new URLSearchParams(window.location.search),profiles=params.getAll('profil');
 const profile=path==='/admin/bibliotheque'?'admin':profiles.length===1&&['eleve','parent','enseignant','directeur','admin'].includes(profiles[0])?profiles[0]:null;
 const id=path.match(/^\/pilote\/lecture\/([a-zA-Z0-9_-]{1,100})$/)?.[1]||null;
 const [session,setSession]=useState(null),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[notice,setNotice]=useState('');
 const epoch=useRef(0),abort=useRef(null),sessionRef=useRef(null),logoutRef=useRef(null),refreshRef=useRef(null),pageRequests=useRef(new Set()),dataRef=useRef(null);
 const endpoint='/reader'+(id?'/'+id:'');
 const clear=()=>{sessionRef.current=null;dataRef.current=null;for(const request of pageRequests.current)request.abort();pageRequests.current.clear();setSession(null);setData(null);};
 const validate=(value,s)=>{if(value.userId!==s.user.id||value.role!==s.user.role||(value.schoolId||null)!==(s.user.schoolId||null)||!Array.isArray(value.manuals))throw new Error('Le compte attendu n’a pas été confirmé.');return value;};
 const refresh=async()=>{
  const ticket=++epoch.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;
  try{
   if(!profile)throw new Error('Choisissez votre profil pour ouvrir les documents.');
   const s=await schoolApi('/session?profil='+profile,{signal:controller.signal});
   if(ticket!==epoch.current)return;
   if(!s.authenticated){clear();logoutRef.current=null;setError('Connectez-vous dans votre espace pour consulter les documents.');return;}
   logoutRef.current=s;
   if(sessionRef.current&&identity(s)!==identity(sessionRef.current)){clear();throw new Error('Le compte a changé. Rouvrez les documents depuis votre espace.');}
   const result=validate(await schoolApi(endpoint,{signal:controller.signal}),s);
   if(ticket!==epoch.current)return;
   sessionRef.current=s;dataRef.current=result;setSession(s);setData(result);setError('');
  }catch(e){if(ticket===epoch.current&&e.name!=='AbortError'){clear();setError(e.message);}}
  finally{if(ticket===epoch.current)setBusy(false);}
 };
 refreshRef.current=refresh;
 useEffect(()=>{
  refreshRef.current();
  const focus=()=>{refreshRef.current();},timer=setInterval(focus,60000);
  const changed=()=>{if(!sessionRef.current&&!logoutRef.current)return;++epoch.current;abort.current?.abort();clear();logoutRef.current=null;setBusy(false);setError('La session a changé. Reconnectez-vous pour ouvrir vos documents.');};
  window.addEventListener('focus',focus);window.addEventListener('jde:signed-out',changed);
  const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('jde-pilot-session'):null;if(channel)channel.onmessage=changed;
  return()=>{++epoch.current;abort.current?.abort();for(const request of pageRequests.current)request.abort();pageRequests.current.clear();clearInterval(timer);channel?.close();window.removeEventListener('focus',focus);window.removeEventListener('jde:signed-out',changed);};
 },[]);
 const beforeRead=useCallback(async()=>{
  const s=sessionRef.current,version=dataRef.current?.manuals.find(m=>m.id===id)?.version;
  if(!s||!version)throw new Error('Session de lecture absente.');
  const controller=new AbortController();pageRequests.current.add(controller);
  try{
   const result=validate(await schoolApi(endpoint,{signal:controller.signal}),s);
   if(identity(s)!==identity(sessionRef.current)||!result.manuals.some(m=>m.id===id&&m.version===version)||dataRef.current?.manuals.find(m=>m.id===id)?.version!==version)throw new Error('Le document ou le compte a changé.');
  }catch(e){if(!controller.signal.aborted){++epoch.current;abort.current?.abort();clear();setBusy(false);setError('Le droit de lecture n’a pas été confirmé. Actualisez ou reconnectez-vous.');}throw e;}
  finally{pageRequests.current.delete(controller);}
 },[endpoint,id]);
 async function logout(){
  ++epoch.current;abort.current?.abort();clear();setBusy(true);setError('');
  try{await endSchoolSession();logoutRef.current=null;announceSchoolLogout();setNotice('Vous êtes déconnecté.');}
  catch{setError('La déconnexion n’a pas été confirmée. Réessayez.');}
  finally{setBusy(false);}
 }
 const user=session?.user,manual=id?data?.manuals.find(m=>m.id===id):null;
 const returnPath=profile==='admin'?'/admin/accueil':profile==='directeur'?directorPath('etablissement'):'/pilote?profil='+profile+'&section='+(profile==='eleve'?'manuels':'mediatheque');
 useEffect(()=>{document.title=(manual?'Lire · '+manual.title:'Documents accessibles')+' — Jet d’Encre';},[manual?.title]);
 const accessError=()=>{++epoch.current;abort.current?.abort();clear();setBusy(false);setError('Le fichier n’est plus accessible. Actualisez ou reconnectez-vous.');};
 const book=manual?{id:manual.id+':'+manual.version,title:manual.title,src:manual.src,meta:manual.pageCount+' pages · Document de test privé · Consultation locale'}:null;
 return <SchoolShell role={user?.role||profile} user={user} nav={navigation(user?.role||profile)} activeId={profile==='admin'?'library':profile==='directeur'?'etablissement':profile==='eleve'?'manuels':'mediatheque'} onLogout={logoutRef.current?logout:null} busy={busy}>
  <main id="pilot-main" className="private-manual-main">
   {notice&&<p role="status">{notice}</p>}
   {error&&<section className="panel"><p role="alert">{error}</p><button className="button button-light" disabled={busy} onClick={()=>{setBusy(true);refresh();}}>Actualiser</button> {logoutRef.current&&<button className="button button-light" disabled={busy} onClick={logout}>Se déconnecter</button>} <a className="button button-light" href={localRecipePath(profile)||'/connexion'}>Me connecter</a></section>}
   {busy&&!data&&<p role="status">Vérification des documents accessibles…</p>}
   {data&&<><p className="school-library-note">Document fourni pour une recette privée sur cet ordinateur. Ce magazine n’est pas un manuel FLE validé. La lecture ne rapporte pas de XP ; sa position reste mémorisée sur cet appareil.</p>
    {manual?<><h1 className="pdf-reader__sr-only">Lire · {manual.title}</h1><PdfReader key={identity(session)+':'+manual.version} book={book} userId={identity(session)} beforeRead={beforeRead} progressive backLabel="Retour aux documents" onBack={()=>window.location.assign(libraryPath(profile))} allowFileActions={false} onAccessError={accessError}/></>:
     <><PageHeader eyebrow="BIBLIOTHÈQUE PRIVÉE" title="Documents accessibles" subtitle="Seuls les documents autorisés pour votre compte apparaissent ici." action={<a className="button button-light" href={returnPath}><ArrowLeft/> Retour à mon espace</a>}/>
      <div className="school-class-list">{data.manuals.map(m=><article className="panel" key={m.id}><Books size={38}/><span className="status-pill neutral">TEST PRIVÉ</span><h2>{m.title}</h2><p>{m.pageCount} pages · PDF · {(m.byteSize/1048576).toFixed(1)} Mo</p><a className="button button-dark" href={privateReadingPath(m.id,profile)}>Lire le document <ArrowRight/></a></article>)}</div>
      {!data.manuals.length&&<section className="panel"><h2>Aucun document accessible pour le moment</h2><p>{profile==='eleve'?'Activez le code remis pour votre manuel afin de le retrouver ici.':profile==='parent'?'Les documents apparaissent lorsqu’un enfant rattaché à votre compte dispose d’une activation valide.':'Aucun document privé n’est encore attribué à votre établissement.'}</p>{profile==='eleve'&&<a className="button button-light" href="/activation">Activer un manuel</a>}</section>}</>}
   </>}
  </main>
 </SchoolShell>;
}
