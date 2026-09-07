import {all,first,fail,hash,now,readInput,reply,checkCsrf} from './session.js';
import {GUARD,values,live} from './editorial.js';

const BASE='/api/pilot/admin/library',ID=/^[a-zA-Z0-9_-]{1,100}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,SHA=/^[a-f0-9]{64}$/;
const JOIN=`FROM pilot_manuals m JOIN pilot_manual_files f ON f.manual_id=m.id LEFT JOIN pilot_library_documents d ON d.manual_id=m.id`;
const SELECT=`SELECT m.id,m.title,m.level,m.active,f.storage_key,f.sha256,f.byte_size,f.page_count,f.created_at file_created_at,COALESCE(d.revision,0) revision,COALESCE(d.assignment_mode,'legacy') assignment_mode,COALESCE(d.description,'') description ${JOIN}`;
const documentView=r=>({id:r.id,title:r.title,level:r.level,active:Boolean(r.active),revision:r.revision,description:r.description,assignmentMode:r.assignment_mode,version:r.sha256,byteSize:r.byte_size,pageCount:r.page_count});
const versionView=r=>({version:r.sha256,number:r.version_no,byteSize:r.byte_size,pageCount:r.page_count,note:r.note,createdAt:r.created_at});
async function snapshot(db,id){return first(db,SELECT+" WHERE m.id=? AND f.scope='local_test'",id);}
function text(value,label,max,optional=false,multiline=false){
  if(multiline&&typeof value==='string')value=value.replace(/\r\n?/g,'\n');
  if(typeof value!=='string'||value.trim().length>(max)||(!optional&&!value.trim())||(multiline?/[\u0000-\u0008\u000b-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(value))fail(422,'library_input',label+' est invalide.');
  return value.trim();
}
export function libraryCommand(input,upload){
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.requestId!=='string'||!UUID.test(input.requestId)||typeof input.manualId!=='string'||!ID.test(input.manualId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||input.expectedRevision>1000000)fail(422,'library_input','Référence ou version attendue invalide.');
  const action=upload?'import':input.action,keys=['requestId','manualId','expectedRevision',...(upload?['title','level','description','note','fileSize']:['action',...(action==='describe'?['title','level','description']:action==='assign'?['schoolId','active']:action==='status'?['active']:action==='restore'?['version']:[])])];
  if(Object.keys(input).some(k=>!keys.includes(k))||!['import','describe','assign','status','restore'].includes(action))fail(422,'library_input','Commande de bibliothèque invalide.');
  const c={requestId:input.requestId,manualId:input.manualId,expectedRevision:input.expectedRevision,action};
  if(['import','describe'].includes(action)){c.title=text(input.title,'Le titre',140);c.level=text(input.level,'Le niveau',80);c.description=text(input.description??'','La description',400,true,true);}
  if(upload){c.note=text(input.note??'','La note de version',240,true);c.fileSize=input.fileSize;if(!Number.isSafeInteger(c.fileSize)||c.fileSize<1||c.fileSize>209715200)fail(413,'pdf_size','Le PDF doit peser au maximum 200 Mo.');}
  if(['assign','status'].includes(action)){if(typeof input.active!=='boolean')fail(422,'library_input','Statut invalide.');c.active=input.active;}
  if(action==='assign'){if(typeof input.schoolId!=='string'||!ID.test(input.schoolId))fail(422,'library_input','Établissement invalide.');c.schoolId=input.schoolId;}
  if(action==='restore'){if(typeof input.version!=='string'||!SHA.test(input.version))fail(422,'library_input','Version invalide.');c.version=input.version;}
  return c;
}
async function receipt(db,session,id,checksum){
  const row=await first(db,'SELECT actor_id,request_hash,state,result_json FROM pilot_library_operations WHERE id=?',id);
  await live(db,session);
  if(!row)return null;
  if(row.actor_id!==session.user_id||(checksum&&row.request_hash!==checksum))fail(409,'operation_conflict','Cette référence correspond à une autre opération.');
  if(row.state!=='committed')fail(409,'operation_pending','Cette opération doit être vérifiée avant de recommencer.');
  return JSON.parse(row.result_json);
}
export async function handleAdminLibrary(request,env,session,local){
  const files=env.LOCAL_MANUAL_FILES,db=env.DB,url=new URL(request.url),suffix=url.pathname.slice(BASE.length);
  if(!local||session.assurance!=='local_fixture'||!files?.libraryEnabled||!files.allowedUsers?.has(session.user_id))fail(404,'library_unavailable','La gestion des PDF privés est disponible uniquement dans la recette locale.');
  await live(db,session);
  if(url.search)fail(422,'library_query','Ce lien contient des paramètres inattendus.');
  if(request.method==='GET'){
    if(!suffix){
      const rows=await all(db,SELECT+" WHERE f.scope='local_test' ORDER BY m.title,m.id LIMIT 201");
      if(rows.length>200)fail(503,'library_capacity','Le catalogue a atteint la capacité de cette recette.');
      await live(db,session);return reply({userId:session.user_id,source:'private_local_test',documents:rows.map(documentView)});
    }
    const operation=suffix.match(/^\/operations\/([a-f0-9-]{36})$/);
    if(operation&&UUID.test(operation[1]))return reply({userId:session.user_id,receipt:await receipt(db,session,operation[1]),processing:Boolean(files.operations?.has(operation[1]))});
    const detail=suffix.match(/^\/([a-zA-Z0-9_-]{1,100})$/);
    if(detail){
      const r=await snapshot(db,detail[1]);if(!r)fail(404,'manual_missing','Document privé introuvable.');
      const versions=await all(db,'SELECT * FROM pilot_library_versions WHERE manual_id=? ORDER BY version_no DESC LIMIT 201',r.id);
      if(versions.length>200)fail(503,'library_capacity','L’historique a atteint la capacité de cette recette.');
      if(!versions.some(v=>v.sha256===r.sha256))versions.unshift({...r,version_no:1,note:'Version initiale',created_at:r.file_created_at});
      const schools=await all(db,`SELECT s.id,s.name,s.active,la.active explicit,
        EXISTS(SELECT 1 FROM pilot_manual_codes c WHERE c.school_id=s.id AND c.manual_id=? AND c.revoked_at IS NULL AND ((c.activated_at IS NOT NULL AND c.activated_at<=?) OR (c.student_id IS NULL AND (c.expires_at IS NULL OR c.expires_at>?)))) legacy
        FROM pilot_schools s LEFT JOIN pilot_library_assignments la ON la.school_id=s.id AND la.manual_id=? ORDER BY s.name,s.id LIMIT 201`,r.id,now(),now(),r.id);
      if(schools.length>200)fail(503,'library_capacity','La liste des écoles a atteint la capacité de cette recette.');
      await live(db,session);
      return reply({userId:session.user_id,source:'private_local_test',document:documentView(r),versions:versions.map(versionView),schools:schools.map(s=>({id:s.id,name:s.name,active:Boolean(s.active),assigned:s.explicit===null?r.assignment_mode==='legacy'&&Boolean(s.legacy):Boolean(s.explicit),origin:s.explicit===null?'legacy':'explicit'}))});
    }
    fail(404,'not_found','Route inexistante.');
  }
  if(request.method!=='POST'||!['','/imports'].includes(suffix))fail(404,'not_found','Route inexistante.');
  checkCsrf(request,session);
  const upload=suffix==='/imports';let input;
  if(upload){const header=request.headers.get('X-Library-Command');if(!header||header.length>12000)fail(422,'library_input','Les informations du document sont trop longues.');try{input=JSON.parse(decodeURIComponent(header));}catch{fail(422,'library_input','Informations du document invalides.');}}
  else input=await readInput(request,8000);
  const c=libraryCommand(input,upload);
  files.operations??=new Set();
  if(files.operations.has(c.requestId))fail(409,'operation_pending','Cette opération est encore en cours. Vérifiez son état dans un instant.');
  files.operations.add(c.requestId);
  try{
  // Imports include the received digest in their receipt, never a client-supplied checksum.
  let checksum=upload?null:await hash(JSON.stringify(c));
  if(!upload){const done=await receipt(db,session,c.requestId,checksum);if(done)return reply(done);}
  const priorUpload=upload?await receipt(db,session,c.requestId):null;
  const original=await snapshot(db,c.manualId),create=!original;
  if(create&&(!upload||c.expectedRevision!==0||c.manualId!=='manuel-test-'+c.requestId))fail(404,'manual_missing','Document privé introuvable.');
  if(original&&original.revision!==c.expectedRevision&&!priorUpload){
    // A lost upload response is resolved through the receipt endpoint before retrying the bytes.
    fail(409,'revision_conflict','Ce document a changé. Vérifiez l’opération puis actualisez la fiche.');
  }
  if(create&&await first(db,'SELECT id FROM pilot_manuals WHERE id=?',c.manualId))fail(409,'manual_conflict','Cette référence existe déjà.');
  let file=null;
  if(upload){
    file=await files.receive(request,c.fileSize);
    checksum=await hash(JSON.stringify([c,file.sha256,file.byte_size,file.page_count]));
    const done=await receipt(db,session,c.requestId,checksum);if(done)return reply(done);
  }else if(c.action==='restore'){
    file=await first(db,'SELECT storage_key,sha256,byte_size,page_count FROM pilot_library_versions WHERE manual_id=? AND sha256=?',c.manualId,c.version);
    if(!file||!await files.verify(file))fail(404,'version_missing','Cette version ne peut pas être restaurée : son fichier privé n’est pas disponible.');
  }
  if(file&&await first(db,'SELECT manual_id FROM pilot_manual_files WHERE storage_key=? AND manual_id<>?',file.storage_key,c.manualId))fail(409,'duplicate_pdf','Ce PDF est déjà utilisé par un autre document. Aucun remplacement effectué.');
  if(c.action==='assign'&&!await first(db,'SELECT id FROM pilot_schools WHERE id=? AND (?=0 OR active=1)',c.schoolId,Number(c.active)))fail(422,'school_unavailable','Cet établissement n’est pas disponible pour cette attribution.');
  if(request.signal.aborted)fail(503,'import_incomplete','La connexion a été interrompue avant confirmation.');
  await live(db,session);
  const time=now(),result={ok:true,userId:session.user_id,id:c.manualId,requestId:c.requestId,revision:c.expectedRevision+1,action:c.action,...(c.action==='assign'?{schoolId:c.schoolId,active:c.active}:c.action==='status'?{active:c.active}:{}),...(file?{version:file.sha256}:{})};
  const statement=(sql,...params)=>db.prepare(sql).bind(...params);
  const match=create?{sql:'NOT EXISTS(SELECT 1 FROM pilot_manuals WHERE id=?)',args:[c.manualId]}:{sql:`EXISTS(SELECT 1 ${JOIN} WHERE m.id=? AND f.scope='local_test' AND COALESCE(d.revision,0)=? AND m.title=? AND m.level=? AND m.active=? AND f.sha256=?)`,args:[c.manualId,c.expectedRevision,original.title,original.level,original.active,original.sha256]};
  if(c.action==='assign'){match.sql+=' AND EXISTS(SELECT 1 FROM pilot_schools WHERE id=? AND (?=0 OR active=1))';match.args.push(c.schoolId,Number(c.active));}
  if(create)match.sql+=" AND (SELECT count(*) FROM pilot_manual_files WHERE scope='local_test')<200";
  if(upload){match.sql+=' AND ((SELECT count(*) FROM pilot_library_versions WHERE manual_id=?)<199 OR EXISTS(SELECT 1 FROM pilot_library_versions WHERE manual_id=? AND sha256=?))';match.args.push(c.manualId,c.manualId,file.sha256);}
  // The claim and every gated write share a single transaction. A committed retry cannot replay writes.
  const gate=`EXISTS(SELECT 1 FROM pilot_library_operations WHERE id=? AND actor_id=? AND request_hash=? AND state='applying')`,g=[c.requestId,session.user_id,checksum];
  const steps=[statement(`INSERT INTO pilot_library_operations(id,actor_id,manual_id,request_hash,state,result_json,created_at) SELECT ?,?,?,?,'applying',?,? WHERE ${GUARD} AND ${match.sql} ON CONFLICT(id) DO NOTHING`,...g.slice(0,2),c.manualId,checksum,JSON.stringify(result),time,...values(session),...match.args)];
  if(create)steps.push(statement(`INSERT INTO pilot_manuals(id,title,level,active) SELECT ?,?,?,1 WHERE ${gate}`,c.manualId,c.title,c.level,...g));
  steps.push(statement(`INSERT INTO pilot_library_documents(manual_id,revision,assignment_mode,description,created_by,created_at,updated_at)
    SELECT ?,?,?,?, ?,?,? WHERE ${gate} ON CONFLICT(manual_id) DO UPDATE SET revision=excluded.revision,description=excluded.description,updated_at=excluded.updated_at`,c.manualId,result.revision,create?'explicit':original.assignment_mode,c.description??original?.description??'',session.user_id,time,time,...g));
  if(original)steps.push(statement(`INSERT INTO pilot_library_versions(manual_id,sha256,version_no,storage_key,byte_size,page_count,note,created_at)
    SELECT ?,?,1,?,?,?,'Version initiale conservée',? WHERE ${gate} AND NOT EXISTS(SELECT 1 FROM pilot_library_versions WHERE manual_id=? AND sha256=?)`,c.manualId,original.sha256,original.storage_key,original.byte_size,original.page_count,original.file_created_at,...g,c.manualId,original.sha256));
  if(upload)steps.push(statement(`INSERT INTO pilot_library_versions(manual_id,sha256,version_no,storage_key,byte_size,page_count,note,created_by,created_at)
    SELECT ?,?,COALESCE((SELECT max(version_no) FROM pilot_library_versions WHERE manual_id=?),0)+1,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(manual_id,sha256) DO NOTHING`,c.manualId,file.sha256,c.manualId,file.storage_key,file.byte_size,file.page_count,c.note,session.user_id,time,...g));
  if(file)steps.push(statement(`INSERT INTO pilot_manual_files(manual_id,storage_key,sha256,byte_size,page_count,scope,created_at)
    SELECT ?,?,?,?,?,'local_test',? WHERE ${gate} ON CONFLICT(manual_id) DO UPDATE SET storage_key=excluded.storage_key,sha256=excluded.sha256,byte_size=excluded.byte_size,page_count=excluded.page_count`,c.manualId,file.storage_key,file.sha256,file.byte_size,file.page_count,time,...g));
  if(['import','describe'].includes(c.action))steps.push(statement(`UPDATE pilot_manuals SET title=?,level=? WHERE id=? AND ${gate}`,c.title,c.level,c.manualId,...g));
  if(c.action==='status')steps.push(statement(`UPDATE pilot_manuals SET active=? WHERE id=? AND ${gate}`,Number(c.active),c.manualId,...g));
  if(c.action==='assign')steps.push(statement(`INSERT INTO pilot_library_assignments(manual_id,school_id,active,updated_by,updated_at) SELECT ?,?,?,?,? WHERE ${gate}
    ON CONFLICT(manual_id,school_id) DO UPDATE SET active=excluded.active,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,c.manualId,c.schoolId,Number(c.active),session.user_id,time,...g));
  steps.push(statement(`INSERT INTO pilot_admin_events(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE ${gate}`,c.requestId,session.user_id,'library_'+c.action,c.manualId,time,...g));
  steps.push(statement(`UPDATE pilot_library_operations SET state='committed' WHERE id=? AND ${gate}`,c.requestId,...g));
  try{await db.batch(steps);}catch{await live(db,session);const done=await receipt(db,session,c.requestId,checksum);if(done)return reply(done);fail(409,'library_conflict','La modification n’a pas été confirmée. Vérifiez l’état de l’opération puis actualisez.');}
  const done=await receipt(db,session,c.requestId,checksum);
  if(!done)fail(409,'revision_conflict','L’accès ou le document a changé pendant l’opération. Aucun remplacement confirmé.');
  return reply(done);
  }finally{files.operations.delete(c.requestId);}
}
