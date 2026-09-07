import { ARTICLE_UUID, normalizeArticle } from '../../src/features/editorial/articleCore.js';
import { publicationImage, publicationSlug } from '../../src/features/editorial/publicationCore.js';
import { all, first, fail, hash, now, readInput, reply } from './session.js';
import { GUARD, values, live, record, decode } from './editorial.js';

async function state(db,session,id){
  const rows=await all(db,`SELECT p.id,p.publication_no,p.action,p.source_version_no,p.image_id,p.image_alt,p.created_at,v.id source_id FROM beta_article_publication_events p LEFT JOIN beta_content_versions v ON v.content_id=p.content_id AND v.version_no=p.source_version_no WHERE p.content_id=? AND ${GUARD} ORDER BY p.publication_no DESC LIMIT 20`,id,...values(session));
  await live(db,session);const row=rows[0];
  return {publication:{revision:row?.publication_no||0,status:row?(row.action==='publish'?'published':'retracted'):'unpublished',slug:publicationSlug(id),sourceVersionId:row?.source_id||null,sourceVersionNo:row?.source_version_no||null,imageId:row?.image_id||null,imageAlt:row?.image_alt||null,publishedAt:row?.action==='publish'?row.created_at:null},history:rows.map(row=>({id:row.id,revision:row.publication_no,action:row.action,sourceVersionNo:row.source_version_no,createdAt:row.created_at}))};
}
export async function handleArticlePublication(request,db,session,id){
  await live(db,session);if(!ARTICLE_UUID.test(id))fail(422,'invalid_article_id','Référence d’article invalide.');
  if(new URL(request.url).search)fail(400,'invalid_filter','Ce lien de publication est invalide.');
  const entry=await record(db,session,id);
  if(request.method==='GET')return reply({userId:session.user_id,...await state(db,session,id)});
  if(request.method!=='POST')fail(405,'method_not_allowed','Méthode indisponible.');
  const input=await readInput(request),{operationId,action,basePublicationRevision}=input;
  const publishing=action==='publish',allowed=publishing?['operationId','action','basePublicationRevision','confirmed','baseRevision','sourceVersionId','imageId','imageAlt']:['operationId','action','basePublicationRevision','confirmed'];
  if(Object.keys(input).some(key=>!allowed.includes(key))||!ARTICLE_UUID.test(operationId||'')||!['publish','retract'].includes(action)||input.confirmed!==true||!Number.isSafeInteger(basePublicationRevision)||basePublicationRevision<0||basePublicationRevision>1000000)fail(422,'invalid_publication','Vérifiez la version choisie et confirmez explicitement votre décision.');
  let source=null,cover=null;
  if(publishing){
    if(!Number.isSafeInteger(input.baseRevision)||input.baseRevision<1||!ARTICLE_UUID.test(input.sourceVersionId||''))fail(422,'invalid_publication','La version choisie est invalide.');
    source=await first(db,`SELECT * FROM beta_content_versions WHERE id=? AND content_id=? AND ${GUARD}`,input.sourceVersionId,id,...values(session));
    if(!source)fail(404,'version_not_found','Cette version n’appartient pas à cet article.');
    try{normalizeArticle({...decode(source),status:'review'});cover=publicationImage(input.imageId,input.imageAlt);}catch(error){if(error instanceof Response)throw error;fail(422,'invalid_publication',error.message);}
  }
  const requestHash=await hash(JSON.stringify([session.user_id,id,action,basePublicationRevision,publishing?input.baseRevision:null,publishing?input.sourceVersionId:null,cover?.imageId||null,cover?.imageAlt||null]));
  async function receipt(){const row=await first(db,`SELECT id,content_id,publication_no,action,actor_id,request_hash FROM beta_article_publication_events WHERE id=? AND ${GUARD}`,operationId,...values(session));if(row&&(row.content_id!==id||row.actor_id!==session.user_id||row.request_hash!==requestHash))fail(409,'operation_conflict','Cette référence correspond déjà à une autre décision.');return row;}
  let saved=await receipt(),replayed=Boolean(saved);
  if(!saved){
    if(await first(db,`SELECT id FROM pilot_admin_events WHERE id=? UNION ALL SELECT id FROM beta_content_versions WHERE id=?`,operationId,operationId))fail(409,'operation_conflict','Cette référence est déjà utilisée.');
    const time=new Date().toISOString(),statement=(sql,...args)=>db.prepare(sql).bind(...args);
    const condition=publishing?`e.revision=? AND e.current_version_id=? AND e.status<>'archived'`:`EXISTS(SELECT 1 FROM beta_article_publication_events last WHERE last.content_id=e.id AND last.publication_no=? AND last.action='publish')`;
    const args=publishing?[input.baseRevision,input.sourceVersionId]:[basePublicationRevision];
    const result=await db.batch([
      statement(`INSERT INTO beta_article_publication_events(id,content_id,publication_no,action,source_version_no,image_id,image_alt,request_hash,actor_id,created_at) SELECT ?,e.id,?,?,?,?,?,?,?,? FROM beta_editorial_items e WHERE e.id=? AND e.item_type='article' AND e.audience='private' AND ${condition} AND coalesce((SELECT max(publication_no) FROM beta_article_publication_events WHERE content_id=e.id),0)=? AND NOT EXISTS(SELECT 1 FROM beta_article_publication_events WHERE id=?) AND NOT EXISTS(SELECT 1 FROM pilot_admin_events WHERE id=?) AND NOT EXISTS(SELECT 1 FROM beta_content_versions WHERE id=?) AND ${GUARD}`,operationId,basePublicationRevision+1,action,source?.version_no||null,cover?.imageId||null,cover?.imageAlt||null,requestHash,session.user_id,time,id,...args,basePublicationRevision,operationId,operationId,operationId,...values(session)),
      statement(`INSERT INTO pilot_admin_events(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0`,operationId,session.user_id,'article_'+action,id,now()),
    ]);
    replayed=!result[0]?.meta?.changes;saved=await receipt();
    if(!saved){await live(db,session);fail(409,'publication_conflict','Le brouillon ou la publication a changé. Relisez la situation actuelle avant de confirmer une nouvelle décision.');}
  }
  await record(db,session,id);
  return reply({userId:session.user_id,replayed,receipt:{id:saved.id,revision:saved.publication_no,action:saved.action},...await state(db,session,id)},replayed?200:201);
}
