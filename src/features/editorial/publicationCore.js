import { PUBLIC_BLOG_ARTICLES } from '../../publicContentArticles.js';
import { ARTICLE_UUID, normalizeArticle } from './articleCore.js';

export const ARTICLE_COVERS=Object.freeze(PUBLIC_BLOG_ARTICLES.map(item=>({id:item.slug,image:item.image,alt:item.imageAlt,label:item.theme})));
export const publicationSlug=id=>'article-'+id;
export const publicationId=slug=>typeof slug==='string'&&slug.startsWith('article-')&&ARTICLE_UUID.test(slug.slice(8))?slug.slice(8):null;
export function publicationImage(imageId,imageAlt){
  const cover=ARTICLE_COVERS.find(item=>item.id===imageId);
  if(!cover||typeof imageAlt!=='string'||imageAlt.trim().length<5||imageAlt.length>300||/[\u0000-\u001f\u007f]/.test(imageAlt))throw new Error('Choisissez une illustration disponible et décrivez-la en 5 à 300 caractères.');
  return {imageId:cover.id,image:cover.image,imageAlt:imageAlt.trim()};
}
export function publicArticle(id,input,{imageId,imageAlt,publishedAt},detail=true){
  const article=normalizeArticle({...input,status:'review'}),cover=publicationImage(imageId,imageAlt);
  const count=(article.body.match(/\S+/gu)||[]).length;
  return {slug:publicationSlug(id),title:article.title,excerpt:article.excerpt,category:article.category,theme:article.theme,author:article.author,image:cover.image,imageAlt:cover.imageAlt,publishedAt:publishedAt||null,date:publishedAt?new Date(publishedAt).toLocaleDateString('fr-MA',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Casablanca'}):'Date fixée lors de la publication',readTime:Math.max(1,Math.ceil(count/200))+' min',source:'publication',...(detail?{body:article.body,sections:[]}: {})};
}
