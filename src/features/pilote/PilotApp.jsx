import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle, ChalkboardTeacher, LockKey, Plus, SignOut, Student, Users, ArrowsClockwise } from "@phosphor-icons/react/ssr";
import "./pilot.css";
import { PilotGameSummary, useSchoolGameSummary } from './PilotCrosswords.jsx';
import SchoolShell from './SchoolShell.jsx';
import SchoolHome, { SchoolGroups, SchoolHelp, SchoolLink, schoolMenu } from './SchoolHome.jsx';
import { MediaLibraryView } from '../mediatheque/StudentMediaLibrary.jsx';
import { getAutomaticSignInPath, getSchoolSection } from './schoolNavigationCore.js';

const roles={enseignant:"Enseignant",eleve:"Élève",parent:"Parent",admin:'Administrateur'};
const icons={enseignant:ChalkboardTeacher,eleve:Student,parent:Users,admin:LockKey};
const identityKey=value=>value?.user?[value.user.id,value.user.schoolId,value.user.role].join(":"):null;
const date=value=>new Intl.DateTimeFormat("fr-MA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value*1000));
async function api(path,{signal,body,csrf,headers={}}={}){
  let response;
  try{response=await fetch("/api/pilot"+path,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",signal,headers:{...(body===undefined?{}:{"Content-Type":"application/json","X-CSRF-Token":csrf||""}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch(error){if(error.name==="AbortError")throw error;throw new Error("Le serveur n’a pas confirmé l’opération. Votre texte reste dans cette page : réessayez sans le modifier.");}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error?.message||"Le service est momentanément indisponible.");error.status=response.status;throw error;}
  return data;
}
function PublishForm({classes,busy,onPublish,draft,onChange}){
  const {title="",instructions="",dueDate="",classId=classes[0]?.id||""}=draft;
  return <form className="pilot-form" onSubmit={e=>{e.preventDefault();onPublish({title,instructions,dueDate,classId},draft.requestKey);}}>
    <span className="pilot-eyebrow">PREMIÈRE SÉQUENCE · PRODUCTION ÉCRITE</span><h2>Publier un devoir</h2><p>Le devoir sera visible par les élèves actuellement inscrits dans cette classe. La consigne ne pourra plus être modifiée après publication.</p>
    <label>Classe<select disabled={busy} value={classId} onChange={e=>onChange({classId:e.target.value})} required>{classes.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
    <label>Titre<input disabled={busy} value={title} onChange={e=>onChange({title:e.target.value})} minLength={5} maxLength={120} placeholder="Mon quartier en quatre phrases" required/></label>
    <label>Consigne<textarea disabled={busy} value={instructions} onChange={e=>onChange({instructions:e.target.value})} minLength={12} maxLength={3000} rows={5} placeholder="Présente un lieu de ton quartier en quatre phrases. Indique sa position et donne ton avis." required/></label>
    <label>À remettre pour le<input disabled={busy} type="date" value={dueDate} onInput={e=>onChange({dueDate:e.currentTarget.value})} onChange={e=>onChange({dueDate:e.target.value})} required/></label>
    <button className="button button-gold" disabled={busy||!classes.length}>{busy?"Publication en cours…":"Publier dans ma classe"}<ArrowRight/></button>
  </form>;
}
function SubmitForm({busy,onSubmit,draft,onChange}){
  const {body=""}=draft;
  return <form className="pilot-form" onSubmit={e=>{e.preventDefault();onSubmit({body});}}>
    <label>Mon texte<textarea disabled={busy} rows={7} minLength={12} maxLength={6000} value={body} onChange={e=>onChange({body:e.target.value})} placeholder="Près de chez moi, il y a…" required/></label>
    <small>{body.length} / 6 000 caractères · Relis ton texte avant de le remettre.</small>
    <p className="pilot-hint">Une fois remis, ton texte est conservé pour la correction. Tu ne pourras pas le remplacer dans ce premier pilote.</p>
    <button className="button button-gold" disabled={busy}>{busy?"Remise en cours…":"Remettre mon travail"}<ArrowRight/></button>
  </form>;
}
function ReviewForm({busy,onReview,draft,onChange}){
  const {score="",feedback=""}=draft;
  return <form className="pilot-form pilot-review-form" onSubmit={e=>{e.preventDefault();onReview({score:Number(score),feedback});}}>
    <label>Note sur 20<input disabled={busy} type="number" min={0} max={20} step={1} value={score} onChange={e=>onChange({score:e.target.value})} required/></label>
    <label>Retour pour progresser<textarea disabled={busy} rows={4} minLength={8} maxLength={2000} value={feedback} onChange={e=>onChange({feedback:e.target.value})} placeholder="Un point réussi et une prochaine action précise…" required/></label>
    <p className="pilot-hint">La correction sera visible par l’élève et son parent. Elle ne pourra pas être remplacée dans ce premier pilote.</p>
    <button className="button button-dark" disabled={busy||score===""}>{busy?"Enregistrement…":"Publier la correction"}<CheckCircle/></button>
  </form>;
}
function Submission({submission,teacher,busy,onReview,draft,onChange}){
  return <article className="pilot-submission"><header><strong>{submission.studentName}</strong><span className={`pilot-status ${submission.reviewedAt?"done":""}`}>{submission.reviewedAt?"Corrigé":"Remis"}</span></header>
    <p className="pilot-receipt">Remis le {date(submission.submittedAt)}</p><p className="pilot-answer">{submission.body}</p>
    {submission.reviewedAt?<section className="pilot-feedback"><h3><CheckCircle/> Retour de l’enseignant <span>{submission.score}/20</span></h3><p>{submission.feedback}</p><small>Correction publiée le {date(submission.reviewedAt)}</small></section>:teacher?<ReviewForm busy={busy} onReview={onReview} draft={draft} onChange={onChange}/>:<p className="pilot-hint">Le travail est bien enregistré. La correction n’a pas encore été publiée.</p>}
  </article>;
}
export default function PilotApp(){
  const [search,setSearch]=useState(window.location.search);
  const mediaNavigate=target=>{
    const id=target.startsWith('/eleve/mediatheque/')?target.slice('/eleve/mediatheque/'.length):'';
    navigate('/pilote?section=mediatheque'+(id?'&livre='+encodeURIComponent(id):''));
  };
  function navigate(target,{preserveForm=false}={}){
    const url=new URL(target,window.location.origin);
    if(url.origin===window.location.origin&&url.pathname==='/pilote'){
      // Explicit work links open the selected assignment. History Back keeps the
      // current form, and its draft stays in memory in either case.
      if(!preserveForm&&getSchoolSection(url.search,currentSession.current?.user?.role)==='devoirs')setCreating(false);
      window.history.pushState(null,'',url.pathname+url.search);setSearch(url.search);
    }else window.location.assign(target);
  }
  useEffect(()=>{const update=()=>setSearch(window.location.search);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
  const [session,setSession]=useState(null),[profiles,setProfiles]=useState([]),[workspace,setWorkspace]=useState(null),[verifying,setVerifying]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[selected,setSelected]=useState(null),[creating,setCreating]=useState(false);
  const [detail,setDetail]=useState(null),[detailLoading,setDetailLoading]=useState(false);
  const [drafts,setDrafts]=useState({});
  const hasDraft=Object.values(drafts).some(draft=>Object.entries(draft).some(([key,value])=>!["requestKey","classId"].includes(key)&&String(value).trim()));
  const updateDraft=(key,patch)=>setDrafts(previous=>({...previous,[key]:{requestKey:previous[key]?.requestKey||crypto.randomUUID(),...previous[key],...patch}}));
  const discardDraft=key=>setDrafts(previous=>{const next={...previous};delete next[key];return next;});
  const detailRequest=useRef(null);
  const epoch=useRef(0),controller=useRef(null),mutation=useRef(null),currentSession=useRef(null),channel=useRef(null),heading=useRef(null);
  const clear=()=>{currentSession.current=null;setSession(null);setWorkspace(null);setDetail(null);setDrafts({});detailRequest.current?.abort();setSelected(null);setCreating(false);setNotice("");};
  async function refresh({reset=false}={}){
    const version=++epoch.current;controller.current?.abort();controller.current=new AbortController();const signal=controller.current.signal;
    if(reset){mutation.current?.abort();clear();}setVerifying(true);setError("");
    try{
      const next=await api("/session",{signal});if(version!==epoch.current)return {status:"stale"};
      if(identityKey(next)!==identityKey(currentSession.current))clear();
      currentSession.current=next;setSession(next);
      if(next.authenticated){const url=new URL(window.location.href);if(url.searchParams.getAll('connexion').length===1&&url.searchParams.get('connexion')==='1'){url.searchParams.delete('connexion');window.history.replaceState(null,'',url.pathname+url.search);setSearch(url.search);}}
      const signIn=getAutomaticSignInPath(next,window.location.search);
      if(signIn){const url=new URL(window.location.href);url.searchParams.delete('connexion');window.history.replaceState(null,'',url.pathname+url.search);window.location.replace(signIn);return {status:'redirect'};}
      if(next.authenticated){
        if(next.user.role==='admin'){window.location.replace('/admin/accueil');return {status:'redirect'};}
        const data=await api("/workspace",{signal});if(version!==epoch.current)return {status:"stale"};
        if(data.userId!==next.user.id){clear();throw new Error("Le compte a changé dans un autre onglet. Actualisez pour continuer.");}
        setWorkspace(data);setSelected(previous=>previous||data.assignments[0]?.id||null);
        setCreating(previous=>previous||(next.user.role==="enseignant"&&!data.assignments.length));
      }else if(next.mode==="local_fixture"){
        const data=await api("/local/profiles",{signal});if(version!==epoch.current)return {status:"stale"};setProfiles(data.profiles);
      }
      return {status:"current",version,identity:identityKey(next)};
    }catch(e){if(e.name!=="AbortError"&&version===epoch.current){setError(e.message);if([401,403].includes(e.status))clear();return {status:"error",version};}return {status:"stale"};}
    finally{if(version===epoch.current)setVerifying(false);}
  }
  useEffect(()=>{
    if(!hasDraft)return;
    const leaving=e=>{e.preventDefault();e.returnValue="";};
    window.addEventListener("beforeunload",leaving);
    return()=>window.removeEventListener("beforeunload",leaving);
  },[hasDraft]);
  useEffect(()=>{
    document.title="Mon espace · Jet d’Encre";document.querySelector('meta[name="robots"]')?.setAttribute("content","noindex,nofollow");
    const reason=new URLSearchParams(location.search).get("connexion");
    if(reason&&reason!=="1")setNotice(reason==="non-autorisee"?"Votre identité a été reconnue, mais aucun compte scolaire n’y est encore associé.":"La connexion n’a pas abouti. Vous pouvez réessayer.");
    refresh();
    const changed=()=>refresh({reset:true}),focused=()=>{if(!mutation.current)refresh();};
    if(typeof BroadcastChannel!=="undefined"){channel.current=new BroadcastChannel("jde-pilot-session");channel.current.onmessage=changed;}
    window.addEventListener("focus",focused);
    return()=>{++epoch.current;controller.current?.abort();mutation.current?.abort();detailRequest.current?.abort();channel.current?.close();window.removeEventListener("focus",focused);};
  },[]);
  async function act(path,body,headers={},success="Enregistrement confirmé par le serveur."){
    if(mutation.current)return false;
    const current=currentSession.current,version=epoch.current,abort=new AbortController();mutation.current=abort;setBusy(true);setError("");setNotice("");
    try{
      const data=await api(path,{body,csrf:current?.csrfToken,headers,signal:abort.signal});if(version!==epoch.current)return false;
      const identityChanged=path==="/local/login"||path==="/logout";
      if(identityChanged){channel.current?.postMessage("changed");clear();if(path==='/local/login')navigate('/pilote');}
      const refreshed=await refresh({reset:false});
      if(refreshed.status!=="current"||refreshed.version!==epoch.current||abort.signal.aborted)return false;
      if(!identityChanged&&refreshed.identity!==identityKey(current))return false;
      setNotice(success);heading.current?.focus();return data;
    }catch(e){if(e.name!=="AbortError"&&version===epoch.current){setError(e.message);if([401,403].includes(e.status)){clear();const refreshed=await refresh();if(refreshed.status==="current"&&refreshed.version===epoch.current)setError(e.message);}}return false;}
    finally{if(mutation.current===abort)mutation.current=null;setBusy(false);}
  }
  const user=session?.user,role=user?.role;
  const section=getSchoolSection(search,role);
  const gameSummary=useSchoolGameSummary(user,workspace);
  const ownProgress=gameSummary.data?.children.find(child=>child.studentId===user?.id);
  const sectionTitles={accueil:user?'Bonjour '+user.name.split(/[ ·]/)[0]:'Connexion',devoirs:role==='parent'?'Travaux et retours':'Mes devoirs',jeux:'Mes jeux',mediatheque:'Médiathèque',progres:role==='parent'?'Les progrès de mes enfants':'Mes progrès',classes:'Mes classes',enfants:'Mes enfants',aide:'Profil & aide'};
  useEffect(()=>{document.title=(sectionTitles[section]||'Mon espace')+' · Jet d’Encre';heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});},[search,user?.id]);
  const visibleDetail=detail?.userId===user?.id&&detail?.assignment?.id===selected?detail:null;
  const active=visibleDetail?.assignment||workspace?.assignments.find(a=>a.id===selected),submissions=visibleDetail?.submissions||[];
  const listedAssignments=workspace?.assignments||[];
  const params=new URLSearchParams(search);
  const requestedAssignment=workspace?.assignments.find(assignment=>assignment.id===params.get('devoir'));
  useEffect(()=>{if(section==='devoirs'&&requestedAssignment){setSelected(requestedAssignment.id);setCreating(false);}},[search,requestedAssignment?.id]);
  const requestedChild=workspace?.children.find(child=>child.id===params.get('enfant'));
  const displayedSubmissions=requestedChild?submissions.filter(submission=>submission.studentId===requestedChild.id):submissions;
  const requestedClass=workspace?.classes.find(group=>group.id===params.get('classe'));
  const filterClass=requestedChild?.classId||requestedClass?.id;
  const allDisplayedAssignments=active&&!listedAssignments.some(a=>a.id===active.id)?[active,...listedAssignments]:listedAssignments;
  const displayedAssignments=filterClass?allDisplayedAssignments.filter(a=>a.classId===filterClass):allDisplayedAssignments;
  useEffect(()=>{if(filterClass&&!displayedAssignments.some(a=>a.id===selected)){setSelected(displayedAssignments[0]?.id||null);setCreating(false);}},[filterClass,workspace]);
  const completed=workspace?.counts.reviewed||0;
  async function loadDetail(offset=0){
    if(!selected||!user)return;
    detailRequest.current?.abort();const abort=new AbortController();detailRequest.current=abort;const version=epoch.current;
    // Revalidate without unmounting the current form. Drafts also survive navigation in memory.
    setDetailLoading(true);
    try{const data=await api(`/assignments/${selected}?offset=${offset}`,{signal:abort.signal});
      if(version!==epoch.current||detailRequest.current!==abort)return;
      if(data.userId!==user.id){clear();setError("Le compte a changé. Actualisez l’accès.");return;}
      setDetail(previous=>({...data,submissions:offset&&previous?[...previous.submissions,...data.submissions]:data.submissions}));
    }catch(e){if(e.name!=="AbortError"&&version===epoch.current&&detailRequest.current===abort){setError(e.message);if([401,403].includes(e.status))clear();else if(e.status===404){setDetail(null);setSelected(null);setWorkspace(previous=>previous?{...previous,assignments:previous.assignments.filter(a=>a.id!==selected)}:previous);}}}
    finally{if(detailRequest.current===abort)setDetailLoading(false);}
  }
  useEffect(()=>{loadDetail();return()=>detailRequest.current?.abort();},[selected,workspace,user?.id]);
  async function moreAssignments(){
    const version=epoch.current;setBusy(true);
    try{const data=await api(`/workspace?offset=${workspace.nextAssignmentsOffset}`,{signal:controller.current?.signal});
      if(version!==epoch.current)return;
      if(data.userId!==user.id){clear();setError("Le compte a changé. Actualisez l’accès.");return;}
      setWorkspace(previous=>({...data,assignments:[...previous.assignments,...data.assignments]}));
    }catch(e){if(e.name!=="AbortError")setError(e.message);}finally{setBusy(false);}
  }
  function createAssignment(){if(requestedClass&&!drafts.publish?.classId)updateDraft('publish',{classId:requestedClass.id});setCreating(true);navigate('/pilote?section=devoirs',{preserveForm:true});}
  const mediaId=new URLSearchParams(search).get('livre');
  const MediaLink=({to,children,...props})=><SchoolLink {...props} to={'/pilote?section=mediatheque'+(to.startsWith('/eleve/mediatheque/')?'&livre='+encodeURIComponent(to.slice('/eleve/mediatheque/'.length)):'')} onNavigate={navigate}>{children}</SchoolLink>;
  const MediaHeading=()=>null;
  return <SchoolShell role={role} user={user} nav={schoolMenu(role)} activeId={section} xp={ownProgress?.xpTotal} onNavigate={navigate} busy={busy||verifying} onLogout={()=>{if(!hasDraft||window.confirm('Des textes ne sont pas encore remis. Se déconnecter les effacera. Continuer ?'))act('/logout',{}, {},'Déconnexion confirmée.');}}>
    <div className="pilot-app"><main id="pilot-main" className="pilot-main">
      <div className="pilot-heading"><div><span className="pilot-eyebrow">{user?(section==='accueil'?'BIENVENUE DANS MON ESPACE':'MON ESPACE SCOLAIRE'):'JET D’ENCRE'}</span><h1 ref={heading} tabIndex={-1}>{user?sectionTitles[section]:'Retrouver mon espace'}</h1><p>{user?(section==='accueil'?'Qu’est-ce que tu veux faire aujourd’hui ?':section==='jeux'?'Un peu de réflexion, de nouveaux mots et le plaisir de progresser.':section==='mediatheque'?'Écoute, regarde et lis sans quitter ton espace.':''):"Connecte-toi avec le compte remis par l’équipe Jet d’Encre."}</p></div>{user&&<div className="pilot-actions">{section==='accueil'&&role==='enseignant'?<button className="button button-gold" onClick={createAssignment}>Créer un devoir <Plus/></button>:<button className="button button-light" onClick={()=>refresh()} disabled={busy||verifying}><ArrowsClockwise/> Actualiser</button>}</div>}</div>
      {error&&<div className="pilot-alert" role="alert"><strong>Action non confirmée</strong><p>{error}</p><button className="button button-light" onClick={()=>refresh()} disabled={busy}>Réessayer</button></div>}
      {notice&&<p className="pilot-notice" role="status">{notice}</p>}
      {hasDraft&&<p className="pilot-hint">Ton texte non remis reste disponible pendant que tu explores les rubriques. Reviens aux devoirs pour l’envoyer avant de fermer cette page.</p>}
      {verifying&&<p role="status" className="pilot-loading">Chargement de mon espace…</p>}
      <div hidden={verifying}>
        {!user&&session?.mode==='local_fixture'&&<><p className="school-library-note">Prévisualisation locale · choisis un compte fictif pour vérifier les parcours.</p><div className="pilot-school-grid">{[...new Set(profiles.map(p=>p.schoolId))].map(school=><section className="pilot-school" key={school}><h2>{profiles.find(p=>p.schoolId===school)?.schoolName||'Administration Jet d’Encre'}</h2>{profiles.filter(p=>p.schoolId===school).map(p=>{const Icon=icons[p.role];return <button key={p.id} onClick={()=>act('/local/login',{profileId:p.id},{'X-Local-Pilot':'1'},'')} disabled={busy}><Icon/><span><strong>{p.name}</strong><small>{roles[p.role]}</small></span><ArrowRight/></button>;})}</section>)}</div></>}
        {!user&&session?.signInPath==='/api/pilot/auth/start'&&<section className="pilot-panel"><h2>Connexion sécurisée</h2><a className="button button-gold" href="/api/pilot/auth/start">Me connecter <ArrowRight/></a><p className="school-library-note"><a href="/guide-ecole">Besoin d’aide pour te connecter ?</a></p></section>}
        {user&&workspace&&section==='accueil'&&<SchoolHome user={user} workspace={workspace} onNavigate={navigate} onCreate={createAssignment} summary={gameSummary}/>}
        {user&&workspace&&section==='devoirs'&&<><section className="pilot-summary" aria-label="Résumé de tous mes travaux"><div><strong>{workspace.counts.assignments}</strong><span>{workspace.counts.assignments===1?"devoir accessible":"devoirs accessibles"}</span></div><div><strong>{workspace.counts.submitted}</strong><span>{workspace.counts.submitted===1?"travail remis":"travaux remis"}</span></div><div><strong>{completed}</strong><span>{completed===1?"correction publiée":"corrections publiées"}</span></div><p>Les travaux écrits ne donnent pas d’XP automatique. Une note ne résume pas la maîtrise du français.</p></section><div>{filterClass&&<p className="school-library-note">Travaux de {requestedChild?.name||requestedClass?.name}. Les compteurs ci-dessus concernent tout ton espace. <SchoolLink to="/pilote?section=devoirs" onNavigate={navigate}>Voir tous les travaux</SchoolLink></p>}</div><div className="pilot-layout">
      <aside className="pilot-list"><header><h2>Les devoirs</h2>{role==="enseignant"&&<button aria-label="Créer un devoir" className="button button-dark" onClick={createAssignment} disabled={busy}><Plus/></button>}</header>
        {!workspace.assignments.length&&<p>Aucun devoir publié pour ce profil. Ton enseignant pourra y ajouter une consigne.</p>}
        {displayedAssignments.map(a=><button key={a.id} aria-current={!creating&&a.id===selected?"true":undefined} onClick={()=>{setSelected(a.id);setCreating(false);}}><strong>{a.title}</strong><small>Pour le {new Date(a.dueDate+"T12:00:00").toLocaleDateString("fr-MA")}</small><ArrowRight/></button>)}
      {workspace.nextAssignmentsOffset!==null&&<button onClick={moreAssignments} disabled={busy}>Voir les devoirs précédents</button>}
      </aside><section className="pilot-panel" aria-label="Détail du devoir">
      {creating&&role==="enseignant"?<PublishForm key={user.id} classes={workspace.classes} busy={busy} draft={drafts.publish||{}} onChange={patch=>updateDraft("publish",patch)} onPublish={async(body,key)=>{const result=await act("/assignments",body,{"Idempotency-Key":key},"Devoir publié : les élèves de la classe peuvent maintenant le consulter.");if(result){discardDraft("publish");setCreating(false);setSelected(result.assignment.id);}return result;}}/>:active?<><span className="pilot-eyebrow">PRODUCTION ÉCRITE</span><h2>{active.title}</h2><p className="pilot-instructions">{active.instructions}</p><p className="pilot-receipt">Publié le {date(active.createdAt)} · à remettre pour le {new Date(active.dueDate+"T12:00:00").toLocaleDateString("fr-MA")}</p>
        {visibleDetail&&role==="eleve"&&!submissions.length&&<SubmitForm key={active.id+user.id} busy={busy} draft={drafts[`submit:${active.id}`]||{}} onChange={patch=>updateDraft(`submit:${active.id}`,patch)} onSubmit={async body=>{const result=await act(`/assignments/${active.id}/submission`,body,{},"Ton travail a bien été enregistré. Tu peux le retrouver après une nouvelle connexion.");if(result)discardDraft(`submit:${active.id}`);}}/>}
        {visibleDetail&&role==="parent"&&!displayedSubmissions.length&&<p className="pilot-hint">Aucun travail affiché pour {requestedChild?.name||workspace.children.filter(c=>c.classId===active.classId).map(c=>c.name).join(", ")} pour ce devoir.{visibleDetail?.nextOffset!=null?" Consulte les remises suivantes.":""}</p>}
        {visibleDetail&&role==="enseignant"&&!submissions.length&&<p className="pilot-hint">Aucune remise reçue pour ce devoir. Les élèves pourront répondre depuis leur espace.</p>}
        {detailLoading&&<p role="status">Chargement des remises…</p>}{!visibleDetail&&!detailLoading&&<button className="button button-light" onClick={()=>loadDetail()}>Recharger les remises</button>}{displayedSubmissions.map(s=><Submission key={s.id} submission={s} teacher={role==="enseignant"} busy={busy} draft={drafts[`review:${s.id}`]||{}} onChange={patch=>updateDraft(`review:${s.id}`,patch)} onReview={async body=>{const result=await act(`/submissions/${s.id}/review`,body,{},"Correction publiée : l’élève et son parent peuvent la consulter.");if(result)discardDraft(`review:${s.id}`);}}/>) }{visibleDetail?.nextOffset!=null&&<button className="button button-light" disabled={detailLoading} onClick={()=>loadDetail(visibleDetail.nextOffset)}>Voir les remises suivantes</button>}</>:<div className="pilot-empty"><BookOpenText/><h2>Les devoirs de ma classe</h2><p>{role==="enseignant"?"Crée le premier devoir pour ta classe.":"Les devoirs apparaîtront ici après leur publication par l’enseignant."}</p></div>}
      </section></div></>}
        {user&&workspace&&['jeux','progres'].includes(section)&&<><PilotGameSummary user={user} summary={gameSummary}/>{section==='progres'&&<section className="pilot-summary school-progress-grid" aria-label="Mes travaux"><div><strong>{workspace.counts.submitted}</strong><span>travaux remis</span></div><div><strong>{completed}</strong><span>retours de l’enseignant</span></div><p>Les XP récompensent les grilles terminées. Les retours de ton enseignant t’aident à progresser dans tes écrits.</p></section>}</>}
        {user&&workspace&&['classes','enfants'].includes(section)&&<SchoolGroups user={user} workspace={workspace} onNavigate={navigate}/>}
        {user&&workspace&&section==='mediatheque'&&<><p className="school-library-note">Collection de découverte · la page de lecture est conservée sur cet appareil, séparément des résultats scolaires.</p><MediaLibraryView allowLocalImport={false} key={user.schoolId+':'+user.id} detail={mediaId} onNavigate={mediaNavigate} ui={{RouteLink:MediaLink,PageHeader:MediaHeading}} userId={'school:'+user.schoolId+':'+user.id}/></>}
        {user&&workspace&&section==='aide'&&<SchoolHelp user={user}/>}
      </div>
    </main></div>
  </SchoolShell>;
}
