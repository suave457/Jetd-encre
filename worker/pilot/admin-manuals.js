import { all, first, fail, now, readInput, reply, requiredText } from './session.js';

export async function handleAdminManuals(request,db,session,guard,values) {
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/api/pilot/admin/manuals'){
    const raw=url.searchParams.get('offset')||'0';
    if(url.searchParams.getAll('offset').length>1||!/^\d{1,7}$/.test(raw))fail(422,'invalid_offset','Page invalide.');
    const offset=Number(raw),time=now();
    const manuals=await all(db,'SELECT id,title,level,active FROM pilot_manuals ORDER BY title,id');
    const counts=await first(db,`SELECT count(*) total,
      coalesce(sum(revoked_at IS NOT NULL),0) revoked,
      coalesce(sum(revoked_at IS NULL AND student_id IS NOT NULL),0) activated,
      coalesce(sum(revoked_at IS NULL AND student_id IS NULL AND (expires_at IS NULL OR expires_at>?)),0) available,
      coalesce(sum(revoked_at IS NULL AND student_id IS NULL AND expires_at<=?),0) expired
      FROM pilot_manual_codes`,time,time);
    const codes=await all(db,`SELECT code.id,code.school_id schoolId,code.manual_id manualId,
      code.created_at createdAt,code.expires_at expiresAt,code.revoked_at revokedAt,code.activated_at activatedAt,
      school.name schoolName,manual.title,manual.level
      FROM pilot_manual_codes code JOIN pilot_manuals manual ON manual.id=code.manual_id
      JOIN pilot_schools school ON school.id=code.school_id
      ORDER BY code.created_at DESC,code.id LIMIT 50 OFFSET ?`,offset);
    if(!await first(db,`SELECT 1 allowed WHERE ${guard}`,...values))fail(403,'admin_access_changed','Votre accès a changé. Reconnectez-vous.');
    return reply({userId:session.user_id,generatedAt:time,manuals,counts,codes,nextOffset:offset+codes.length<counts.total?offset+codes.length:null});
  }
  if(request.method==='POST'&&url.pathname==='/api/pilot/admin/manual-code-revoke'){
    const input=await readInput(request),id=requiredText(input.id,'Référence',36,36);
    if(Object.keys(input).some(key=>key!=='id'))fail(422,'invalid_request','Seule la référence du code est attendue.');
    const existing=await first(db,`SELECT id,revoked_at FROM pilot_manual_codes WHERE id=? AND ${guard}`,id,...values);
    if(!existing)fail(404,'code_missing','Code introuvable ou accès modifié.');
    if(existing.revoked_at!=null)return reply({ok:true,id,replayed:true});
    const result=await db.batch([
      db.prepare(`UPDATE pilot_manual_codes SET revoked_at=? WHERE id=? AND revoked_at IS NULL AND ${guard}`).bind(now(),id,...values),
      db.prepare(`INSERT INTO pilot_admin_events(id,actor_id,action,target_id,created_at) SELECT ?,?,'manual_code_revoked',?,? WHERE changes()>0 AND ${guard}`).bind(crypto.randomUUID(),session.user_id,id,now(),...values),
    ]);
    if(!result[0]?.meta?.changes)fail(409,'access_changed','Le code ou vos droits ont changé. Actualisez la liste.');
    return reply({ok:true,id});
  }
  fail(404,'not_found','Route inexistante.');
}
