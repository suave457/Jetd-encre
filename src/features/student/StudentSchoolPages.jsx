import {PrivateManualEntry} from '../pilote/PrivateManualEntry.jsx';
import { useEffect, useRef, useState } from 'react';
import { StudentAssignmentView, StudentDashboardView, StudentHomeworkView } from './StudentViews.jsx';
import { StudentProfile, StudentSchoolManuals } from '../../PenAlignedPages.jsx';
import { getResponsiveImageProps } from '../../mediaAssets.js';
import { schoolApi } from '../pilote/schoolApi.js';
import { SchoolLink } from '../pilote/SchoolHome.jsx';
import { schoolHomework, studentSchoolPath } from './studentSchoolCore.js';
import { getAssignmentRequest } from '../pilote/schoolNavigationCore.js';
import { isStudentAvatar } from './studentProfileCore.js';
import { MOTS_FLECHES_GRIDS } from '../games/mots-fleches/motsFlechesData.js';

function PageHeader({eyebrow,title,subtitle,action,serif=false}){return <div className="page-header"><div><span className="page-eyebrow">{eyebrow}</span><h1 className={serif?'serif':''}>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>;}
function ResponsiveImage({fileName,alt='',sizes}){return <img {...getResponsiveImageProps(fileName,{sizes})} alt={alt}/>;}
function Tabs({value,onChange,items}){
  function move(event){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=items.findIndex(item=>item[0]===value);const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;onChange(items[next][0]);event.currentTarget.querySelectorAll('button')[next]?.focus();}
  return <div className="tab-list" role="tablist" onKeyDown={move}>{items.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={value===key} tabIndex={value===key?0:-1} className={value===key?'active':''} onClick={()=>onChange(key)}>{label}</button>)}</div>;
}

