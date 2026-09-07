import { handleManualReader } from './manual-reader.js';
import { handleDirector } from './director.js';
import { authSettings, handleOidc } from "./oidc.js";
import { handleAdmin } from "./admin.js";
import { handleGames, readSchoolGameSummary } from './games.js';
import { handleQuizGames } from './quizzes.js';
import { handleZellige } from './zellige.js';
import {handleTeacherMarket} from "./teacher-market.js";
import { handleMarket } from './market.js';
import { handleClassChallenges } from './class-challenges.js';
import { effectiveRole, requestedProfile, requireProfile } from './access-role.js';
import { handleManuals } from './manuals.js';
import { handleStudentProfile, readStudentProfile } from './student-profile.js';
import { all, authenticate, checkCsrf, fail, first, hash, LIVE_SESSION_SQL, liveValues, now, readInput, reply, requiredText, run, sessionCookie } from "./session.js";

async function context(db, session) {
  const membership=await first(db,`SELECT m.school_id,m.role,s.name school_name FROM pilot_memberships m JOIN pilot_schools s ON s.id=m.school_id
    WHERE m.user_id=? AND m.active=1 AND s.active=1 ORDER BY m.school_id LIMIT 1`,session.user_id);
  if(!membership)fail(403,"membership_required","Aucun accès scolaire actif n’est associé à ce compte.");
  return {...session,...membership};
}
function membershipGuard(c) {
  return { sql:`EXISTS (SELECT 1 FROM pilot_memberships pm JOIN pilot_schools ps ON ps.id=pm.school_id WHERE pm.school_id=? AND pm.user_id=? AND pm.role=? AND pm.active=1 AND ps.active=1) AND ${LIVE_SESSION_SQL}`,
    values:[c.school_id,c.user_id,c.role,...liveValues(c)] };
}
function assignmentScope(c, alias="a") {
  if(c.role==="enseignant")return { sql:`${alias}.teacher_id=? AND EXISTS (SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id WHERE cm.school_id=${alias}.school_id AND cm.class_id=${alias}.class_id AND cm.user_id=? AND cl.active=1)`, values:[c.user_id,c.user_id] };
  if(c.role==="eleve")return { sql:`EXISTS (SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id WHERE cm.school_id=${alias}.school_id AND cm.class_id=${alias}.class_id AND cm.user_id=? AND cl.active=1)`,values:[c.user_id] };
  if(c.role==="parent")return { sql:`EXISTS (SELECT 1 FROM pilot_family_links f JOIN pilot_memberships child ON child.school_id=f.school_id AND child.user_id=f.student_id
    JOIN pilot_users u ON u.id=f.student_id JOIN pilot_class_members cm ON cm.school_id=f.school_id AND cm.user_id=f.student_id
    JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id
    WHERE f.school_id=${alias}.school_id AND f.parent_id=? AND f.active=1 AND child.active=1 AND child.role='eleve' AND u.active=1 AND cm.class_id=${alias}.class_id AND cl.active=1)`,values:[c.user_id] };
  fail(403,"role_not_supported","Ce premier parcours est réservé aux enseignants, élèves et parents.");
}
async function assignment(db,c,id) {
  const scope=assignmentScope(c);
  const record=await first(db,`SELECT a.* FROM pilot_assignments a WHERE a.id=? AND a.school_id=? AND ${scope.sql}`,id,c.school_id,...scope.values);
  if(!record)fail(404,"assignment_not_found","Ce devoir n’est pas disponible pour ce compte.");
  return record;
}
function viewAssignment(a) {return {id:a.id,classId:a.class_id,title:a.title,instructions:a.instructions,dueDate:a.due_date,createdAt:a.created_at};}
async function studentDashboard(db,c,offset=0) {
  requireProfile(await effectiveRole(db,c.user_id),'eleve');
  const scope=assignmentScope(c),guard=membershipGuard(c);
  const classes=await all(db,`SELECT cl.id,cl.name FROM pilot_classes cl JOIN pilot_class_members cm ON cm.school_id=cl.school_id AND cm.class_id=cl.id
    WHERE cl.school_id=? AND cm.user_id=? AND cl.active=1 AND ${guard.sql} ORDER BY cl.name,cl.id`,c.school_id,c.user_id,...guard.values);
  const from=`FROM pilot_assignments a
    LEFT JOIN pilot_submissions sub ON sub.assignment_id=a.id AND sub.school_id=a.school_id AND sub.student_id=?
    LEFT JOIN pilot_reviews rev ON rev.submission_id=sub.id AND rev.school_id=sub.school_id
    WHERE a.school_id=? AND ${scope.sql} AND ${guard.sql}`;
  const values=[c.user_id,c.school_id,...scope.values,...guard.values];
  const counts=await first(db,`SELECT count(*) total,count(sub.id) submitted,count(rev.submission_id) reviewed ${from}`,...values);
  const rows=await all(db,`SELECT a.*,sub.id submission_id,sub.submitted_at,rev.reviewed_at,rev.score,rev.feedback ${from}
    ORDER BY a.due_date,a.created_at,a.id LIMIT 50 OFFSET ?`,...values,offset);
  const next=await first(db,`SELECT a.* ${from} AND sub.id IS NULL ORDER BY a.due_date,a.created_at,a.id LIMIT 1`,...values);
  const summary=await readSchoolGameSummary(db,{user:{id:c.user_id},schoolId:c.school_id,role:c.role,session:c});
  // Reject the entire result when an access change occurred during its reads.
  const currentClasses=await all(db,`SELECT cl.id FROM pilot_classes cl JOIN pilot_class_members cm ON cm.school_id=cl.school_id AND cm.class_id=cl.id
    WHERE cl.school_id=? AND cm.user_id=? AND cl.active=1 AND ${guard.sql}`,c.school_id,c.user_id,...guard.values);
  const ids=new Set(currentClasses.map(group=>group.id));
  if(!classes.length||classes.length!==ids.size||classes.some(group=>!ids.has(group.id))||rows.some(row=>!ids.has(row.class_id))||(next&&!ids.has(next.class_id)))fail(403,'student_access_changed','Ton accès scolaire a changé. Reconnecte-toi pour continuer.');
  requireProfile(await effectiveRole(db,c.user_id),'eleve');
  return {userId:c.user_id,schoolId:c.school_id,classes,
    assignments:{total:counts.total,submitted:counts.submitted,reviewed:counts.reviewed,pending:counts.total-counts.submitted,
      next:next?viewAssignment(next):null,nextOffset:offset+rows.length<counts.total?offset+rows.length:null,
      items:rows.map(row=>({...viewAssignment(row),submission:row.submission_id?{id:row.submission_id,submittedAt:row.submitted_at,reviewedAt:row.reviewed_at,score:row.score,feedback:row.feedback}:null}))},
    rewards:summary.children.find(child=>child.studentId===c.user_id)||null};
}
async function relatedSubmissions(db,c,assignmentId=null,offset=0) {
  const scope=assignmentScope(c);
  let studentSql="1=1",values=[];
  if(c.role==="eleve"){studentSql="s.student_id=?";values=[c.user_id];}
  if(c.role==="parent"){
    studentSql=`EXISTS (SELECT 1 FROM pilot_family_links f JOIN pilot_memberships pm ON pm.school_id=f.school_id AND pm.user_id=f.student_id
      JOIN pilot_users pu ON pu.id=f.student_id WHERE f.school_id=s.school_id AND f.student_id=s.student_id AND f.parent_id=? AND f.active=1 AND pm.active=1 AND pm.role='eleve' AND pu.active=1)`;values=[c.user_id];
  }
  const from=`FROM pilot_submissions s JOIN pilot_assignments a ON a.id=s.assignment_id AND a.school_id=s.school_id
    JOIN pilot_users u ON u.id=s.student_id LEFT JOIN pilot_reviews r ON r.submission_id=s.id AND r.school_id=s.school_id
    WHERE s.school_id=? AND ${scope.sql} AND ${studentSql}${assignmentId?" AND a.id=?":""}`;
  const params=[c.school_id,...scope.values,...values,...(assignmentId?[assignmentId]:[])];
  const counts=await first(db,`SELECT count(*) submitted,count(r.submission_id) reviewed ${from}`,...params);
  const rows=await all(db,`SELECT s.id,s.assignment_id assignmentId,s.student_id studentId,u.display_name studentName,s.body,s.submitted_at submittedAt,
    r.score,r.feedback,r.reviewed_at reviewedAt ${from} ORDER BY s.submitted_at DESC,s.id LIMIT 200 OFFSET ?`,...params,offset);
  return {submissions:rows,total:counts.submitted,reviewed:counts.reviewed,nextOffset:offset+rows.length<counts.submitted?offset+rows.length:null};
}
async function workspace(db,c,offset=0) {
  const scope=assignmentScope(c);
  const assignments=await all(db,`SELECT a.* FROM pilot_assignments a WHERE a.school_id=? AND ${scope.sql} ORDER BY a.created_at DESC,a.id LIMIT 100 OFFSET ?`,c.school_id,...scope.values,offset);
  const total=await first(db,`SELECT count(*) n FROM pilot_assignments a WHERE a.school_id=? AND ${scope.sql}`,c.school_id,...scope.values);
  const classes=c.role==="enseignant"?await all(db,`SELECT cl.id,cl.name FROM pilot_classes cl JOIN pilot_class_members cm ON cm.class_id=cl.id AND cm.school_id=cl.school_id WHERE cl.school_id=? AND cm.user_id=? AND cl.active=1 ORDER BY cl.name`,c.school_id,c.user_id):[];
  const children=c.role==="parent"?await all(db,`SELECT u.id,u.display_name name,cm.class_id classId FROM pilot_family_links f
    JOIN pilot_users u ON u.id=f.student_id JOIN pilot_memberships m ON m.school_id=f.school_id AND m.user_id=f.student_id
    JOIN pilot_class_members cm ON cm.school_id=f.school_id AND cm.user_id=f.student_id JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id
    WHERE f.school_id=? AND f.parent_id=? AND f.active=1 AND u.active=1 AND m.active=1 AND m.role='eleve' AND cl.active=1`,c.school_id,c.user_id):[];
  const result=await relatedSubmissions(db,c);
  return {assignments:assignments.map(viewAssignment),submissions:result.submissions,submissionsTruncated:result.nextOffset!==null,
    counts:{assignments:total.n,submitted:result.total,reviewed:result.reviewed},nextAssignmentsOffset:offset+assignments.length<total.n?offset+assignments.length:null,classes,children};
}
async function publishAssignment(request,db,c) {
  if(c.role!=="enseignant")fail(403,"teacher_required","Seul l’enseignant peut publier un devoir.");
  const input=await readInput(request);
  const classId=requiredText(input.classId,"Classe",1,100),title=requiredText(input.title,"Titre",5,120),instructions=requiredText(input.instructions,"Consigne",12,3000);
  const key=requiredText(request.headers.get("Idempotency-Key"),"Référence de publication",16,100);
  if(!/^[a-zA-Z0-9_-]+$/.test(key))fail(422,"invalid_key","Référence de publication invalide.");
  const dueDate=input.dueDate;
  if(typeof dueDate!=="string"||!/^20\d\d-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate))||new Date(dueDate).toISOString().slice(0,10)!==dueDate)fail(422,"invalid_due_date","Choisissez une date valide.");
  const requestHash=await hash(JSON.stringify([classId,title,instructions,dueDate]));
  const guard=membershipGuard(c); const id=crypto.randomUUID();
  await run(db,`INSERT INTO pilot_assignments(id,school_id,class_id,teacher_id,title,instructions,due_date,created_at,request_key,request_hash)
    SELECT ?,cl.school_id,cl.id,?,?,?,?,?,?,? FROM pilot_classes cl JOIN pilot_class_members cm ON cm.class_id=cl.id AND cm.school_id=cl.school_id
    WHERE cl.id=? AND cl.school_id=? AND cm.user_id=? AND cl.active=1 AND ${guard.sql}
    ON CONFLICT(school_id,teacher_id,request_key) DO NOTHING`,id,c.user_id,title,instructions,dueDate,now(),key,requestHash,classId,c.school_id,c.user_id,...guard.values);
  const found=await first(db,"SELECT * FROM pilot_assignments WHERE school_id=? AND teacher_id=? AND request_key=?",c.school_id,c.user_id,key);
  if(!found)fail(404,"class_unavailable","Cette classe n’est pas disponible pour ce compte.");
  await assignment(db,c,found.id);
  if(found.request_hash!==requestHash)fail(409,"idempotency_conflict","Cette publication existe avec un contenu différent. Actualisez avant de continuer.");
  return reply({assignment:viewAssignment(found),replayed:found.id!==id},found.id===id?201:200);
}
async function submit(request,db,c,id) {
  if(c.role!=="eleve")fail(403,"student_required","Seul l’élève peut remettre son travail.");
  const a=await assignment(db,c,id),input=await readInput(request);
  const body=requiredText(input.body,"Réponse",12,6000),requestHash=await hash(body),newId=crypto.randomUUID();
  const scope=assignmentScope(c),guard=membershipGuard(c);
  await run(db,`INSERT INTO pilot_submissions(id,school_id,assignment_id,student_id,body,request_hash,submitted_at)
    SELECT ?,a.school_id,a.id,?,?,?,? FROM pilot_assignments a WHERE a.id=? AND a.school_id=? AND ${scope.sql} AND ${guard.sql}
    ON CONFLICT(assignment_id,student_id) DO NOTHING`,newId,c.user_id,body,requestHash,now(),a.id,c.school_id,...scope.values,...guard.values);
  const found=await first(db,"SELECT id,request_hash FROM pilot_submissions WHERE assignment_id=? AND school_id=? AND student_id=?",a.id,c.school_id,c.user_id);
  if(!found)fail(403,"access_changed","Votre accès a changé. Rechargez la page.");
  if(found.request_hash!==requestHash)fail(409,"submission_locked","Un travail a déjà été remis. Il ne sera pas remplacé.");
  return reply({id:found.id,replayed:found.id!==newId},found.id===newId?201:200);
}
async function review(request,db,c,id) {
  if(c.role!=="enseignant")fail(403,"teacher_required","Seul l’enseignant peut publier une correction.");
  const source=await first(db,"SELECT assignment_id FROM pilot_submissions WHERE id=? AND school_id=?",id,c.school_id);
  if(!source)fail(404,"submission_not_found","Cette remise n’est pas disponible.");
  await assignment(db,c,source.assignment_id);
  const input=await readInput(request),feedback=requiredText(input.feedback,"Retour pédagogique",8,2000),score=input.score;
  if(!Number.isInteger(score)||score<0||score>20)fail(422,"invalid_score","Indiquez une note entière de 0 à 20.");
  const requestHash=await hash(JSON.stringify([score,feedback])),scope=assignmentScope(c),guard=membershipGuard(c);
  const changed=await run(db,`INSERT INTO pilot_reviews(submission_id,school_id,teacher_id,score,feedback,request_hash,reviewed_at)
    SELECT s.id,s.school_id,?,?,?,?,? FROM pilot_submissions s JOIN pilot_assignments a ON a.id=s.assignment_id AND a.school_id=s.school_id
    WHERE s.id=? AND s.school_id=? AND ${scope.sql} AND ${guard.sql} ON CONFLICT(submission_id) DO NOTHING`,c.user_id,score,feedback,requestHash,now(),id,c.school_id,...scope.values,...guard.values);
  const found=await first(db,"SELECT request_hash FROM pilot_reviews WHERE submission_id=? AND school_id=?",id,c.school_id);
  if(!found)fail(403,"access_changed","Votre accès a changé. Rechargez la page.");
  if(found.request_hash!==requestHash)fail(409,"review_locked","Une correction a déjà été publiée. Elle ne sera pas remplacée.");
  return reply({id,replayed:!changed.meta?.changes},changed.meta?.changes?201:200);
}
export async function handlePilot(request,env,{local=false,requestId=null}={}) {
  const path=new URL(request.url).pathname;
  try {
    // Local fixture sign-in is not part of this handler, even when local=true.
    if(path.startsWith("/api/pilot/local/"))return reply({error:{code:"not_found",message:"Route inexistante."}},404);
    if(!local&&env.PILOT_ENABLED!=="true")return reply({error:{code:"pilot_not_enabled",message:"Le pilote serveur n’est pas encore ouvert."}},503);
    if(!env.DB)fail(503,"database_unavailable","Le serveur de données n’est pas disponible.");
    if(!local && (!authSettings(env)||new URL(request.url).origin!==authSettings(env).origin))fail(503,"identity_not_configured","La connexion réelle n’est pas encore configurée.");
    if(path.startsWith("/api/pilot/auth/"))return await handleOidc(request,env);
    if(request.method==="GET"&&path==="/api/pilot/session"){
      const profile=requestedProfile(new URL(request.url));
      const session=await authenticate(request,env.DB,local,true);
      if(!session)return reply({authenticated:false,mode:local?"local_fixture":"oidc",signInPath:local?null:"/api/pilot/auth/start"});
      const role=await effectiveRole(env.DB,session.user_id);
      requireProfile(role,profile,local?'local_fixture':'oidc');
      if(role==='admin')return reply({authenticated:true,mode:local?'local_fixture':'oidc',csrfToken:session.csrf_token,user:{id:session.user_id,name:session.display_name,role:'admin'}});
      const c=await context(env.DB,session);
      requireProfile(c.role,profile,local?'local_fixture':'oidc');
      const studentProfile=c.role==='eleve'?await readStudentProfile(env.DB,c):null;
      return reply({authenticated:true,mode:local?"local_fixture":"oidc",csrfToken:c.csrf_token,user:{id:c.user_id,name:c.display_name,role:c.role,schoolId:c.school_id,schoolName:c.school_name,...(studentProfile?{avatar:studentProfile.avatar}:{})}});
    }
    const session=await authenticate(request,env.DB,local);
    if(path==='/api/pilot/reader'||path.startsWith('/api/pilot/reader/'))return await handleManualReader(request,env,session,local);
    if(request.method!=="GET")checkCsrf(request,session);
    // Logout remains available after all memberships were removed.
    if(request.method==="POST"&&path==="/api/pilot/logout"){
      await run(env.DB,"UPDATE pilot_sessions SET revoked_at=? WHERE token_hash=?",now(),session.token_hash);
      return reply({ok:true},200,{"Set-Cookie":sessionCookie(local,"",0)});
    }
    if(path==='/api/pilot/admin'||path.startsWith('/api/pilot/admin/'))return await handleAdmin(request,env,session,local);
    const c=await context(env.DB,session);
    if(path==='/api/pilot/director'||path.startsWith('/api/pilot/director/'))return await handleDirector(request,env,c,local);
    if(path==='/api/pilot/student/profile')return await handleStudentProfile(request,env.DB,c);
    if(path==='/api/pilot/manuals'||path.startsWith('/api/pilot/manuals/'))return await handleManuals(request,env.DB,c,path,local&&Boolean(env.LOCAL_MANUAL_FILES?.libraryEnabled));
    if(path==='/api/pilot/teacher/market'||path.startsWith('/api/pilot/teacher/market/'))return await handleTeacherMarket(request,env,{user:{id:c.user_id},schoolId:c.school_id,role:c.role,session:c},local);
    if(path==='/api/pilot/games/defis-classe'||path.startsWith('/api/pilot/games/defis-classe/'))return await handleClassChallenges(request,env,{user:{id:c.user_id,name:c.display_name},schoolId:c.school_id,role:c.role,session:c},path);
    if(path==='/api/pilot/games/souk-des-mots'||path.startsWith('/api/pilot/games/souk-des-mots/'))return await handleMarket(request,env,{user:{id:c.user_id,name:c.display_name},schoolId:c.school_id,role:c.role,session:c},path);
    if(path==='/api/pilot/games/mission-zellige'||path.startsWith('/api/pilot/games/mission-zellige/'))return await handleZellige(request,env,{user:{id:c.user_id,name:c.display_name},schoolId:c.school_id,role:c.role,session:c},path);
    if(path.startsWith('/api/pilot/games/quiz/'))return await handleQuizGames(request,env,{user:{id:c.user_id,name:c.display_name},schoolId:c.school_id,role:c.role,session:c},path);
    if(path.startsWith('/api/pilot/games/'))return await handleGames(request,env,{user:{id:c.user_id,name:c.display_name},schoolId:c.school_id,role:c.role,session:c},path);
    const offset=Number(new URL(request.url).searchParams.get("offset")||0);
    if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail(422,"invalid_page","Page invalide.");
    if(request.method==='GET'&&path==='/api/pilot/student/dashboard')return reply(await studentDashboard(env.DB,c,offset));
    if(request.method==="GET"&&path==="/api/pilot/workspace")return reply({userId:c.user_id,...await workspace(env.DB,c,offset)});
    if(request.method==="POST"&&path==="/api/pilot/assignments")return await publishAssignment(request,env.DB,c);
    const entry=path.match(/^\/api\/pilot\/assignments\/([a-f0-9-]{36})(\/submission)?$/);
    if(entry&&request.method==="GET"&&!entry[2])return reply({userId:c.user_id,assignment:viewAssignment(await assignment(env.DB,c,entry[1])),...await relatedSubmissions(env.DB,c,entry[1],offset)});
    if(entry&&entry[2]&&request.method==="POST")return await submit(request,env.DB,c,entry[1]);
    const correction=path.match(/^\/api\/pilot\/submissions\/([a-f0-9-]{36})\/review$/);
    if(correction&&request.method==="POST")return await review(request,env.DB,c,correction[1]);
    return reply({error:{code:"not_found",message:"Route inexistante."}},404);
  }catch(error){
    if(error instanceof Response)return error;
    const reference=requestId||crypto.randomUUID();console.error(JSON.stringify({reference,operation:"pilot",code:"request_failed"}));
    return reply({error:{code:"server_unavailable",message:"Le serveur n’a pas confirmé l’opération. Réessayez sans modifier votre texte."},reference},503);
  }
}
