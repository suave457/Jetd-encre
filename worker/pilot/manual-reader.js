import {libraryGate} from './library-access.js';
import { all, first, fail, LIVE_SESSION_SQL, liveValues, now, reply } from './session.js';
import { effectiveRole } from './access-role.js';

// The provided test PDF never becomes a public asset, even if its metadata is copied remotely.
export async function readerContext(db,session){
  const role=await effectiveRole(db,session.user_id);
  if(role==='admin')return {...session,role,school_id:null};
  const membership=await first(db,`SELECT m.school_id,m.role FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
    WHERE m.user_id=? AND m.active=1 AND s.active=1 ORDER BY m.school_id LIMIT 1`,session.user_id);
  if(!membership||membership.role!==role||!['eleve','parent','enseignant','directeur'].includes(role))fail(403,'reader_access','Cet espace ne permet pas de consulter les manuels.');
  return {...session,...membership};
}
function scope(c){
  const base=LIVE_SESSION_SQL,values=liveValues(c);
  if(c.role==='admin')return {sql:base+' AND EXISTS(SELECT 1 FROM pilot_admins WHERE user_id=? AND active=1)',values:[...values,c.user_id]};
  const membership=`NOT EXISTS(SELECT 1 FROM pilot_admins WHERE user_id=? AND active=1)
    AND EXISTS(SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
      WHERE m.user_id=? AND m.school_id=? AND m.role=? AND m.active=1 AND s.active=1
      AND m.school_id=(SELECT mm.school_id FROM pilot_memberships mm JOIN pilot_schools ss ON ss.id=mm.school_id WHERE mm.user_id=m.user_id AND mm.active=1 AND ss.active=1 ORDER BY mm.school_id LIMIT 1))`;
  const params=[...values,c.user_id,c.user_id,c.school_id,c.role];
  let access=`code.school_id=? AND code.manual_id=manual.id AND code.revoked_at IS NULL`;
  params.push(c.school_id);
  if(c.role==='eleve'){access+=' AND code.student_id=? AND code.activated_at IS NOT NULL AND code.activated_at<=?';params.push(c.user_id,now());}
  else if(c.role==='parent'){
    access+=` AND code.activated_at IS NOT NULL AND code.activated_at<=? AND EXISTS(
      SELECT 1 FROM pilot_family_links f JOIN pilot_memberships child ON child.school_id=f.school_id AND child.user_id=f.student_id
      JOIN pilot_users u ON u.id=f.student_id
      WHERE f.school_id=code.school_id AND f.student_id=code.student_id AND f.parent_id=? AND f.active=1 AND child.role='eleve' AND child.active=1 AND u.active=1
      AND NOT EXISTS(SELECT 1 FROM pilot_admins WHERE user_id=f.student_id AND active=1))`;params.push(now(),c.user_id);
  }else{access+=' AND ((code.activated_at IS NOT NULL AND code.activated_at<=?) OR (code.student_id IS NULL AND (code.expires_at IS NULL OR code.expires_at>?)))';params.push(now(),now());}
  let accessSql='EXISTS(SELECT 1 FROM pilot_manual_codes code WHERE '+access+')';
  if(['enseignant','directeur'].includes(c.role)){accessSql='('+accessSql+' OR EXISTS(SELECT 1 FROM pilot_library_assignments la WHERE la.manual_id=manual.id AND la.school_id=? AND la.active=1))';params.push(c.school_id);}
  params.push(c.school_id);
  return {sql:base+' AND '+membership+' AND '+accessSql+' AND '+libraryGate('manual.id','?'),values:params};
}
async function records(db,c,id){
  const g=scope(c);
  return all(db,`SELECT manual.id,manual.title,manual.level,file.storage_key,file.sha256,file.byte_size,file.page_count,EXISTS(SELECT 1 FROM pilot_library_documents WHERE manual_id=manual.id) managed FROM pilot_manuals manual
    JOIN pilot_manual_files file ON file.manual_id=manual.id WHERE manual.active=1 AND file.scope='local_test'
    ${id?'AND manual.id=?':''} AND ${g.sql} ORDER BY manual.title,manual.id LIMIT 201`,...(id?[id]:[]),...g.values);
}
const view=r=>({id:r.id,title:r.title,level:r.level,pageCount:r.page_count,byteSize:r.byte_size,version:r.sha256,
  src:'/api/pilot/reader/'+encodeURIComponent(r.id)+'/versions/'+r.sha256+'/file',localTest:true});
