import { all, first, fail, reply, hash } from './pilot/session.js';
import { ARTICLE_FORMAT } from '../src/features/editorial/articleCore.js';
import { publicArticle, publicationId } from '../src/features/editorial/publicationCore.js';

const LATEST=`NOT EXISTS(SELECT 1 FROM beta_article_publication_events newer WHERE newer.content_id=p.content_id AND newer.publication_no>p.publication_no)`;
const SELECT=`SELECT p.id decision_id,p.content_id,p.image_id,p.image_alt,p.created_at,v.payload_json
  FROM beta_article_publication_events p JOIN beta_editorial_items e ON e.id=p.content_id
  JOIN beta_content_versions v ON v.content_id=p.content_id AND v.version_no=p.source_version_no
  WHERE p.action='publish' AND e.item_type='article' AND e.audience='private' AND e.status<>'archived' AND ${LATEST}`;
const searchField="json_extract(v.payload_json,'$.article.title')||' '||json_extract(v.payload_json,'$.article.excerpt')||' '||json_extract(v.payload_json,'$.article.theme')";
const foldedSearch=[...'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ'].reduce((sql,char)=>"replace("+sql+",'"+char+"','"+char.toLowerCase()+"')",'('+searchField+')');
async function catalogueRevision(db){return hash(String((await first(db,'SELECT count(*) n FROM beta_article_publication_events')).n));}
function project(row,detail){const payload=JSON.parse(row.payload_json);if(payload.format!==ARTICLE_FORMAT)throw new Error('Invalid publication format');return publicArticle(row.content_id,payload.article,{imageId:row.image_id,imageAlt:row.image_alt,publishedAt:row.created_at},detail);}
async function stillPublished(db,row){return Boolean(await first(db,`SELECT p.id FROM beta_article_publication_events p JOIN beta_editorial_items e ON e.id=p.content_id WHERE p.id=? AND p.action='publish' AND e.status<>'archived' AND ${LATEST}`,row.decision_id));}
export async function readPublicArticle(db,slug){
  const id=publicationId(slug);if(!id)fail(404,'article_not_found','Cet article n’est pas disponible.');
  const row=await first(db,SELECT+' AND p.content_id=?',id);
  if(!row)fail(404,'article_not_found','Cet article n’est pas disponible.');
  const article=project(row,true);
  if(!await stillPublished(db,row))fail(404,'article_not_found','Cet article n’est plus disponible.');
  return article;
}
export async function handlePublicArticles(request,env){
  try{
    if(!['GET','HEAD'].includes(request.method))fail(405,'method_not_allowed','Cette consultation est disponible en lecture seulement.');
    if(!env.DB)fail(503,'public_articles_unavailable','Les articles publiés sont temporairement indisponibles.');
    const url=new URL(request.url),suffix=url.pathname.slice('/api/public/articles'.length);
    let result;
    if(suffix){if(url.search||!/^\/article-[a-f0-9-]{36}$/.test(suffix))fail(404,'article_not_found','Cet article n’est pas disponible.');result={article:await readPublicArticle(env.DB,suffix.slice(1))};}
    else{
      for(const key of url.searchParams.keys())if(!['q','category','offset','revision'].includes(key)||url.searchParams.getAll(key).length!==1)fail(400,'invalid_filter','Les filtres sont invalides.');
      const q=(url.searchParams.get('q')||'').trim(),category=url.searchParams.get('category')||'Tous',offset=url.searchParams.get('offset')||'0';
      if(q.length>100||/[\u0000-\u001f]/.test(q)||!['Tous','Parents','Enseignants','Enfants'].includes(category)||!/^\d{1,6}$/.test(offset)||Number(offset)>100000)fail(400,'invalid_filter','Les filtres sont invalides.');
      const revision=await catalogueRevision(env.DB),requestedRevision=url.searchParams.get('revision');
      if(requestedRevision!==null&&!/^[a-f0-9]{64}$/.test(requestedRevision))fail(400,'invalid_filter','La référence de pagination est invalide.');
      if((Number(offset)>0&&!requestedRevision)||(requestedRevision&&requestedRevision!==revision))fail(409,'catalogue_changed','Le Mag a été mis à jour. Actualisez la liste avant de poursuivre.');
      const rows=await all(env.DB,SELECT+` AND (?='Tous' OR json_extract(v.payload_json,'$.article.category')=?) AND instr(lower(${foldedSearch}),?)>0 ORDER BY p.created_at DESC,p.id DESC LIMIT 26 OFFSET ?`,category,category,q.toLowerCase(),Number(offset));
      const page=rows.slice(0,25);
      const visible=page.length?await all(env.DB,`SELECT p.id FROM beta_article_publication_events p JOIN beta_editorial_items e ON e.id=p.content_id WHERE p.id IN (${page.map(()=>'?').join(',')}) AND p.action='publish' AND e.item_type='article' AND e.audience='private' AND e.status<>'archived' AND ${LATEST}`,...page.map(row=>row.decision_id)):[];
      const ids=new Set(visible.map(row=>row.id)),items=page.filter(row=>ids.has(row.decision_id)).map(row=>project(row,false));
      result={items,nextOffset:rows.length>25?Number(offset)+25:null,revision};
    }
    const response=reply(result,200,{'X-Robots-Tag':'noindex, nofollow'});
    return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  }catch(error){const response=error instanceof Response?error:reply({error:{code:'public_articles_unavailable',message:'Les articles publiés sont temporairement indisponibles.'}},503);return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;}
}
