import {useEffect,useRef,useState} from 'react';
import {X,Eye,PaperPlaneTilt} from '@phosphor-icons/react/ssr';
import {BlogArticleContent} from '../../App.jsx';
import {editorialRequest} from './articleCore.js';
import {ARTICLE_COVERS,publicArticle} from './publicationCore.js';
import './publication.css';

export default function PublicationPanel({item,userId,csrf,accessPending,onVerifyAccess,onClose,onPending,onAccessError}){
  const dialog=useRef(null),alive=useRef(true),sequence=useRef(0),command=useRef(null),flight=useRef(false);
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [imageId,setImageId]=useState(ARTICLE_COVERS[0].id),[imageAlt,setImageAlt]=useState(ARTICLE_COVERS[0].alt),[confirmed,setConfirmed]=useState(false),[preview,setPreview]=useState(null);
  const api=body=>editorialRequest('/'+item.id+'/publication',{userId,csrf,body});
  function failed(e){setError(e.message);if(e.status===401||e.status===403)onAccessError(e);}
  async function load(){const v=++sequence.current;setBusy(true);setError('');setConfirmed(false);setPreview(null);try{const result=await api();if(alive.current&&v===sequence.current){setData(result);if(result.publication.imageId){setImageId(result.publication.imageId);setImageAlt(result.publication.imageAlt);}}}catch(e){if(alive.current&&v===sequence.current)failed(e);}finally{if(alive.current&&v===sequence.current)setBusy(false);}}
  useEffect(()=>{alive.current=true;dialog.current.showModal();load();return()=>{alive.current=false;++sequence.current;dialog.current?.close();};},[]);
  function showPreview(){try{setPreview(publicArticle(item.id,item.article,{imageId,imageAlt,publishedAt:null}));setError('');}catch(e){setPreview(null);setError(e.message);}}
  async function send(next){
    if(accessPending||flight.current||!next||(command.current&&command.current!==next))return;
    flight.current=true;command.current=next;setBusy(true);setPending(true);onPending(true);setError('');setNotice('');
    try{const result=await api(next);if(!alive.current)return;command.current=null;setPending(false);onPending(false);setData(result);setConfirmed(false);setPreview(null);
      setNotice(result.receipt.revision===result.publication.revision?(result.publication.status==='published'?`La version ${result.publication.sourceVersionNo} est publiée dans le Mag.`:'L’article a été retiré du Mag. Son lien public n’est plus disponible.'):`Votre décision n°${result.receipt.revision} a été enregistrée. Une décision plus récente existe : la situation actuelle est affichée ci-dessous.`);
    }catch(e){if(!alive.current)return;if(e.status&&e.status<500){command.current=null;setPending(false);onPending(false);setConfirmed(false);setPreview(null);if(e.status===409)setData(null);}failed(e);}
    finally{flight.current=false;if(alive.current)setBusy(false);}
  }
  function publish(){if(!data||!confirmed||!preview||pending||busy||accessPending)return;send({operationId:crypto.randomUUID(),action:'publish',basePublicationRevision:data.publication.revision,confirmed:true,baseRevision:item.revision,sourceVersionId:item.currentVersionId,imageId,imageAlt});}
  function retract(){if(!data||pending||busy||accessPending||!window.confirm('Retirer cet article du Mag ? Son lien deviendra indisponible. Le brouillon et l’historique seront conservés.'))return;send({operationId:crypto.randomUUID(),action:'retract',basePublicationRevision:data.publication.revision,confirmed:true});}
  const locked=busy||pending||accessPending,publication=data?.publication;
  return <dialog ref={dialog} className="publication-dialog" aria-labelledby="publication-heading" onCancel={event=>{event.preventDefault();if(!busy&&!pending)onClose();}}>
    <section className="publication-controls"><header><div><span className="eyebrow">PUBLICATION CONTRÔLÉE</span><h2 id="publication-heading">{item.article.title}</h2></div><button className="icon-button" aria-label="Fermer la publication" disabled={busy||pending} onClick={onClose}><X/></button></header>
      <p>Version enregistrée {item.revision}. L’enregistrement du brouillon ne change jamais la version publique. Cette commande agit sur le site de cet environnement.</p>
      {accessPending&&<div role="status"><p>Vérifiez votre connexion pour continuer. La décision en attente est conservée.</p><button className="button button-light" disabled={busy} onClick={onVerifyAccess}>Vérifier la connexion</button></div>}
      {error&&<p className="access-error" role="alert">{error}</p>}{notice&&<p className="access-notice" role="status">{notice}</p>}
      {pending&&<div role="status"><p>La confirmation est inconnue. Ne préparez pas une nouvelle décision ; vérifiez le même envoi.</p><button className="button button-dark" disabled={busy||accessPending} onClick={()=>send(command.current)}>Réessayer le même envoi</button></div>}
      {!data&&!pending&&<button className="button button-light" disabled={locked} onClick={load}>{busy?'Vérification…':'Actualiser la situation'}</button>}
      {publication&&<><p><strong>{publication.status==='published'?`Publié · version ${publication.sourceVersionNo}`:publication.status==='retracted'?'Retiré du Mag':'Non publié'}</strong>{publication.status==='published'&&publication.sourceVersionId!==item.currentVersionId?' · Le brouillon courant est différent.':''}</p>
        {publication.status==='published'&&<div className="access-toolbar"><a className="button button-light" href={'/blog/'+publication.slug} target="_blank" rel="noopener noreferrer">Voir la version publique</a><button className="button button-light" disabled={locked} onClick={retract}>Retirer du Mag</button></div>}
        {item.article.status!=='archived'&&<><div className="form-two"><label>Illustration de couverture<select value={imageId} disabled={locked} onChange={event=>{const cover=ARTICLE_COVERS.find(x=>x.id===event.target.value);setImageId(cover.id);setImageAlt(cover.alt);setConfirmed(false);setPreview(null);}}>{ARTICLE_COVERS.map(cover=><option value={cover.id} key={cover.id}>{cover.label}</option>)}</select></label><label>Description de l’image<input type="text" value={imageAlt} minLength={5} maxLength={300} disabled={locked} onChange={event=>{setImageAlt(event.target.value);setConfirmed(false);setPreview(null);}}/></label></div>
        <button className="button button-light" disabled={locked} onClick={showPreview}><Eye/> Prévisualiser la version {item.revision}</button>
        <label className="publication-confirm"><input type="checkbox" checked={confirmed} disabled={locked||!preview} onChange={event=>setConfirmed(event.target.checked)}/><span>J’ai relu l’aperçu, validé la signature, l’illustration et ses droits d’utilisation. Je confirme la publication de cette version sur le Mag.</span></label>
        <button className="button button-dark" disabled={locked||!confirmed||!preview} onClick={publish}><PaperPlaneTilt/> {publication.status==='published'?'Mettre à jour la version publique':'Confirmer la publication'} · v{item.revision}</button></>}
        {data.history.length>0&&<details className="publication-log"><summary>20 dernières décisions de publication</summary><ol>{data.history.map(event=><li key={event.id}>{event.action==='publish'?`Publication de la version ${event.sourceVersionNo}`:'Retrait'} · {new Date(event.createdAt).toLocaleString('fr-MA')}</li>)}</ol></details>}
      </>}
    </section>
    {preview&&<div className="publication-preview" onClickCapture={event=>{if(event.target.closest('a')){event.preventDefault();event.stopPropagation();}}}><BlogArticleContent slug={preview.slug} publicArticles={[preview]} preview/></div>}
  </dialog>;
}
