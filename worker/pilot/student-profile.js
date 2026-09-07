import { first, fail, LIVE_SESSION_SQL, liveValues, now, readInput, reply, run } from './session.js';
import { effectiveRole, requireProfile } from './access-role.js';
import { isStudentAvatar } from '../../src/features/student/studentProfileCore.js';

function profileGuard(c) {
  return { sql: `EXISTS (SELECT 1 FROM pilot_memberships pm JOIN pilot_schools school ON school.id=pm.school_id
    WHERE pm.school_id=? AND pm.user_id=? AND pm.role='eleve' AND pm.active=1 AND school.active=1)
    AND NOT EXISTS (SELECT 1 FROM pilot_admins WHERE user_id=? AND active=1) AND ${LIVE_SESSION_SQL}`,
    values: [c.school_id,c.user_id,c.user_id,...liveValues(c)] };
}
async function readOwnProfile(db,c) {
  const guard=profileGuard(c);
  const row=await first(db,`SELECT ? userId,? schoolId,COALESCE(profile.avatar,'initials') avatar,profile.updated_at updatedAt
    FROM (SELECT 1) anchor LEFT JOIN pilot_student_profiles profile ON profile.school_id=? AND profile.student_id=?
    WHERE ${guard.sql}`,c.user_id,c.school_id,c.school_id,c.user_id,...guard.values);
  if(!row)fail(403,'student_profile_unavailable','Ton accès a changé. Reconnecte-toi pour retrouver ton profil.');
  return row;
}
export async function readStudentProfile(db,c) {
  const profile=await readOwnProfile(db,c),guard=profileGuard(c);
  if(!await first(db,`SELECT 1 allowed WHERE ${guard.sql}`,...guard.values))fail(403,'student_profile_unavailable','Ton accès a changé. Reconnecte-toi.');
  return profile;
}
export async function handleStudentProfile(request,db,c) {
  requireProfile(await effectiveRole(db,c.user_id),'eleve');
  if(request.method==='GET')return reply(await readStudentProfile(db,c));
  if(request.method!=='POST')fail(405,'method_not_allowed','Méthode non disponible.');
  const input=await readInput(request);
  if(Object.keys(input).length!==1||!Object.hasOwn(input,'avatar')||!isStudentAvatar(input.avatar))fail(422,'invalid_student_avatar','Choisis un avatar parmi les pictogrammes proposés.');
  const guard=profileGuard(c);
  const result=await run(db,`INSERT INTO pilot_student_profiles(school_id,student_id,avatar,updated_at)
    SELECT ?,?,?,? WHERE ${guard.sql}
    ON CONFLICT(school_id,student_id) DO UPDATE SET avatar=excluded.avatar,updated_at=excluded.updated_at
    WHERE pilot_student_profiles.avatar<>excluded.avatar`,c.school_id,c.user_id,input.avatar,now(),...guard.values);
  const profile=await readOwnProfile(db,c);
  return reply({...profile,changed:Boolean(result.meta?.changes)});
}
