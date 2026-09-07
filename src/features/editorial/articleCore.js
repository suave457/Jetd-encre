export const ARTICLE_FORMAT = 'jde-blog-draft/v1';
export const ARTICLE_CATEGORIES = Object.freeze(['Parents', 'Enseignants', 'Enfants']);
export const ARTICLE_STATUSES = Object.freeze({ draft: 'Brouillon', review: 'À réviser', archived: 'Archivé' });
export const ARTICLE_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const emptyArticle = () => ({title:'',excerpt:'',body:'',category:'Parents',theme:'',author:'',status:'draft'});
export function normalizeArticle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !Object.hasOwn(emptyArticle(), key))) throw new Error('Les champs de cet article ne sont pas valides.');
  const text = (key, label, min, max) => {
    const value = input[key];
    if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`${label} : entre ${min} et ${max} caractères attendus.`);
    return value.replace(/\r\n?/g, '\n').trim();
  };
  const article = {title:text('title','Titre',3,180),excerpt:text('excerpt','Chapô',0,1200),body:text('body','Corps de l’article',0,12000),category:input.category,theme:text('theme','Thème',0,80),author:text('author','Auteur',0,120),status:input.status};
  if (!ARTICLE_CATEGORIES.includes(article.category) || !Object.hasOwn(ARTICLE_STATUSES, article.status)) throw new Error('Choisissez une catégorie et un statut disponibles.');
  if (article.status === 'review' && (article.excerpt.length < 20 || article.body.length < 80 || article.author.length < 2 || article.theme.length < 2)) throw new Error('Avant la révision, complétez le chapô (20 caractères), le corps (80 caractères), l’auteur et le thème.');
  return article;
}
export function parseArticleLocation(search) {
  const values = new URLSearchParams(search).getAll('article');
  if (!values.length) return {id:null,creating:false,error:''};
  if (values.length !== 1 || (values[0] !== 'nouveau' && !ARTICLE_UUID.test(values[0]))) return {id:null,creating:false,error:'Ce lien d’article est invalide. Revenez à la liste.'};
  return {id:values[0] === 'nouveau' ? null : values[0],creating:values[0] === 'nouveau',error:''};
}
export async function editorialRequest(path, {userId,csrf,body,signal,fetcher=globalThis.fetch}={}) {
  let response;
  try { response = await fetcher('/api/pilot/admin/editorial'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf||''},...(body===undefined?{}:{body:JSON.stringify(body)})}); }
  catch(error) { if(error.name==='AbortError')throw error; throw new Error('La connexion a été interrompue. Votre texte reste ici ; réessayez le même envoi.'); }
  let data;
  try { data = await response.json(); }
  catch { const error=new Error('La réponse du serveur est illisible. La confirmation est inconnue ; réessayez le même envoi.');if(response.status===401||response.status===403)error.status=response.status;throw error; }
  if(!response.ok){const error=new Error(data.error?.message||'Le serveur n’a pas confirmé l’opération.');error.status=response.status;error.code=data.error?.code;throw error;}
  if(data.userId!==userId){const error=new Error('Le compte a changé. Reconnectez-vous avant de continuer.');error.status=403;throw error;}
  return data;
}