export function byteRange(value,size){
  if(value===null)return {start:0,end:size-1,partial:false};
  const match=/^bytes=(\d*)-(\d*)$/.exec(value);
  if(!match||(!match[1]&&!match[2]))return null;
  const left=match[1]?Number(match[1]):null,right=match[2]?Number(match[2]):null;
  if((left!==null&&!Number.isSafeInteger(left))||(right!==null&&!Number.isSafeInteger(right)))return null;
  const start=left??Math.max(0,size-right),end=left!==null&&right!==null?Math.min(right,size-1):size-1;
  return start<0||start>=size||end<start||(left===null&&right===0)?null:{start,end,partial:true};
}
export async function handleManualReader(request,env,session,local){
  const url=new URL(request.url),fileMatch=url.pathname.match(/^\/api\/pilot\/reader\/([a-zA-Z0-9_-]{1,100})(?:(\/file)|\/versions\/([a-f0-9]{64})\/file)?$/);
  if(!local||session.assurance!=='local_fixture'||!env.LOCAL_MANUAL_FILES?.allowedUsers?.has(session.user_id))fail(404,'reader_unavailable','Aucun document privé disponible.');
  if(url.search)fail(422,'reader_query','Ce lien de lecture contient des paramètres inattendus.');
  if(url.pathname!=='/api/pilot/reader'&&!fileMatch)fail(404,'not_found','Document introuvable.');
  const isFile=Boolean(fileMatch?.[2]||fileMatch?.[3]);
  if(!['GET',...(isFile?['HEAD']:[])].includes(request.method))return reply({error:{code:'read_only',message:'Cet accès est réservé à la consultation.'}},405,{Allow:isFile?'GET, HEAD':'GET'});
  const c=await readerContext(env.DB,session),id=fileMatch?.[1],rows=await records(env.DB,c,id);
  if(rows.length>200)fail(503,'reader_capacity','Le catalogue est trop volumineux pour cette vue.');
  // Explicit live/session check also covers an empty catalogue without leaking records.
  const verify=async()=>{
    const current=await readerContext(env.DB,session);
    if(current.role!==c.role||current.school_id!==c.school_id||!await first(env.DB,`SELECT 1 WHERE ${LIVE_SESSION_SQL}`,...liveValues(session)))fail(403,'reader_access_changed','Votre accès a changé.');
    const next=await records(env.DB,c,id);
    if(JSON.stringify(rows)!==JSON.stringify(next))fail(403,'reader_access_changed','Votre accès au document a changé.');
  };
  if(id&&!rows.length)fail(404,'manual_unavailable','Ce document n’est pas disponible pour votre compte.');
  if(!isFile){await verify();return reply({userId:session.user_id,schoolId:c.school_id,role:c.role,manuals:rows.map(view),source:'private_local_test'});}
  const record=rows[0];
  if((fileMatch?.[3]&&fileMatch[3]!==record.sha256)||(record.managed&&fileMatch?.[2]&&request.headers.has('Range')))fail(404,'file_version_changed','Rouvrez le document pour lire sa version actuelle.');
  const range=byteRange(request.headers.get('Range'),record.byte_size);
  if(!range){await verify();return new Response(null,{status:416,headers:{'Content-Range':`bytes */${record.byte_size}`,'Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'}});}
  const opened=await env.LOCAL_MANUAL_FILES.open(record,range,request.method==='HEAD');
  if(!opened)fail(404,'file_unavailable','Le document privé n’est plus disponible sur cet ordinateur.');
  try{await verify();}catch(error){await opened.cancel();throw error;}
  const headers={'Content-Type':'application/pdf','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff',
    'Content-Disposition':'inline; filename="document-test-prive.pdf"','Accept-Ranges':'bytes','Content-Length':String(range.end-range.start+1)};
  if(range.partial)headers['Content-Range']=`bytes ${range.start}-${range.end}/${record.byte_size}`;
  return new Response(opened.body,{status:range.partial?206:200,headers});
}
