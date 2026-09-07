import { ARTICLE_FORMAT, ARTICLE_UUID, normalizeArticle } from '../../src/features/editorial/articleCore.js';
import { all, first, fail, hash, LIVE_SESSION_SQL, liveValues, now, readInput, reply } from './session.js';

const BASE='/api/pilot/admin/editorial';
export const GUARD=`EXISTS (SELECT 1 FROM pilot_admins WHERE user_id=? AND active=1) AND ${LIVE_SESSION_SQL}`;
export const values=session=>[session.user_id,...liveValues(session)];
const MANAGED=`e.item_type='article' AND e.audience='private' AND e.status IN ('draft','review','archived')
  AND CASE WHEN json_valid(v.payload_json) THEN json_extract(v.payload_json,'$.format') ELSE NULL END='${ARTICLE_FORMAT}'`;
const JOIN=`FROM beta_editorial_items e JOIN beta_content_versions v ON v.id=e.current_version_id AND v.content_id=e.id AND v.version_no=e.revision`;
const uuid=(id)=>{if(typeof id!=='string'||!ARTICLE_UUID.test(id))fail(422,'invalid_article_id','Référence d’article ou d’opération invalide.');return id;};
function article(input){try{return normalizeArticle(input);}catch(error){fail(422,'invalid_article',error.message);}}
export function decode(version) {
  let payload;try{payload=JSON.parse(version.payload_json);}catch{fail(409,'legacy_article','Cette ancienne version ne peut pas être modifiée par cet éditeur.');}
  if(payload?.format!==ARTICLE_FORMAT)fail(409,'legacy_article','Cette ancienne version ne peut pas être modifiée par cet éditeur.');
  return article(payload.article);
}
export async function live(db,session){if(!await first(db,`SELECT 1 allowed WHERE ${GUARD}`,...values(session)))fail(403,'admin_access_changed','Votre accès administrateur a changé. Reconnectez-vous.');}
export async function record(db,session,id) {
  const row=await first(db,`SELECT e.*,v.payload_json ${JOIN} WHERE e.id=? AND ${MANAGED} AND ${GUARD}`,id,...values(session));
  if(!row){await live(db,session);fail(404,'article_not_found','Cet article n’est pas disponible dans cet espace.');}
  return row;
}
const view=row=>({id:row.id,revision:row.revision,currentVersionId:row.current_version_id,createdAt:row.created_at,updatedAt:row.updated_at,article:decode(row)});
function paging(params,allowed) {
  for(const key of params.keys())if(!allowed.includes(key)||params.getAll(key).length!==1)fail(400,'invalid_article_filter','Les filtres de cette liste sont invalides.');
  const raw=params.get('offset')||'0';if(!/^\d{1,6}$/.test(raw)||Number(raw)>100000)fail(400,'invalid_article_page','Cette page n’est pas disponible.');
  return Number(raw);
}
export async function handleEditorial(request,db,session) {
  await live(db,session);
  const url=new URL(request.url),suffix=url.pathname.slice(BASE.length);
  if(request.method==='GET'&&!suffix){
    const offset=paging(url.searchParams,['offset','status','q']),status=url.searchParams.get('status')||'all',q=(url.searchParams.get('q')||'').trim();
    if(!['all','draft','review','archived'].includes(status)||q.length>100||/[\u0000-\u001f]/.test(q))fail(400,'invalid_article_filter','Les filtres de cette liste sont invalides.');
    const where=`${MANAGED} AND (?='all' OR e.status=?) AND instr(lower(e.title),lower(?))>0 AND ${GUARD}`;
    const args=[status,status,q,...values(session)];
    const counts=await first(db,`SELECT count(*) total,coalesce(sum(e.status='draft'),0) drafts,coalesce(sum(e.status='review'),0) review,coalesce(sum(e.status='archived'),0) archived ${JOIN} WHERE ${where}`,...args);
    const rows=await all(db,`SELECT e.id,e.title,e.status,e.revision,coalesce((SELECT action FROM beta_article_publication_events p WHERE p.content_id=e.id ORDER BY publication_no DESC LIMIT 1),'unpublished') publicationAction,e.updated_at updatedAt,json_extract(v.payload_json,'$.article.category') category,json_extract(v.payload_json,'$.article.theme') theme,json_extract(v.payload_json,'$.article.author') author ${JOIN} WHERE ${where} ORDER BY e.updated_at DESC,e.id LIMIT 25 OFFSET ?`,...args,offset);
    await live(db,session);
    return reply({userId:session.user_id,source:session.assurance==='local_fixture'?'local_fixture':'school_database',items:rows,counts,nextOffset:offset+rows.length<counts.total?offset+rows.length:null});
  }
  const route=suffix.match(/^\/([a-f0-9-]{36})(?:\/versions(?:\/([a-f0-9-]{36}))?)?$/);
  if(request.method==='GET'&&route){
    const id=uuid(route[1]),entry=await record(db,session,id);
    if(!suffix.includes('/versions')){paging(url.searchParams,[]);await live(db,session);return reply({userId:session.user_id,item:view(entry)});}
    if(route[2]){
      paging(url.searchParams,[]);
      const version=await first(db,`SELECT v.id,v.version_no,v.payload_json,v.created_by,v.created_at,v.reason FROM beta_content_versions v WHERE v.id=? AND v.content_id=? AND ${GUARD}`,uuid(route[2]),id,...values(session));
      if(!version)fail(404,'version_not_found','Cette version n’appartient pas à cet article.');
      await live(db,session);
      return reply({userId:session.user_id,version:{id:version.id,versionNo:version.version_no,createdBy:version.created_by,createdAt:version.created_at,reason:version.reason,article:decode(version)}});
    }
    const offset=paging(url.searchParams,['offset','revision']),anchor=url.searchParams.get('revision');
    if(anchor!==null&&(!/^[1-9]\d{0,6}$/.test(anchor)||Number(anchor)>entry.revision))fail(400,'invalid_article_page','La révision de cet historique est invalide.');
    const revision=anchor===null?entry.revision:Number(anchor);
    const currentVersionId=revision===entry.revision?entry.current_version_id:(await first(db,`SELECT id FROM beta_content_versions WHERE content_id=? AND version_no=? AND ${GUARD}`,id,revision,...values(session)))?.id;
    const rows=await all(db,`SELECT v.id,v.version_no versionNo,v.created_at createdAt,v.reason,coalesce(u.display_name,'Équipe éditoriale') actor FROM beta_content_versions v LEFT JOIN pilot_users u ON u.id=v.created_by WHERE v.content_id=? AND v.version_no<=? AND ${GUARD} ORDER BY v.version_no DESC LIMIT 20 OFFSET ?`,id,revision,...values(session),offset);
    await live(db,session);
    return reply({userId:session.user_id,versions:rows,currentVersionId,currentRevision:revision,nextOffset:offset+rows.length<revision?offset+rows.length:null});
  }
  if(request.method!=='POST'||suffix||url.search)fail(404,'not_found','Route inexistante.');
  const input=await readInput(request,64*1024);
  if(Object.keys(input).some(key=>!['id','operationId','action','baseRevision','sourceVersionId','article','reason'].includes(key)))fail(422,'invalid_article_command','Commande éditoriale invalide.');
  const id=uuid(input.id),op=uuid(input.operationId),action=input.action,base=input.baseRevision;
  if(!['create','save','restore','archive'].includes(action)||!Number.isSafeInteger(base)||base<0||base>1000000||(action==='create'?base!==0:base<1))fail(422,'invalid_article_command','Action ou version attendue invalide.');
  const reason=typeof input.reason==='string'?input.reason.trim():'';
  if(reason.length>300||/[\u0000-\u001f]/.test(reason))fail(422,'invalid_article_reason','Le motif doit tenir sur une ligne de 300 caractères.');
  let content,sourceVersionId=null;
  if(action==='restore'||action==='archive'){
    if(input.article!==undefined)fail(422,'invalid_article_command','Le texte de cette action est déterminé par le serveur.');
    await record(db,session,id);
    if(action==='restore'){
      sourceVersionId=uuid(input.sourceVersionId);
      const source=await first(db,`SELECT payload_json FROM beta_content_versions WHERE id=? AND content_id=? AND ${GUARD}`,sourceVersionId,id,...values(session));
      if(!source)fail(404,'version_not_found','Cette version n’appartient pas à cet article.');
      content={...decode(source),status:'draft'};
    }else{
      // Use the requested immutable version, not whichever version is current on retry.
      const source=await first(db,`SELECT payload_json FROM beta_content_versions WHERE content_id=? AND version_no=? AND ${GUARD}`,id,base,...values(session));
      if(!source)fail(409,'revision_conflict','La version demandée n’est plus disponible.');
      content={...decode(source),status:'archived'};
    }
  }else{content=article(input.article);if(content.status==='archived')fail(422,'invalid_article_command','Utilisez l’action Archiver pour conserver une trace explicite.');}
  if(action!=='restore'&&input.sourceVersionId!==undefined)fail(422,'invalid_article_command','Source de restauration inattendue.');
  const payload=JSON.stringify({format:ARTICLE_FORMAT,article:content,operation:{kind:action,contentId:id,baseRevision:base,sourceVersionId,reason}});
  const checksum=await hash(JSON.stringify([session.user_id,payload]));
  async function receipt(){
    const row=await first(db,`SELECT id,content_id,created_by,checksum,version_no FROM beta_content_versions WHERE id=? AND ${GUARD}`,op,...values(session));
    if(row&&(row.content_id!==id||row.created_by!==session.user_id||row.checksum!==checksum))fail(409,'operation_conflict','Cette référence a déjà confirmé une autre modification. Ne renvoyez pas un texte différent.');
    return row;
  }
  let saved=await receipt(),replayed=Boolean(saved);
  if(!saved){
    const time=new Date().toISOString(),guardValues=values(session),noReceipt='NOT EXISTS (SELECT 1 FROM beta_content_versions WHERE id=?)';
    const statement=(sql,...args)=>db.prepare(sql).bind(...args);
    const firstWrite=action==='create'
      ?statement(`INSERT INTO beta_editorial_items(id,item_type,title,status,audience,revision,current_version_id,created_at,updated_at) SELECT ?,'article',?,?,'private',1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM beta_editorial_items WHERE id=?) AND ${noReceipt} AND ${GUARD}`,id,content.title,content.status,op,time,time,id,op,...guardValues)
      :statement(`UPDATE beta_editorial_items SET title=?,status=?,revision=revision+1,current_version_id=?,updated_at=?,archived_at=? WHERE id=? AND revision=? AND (?='restore' OR status<>'archived') AND (?<>'archive' OR coalesce((SELECT action FROM beta_article_publication_events p WHERE p.content_id=beta_editorial_items.id ORDER BY publication_no DESC LIMIT 1),'unpublished')<>'publish') AND id IN (SELECT e.id ${JOIN} WHERE ${MANAGED}) AND ${noReceipt} AND ${GUARD}`,content.title,content.status,op,time,content.status==='archived'?time:null,id,base,action,action,op,...guardValues);
    const results=await db.batch([firstWrite,
      statement(`INSERT INTO beta_content_versions(id,content_id,version_no,payload_json,checksum,reason,created_by,created_at) SELECT ?,id,revision,?,?,?,?,? FROM beta_editorial_items WHERE id=? AND current_version_id=? AND changes()>0`,op,payload,checksum,reason||({create:'Création du brouillon',save:'Modification éditoriale',restore:'Restauration en brouillon',archive:'Archivage'}[action]),session.user_id,time,id,op),
      statement(`INSERT INTO pilot_admin_events(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0`,op,session.user_id,'article_'+action,id,now()),
    ]);
    replayed=!results[0]?.meta?.changes;
    saved=await receipt();
    if(!saved){await live(db,session);fail(409,'revision_conflict','Une autre modification a été enregistrée. Votre texte reste ici ; consultez la version actuelle avant de poursuivre.');}
  }
  const current=await record(db,session,id);await live(db,session);
  return reply({userId:session.user_id,replayed,savedVersion:{id:saved.id,versionNo:saved.version_no},item:view(current)},replayed?200:201);
}
