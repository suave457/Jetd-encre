import {useEffect,useRef,useState} from 'react';
import {Books,House,Buildings,Key,ChartBar,FileText,Plus,ArrowLeft,ArrowRight} from '@phosphor-icons/react/ssr';
import SchoolShell from './SchoolShell.jsx';
import PageHeader from '../../PageHeader.jsx';
import {registerSchoolNavigationGuard} from './schoolNavigationGuard.js';
import {schoolApi} from './schoolApi.js';
import {uploadLibrary} from './libraryApi.js';
import {announceSchoolLogout,endSchoolSession} from './schoolLogout.js';
import {localRecipePath} from './localRecipePath.js';
import {privateReadingPath} from './PrivateManualEntry.jsx';
import './admin-library.css';

const nav=[['home','Accueil','/admin/accueil',House],['schools','Écoles et accès','/admin/ecoles-acces',Buildings],['library','Bibliothèque','/admin/bibliotheque',Books],['licences','Licences & codes','/admin/licences',Key],['analytics','Analyses','/admin/analyses',ChartBar],['editorial','Blog & articles','/admin/blog',FileText]].map(([id,label,href,Icon])=>({id,label,href,Icon}));
const empty={title:'',level:'',description:''},fields=d=>({title:d.title,level:d.level,description:d.description}),size=n=>(n/1048576).toLocaleString('fr',{maximumFractionDigits:1})+' Mo';
function initialSelection(){const values=new URLSearchParams(window.location.search).getAll('document');return values.length===1&&/^[a-zA-Z0-9_-]{1,100}$/.test(values[0])?values[0]:null;}
export default function AdminManualLibrary(){
 const [session,setSession]=useState(null),[documents,setDocuments]=useState([]),[selected,setSelected]=useState(initialSelection),[detail,setDetail]=useState(null),[draft,setDraft]=useState(empty),[file,setFile]=useState(null),[note,setNote]=useState(''),[query,setQuery]=useState('');
 const [loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(null),[confirmation,setConfirmation]=useState(null);
 const lastPath=useRef(window.location.pathname+window.location.search),navigateRef=useRef(null);
 const sessionRef=useRef(null),logoutRef=useRef(null),epoch=useRef(0),abort=useRef(null),workAbort=useRef(null),refreshRef=useRef(null),dirtyRef=useRef(false),pendingRef=useRef(null),dialog=useRef(null),resolver=useRef(null),focusBack=useRef(null),fileInput=useRef(null);
 const isNew=selected==='nouveau',dirty=Boolean(file)||Boolean(note)||JSON.stringify(draft)!==JSON.stringify(detail?fields(detail.document):empty);
 dirtyRef.current=dirty;pendingRef.current=pending;
 const clear=()=>{resolver.current?.(false);resolver.current=null;dialog.current?.close();setConfirmation(null);if(fileInput.current)fileInput.current.value='';sessionRef.current=null;setSession(null);setDocuments([]);setDetail(null);setDraft(empty);setFile(null);setNote('');setPending(null);pendingRef.current=null;dirtyRef.current=false;};
 const validate=(value,s)=>{if(value.userId!==s.user.id||value.source!=='private_local_test')throw new Error('La bibliothèque privée de ce compte n’a pas été confirmée.');return value;};
 const refresh=async({force=false}={})=>{
  const ticket=++epoch.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;
  try{
   const s=await schoolApi('/session?profil=admin',{signal:controller.signal});if(ticket!==epoch.current)return;
   if(!s.authenticated){logoutRef.current=null;clear();throw new Error('Connectez-vous avec votre compte administrateur.');}
   logoutRef.current=s;
   if(s.user.role!=='admin'||(sessionRef.current&&sessionRef.current.user.id!==s.user.id)){clear();throw new Error('Le compte a changé. Reconnectez-vous dans l’espace administrateur.');}
   sessionRef.current=s;setSession(s);
   // Revalidate the session without overwriting a draft or a request awaiting confirmation.
   if(!force&&(dirtyRef.current||pendingRef.current))return;
   const list=validate(await schoolApi('/admin/library',{signal:controller.signal}),s);
   const item=selected&&!isNew?validate(await schoolApi('/admin/library/'+selected,{signal:controller.signal}),s):null;
   if(ticket!==epoch.current||(!force&&(dirtyRef.current||pendingRef.current)))return;
   setDocuments(list.documents);setDetail(item);setDraft(item?fields(item.document):empty);setError('');
  }catch(e){if(ticket!==epoch.current||e.name==='AbortError')return;if(e.status===401||e.status===403||!sessionRef.current){workAbort.current?.abort();clear();}else if(!dirtyRef.current&&!pendingRef.current){setDocuments([]);setDetail(null);setDraft(empty);}setError(e.message);}
  finally{if(ticket===epoch.current)setLoading(false);}
 };
 refreshRef.current=refresh;
 useEffect(()=>{setLoading(true);refreshRef.current({force:true});},[selected]);
 useEffect(()=>{
  document.title='Bibliothèque · Administration — Jet d’Encre';
  const focus=()=>refreshRef.current(),timer=setInterval(focus,60000);
  const changed=()=>{++epoch.current;abort.current?.abort();workAbort.current?.abort();clear();logoutRef.current=null;setLoading(false);setError('La session a changé. Reconnectez-vous pour gérer les documents.');};
  const leave=e=>{if(dirtyRef.current||pendingRef.current){e.preventDefault();e.returnValue='';}};
  const pop=e=>{const target=window.location.pathname+window.location.search;e?.stopImmediatePropagation();window.history.pushState({},'',lastPath.current);navigateRef.current(target);return true;};
  const removeGuard=registerSchoolNavigationGuard(pop);
  const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('jde-pilot-session'):null;if(channel)channel.onmessage=changed;
  window.addEventListener('focus',focus);window.addEventListener('jde:signed-out',changed);window.addEventListener('beforeunload',leave);
  return()=>{++epoch.current;abort.current?.abort();workAbort.current?.abort();clearInterval(timer);channel?.close();window.removeEventListener('focus',focus);window.removeEventListener('jde:signed-out',changed);window.removeEventListener('beforeunload',leave);removeGuard();resolver.current?.(false);};
 },[]);
 useEffect(()=>{if(confirmation)dialog.current?.showModal();},[confirmation]);
 function ask(title,message,label='Confirmer'){return new Promise(resolve=>{focusBack.current=document.activeElement;resolver.current=resolve;setConfirmation({title,message,label});});}
 function closeConfirm(confirmed){dialog.current?.close();setConfirmation(null);resolver.current?.(confirmed);resolver.current=null;focusBack.current?.focus();}
 async function canLeave(){if(pendingRef.current){setError('Vérifiez la demande en attente avant de quitter cette fiche.');return false;}const allowed=!dirtyRef.current||await ask('Quitter cette fiche ?','Les informations non enregistrées seront abandonnées. Les documents déjà enregistrés seront conservés.','Quitter sans enregistrer');if(allowed)dirtyRef.current=false;return allowed;}
 async function choose(id){if(!await canLeave())return;++epoch.current;abort.current?.abort();setDetail(null);setDraft(empty);setFile(null);setNote('');setError('');setNotice('');setSelected(id);lastPath.current='/admin/bibliotheque'+(id?'?document='+id:'');window.history.replaceState({},'',lastPath.current);}
 async function navigate(href){if(await canLeave())window.location.assign(href);}
 navigateRef.current=navigate;
 async function logout(){if(!await canLeave())return;++epoch.current;abort.current?.abort();workAbort.current?.abort();clear();setWorking(true);try{await endSchoolSession();logoutRef.current=null;announceSchoolLogout();setNotice('Vous êtes déconnecté.');}catch{setError('La déconnexion n’a pas été confirmée. Réessayez.');}finally{setWorking(false);}}
 function command(action,extra={}){return {requestId:crypto.randomUUID(),manualId:detail.document.id,expectedRevision:detail.document.revision,action,...extra};}
 function accessFailure(e){if(e.status===401||e.status===403){++epoch.current;abort.current?.abort();clear();return true;}return false;}
 async function confirmed(result,op){
  if(result.userId!==sessionRef.current?.user.id||result.requestId!==op.command.requestId||result.id!==op.command.manualId||!result.ok)throw new Error('La confirmation reçue ne correspond pas à cette demande.');
  setPending(null);pendingRef.current=null;setFile(null);setNote('');setDraft(empty);dirtyRef.current=false;if(fileInput.current)fileInput.current.value='';
  setNotice('Modification enregistrée. Les codes et les activations existants sont conservés.');setError('');
  if(selected!==result.id){setSelected(result.id);lastPath.current='/admin/bibliotheque?document='+result.id;window.history.replaceState({},'',lastPath.current);}else await refreshRef.current({force:true});
 }
 async function receiptFor(op,signal){const result=await schoolApi('/admin/library/operations/'+op.command.requestId,{signal});signal?.throwIfAborted();if(result.userId!==sessionRef.current?.user.id)throw new Error('Le compte a changé.');return result;}
 async function execute(op,retry=false){
  if(working)return;setPending(op);pendingRef.current=op;setWorking(true);setError('');setNotice(op.file?'Envoi et vérification du PDF en cours…':'Enregistrement en cours…');
  const controller=new AbortController();workAbort.current=controller;
  try{
   if(retry){const status=await receiptFor(op,controller.signal);if(status.receipt){await confirmed(status.receipt,op);return;}if(status.processing)throw new Error('La vérification est encore en cours. Attendez avant de vérifier à nouveau.');}
   const s=sessionRef.current;if(!s)throw new Error('Reconnectez-vous avant de poursuivre.');
   const result=op.file?await uploadLibrary(op.command,op.file,s.csrfToken,{signal:controller.signal}):await schoolApi('/admin/library',{body:op.command,csrf:s.csrfToken,signal:controller.signal});
   if(controller.signal.aborted)return;await confirmed(result,op);
  }catch(e){if(controller.signal.aborted)return;if([400,413,415,422].includes(e.status)){setPending(null);pendingRef.current=null;}accessFailure(e);setError(e.message);setNotice('');}
  finally{setWorking(false);}
 }
 async function releasePending(){
  const op=pendingRef.current;if(!op||working)return;setWorking(true);
  const controller=new AbortController();workAbort.current=controller;
  try{const status=await receiptFor(op,controller.signal);if(status.receipt){await confirmed(status.receipt,op);return;}if(status.processing){setError('Cette opération est encore en cours. Le formulaire reste protégé.');return;}
   if(!await ask('Libérer le formulaire ?','Aucune confirmation n’est enregistrée pour cette demande. La fiche sera relue ; vos saisies et le fichier sélectionné seront retirés du formulaire.','Relire la fiche'))return;
   setPending(null);pendingRef.current=null;setFile(null);setNote('');setDraft(empty);dirtyRef.current=false;if(fileInput.current)fileInput.current.value='';await refreshRef.current({force:true});setNotice('Fiche actualisée. Vérifiez son état avant une nouvelle modification.');
  }catch(e){if(!controller.signal.aborted){accessFailure(e);setError(e.message);}}finally{setWorking(false);}
 }
 async function submit(event){
  event.preventDefault();if(working||pending)return;
  if(isNew&&!file){setError('Choisissez le PDF à importer.');return;}
  if(file){
   if(file.size<1||file.size>209715200){setError('Choisissez un PDF de 200 Mo maximum.');return;}
   if(!await ask(isNew?'Importer ce document ?':'Remplacer le PDF ?',isNew?'Le PDF sera enregistré dans la bibliothèque privée locale. Il ne sera attribué à aucune école automatiquement.':'L’ancienne version restera conservée. Les lecteurs devront rouvrir le document pour consulter la nouvelle version.',isNew?'Importer':'Remplacer'))return;
   const requestId=crypto.randomUUID();execute({command:{requestId,manualId:isNew?'manuel-test-'+requestId:detail.document.id,expectedRevision:isNew?0:detail.document.revision,...draft,note,fileSize:file.size},file});
  }else execute({command:command('describe',draft)});
 }
 async function change(action,extra,title,message,label){if(dirty||pending){setError('Enregistrez ou retirez les modifications de la fiche avant cette action.');return;}if(await ask(title,message,label))execute({command:command(action,extra)});}
 const disabled=working||Boolean(pending),shown=documents.filter(d=>(d.title+' '+d.level).toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')));
 return <SchoolShell role="admin" user={session?.user} nav={nav} activeId="library" onLogout={logoutRef.current?logout:null} busy={working} onNavigate={navigate}>
  <main id="pilot-main" className="admin-library-main">
   <PageHeader eyebrow="ADMINISTRATION" title="Bibliothèque" subtitle="Gérez les documents, leurs versions et leur accès par établissement." action={!selected&&session?<button className="button button-dark" disabled={loading||working} onClick={()=>choose('nouveau')}><Plus/> Importer un PDF</button>:selected?<button className="button button-light" disabled={working} onClick={()=>choose(null)}><ArrowLeft/> Retour à la bibliothèque</button>:null}/>
   <p className="admin-library-note">Recette privée locale · Aucun PDF importé ici n’est publié sur Internet. Utilisez uniquement des documents dont vous êtes autorisé à faire cet usage. L’import n’attribue aucun XP.</p>
   {notice&&<p role="status" className="admin-library-notice">{notice}</p>}
   {error&&<section className="panel admin-library-error"><p role="alert">{error}</p>{!pending&&<button className="button button-light" disabled={working} onClick={()=>refreshRef.current()}>Actualiser</button>} {!session&&<a className="button button-light" href={localRecipePath('admin')||'/connexion'}>Me connecter</a>} {!session&&logoutRef.current&&<button className="button button-light" disabled={working} onClick={logout}>Se déconnecter</button>}</section>}
   {pending&&!working&&<section className="panel admin-library-pending"><h2>Demande à vérifier</h2><p>Le fichier et les informations restent dans cette page. La vérification évite d’enregistrer deux fois la même opération.</p><div className="admin-library-actions"><button className="button button-dark" onClick={()=>execute(pending,true)}>Vérifier puis réessayer</button><button className="button button-light" onClick={releasePending}>Vérifier puis libérer le formulaire</button></div></section>}
   {loading&&<p role="status">Chargement de la bibliothèque…</p>}
   {session&&!selected&&!loading&&<section className="panel"><div className="admin-library-listhead"><h2>Documents privés <span>({documents.length})</span></h2><label>Rechercher<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Titre ou niveau"/></label></div>
    <div className="admin-library-table"><table><thead><tr><th scope="col">Document</th><th scope="col">Fichier</th><th scope="col">Statut</th><th scope="col">Action</th></tr></thead><tbody>{shown.map(d=><tr key={d.id}><td><strong>{d.title}</strong><small>{d.level}</small></td><td>{d.pageCount} pages<small>{size(d.byteSize)} · PDF</small></td><td><span className={'status-pill '+(d.active?'active':'neutral')}>{d.active?'Actif':'Suspendu'}</span></td><td><button className="button button-light" aria-label={'Gérer '+d.title} onClick={()=>choose(d.id)}>Gérer <ArrowRight/></button></td></tr>)}</tbody></table></div>{!shown.length&&<p>{query?'Aucun document ne correspond à cette recherche.':'Aucun document privé. Importez votre premier PDF.'}</p>}
   </section>}
   {session&&selected&&(isNew||detail)&&!loading&&<>
    <div className="admin-library-grid"><section className="panel"><h2>{isNew?'Importer un document':detail.document.title}</h2>{detail&&<p>{detail.document.pageCount} pages · {size(detail.document.byteSize)} · Révision {detail.document.revision}</p>}
     <form onSubmit={submit}><fieldset disabled={disabled} className="admin-library-fields"><label>Titre du document<input required maxLength={140} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Niveau ou usage<input required maxLength={80} value={draft.level} onChange={e=>setDraft({...draft,level:e.target.value})} placeholder="Ex. : A1–A2 · test privé"/></label><label>Description<textarea maxLength={400} rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
      <label>{isNew?'Fichier PDF':'Remplacer le fichier PDF'}<input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={e=>{setFile(e.target.files?.[0]||null);setError('');}}/></label><small>200 Mo maximum · 2 000 pages maximum · PDF non chiffré. La vérification du fichier ne remplace pas un contrôle antivirus.</small>
      {file&&<><p>Fichier sélectionné : {file.name} · {size(file.size)}</p><label>Note de version<input maxLength={240} value={note} onChange={e=>setNote(e.target.value)}/></label><button type="button" className="button button-light" onClick={()=>{setFile(null);setNote('');fileInput.current.value='';}}>Retirer le fichier sélectionné</button></>}
      <button className="button button-dark" type="submit" disabled={!dirty}>{isNew?'Importer le document':file?'Enregistrer la nouvelle version':'Enregistrer la fiche'}</button>
     </fieldset></form>
    </section><aside className="panel"><h2>Accès au document</h2><p>Une attribution donne accès aux enseignants et à la Direction de l’établissement. Chaque élève doit toujours activer son code personnel ; son parent y accède par le lien familial.</p>{isNew?<p>Après l’import, choisissez les établissements autorisés dans cette fiche.</p>:<><p><strong>{detail.document.active?'Document actif':'Document suspendu'}</strong></p><p>La suspension bloque la consultation pour tous, sans supprimer les codes ni l’historique.</p><div className="admin-library-actions">{detail.document.active&&<a className="button button-light" href={privateReadingPath(detail.document.id,'admin')} onClick={e=>{e.preventDefault();navigate(e.currentTarget.href);}}>Lire le document</a>}<button className="button button-light" disabled={disabled||dirty} onClick={()=>change('status',{active:!detail.document.active},detail.document.active?'Suspendre ce document ?':'Réactiver ce document ?',detail.document.active?'La lecture sera bloquée pour tous les comptes. Les codes et les versions seront conservés.':'Les accès existants redeviendront disponibles selon les attributions et les activations conservées.',detail.document.active?'Suspendre':'Réactiver')}>{detail.document.active?'Suspendre le document':'Réactiver le document'}</button></div><a href="/admin/licences" onClick={e=>{e.preventDefault();navigate(e.currentTarget.href);}}>Gérer les licences et codes <ArrowRight/></a></>}
    </aside></div>
    {detail&&<><section className="panel"><h2>Établissements autorisés</h2><p>Retirer une attribution bloque aussi les nouvelles activations de ce document pour l’école. Les anciennes activations restent conservées et reprennent effet si l’attribution est rétablie.</p><div className="admin-library-table"><table><thead><tr><th scope="col">Établissement</th><th scope="col">Attribution</th><th scope="col">Action</th></tr></thead><tbody>{detail.schools.map(s=><tr key={s.id}><td><strong>{s.name}</strong>{!s.active&&<small>Établissement suspendu</small>}</td><td>{s.assigned?(s.origin==='legacy'?'Accès historique conservé':'Attribué'):'Non attribué'}</td><td><button className="button button-light" disabled={disabled||dirty||(!s.active&&!s.assigned)} aria-label={(s.assigned?'Retirer l’accès à ':'Attribuer à ')+s.name} onClick={()=>change('assign',{schoolId:s.id,active:!s.assigned},s.assigned?'Retirer cette attribution ?':'Attribuer ce document ?',s.name+' · '+(s.assigned?'La lecture et les nouvelles activations seront bloquées pour cet établissement. Aucun code ne sera effacé.':'Les enseignants et la Direction pourront lire le document. Aucun compte ni code élève ne sera créé.'),s.assigned?'Retirer l’attribution':'Attribuer')}>{s.assigned?'Retirer':'Attribuer'}</button></td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Versions conservées</h2><p>Restaurer une version change le PDF courant, sans modifier le titre, les attributions ou les codes.</p><div className="admin-library-table"><table><thead><tr><th scope="col">Version</th><th scope="col">Fichier</th><th scope="col">Note</th><th scope="col">Action</th></tr></thead><tbody>{detail.versions.map(v=><tr key={v.version}><td><strong>Version {v.number}</strong><small>{new Date(v.createdAt*1000).toLocaleString('fr-MA')}</small></td><td>{v.pageCount} pages<small>{size(v.byteSize)}</small></td><td>{v.note||'—'}</td><td>{v.version===detail.document.version?<span className="status-pill active">Version actuelle</span>:<button className="button button-light" disabled={disabled||dirty} aria-label={'Restaurer la version '+v.number} onClick={()=>change('restore',{version:v.version},'Restaurer cette version ?','La version '+v.number+' redeviendra le PDF courant. Le fichier remplacé sera conservé dans cet historique.','Restaurer')}>Restaurer</button>}</td></tr>)}</tbody></table></div></section></>}
   </>}
  </main>
  <dialog ref={dialog} className="admin-library-dialog" aria-labelledby="library-confirm-title" onCancel={e=>{e.preventDefault();closeConfirm(false);}}><h2 id="library-confirm-title">{confirmation?.title}</h2><p>{confirmation?.message}</p><div className="admin-library-actions"><button className="button button-light" autoFocus onClick={()=>closeConfirm(false)}>Annuler</button><button className="button button-dark" onClick={()=>closeConfirm(true)}>{confirmation?.label}</button></div></dialog>
 </SchoolShell>;
}
