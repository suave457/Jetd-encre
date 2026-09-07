import { useEffect, useRef, useState } from 'react';
import { Archive, ArrowClockwise, Clock, Copy, Eye, FileText, PencilSimple, Plus, X } from '@phosphor-icons/react/ssr';
import PageHeader from '../../PageHeader.jsx';
import ArticleEditorView from '../editorial/ArticleEditorView.jsx';
import PublicationPanel from '../editorial/PublicationPanel.jsx';
import { ARTICLE_STATUSES, editorialRequest, emptyArticle, normalizeArticle, parseArticleLocation } from '../editorial/articleCore.js';
import './admin-editorial.css';

function VersionDrawer({history,preview,busy,pending,reading,error,accessPending,onVerifyAccess,onClose,onRead,onRestore,onMore,onRetry}){
  const dialog=useRef(null);
  useEffect(()=>{const element=dialog.current;element.showModal();return()=>element.close();},[]);
  return <dialog ref={dialog} className="beta-history-drawer editorial-history" aria-label="Historique de l’article" onCancel={event=>{event.preventDefault();if(!busy&&!pending)onClose();}}>
    <div><span>VERSIONS ENREGISTRÉES</span><h2>{history.title}</h2></div><button className="icon-button" aria-label="Fermer l’historique" disabled={busy||pending} onClick={onClose}><X/></button>
    {accessPending&&<section><p role="status">La vérification de votre accès est nécessaire avant de continuer. Les textes ouverts restent conservés ici.</p><button className="button button-light" disabled={busy} onClick={onVerifyAccess}>Vérifier la connexion</button></section>}
    {pending&&<section><p role="status">La restauration n’est pas encore confirmée.</p><button className="button button-dark" disabled={busy||accessPending} onClick={onRetry}>Réessayer le même envoi</button></section>}
    <section><p>Chaque restauration crée un nouveau brouillon. L’historique reste intact.</p>{error&&<p className="access-error" role="alert">{error}</p>}{history.versions.map(version=><article key={version.id}><Clock/><span><strong>Version {version.versionNo}{version.id===history.currentVersionId?' · actuelle':''}</strong><small>{new Date(version.createdAt).toLocaleString('fr-MA')} · {version.actor}</small><small>{version.reason}</small></span><button className="button button-light" disabled={busy||pending||reading} onClick={()=>onRead(version.id)}>Lire v{version.versionNo}</button></article>)}{history.nextOffset!==null&&<button className="button button-light" disabled={busy||pending||reading} onClick={onMore}>Versions précédentes</button>}</section>
    {preview&&<section className="editorial-version-preview"><h3>Version {preview.versionNo} · {preview.article.title}</h3><p>{preview.article.category} · {preview.article.theme} · {preview.article.author||'Auteur non renseigné'} · {ARTICLE_STATUSES[preview.article.status]}</p><p>{preview.article.excerpt||'Sans chapô'}</p><div className="editorial-body">{preview.article.body||'Corps non renseigné'}</div><button className="button button-dark" disabled={busy||pending||reading} onClick={()=>onRestore(preview.id)}><ArrowClockwise/> Restaurer v{preview.versionNo} en brouillon</button></section>}
  </dialog>;
}
export default function AdminEditorial({userId,csrf,accessPending=false,onVerifyAccess}){
  const [location,setLocation]=useState(()=>parseArticleLocation(window.location.search));
  const [list,setList]=useState(null),[filters,setFilters]=useState({status:'all',q:''}),[search,setSearch]=useState('');
  const [item,setItem]=useState(null),[form,setForm]=useState(emptyArticle),[baseline,setBaseline]=useState('');
  const [loading,setLoading]=useState(false),[saving,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [publicationOpen,setPublicationOpen]=useState(false),[publicationPending,setPublicationPending]=useState(false);
  const busy=saving||accessPending||publicationPending;
  const [history,setHistory]=useState(null),[preview,setPreview]=useState(null),[historyError,setHistoryError]=useState(''),[conflict,setConflict]=useState(false),[pending,setPending]=useState(false);
  const [remote,setRemote]=useState(null),[reading,setReading]=useState(false);
  const epoch=useRef(0),sequence=useRef(0),request=useRef(null),newId=useRef(null),lastPath=useRef(window.location.pathname+window.location.search),guard=useRef({}),formRef=useRef(form),installedPath=useRef(null),preparedDraft=useRef(null),inFlight=useRef(false),drawerSequence=useRef(0),drawerId=useRef(null),viewSequence=useRef(0);
  const dirty=Boolean(baseline)&&JSON.stringify(form)!==baseline;
  formRef.current=form;guard.current={dirty,busy,pending};
  const api=(path='',body)=>editorialRequest(path,{userId,csrf,body});
  function failed(e){if(e.status===401||e.status===403){setPublicationOpen(false);setPublicationPending(false);++epoch.current;setItem(null);setList(null);setForm(emptyArticle());setBaseline('');setHistory(null);setPreview(null);setRemote(null);request.current=null;setPending(false);window.dispatchEvent(new Event('focus'));}setError(e.message);}
  function install(next){setItem(next);setForm(next.article);setBaseline(JSON.stringify(next.article));setConflict(false);setRemote(null);}
  function canLeave(){if(guard.current.busy||guard.current.pending){setError('Terminez ou vérifiez l’envoi en cours avant de quitter cet article.');return false;}return !guard.current.dirty||window.confirm('Quitter cet article sans enregistrer les modifications ?');}
  function navigate(id=null,creating=false,draft=null){if(!canLeave())return false;++viewSequence.current;if(creating)preparedDraft.current=draft;const target='/admin/blog'+(id?'?article='+id:creating?'?article=nouveau':'');lastPath.current=target;window.history.pushState({},'',target);setLocation(parseArticleLocation(window.location.search));setNotice('');setError('');return true;}
  useEffect(()=>{
    const pop=()=>{if(!canLeave()){window.history.pushState({},'',lastPath.current);return;}++viewSequence.current;lastPath.current=window.location.pathname+window.location.search;setLocation(parseArticleLocation(window.location.search));};
    const unload=event=>{if(guard.current.dirty||guard.current.pending||guard.current.busy){event.preventDefault();event.returnValue='';}};
    const leaving=event=>{const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.getAttribute('href')?.startsWith('#')||anchor.target==='_blank'||event.ctrlKey||event.metaKey||event.shiftKey)return;if(!canLeave()){event.preventDefault();event.stopPropagation();}};
    const signOut=event=>{if(!canLeave())event.preventDefault();};
    window.addEventListener('popstate',pop);window.addEventListener('beforeunload',unload);document.addEventListener('click',leaving,true);window.addEventListener('jde:before-school-logout',signOut);
    return()=>{++epoch.current;window.removeEventListener('popstate',pop);window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leaving,true);window.removeEventListener('jde:before-school-logout',signOut);};
  },[]);
  async function loadList(offset=0){const v=++sequence.current,life=epoch.current;setLoading(true);setError('');try{const params=new URLSearchParams({...filters,offset:String(offset)});const result=await api('?'+params);if(v===sequence.current&&life===epoch.current)setList(previous=>({...result,items:offset?[...(previous?.items||[]),...result.items].filter((entry,index,all)=>all.findIndex(candidate=>candidate.id===entry.id)===index):result.items}));}catch(e){if(v===sequence.current&&life===epoch.current)failed(e);}finally{if(v===sequence.current&&life===epoch.current)setLoading(false);}}
  async function loadItem(id){const v=++sequence.current,life=epoch.current;setLoading(true);setError('');setItem(null);try{const result=await api('/'+id);if(v===sequence.current&&life===epoch.current)install(result.item);}catch(e){if(v===sequence.current&&life===epoch.current)failed(e);}finally{if(v===sequence.current&&life===epoch.current)setLoading(false);}}
  useEffect(()=>{
    if(installedPath.current===location.id&&location.id){installedPath.current=null;return;}
    ++drawerSequence.current;drawerId.current=null;setReading(false);
    ++sequence.current;setPublicationOpen(false);setHistory(null);setPreview(null);setConflict(false);setRemote(null);setBaseline('');setItem(null);
    if(location.error){setError(location.error);return;}
    if(location.creating){newId.current=crypto.randomUUID();const blank=emptyArticle();setForm(preparedDraft.current||blank);preparedDraft.current=null;setBaseline(JSON.stringify(blank));setLoading(false);}
    else if(location.id)loadItem(location.id);else loadList();
  },[location.id,location.creating,location.error]);
  useEffect(()=>{if(!location.id&&!location.creating&&!location.error){setList(null);loadList();}},[filters]);
  async function send(command){
    if(accessPending||inFlight.current||!command||(request.current&&request.current!==command))return;inFlight.current=true;const life=epoch.current;request.current=command;setBusy(true);setPending(true);setError('');setHistoryError('');setNotice('');
    try{const result=await api('',command);if(life!==epoch.current)return;request.current=null;setPending(false);closeHistory();
      const target='/admin/blog?article='+result.item.id;window.history.replaceState({},'',target);lastPath.current=target;
      // Change the location without refetching/clearing a confirmed form on creation.
      if(result.savedVersion.id===result.item.currentVersionId){install(result.item);setNotice(`Version ${result.savedVersion.versionNo} enregistrée. Le Mag public n’a pas été modifié.`);}
      else{setItem(previous=>previous||{...result.item,article:formRef.current});setConflict(true);setRemote(result.item);setNotice(`La version ${result.savedVersion.versionNo} a bien été enregistrée ; une version plus récente existe déjà.`);}
      if(location.id!==result.item.id){installedPath.current=result.item.id;setLocation({id:result.item.id,creating:false,error:''});}
    }catch(e){if(life!==epoch.current)return;if(e.status&&e.status<500){request.current=null;setPending(false);}if(e.status===409)setConflict(true);if(history)setHistoryError(e.message);failed(e);}
    finally{inFlight.current=false;if(life===epoch.current)setBusy(false);}
  }
  function save(){if(pending||conflict||loading)return;let article;try{article=normalizeArticle(form);}catch(e){setError(e.message);return;}send({id:item?.id||newId.current,operationId:crypto.randomUUID(),action:item?'save':'create',baseRevision:item?.revision||0,article,reason:''});}
  function closeHistory(){++drawerSequence.current;drawerId.current=null;setHistory(null);setPreview(null);setReading(false);}
  async function openHistory(entry=item){
    if(!entry||busy||pending)return;const life=epoch.current,v=++drawerSequence.current,view=viewSequence.current;drawerId.current=entry.id;setHistoryError('');setPreview(null);
    try{const result=await api('/'+entry.id+'/versions');if(life===epoch.current&&v===drawerSequence.current&&view===viewSequence.current)setHistory({...result,id:entry.id,title:entry.article?.title||entry.title,revision:result.currentRevision});}catch(e){if(life===epoch.current&&v===drawerSequence.current)failed(e);}
  }
  async function readVersion(id){
    if(!history||busy||pending||reading)return;const life=epoch.current,v=++drawerSequence.current,target=history.id;setReading(true);setHistoryError('');setPreview(null);
    try{const result=await api('/'+target+'/versions/'+id);if(life===epoch.current&&v===drawerSequence.current&&drawerId.current===target)setPreview(result.version);}
    catch(e){if(life===epoch.current&&v===drawerSequence.current){setHistoryError(e.message);failed(e);}}
    finally{if(v===drawerSequence.current&&life===epoch.current)setReading(false);}
  }
  async function moreVersions(){
    if(!history||busy||pending||reading)return;const life=epoch.current,v=++drawerSequence.current,target=history.id;setReading(true);
    try{const result=await api('/'+target+'/versions?offset='+history.nextOffset+'&revision='+history.currentRevision);if(life===epoch.current&&v===drawerSequence.current&&drawerId.current===target)setHistory(previous=>previous?.id===target?{...previous,...result,versions:[...previous.versions,...result.versions].filter((entry,index,all)=>all.findIndex(candidate=>candidate.id===entry.id)===index)}:previous);}
    catch(e){if(life===epoch.current&&v===drawerSequence.current){setHistoryError(e.message);failed(e);}}
    finally{if(v===drawerSequence.current&&life===epoch.current)setReading(false);}
  }
  function restore(id){if(pending||busy||reading)return;if((dirty&&!window.confirm('Restaurer cette version et abandonner vos modifications non enregistrées ?'))||!window.confirm('Créer un nouveau brouillon à partir de cette version ? Les versions précédentes seront conservées.'))return;send({id:history.id,operationId:crypto.randomUUID(),action:'restore',baseRevision:history.revision,sourceVersionId:id,reason:'Restauration choisie dans l’historique'});}
  async function archive(entry){if(pending||busy)return;if(!window.confirm(`Archiver « ${entry.title} » ? Il restera disponible dans les archives et l’historique.`))return;send({id:entry.id,operationId:crypto.randomUUID(),action:'archive',baseRevision:entry.revision,reason:'Archivage depuis la liste'});}
  async function duplicate(entry){if(busy||pending)return;const life=epoch.current,view=viewSequence.current;try{const result=await api('/'+entry.id);if(life!==epoch.current||view!==viewSequence.current)return;const draft={...result.item.article,title:('Copie — '+result.item.article.title).slice(0,180),status:'draft'};if(navigate(null,true,draft))setNotice('Copie préparée. Enregistrez pour créer un article distinct.');}catch(e){if(life===epoch.current&&view===viewSequence.current)failed(e);}}
  async function seeCurrent(){const life=epoch.current,view=viewSequence.current;try{const result=await api('/'+(item?.id||newId.current));if(life===epoch.current&&view===viewSequence.current)setRemote(result.item);}catch(e){if(life===epoch.current&&view===viewSequence.current)failed(e);}}
  const feedback=<>{pending&&<div className="access-panel" role="status"><p>L’envoi n’est pas encore confirmé. Le texte envoyé est conservé ici, sans modification.</p><button className="button button-dark" disabled={busy} onClick={()=>send(request.current)}>Réessayer le même envoi</button></div>}{conflict&&<section className="access-panel"><p>Votre texte n’a pas été remplacé. Consultez la version enregistrée avant de reprendre.</p><button className="button button-light" onClick={seeCurrent}>Voir la version enregistrée</button>{remote&&<><h3>Version {remote.revision} · {remote.article.title}</h3><p>{remote.article.excerpt}</p><div className="editorial-body">{remote.article.body}</div><button className="button button-dark" onClick={()=>{if(window.confirm('Remplacer le texte de cet écran par la version enregistrée ?')){install(remote);setError('');}}}>Reprendre cette version</button></>}</section>}</>;
  const drawer=history&&<VersionDrawer history={history} preview={preview} busy={saving} pending={pending} reading={reading||accessPending} accessPending={accessPending} onVerifyAccess={onVerifyAccess} error={historyError} onClose={closeHistory} onRead={readVersion} onRestore={restore} onMore={moreVersions} onRetry={()=>send(request.current)}/>;
  if(location.error)return <section className="access-panel"><h1>Article indisponible</h1><p role="alert">{location.error}</p><button className="button button-light" onClick={()=>navigate()}>Retour aux articles</button></section>;
  if(location.id||location.creating)return <div className="school-editorial">{loading?<p role="status">Chargement de l’article…</p>:location.id&&!item?<section className="access-panel"><h1>Article indisponible</h1><p role="alert">{error}</p><button className="button button-light" onClick={()=>loadItem(location.id)}>Réessayer</button><button className="button button-light" onClick={()=>navigate()}>Retour aux articles</button></section>:<ArticleEditorView form={form} setForm={setForm} editingId={item?.id} connected locked={accessPending||pending||publicationOpen||conflict||item?.article.status==='archived'} busy={saving||publicationPending} notice={notice} error={error} onBack={()=>navigate()} onSave={save} onPublish={()=>setPublicationOpen(true)} canPublish={Boolean(item)&&!dirty&&!busy&&!pending&&!conflict&&!loading&&item.article.status!=='archived'} ui={{PageHeader}} extraActions={<>{feedback}{item&&<div className="access-toolbar"><span>Version {item.revision} · {dirty?'Modifications non enregistrées':'Version enregistrée'}</span><button className="button button-light" disabled={busy||pending} onClick={()=>openHistory()}><Clock/> Historique des versions</button></div>}</>}/ >}{drawer}{publicationOpen&&item&&<PublicationPanel key={item.id} item={item} userId={userId} csrf={csrf} accessPending={accessPending} onVerifyAccess={onVerifyAccess} onPending={setPublicationPending} onAccessError={failed} onClose={()=>setPublicationOpen(false)}/>}</div>;
  return <div className="school-editorial">
    <PageHeader eyebrow="PUBLICATION ÉDITORIALE" title="Blog & articles" subtitle="Préparez les contenus destinés aux familles et aux équipes pédagogiques." serif action={<button className="button button-dark" onClick={()=>navigate(null,true)} disabled={busy||pending}><Plus/> Nouvel article</button>}/>
    <p className="prototype-inline-note">{list?.source==='local_fixture'?'Environnement local de test. ':''}Brouillons privés pour l’équipe administratrice. Seule une publication explicitement confirmée modifie le Mag.</p>
    {error&&<p className="access-error" role="alert">{error}</p>}{notice&&<p className="access-notice" role="status">{notice}</p>}{feedback}
    {list&&<div className="kpi-grid">{[['Brouillons',list.counts.drafts],['À réviser',list.counts.review],['Archives',list.counts.archived],['Total',list.counts.total]].map(([label,value])=><article className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong><small>Recherche et statut sélectionnés</small></article>)}</div>}
    <form className="access-toolbar" onSubmit={event=>{event.preventDefault();setFilters(previous=>({...previous,q:search.trim()}));}}><label>Rechercher un article<input value={search} maxLength={100} onChange={event=>setSearch(event.target.value)}/></label><button className="button button-light" disabled={busy||pending}>Rechercher</button></form>
    <div className="library-toolbar blog-admin-toolbar"><div className="tabs-inline" aria-label="Filtrer les articles">{Object.entries({all:'Tous',...ARTICLE_STATUSES}).map(([key,label])=><button key={key} disabled={busy||pending} className={filters.status===key?'active':''} aria-pressed={filters.status===key} onClick={()=>setFilters(previous=>({...previous,status:key}))}>{label}</button>)}</div><a href="/blog" className="button button-light"><Eye/> Voir le Mag public</a></div>
    {loading&&<p role="status">Chargement des articles…</p>}
    {list&&<div className="admin-article-list store-articles">{list.items.map(entry=><article key={entry.id}><span className="article-placeholder"><FileText weight="duotone"/></span><div className="admin-article-title"><span>{entry.category} · {entry.theme}</span><strong>{entry.title}</strong><small>{entry.author||'Auteur à renseigner'} · {new Date(entry.updatedAt).toLocaleString('fr-MA')}</small></div><span className={'status-pill '+(entry.status==='draft'?'neutral':'warning')}>{ARTICLE_STATUSES[entry.status]}</span><span className="article-performance"><strong>{entry.publicationAction==='publish'?'Publié':'Non publié'}</strong><small>Brouillon v{entry.revision}</small></span><span className="row-actions"><button disabled={busy||pending} aria-label={`Modifier ${entry.title}`} onClick={()=>navigate(entry.id)}><PencilSimple/></button><button disabled={busy||pending} aria-label={`Historique de ${entry.title}`} onClick={()=>openHistory(entry)}><Clock/></button><button disabled={busy||pending} aria-label={`Dupliquer ${entry.title}`} onClick={()=>duplicate(entry)}><Copy/></button><button disabled={busy||pending||entry.status==='archived'||entry.publicationAction==='publish'} title={entry.publicationAction==='publish'?'Retirez d’abord cet article du Mag.':undefined} aria-label={`Archiver ${entry.title}`} onClick={()=>archive(entry)}><Archive/></button></span></article>)}</div>}
    {list&&!list.items.length&&!loading&&<div className="empty-state"><FileText/><h3>Aucun article dans cette liste</h3><p>Choisissez un autre filtre ou créez un nouvel article. Les articles de démonstration ne sont pas importés ici.</p></div>}
    {list?.nextOffset!=null&&<button className="button button-light" disabled={loading||busy||pending} onClick={()=>loadList(list.nextOffset)}>Charger les articles suivants</button>}{drawer}
  </div>;
}