export default function StudentSchoolPages({user,csrf,section,search,onNavigate,refreshKey,onSessionError,onDraftChange,onAvatarSaved}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[detail,setDetail]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState('');
  const [drafts,setDrafts]=useState({});
  const [manuals,setManuals]=useState(null);
  const [profile,setProfile]=useState(null),[profileError,setProfileError]=useState(''),[avatarBusy,setAvatarBusy]=useState(false),[profileRetry,setProfileRetry]=useState(0);
  const profileRead=useRef(null),profileWrite=useRef(null);
  const life=useRef(null),write=useRef(null),pageRead=useRef(null),detailRead=useRef(null),selectedId=useRef(null);
  const [retry,setRetry]=useState(0);
  const assignmentRequest=getAssignmentRequest(search);
  const id=section==='devoirs'?assignmentRequest.id:null;
  selectedId.current=id;
  function own(value){if(value.userId!==user.id||(value.schoolId&&value.schoolId!==user.schoolId))throw new Error('Le compte a changé. Actualise la page.');return value;}
  const fail=error=>{setError(error.message);if([401,403].includes(error.status))onSessionError();};
  useEffect(()=>{onDraftChange(Object.values(drafts).some(Boolean));},[drafts]);
  useEffect(()=>()=>{onDraftChange(false);write.current?.abort();profileWrite.current?.abort();},[]);
  useEffect(()=>{
    const abort=new AbortController();life.current=abort;setLoading(true);setError('');
    schoolApi('/student/dashboard',{signal:abort.signal}).then(value=>{if(abort.signal.aborted)return;own(value);setData(value);}).catch(error=>{if(!abort.signal.aborted)fail(error);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>{abort.abort();pageRead.current?.abort();};
  },[refreshKey,user.id,user.schoolId,retry]);
  useEffect(()=>{
    const abort=new AbortController();detailRead.current=abort;setDetail(null);setReceipt('');setError('');
    if(id)schoolApi('/assignments/'+id,{signal:abort.signal}).then(value=>{if(!abort.signal.aborted){own(value);if(value.assignment?.id!==id)throw new Error('Le devoir demandé n’a pas été confirmé. Réessaie depuis la liste.');setDetail(value);}}).catch(error=>{if(!abort.signal.aborted)fail(error);});
    return()=>abort.abort();
  },[id,refreshKey,user.id,retry]);
  useEffect(()=>{
    if(section!=='manuels')return;
    const abort=new AbortController();setManuals(null);
    schoolApi('/manuals',{signal:abort.signal}).then(value=>{if(!abort.signal.aborted){own(value);setManuals(value.manuals);}}).catch(error=>{if(!abort.signal.aborted)fail(error);});
    return()=>abort.abort();
  },[section,refreshKey,user.id,user.schoolId,retry]);
  function ownProfile(value){own(value);if(value.schoolId!==user.schoolId||!isStudentAvatar(value.avatar))throw new Error('Le profil attendu n’a pas été confirmé. Réessaie.');return value;}
  const failProfile=error=>{setProfileError(error.message);if([401,403].includes(error.status))onSessionError();};
  useEffect(()=>{
    if(section!=='aide')return;
    const abort=new AbortController();profileRead.current=abort;setProfile(null);setProfileError('');
    schoolApi('/student/profile',{signal:abort.signal}).then(value=>{if(!abort.signal.aborted)setProfile(ownProfile(value));}).catch(error=>{if(!abort.signal.aborted)failProfile(error);});
    return()=>abort.abort();
  },[section,refreshKey,user.id,user.schoolId,profileRetry]);
  async function saveAvatar(avatar){
    if(profileWrite.current)return false;
    const abort=new AbortController();profileWrite.current=abort;setAvatarBusy(true);setProfileError('');
    try{
      const saved=ownProfile(await schoolApi('/student/profile',{body:{avatar},csrf,signal:abort.signal}));
      if(abort.signal.aborted)return false;
      profileRead.current?.abort();setProfile(saved);onAvatarSaved?.(saved);return true;
    }catch(error){if(!abort.signal.aborted)failProfile(error);return false;}
    finally{if(profileWrite.current===abort){profileWrite.current=null;if(!abort.signal.aborted)setAvatarBusy(false);}}
  }
  async function more(){
    if(busy||data?.assignments.nextOffset==null)return;
    const abort=new AbortController();pageRead.current=abort;setBusy(true);setError('');
    try{const next=own(await schoolApi('/student/dashboard?offset='+data.assignments.nextOffset,{signal:abort.signal}));if(abort.signal.aborted)return;
      setData(previous=>({...next,assignments:{...next.assignments,items:[...new Map([...previous.assignments.items,...next.assignments.items].map(item=>[item.id,item])).values()]}}));
    }catch(error){if(!abort.signal.aborted)fail(error);}finally{if(pageRead.current===abort){pageRead.current=null;setBusy(Boolean(write.current));}}
  }
  async function submit(event){
    event.preventDefault();if(write.current||!id||!detail)return;
    const abort=new AbortController(),target=id;write.current=abort;setBusy(true);setError('');
    try{
      await schoolApi('/assignments/'+target+'/submission',{body:{body:drafts[target]||''},csrf,signal:abort.signal});
      const verified=own(await schoolApi('/assignments/'+target,{signal:abort.signal}));
      if(abort.signal.aborted)return;
      if(!verified.submissions.some(item=>item.studentId===user.id))throw new Error('La remise attend une confirmation. Conserve ton texte et réessaie.');
      const refreshed=own(await schoolApi('/student/dashboard',{signal:abort.signal}));if(abort.signal.aborted)return;
      if(selectedId.current===target){detailRead.current?.abort();setDetail(verified);setReceipt('Ton enseignant peut maintenant consulter ton travail.');}life.current?.abort();setLoading(false);pageRead.current?.abort();setData(refreshed);setDrafts(previous=>{const next={...previous};delete next[target];return next;});
    }catch(error){if(!abort.signal.aborted)fail(error);}finally{if(write.current===abort)write.current=null;if(!abort.signal.aborted)setBusy(false);}
  }
  function RouteLink({to,...props}){return <SchoolLink {...props} to={studentSchoolPath(to)} onNavigate={onNavigate}/>;}
  const ui={PageHeader,RouteLink,ResponsiveImage,Tabs};
  if(!['accueil','devoirs','aide','manuels'].includes(section))return null;
  if(loading&&!data)return <p role="status">Chargement de ton espace…</p>;
  if(!data)return <><p role="alert">{error||'Ton espace ne peut pas encore être chargé.'}</p><button className="button button-light" onClick={()=>setRetry(value=>value+1)}>Réessayer</button></>;
  if(section==='devoirs'&&assignmentRequest.error)return <><p className="form-error" role="alert">{assignmentRequest.error}</p><RouteLink to="/eleve/devoirs" className="button button-light">Revenir à mes devoirs</RouteLink></>;
  const latestGrid=[...(data.rewards?.grids||[])].filter(grid=>grid.completedAt!=null).sort((a,b)=>b.completedAt-a.completedAt)[0];
  const puzzle=MOTS_FLECHES_GRIDS.find(grid=>grid.id===latestGrid?.gridId);
  const latestQuiz=data.rewards?.latestQuiz;
  const latest=[latestQuiz?{...latestQuiz,quizId:latestQuiz.gameId}:null,
    latestGrid&&puzzle?{quizId:'mots-fleches',completedAt:latestGrid.completedAt,correctCount:puzzle.entries.length,questionCount:puzzle.entries.length,xpEarned:latestGrid.awardedXp}:null,
    data.rewards?.latestZellige,
    data.rewards?.latestMarket?{...data.rewards.latestMarket,quizId:'souk-des-mots',correctCount:data.rewards.latestMarket.completedMissionCount,questionCount:data.rewards.latestMarket.missionCount}:null].filter(Boolean).sort((a,b)=>b.completedAt-a.completedAt||a.quizId.localeCompare(b.quizId))[0]??null;
  const visibleDetail=detail?.assignment.id===id?detail:null;
  const existing=visibleDetail?.submissions.find(item=>item.studentId===user.id);
  return <>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {section==='accueil'&&<StudentDashboardView connected currentUser={user} latest={latest} classLabel={data.classes.map(group=>group.name).join(', ')} todo={data.assignments.next?schoolHomework([data.assignments.next]):[]} pendingCount={data.assignments.pending} ui={ui}/>}
    {section==='devoirs'&&!id&&<><StudentHomeworkView connected homework={schoolHomework(data.assignments.items)} counts={data.assignments} ui={ui}/>{data.assignments.nextOffset!=null&&<p className="school-library-note">{data.assignments.items.length} devoirs chargés sur {data.assignments.total}. <button className="button button-light" onClick={more} disabled={busy}>Charger les devoirs suivants</button></p>}</>}
    {section==='devoirs'&&id&&(visibleDetail?<StudentAssignmentView connected assignment={{...visibleDetail.assignment,dueAt:visibleDetail.assignment.dueDate+'T12:00:00'}} existing={existing?{...existing,status:existing.reviewedAt!=null?'Corrigé':'Remis'}:null} answer={existing?.body??drafts[id]??''} onChange={value=>setDrafts(previous=>({...previous,[id]:value}))} onSubmit={submit} feedback={receipt} busy={busy} ui={ui}/>:error?<p><button className="button button-light" onClick={()=>setRetry(value=>value+1)}>Réessayer</button> <RouteLink to="/eleve/devoirs" className="button button-light">Revenir à mes devoirs</RouteLink></p>:<p role="status">Ouverture du devoir…</p>)}
    {section==='aide'&&<StudentProfile user={user} classes={data.classes} profile={profile} avatarBusy={avatarBusy} profileError={profileError} onAvatarSave={saveAvatar} onProfileRetry={()=>setProfileRetry(value=>value+1)} ui={ui}/>}
    {section==='manuels'&&(manuals?<><PrivateManualEntry role='eleve'/><StudentSchoolManuals manuals={manuals} ui={ui}/></>:error?<button className="button button-light" onClick={()=>setRetry(value=>value+1)}>Réessayer</button>:<p role="status">Chargement de tes manuels…</p>)}
  </>;
}
