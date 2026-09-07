import {libraryGate} from './library-access.js';
import { all, first, fail, hash, LIVE_SESSION_SQL, liveValues, now, readInput, reply, requiredText, run } from './session.js';
import { effectiveRole, requireProfile } from './access-role.js';

// A code only attributes an existing catalogue item. This module never provisions identities.
function studentGuard(c) {
  return {sql:`EXISTS (SELECT 1 FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
    WHERE m.school_id=? AND m.user_id=? AND m.role='eleve' AND m.active=1 AND s.active=1)
    AND NOT EXISTS (SELECT 1 FROM pilot_admins WHERE user_id=? AND active=1) AND ${LIVE_SESSION_SQL}`,
  values:[c.school_id,c.user_id,c.user_id,...liveValues(c)]};
}
const view=record=>({id:record.id,manualId:record.manual_id,title:record.title,level:record.level,activatedAt:record.activated_at});
async function owned(db,c,libraryEnabled=false) {
  const guard=studentGuard(c);
  return all(db,`SELECT code.id,code.manual_id,code.activated_at,manual.title,manual.level
    FROM pilot_manual_codes code JOIN pilot_manuals manual ON manual.id=code.manual_id
    WHERE code.school_id=? AND code.student_id=? AND code.revoked_at IS NULL AND manual.active=1 AND ${libraryEnabled?libraryGate('code.manual_id','code.school_id'):'1=1'} AND ${guard.sql}
    ORDER BY code.activated_at DESC,code.id`,c.school_id,c.user_id,...guard.values);
}
export async function handleManuals(request,db,c,path,libraryEnabled=false) {
  requireProfile(await effectiveRole(db,c.user_id),'eleve');
  const guard=studentGuard(c);
  if(!await first(db,`SELECT 1 allowed WHERE ${guard.sql}`,...guard.values))fail(403,'student_access_required','Un compte élève actif est nécessaire.');
  if(request.method==='GET'&&path==='/api/pilot/manuals') {
    const manuals=await owned(db,c,libraryEnabled);
    if(!await first(db,`SELECT 1 allowed WHERE ${guard.sql}`,...guard.values))fail(403,'student_access_changed','Ton accès a changé. Reconnecte-toi.');
    if(libraryEnabled&&JSON.stringify(manuals)!==JSON.stringify(await owned(db,c,libraryEnabled)))fail(403,'manual_access_changed','L’accès aux documents a changé. Actualise la page.');
    return reply({userId:c.user_id,schoolId:c.school_id,manuals:manuals.map(view)});
  }
  if(request.method!=='POST'||path!=='/api/pilot/manuals/activate')fail(404,'not_found','Route inexistante.');
  const input=await readInput(request);
  // Reject attribution hints rather than silently treating them as trusted.
  if(Object.keys(input).some(key=>key!=='code'))fail(422,'invalid_activation','Seul le code du manuel est attendu.');
  const raw=requiredText(input.code,'Code',1,100);
  const code=raw.toUpperCase().replaceAll(/\s/g,''),valid=/^JDE-(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/.test(code);
  const digest=valid?await hash(code):null;
  const replay=async()=>digest?first(db,`SELECT code.*,manual.title,manual.level FROM pilot_manual_codes code
    JOIN pilot_manuals manual ON manual.id=code.manual_id WHERE code.code_hash=? AND code.school_id=? AND code.student_id=?
    AND code.revoked_at IS NULL AND manual.active=1 AND ${libraryEnabled?libraryGate('code.manual_id','code.school_id'):'1=1'} AND ${guard.sql}`,digest,c.school_id,c.user_id,...guard.values):null;
  const previous=await replay();
  if(previous)return reply({userId:c.user_id,schoolId:c.school_id,manual:view(previous),replayed:true});
  const time=now(),bucket=Math.floor(time/900);
  const quota=await run(db,`INSERT INTO pilot_manual_attempts(school_id,student_id,bucket,attempts)
    SELECT ?,?,?,1 WHERE ${guard.sql}
    ON CONFLICT(school_id,student_id) DO UPDATE SET
    attempts=CASE WHEN pilot_manual_attempts.bucket < excluded.bucket THEN 1 ELSE pilot_manual_attempts.attempts+1 END,
    bucket=max(pilot_manual_attempts.bucket,excluded.bucket)
    WHERE pilot_manual_attempts.bucket < excluded.bucket OR pilot_manual_attempts.attempts < 10`,
    c.school_id,c.user_id,bucket,...guard.values);
  if(!quota.meta?.changes){
    const confirmed=await replay();
    if(confirmed)return reply({userId:c.user_id,schoolId:c.school_id,manual:view(confirmed),replayed:true});
    fail(429,'activation_rate_limit','Trop de tentatives. Attends quinze minutes avant de réessayer.');
  }
  if(!valid)fail(422,'code_invalid','Ce code n’est pas reconnu. Vérifie les lettres et les chiffres.');
  const result=await run(db,`UPDATE pilot_manual_codes SET student_id=?,activated_at=?
    WHERE code_hash=? AND school_id=? AND student_id IS NULL AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at>?) AND EXISTS (SELECT 1 FROM pilot_manuals WHERE id=manual_id AND active=1)
    AND ${libraryEnabled?libraryGate('pilot_manual_codes.manual_id','pilot_manual_codes.school_id'):'1=1'}
    AND NOT EXISTS (SELECT 1 FROM pilot_manual_codes previous WHERE previous.school_id=pilot_manual_codes.school_id
      AND previous.manual_id=pilot_manual_codes.manual_id AND previous.student_id=? AND previous.revoked_at IS NULL)
    AND ${guard.sql}`,c.user_id,time,digest,c.school_id,time,c.user_id,...guard.values);
  const found=await first(db,`SELECT code.*,manual.title,manual.level FROM pilot_manual_codes code
    JOIN pilot_manuals manual ON manual.id=code.manual_id
    WHERE code.code_hash=? AND code.school_id=? AND manual.active=1 AND code.revoked_at IS NULL AND ${libraryEnabled?libraryGate('code.manual_id','code.school_id'):'1=1'} AND ${guard.sql}`,digest,c.school_id,...guard.values);
  if(!found)fail(422,'code_invalid','Ce code n’est pas disponible pour ton compte. Demande à ton établissement de le vérifier.');
  if(found.student_id===c.user_id)return reply({userId:c.user_id,schoolId:c.school_id,manual:view(found),replayed:!result.meta?.changes},result.meta?.changes?201:200);
  if(found.student_id)fail(409,'code_used','Ce code a déjà été utilisé. Demande à ton établissement de vérifier ton accès.');
  if(found.expires_at!==null&&found.expires_at<=time)fail(410,'code_expired','Ce code a expiré. Demande un nouveau code à ton établissement.');
  const existing=(await owned(db,c,libraryEnabled)).find(manual=>manual.manual_id===found.manual_id);
  if(existing)return reply({userId:c.user_id,schoolId:c.school_id,manual:view(existing),replayed:true});
  fail(403,'student_access_changed','Ton accès a changé. Reconnecte-toi avant de réessayer.');
}

// Administration only. Catalogue publication is separate and deliberately has no public write route.
export async function issueManualCode(request,db,session,guard,guardValues,libraryEnabled=false) {
  const input=await readInput(request);
  const id=requiredText(input.id,'Référence',36,36),school=requiredText(input.schoolId,'École',1,100),manual=requiredText(input.manualId,'Manuel',1,100);
  if(!/^[a-f0-9-]{36}$/.test(id))fail(422,'invalid_reference','Référence invalide.');
  if(input.expiresAt!==null&&!Number.isSafeInteger(input.expiresAt))fail(422,'invalid_expiry','Une date future ou une absence explicite d’expiration est nécessaire.');
  const existing=await first(db,`SELECT id,school_id,manual_id,expires_at FROM pilot_manual_codes WHERE id=? AND ${guard}`,id,...guardValues);
  if(existing){
    if(existing.school_id!==school||existing.manual_id!==manual||existing.expires_at!==input.expiresAt)fail(409,'code_request_conflict','Cette référence correspond à une autre demande.');
    return reply({ok:true,id,code:null,replayed:true,message:'Le code secret ne peut pas être réaffiché.'});
  }
  // A confirmed request remains replayable after its activation deadline has passed.
  if(input.expiresAt!==null&&input.expiresAt<=now())fail(422,'invalid_expiry','Une date future ou une absence explicite d’expiration est nécessaire.');
  const secret=[...crypto.getRandomValues(new Uint8Array(16))].map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
  const code='JDE-'+secret.match(/.{8}/g).join('-'),digest=await hash(code);
  const statements=[
    db.prepare(`INSERT INTO pilot_manual_codes(id,school_id,manual_id,code_hash,created_by,created_at,expires_at)
      SELECT ?,?,?,?, ?,?,? WHERE EXISTS (SELECT 1 FROM pilot_schools WHERE id=? AND active=1)
      AND EXISTS (SELECT 1 FROM pilot_manuals manual WHERE manual.id=? AND manual.active=1 AND ${libraryEnabled?libraryGate('manual.id','?'):'1=1'}) AND ${guard}
      ON CONFLICT(id) DO NOTHING`).bind(id,school,manual,digest,session.user_id,now(),input.expiresAt,school,manual,...(libraryEnabled?[school]:[]),...guardValues),
    db.prepare(`INSERT INTO pilot_admin_events(id,actor_id,action,target_id,created_at)
      SELECT ?,?,'manual_code_issued',?,? WHERE changes()>0 AND ${guard}`).bind(crypto.randomUUID(),session.user_id,id,now(),...guardValues),
  ];
  const result=await db.batch(statements);
  if(!result[0]?.meta?.changes)fail(409,'manual_code_unavailable','Le manuel, l’école ou les droits ne permettent pas de délivrer ce code. Actualisez avant de réessayer.');
  return reply({ok:true,id,code,replayed:false},201);
}
