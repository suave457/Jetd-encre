import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Books, Buildings, ChartBar, FileText, House, Key, Plus, Users } from '@phosphor-icons/react/ssr';
import './access-admin.css';
import AdminHome from './AdminHome.jsx';
import { localRecipePath } from './localRecipePath.js';
import { BetaAnalytics } from '../beta-admin/BetaAdminPages.jsx';
import PageHeader from '../../PageHeader.jsx';
import AdminManualCodes from './AdminManualCodes.jsx';
import AdminEditorial from './AdminEditorial.jsx';
import { announceSchoolLogout } from './schoolLogout.js';
import SchoolShell from './SchoolShell.jsx';
import { getAutomaticSignInPath, getSignInFailure } from './schoolNavigationCore.js';

const roles={enseignant:'Enseignant',eleve:'Élève',parent:'Parent',directeur:'Direction'};
const actions={library_import:'PDF importé ou remplacé',library_describe:'Fiche du document modifiée',library_assign:'Attribution du document modifiée',library_status:'Statut du document modifié',library_restore:'Version du PDF restaurée',article_publish:'Article publié',article_retract:'Article retiré du Mag',article_create:'Brouillon créé',article_save:'Article modifié',article_restore:'Version restaurée',article_archive:'Article archivé',school_created:'École créée',class_created:'Classe créée',account_created:'Compte préparé',identity_linked:'Connexion rattachée',school_suspended:'École suspendue',school_activated:'École réactivée',account_suspended:'Compte suspendu',account_activated:'Compte réactivé',sessions_revoked:'Sessions fermées'};
const adminNavigation=[
  {id:'home',label:'Accueil',href:'/admin/accueil',Icon:House},
  {id:'schools',label:'Écoles et accès',href:'/admin/ecoles-acces',Icon:Buildings},
  {id:'library',label:'Bibliothèque',href:'/admin/bibliotheque',Icon:Books},
  {id:'licences',label:'Licences & codes',href:'/admin/licences',Icon:Key},
  {id:'analytics',label:'Analyses',href:'/admin/analyses',Icon:ChartBar},
  {id:'editorial',label:'Blog & articles',href:'/admin/blog',Icon:FileText},
];
async function api(path,body,csrf){
  const response=await fetch('/api/pilot'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf||'', 'X-Local-Pilot':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data;try{data=await response.json();}catch{const error=new Error('Le service est indisponible.');if(!response.ok)error.status=response.status;throw error;}
  if(!response.ok){const error=new Error(data.error?.message||'Le service est indisponible.');error.status=response.status;error.code=data.error?.code;error.mode=data.mode;throw error;}return data;
}
export default function AccessAdmin({home=false,licences=false,analytics=false,editorial=false}){
  const [session,setSession]=useState(null),[data,setData]=useState(null),[schoolId,setSchoolId]=useState(''),[query,setQuery]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[form,setForm]=useState(null),[draft,setDraft]=useState({});
  const [accessPending,setAccessPending]=useState(true);
  const epoch=useRef(0),identity=useRef(null),signInStarted=useRef(false);
  useEffect(()=>{document.title=(editorial?'Blog & articles':analytics?'Analyses':licences?'Licences & codes':home?'Accueil administrateur':'Écoles et accès')+' · Jet d’Encre';},[home,licences,analytics,editorial]);
  useEffect(()=>{
    if(!home||error||signInStarted.current)return;
    const url=new URL(window.location.href);
    if(session?.authenticated&&url.searchParams.getAll('connexion').length===1&&url.searchParams.get('connexion')==='1'){
      url.searchParams.delete('connexion');
      window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
      return;
    }
    const signInPath=getAutomaticSignInPath(session,url.search,'admin');
    if(!signInPath)return;
    signInStarted.current=true;
    url.searchParams.delete('connexion');
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    window.location.replace(signInPath);
  },[home,session,error]);
  async function refresh(){const version=++epoch.current;setAccessPending(true);setError('');try{
    const signInFailure=getSignInFailure(window.location.search);
    if(signInFailure){
      setData(null);identity.current=null;setSession({authenticated:false,mode:'oidc'});setError(signInFailure);return;
    }
    const s=await api('/session?profil=admin');if(version!==epoch.current)return;
    if(identity.current!==s.user?.id){setData(null);setForm(null);setDraft({});setSchoolId('');}
    identity.current=s.user?.id;setSession(s);
    if(!s.authenticated||s.user.role!=='admin'){setData(null);return;}
    const next=await api('/admin');if(version!==epoch.current)return;
    if(next.userId!==s.user.id){const mismatch=new Error('Le compte a changé. Actualisez la page.');mismatch.status=403;throw mismatch;}
    setData(next);setAccessPending(false);setSchoolId(previous=>{const requested=previous||new URLSearchParams(window.location.search).get('ecole');return next.schools.some(s=>s.id===requested)?requested:next.schools[0]?.id||'';});
  }catch(e){if(version===epoch.current){
    if(!editorial||e.status===401||e.status===403){setData(null);identity.current=null;setSession(e.code==='profile_mismatch'?{authenticated:false,mode:e.mode==='local_fixture'?'local_fixture':'oidc'}:null);}
    setError(editorial&&e.status!==401&&e.status!==403?'Connexion au serveur interrompue. Le texte ouvert est conservé à l’écran ; actualisez la vérification pour reprendre.':e.message);
  }}}
  useEffect(()=>{refresh();const reset=()=>{setData(null);refresh();};const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('jde-pilot-session'):null;if(channel)channel.onmessage=reset;window.addEventListener('focus',refresh);return()=>{epoch.current++;channel?.close();window.removeEventListener('focus',refresh);};},[]);
  async function mutate(path,body){setBusy(true);setError('');setNotice('');try{await api(path,body,session?.csrfToken);setForm(null);if(path.startsWith('/admin/'))setNotice('Modification enregistrée.');await refresh();}catch(e){setError(e.message);if(e.status===401||e.status===403){setData(null);await refresh();}}finally{setBusy(false);}}
  function open(kind,account=null){setError('');setNotice('');setDraft({id:account?.id||crypto.randomUUID(),name:'',role:'enseignant',classId:'',childId:'',subject:'',schoolId});setForm(kind);}
  const school=data?.schools.find(s=>s.id===schoolId),accounts=data?.accounts.filter(a=>a.schoolId===schoolId)||[];
  const classes=data?.classes.filter(c=>c.schoolId===schoolId)||[];
  async function logout(){if(busy||!window.dispatchEvent(new Event('jde:before-school-logout',{cancelable:true})))return;setBusy(true);setError('');try{await api('/logout',{},session?.csrfToken);announceSchoolLogout();setData(null);setSession(null);await refresh();}catch(error){setError('La déconnexion n’a pas été confirmée. Réessayez.');}finally{setBusy(false);}}
  return <SchoolShell role="admin" user={session?.authenticated&&session.user.role==='admin'?session.user:null} schoolName="Administration Jet d’Encre" nav={adminNavigation} activeId={editorial?'editorial':analytics?'analytics':licences?'licences':home?'home':'schools'} onLogout={session?.authenticated?logout:undefined} busy={busy} mainId="access-main">
    <div className="access-admin"><main id="access-main">{!analytics&&!editorial&&<div className="access-heading"><div><span>VOTRE ESPACE DE GESTION</span><h1>{licences?'Piloter les activations':home?"Accueil administrateur":"Écoles et accès"}</h1><p>{licences?'Distribuez les codes et suivez les accès aux manuels.':home?"Vos établissements et les accès à préparer.":"Vous décidez qui peut se connecter et à quelle école."}</p></div>{data&&!licences&&(home?<a className="access-primary" href="/admin/ecoles-acces">Gérer les écoles <ArrowRight/></a>:<button className="access-primary" disabled={busy} onClick={()=>open('school')}><Plus/> Ajouter une école</button>)}</div>}
    {error&&<p className="access-error" role="alert">{error} {session?.authenticated===false&&session.mode==='oidc'?<a href={localRecipePath('admin')||'/api/pilot/auth/start?profil=admin'}>Réessayer</a>:<button onClick={refresh}>Actualiser</button>}</p>}{notice&&<p className="access-notice" role="status">{notice}</p>}
    {!session&&!error&&<p role="status">Vérification de votre accès…</p>}
    {session&&!session.authenticated&&<section className="access-panel"><h2>Connexion administrateur</h2><p>Utilisez votre compte administrateur attribué par Jet d’Encre.</p><a className="access-primary" href={localRecipePath('admin')||'/api/pilot/auth/start?profil=admin'}>Me connecter</a><p><a href="/connexion">Choisir un autre profil</a></p></section>}
    {session?.authenticated&&session.user.role!=='admin'&&<section className="access-panel"><h2>Accès réservé</h2><p>Ce compte ne dispose pas des droits d’administration Jet d’Encre.</p><a href="/pilote">Retour à mon espace</a></section>}
    {data&&<>{editorial?<AdminEditorial key={session.user.id} userId={session.user.id} csrf={session.csrfToken} accessPending={accessPending} onVerifyAccess={refresh}/>:analytics?<BetaAnalytics source="pilot" key={session.user.id} userId={session.user.id} ui={{PageHeader}}/>:licences?<AdminManualCodes key={session.user.id} userId={session.user.id} csrf={session.csrfToken} schools={data.schools}/>:home?<AdminHome data={data}/>:<div className="access-layout"><aside className="access-panel"><h2><Buildings/> Établissements <small>{data.schools.length}</small></h2><label>Rechercher une école<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom de l’école"/></label><div className="access-schools">{data.schools.filter(s=>s.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).map(s=>{const accountCount=data.accounts.filter(a=>a.schoolId===s.id).length;return <button key={s.id} aria-pressed={schoolId===s.id} onClick={()=>{setSchoolId(s.id);setForm(null);}}><strong>{s.name}</strong><span>{s.active?'Active':'Suspendue'} · {accountCount} {accountCount===1?'compte':'comptes'}</span></button>;})}</div></aside>
    <section className="access-panel">{school?<><div className="access-school-title"><div><h2>{school.name}</h2><span className={school.active?'access-tag':'access-tag suspended'}>{school.active?'Accès ouverts':'École suspendue'}</span></div><button disabled={busy} onClick={()=>{if(window.confirm(school.active?'Suspendre cette école et fermer les sessions de ses utilisateurs ?':'Réactiver les accès de cette école ?'))mutate('/admin/school-status',{id:school.id,active:!school.active});}}>{school.active?'Suspendre l’école':'Réactiver l’école'}</button></div>
    <div className="access-toolbar"><h3><Users/> {accounts.length} {accounts.length===1?'compte':'comptes'}</h3><button disabled={busy||!school.active} onClick={()=>open('class')}>Ajouter une classe</button><button className="access-primary" disabled={busy||!school.active} onClick={()=>open('account')}><Plus/> Ajouter un compte</button></div>
    {!accounts.length?<p>Aucun compte pour cette école. Ajoutez la Direction, puis les classes et leurs enseignants et élèves. Vous pourrez ensuite rattacher les parents.</p>:<div className="access-table"><table><thead><tr><th>Utilisateur</th><th>Accès</th><th>Sessions</th><th>Actions</th></tr></thead><tbody>{accounts.map(a=><tr key={a.id}><td><strong>{a.name}</strong><small>{roles[a.role]||a.role}</small></td><td><span className="access-tag">{!a.active?'Suspendu':!school.active?'École suspendue':a.connected?'Connexion rattachée':'Connexion à préparer'}</span></td><td>{a.sessions}</td><td><div className="access-row-actions">{!a.connected&&<button disabled={busy||!a.active||!school.active} onClick={()=>open('identity',a)}>Rattacher la connexion</button>}<button disabled={busy} onClick={()=>{if(window.confirm(a.active?`Suspendre ${a.name} et fermer ses sessions ?`:`Réactiver ${a.name} ?`))mutate('/admin/account-status',{id:a.id,active:!a.active});}}>{a.active?'Suspendre':'Réactiver'}</button>{a.sessions>0&&<button disabled={busy} onClick={()=>{if(window.confirm(`Fermer toutes les sessions de ${a.name} ?`))mutate('/admin/revoke',{id:a.id});}}>Fermer les sessions</button>}</div></td></tr>)}</tbody></table></div>}
    <p className="access-footnote">Les identifiants sont remis par votre équipe. Les comptes sans connexion rattachée ne peuvent pas encore se connecter.</p></>:<p>Ajoutez votre premier établissement pour préparer ses accès.</p>}</section></div>}
    {form&&<section className="access-panel access-form-panel"><form onSubmit={e=>{e.preventDefault();mutate('/admin/'+({school:'schools',class:'classes',account:'accounts',identity:'identity'}[form]),draft);}}><h2>{{school:'Ajouter une école',class:'Ajouter une classe',account:'Préparer un compte',identity:'Rattacher la connexion'}[form]}</h2><fieldset disabled={busy}>
    {form!=='identity'&&<label>{form==='school'?'Nom de l’école':form==='class'?'Nom de la classe':'Nom et prénom'}<input autoFocus required minLength={form==='school'?3:2} maxLength={form==='school'?140:form==='class'?100:120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>}
    {form==='account'&&<><label>Rôle<select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value,classId:'',childId:''})}>{Object.entries(roles).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{draft.role==='parent'?<label>Enfant rattaché<select required value={draft.childId} onChange={e=>setDraft({...draft,childId:e.target.value})}><option value="">Choisir l’enfant</option>{accounts.filter(a=>a.role==='eleve'&&a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>:['enseignant','eleve'].includes(draft.role)?<label>Classe<select required value={draft.classId} onChange={e=>setDraft({...draft,classId:e.target.value})}><option value="">Choisir une classe</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>:<p>La Direction consulte son établissement, sans rattachement à une classe. La gestion des comptes reste réservée à l’administration Jet d’Encre.</p>}<p>Le profil sera créé dans {school?.name}. Vous préparerez ensuite sa connexion.</p></>}
    {form==='identity'&&<><p>Compte : <strong>{accounts.find(a=>a.id===draft.id)?.name}</strong></p><ol><li>Créez le compte dans votre tableau de bord Auth0.</li><li>Vérifiez son identité, puis recopiez son « User ID » ci-dessous.</li><li>Remettez les identifiants à l’utilisateur par votre canal habituel.</li></ol><label>User ID Auth0<input autoFocus required placeholder="auth0|…" value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></label><p>Ne saisissez aucun mot de passe ici. La réinitialisation reste gérée depuis Auth0 à cette étape.</p></>}
    <div className="access-toolbar"><button className="access-primary">{busy?'Enregistrement…':'Enregistrer'}</button><button type="button" onClick={()=>setForm(null)}>Annuler</button></div></fieldset></form></section>}
    <details className="access-panel access-history"><summary>Historique des dernières actions</summary>{!data.events.length&&<p>Aucune action enregistrée pour le moment.</p>}{data.events.map((e,i)=><p key={i}><strong>{actions[e.action]||e.action}</strong> · {data.schools.find(s=>s.id===e.targetId)?.name||data.accounts.find(a=>a.id===e.targetId)?.name||(e.action.startsWith('article_')?'Article éditorial':e.action.startsWith('library_')?'Document privé':'Classe')} · {e.actor} · {new Date(e.createdAt*1000).toLocaleString('fr-MA')}</p>)}</details></>}
    </main></div></SchoolShell>;
}
