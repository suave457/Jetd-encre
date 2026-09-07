import { ArrowLeft, CheckCircle, PaperPlaneTilt, PencilSimple } from '@phosphor-icons/react/ssr';
import { ARTICLE_CATEGORIES, ARTICLE_STATUSES } from './articleCore.js';

// The active Git/Pen blog editor composition, shared by the two data adapters.
export default function ArticleEditorView({form,setForm,editingId,notice='',error='',busy=false,connected=false,locked=false,onBack,onSave,onPublish,canPublish=false,extraActions,ui:{PageHeader,DemoBadge}}){
  const field=(key)=>({value:form[key],disabled:busy||locked,onChange:event=>setForm({...form,[key]:event.target.value})});
  return <div className="admin-blog-editor">
    <PageHeader eyebrow="BLOG & ARTICLES" title={editingId?'Modifier l’article':'Nouvel article'} subtitle={connected?'Rédigez et préparez la relecture. Les brouillons restent privés.':'Rédigez, ciblez et préparez la publication dans le prototype local.'} serif action={<button className="button button-light" onClick={onBack} disabled={busy}><ArrowLeft/> Retour aux articles</button>}/>
    {notice&&<div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>{connected?'Suivi de l’article':'Enregistrement réussi'}</strong><small>{notice}</small></span></div>}
    {error&&<p className="access-error" role="alert">{error}</p>}
    {extraActions}
    <div className="blog-editor-layout">
      <form id="article-editor-form" className="panel blog-editor-form" onSubmit={event=>{event.preventDefault();onSave(false);}}>
        <h2>Contenu éditorial</h2>
        <label>Titre de l’article<input {...field('title')} required minLength={connected?3:undefined} maxLength={connected?180:undefined}/></label>
        <label>Chapô<textarea {...field('excerpt')} maxLength={connected?1200:undefined} placeholder="Résumez la promesse de l’article en deux phrases."/></label>
        <div className="form-two"><label>Catégorie<select {...field('category')}>{ARTICLE_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></label><label>Thème<input {...field('theme')} maxLength={connected?80:undefined}/></label></div>
        <div className="form-two"><label>Auteur<input {...field('author')} maxLength={connected?120:undefined}/></label><label>Statut<select {...field('status')}>{connected?Object.entries(ARTICLE_STATUSES).filter(([key])=>key!=='archived'||locked).map(([key,label])=><option key={key} value={key}>{label}</option>):['Brouillon','À réviser','Planifié','Publié'].map(label=><option key={label}>{label}</option>)}</select></label></div>
        {!connected&&form.status==='Planifié'&&<label>Date de publication<input type="date" min="2026-08-27" {...field('scheduleDate')}/></label>}
        <label>Corps de l’article<textarea className="rich-textarea" {...field('body')} maxLength={connected?12000:undefined} placeholder="Développez l’article avec des paragraphes clairs, des exemples marocains et une proposition immédiatement applicable."/></label>
        {connected&&<small>12 000 caractères maximum pour le corps. Le texte n’est conservé qu’après confirmation de l’enregistrement.</small>}
      </form>
      <aside className="panel article-preview-panel"><div className="panel-heading"><h2>Aperçu</h2>{connected?<span className="status-pill neutral">Non public</span>:<DemoBadge/>}</div><article className="mini-article-preview text-preview"><span>{form.category} · {form.theme}</span><h3>{form.title||'Titre de votre article'}</h3><p>{form.excerpt||'Le chapô apparaîtra ici.'}</p><small>{form.author||'Auteur à renseigner'}{!connected&&' · lecture estimée 6 min'}</small></article><p className="prototype-copy">{connected?'Enregistrer prépare une version privée pour l’équipe éditoriale. Le Mag public n’est pas modifié.':'Les modifications apparaissent dans l’aperçu local uniquement. Le site public n’est pas modifié.'}</p></aside>
    </div>
    <div className="blog-editor-actions"><button className="button button-light" type="submit" form="article-editor-form" disabled={busy||locked||!form.title.trim()}><PencilSimple/> {busy?'Enregistrement…':'Enregistrer'}</button><button className="button button-dark" type="button" title={connected?'Enregistrez vos modifications avant de prévisualiser et publier.':undefined} disabled={connected?!canPublish:busy||!form.title.trim()||!form.excerpt.trim()||!form.body.trim()} onClick={()=>connected?onPublish():onSave(true)}><PaperPlaneTilt/> Publier l’article</button></div>
    {connected&&<p className="prototype-copy">Enregistrez d’abord les modifications, puis prévisualisez la version avant de confirmer sa publication.</p>}
  </div>;
}
