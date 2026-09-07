import {useEffect,useRef,useState} from 'react';
import TeacherMarketDashboard from '../games/market-shop/TeacherMarketDashboard.jsx';
import {schoolApi} from './schoolApi.js';
import {filterSchoolMarket,schoolMarketCsv} from './teacherMarketCore.js';

export default function SchoolTeacherMarket({user,onBack}){
 const [snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const epoch=useRef(0),operation=useRef(0),abort=useRef(null),running=useRef(false),loadRef=useRef(null),focusReturn=useRef(null);
 function forget(message){++epoch.current;abort.current?.abort();running.current=false;setSnapshot(null);setBusy(false);setError(message);}
 async function load({passive=false}={}){
  if(running.current&&passive)return null;
  abort.current?.abort();
  const version=epoch.current,ticket=++operation.current,controller=new AbortController();abort.current=controller;running.current=true;
  if(!passive){focusReturn.current=document.activeElement;setBusy(true);}setError('');
  try{
   const identity=await schoolApi('/session?profil=enseignant',{signal:controller.signal});
   if(!identity.authenticated||identity.user?.id!==user.id||identity.user?.schoolId!==user.schoolId||identity.user?.role!=='enseignant')throw new Error('Le compte a changé. Reconnectez-vous dans votre espace enseignant.');
   const data=await schoolApi('/teacher/market',{signal:controller.signal});
   if(data.userId!==user.id||data.schoolId!==user.schoolId||data.role!=='enseignant'||!['pilot_database','pilot_local_fixture'].includes(data.source))throw new Error('Le suivi ne correspond pas au compte connecté.');
   if(version!==epoch.current||ticket!==operation.current||controller.signal.aborted)return null;
   setSnapshot(data);return data;
  }catch(e){if(version===epoch.current&&ticket===operation.current&&!controller.signal.aborted){setSnapshot(null);setError([401,403].includes(e.status)?'Les accès ont changé. Revenez à votre espace et reconnectez-vous.':'Le suivi ne peut pas être confirmé. Aucun ancien résultat n’est affiché ; réessayez.');}return null;}
  finally{if(version===epoch.current&&ticket===operation.current){running.current=false;setBusy(false);}}
 }
 loadRef.current=load;
 useEffect(()=>{
  ++epoch.current;loadRef.current();
  const focus=()=>loadRef.current({passive:true}),timer=setInterval(()=>{if(!document.hidden)loadRef.current({passive:true});},60000);
  const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('jde-pilot-session');
  if(channel)channel.onmessage=()=>forget('La session a changé dans un autre onglet. Reconnectez-vous pour consulter le suivi.');
  window.addEventListener('focus',focus);
  return()=>{++epoch.current;abort.current?.abort();running.current=false;clearInterval(timer);window.removeEventListener('focus',focus);channel?.close();};
 },[user.id,user.schoolId]);
 useEffect(()=>{if(busy)return;const id=requestAnimationFrame(()=>{const previous=focusReturn.current;if(document.activeElement===document.body&&previous?.isConnected&&!previous.disabled&&!previous.closest('[inert]'))previous.focus({preventScroll:true});focusReturn.current=null;});return()=>cancelAnimationFrame(id);},[busy]);
 async function exportView(filters){
  const data=await load();if(!data)return;
  if(filters.classId!=='all'&&!data.classes.some(c=>c.id===filters.classId)){setNotice('La classe sélectionnée n’est plus accessible. Vérifiez la vue actualisée avant de relancer l’export.');return;}
  setNotice('');
  const csv=schoolMarketCsv(data,filterSchoolMarket(data.students,filters,data.generatedAt),filters);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download='progression-souk-des-mots.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 if(!snapshot)return <section className="panel"><h1>Suivi du Souk des mots</h1><p role={error?'alert':'status'}>{error||'Chargement des classes et des progrès autorisés…'}</p>{error&&<button className="button button-light" onClick={load}>Réessayer</button>}<button className="button button-light" onClick={onBack}>Retour aux analyses</button></section>;
 return <>{notice&&<p className='school-library-note' role='status'>{notice}</p>}<div inert={busy?true:undefined} aria-busy={busy}><TeacherMarketDashboard onBack={onBack} school={{snapshot,refresh:load,onExport:exportView,onVerify:async id=>Boolean((await load())?.students.some(s=>s.id===id))}}/></div>{busy&&<p className="school-library-note" role="status">Vérification des accès et actualisation du suivi…</p>}</>;
}
