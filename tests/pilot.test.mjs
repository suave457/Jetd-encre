import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openPilotDatabase, seedLocalPilot } from "../scripts/pilot-local-store.mjs";
import { handleLocalPilot, localPilotRequestAllowed } from "../scripts/pilot-local-api.mjs";
import { issueSession, hash, now } from "../worker/pilot/session.js";
import worker from "../worker/index.js";
import { sqliteBinding } from "../scripts/pilot-local-store.mjs";
const origin="http://127.0.0.1:5173";
const answer="Près de chez moi, il y a une place. Une fontaine se trouve au milieu. Je vois des boutiques autour. J’aime y retrouver mes amis.";
async function setup(t){const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());return store;}
async function client(db,id){
  const session=await issueSession(db,id,"local_fixture",true),cookie=session.cookie.split(";")[0];
  return {cookie,csrf:session.csrfToken,async call(path,body,extra={}){
    const request=new Request(origin+"/api/pilot"+path,{method:body===undefined?"GET":"POST",headers:{cookie,origin,"content-type":"application/json","X-CSRF-Token":session.csrfToken,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const response=await handleLocalPilot(request,db);return {status:response.status,data:await response.json(),headers:response.headers};
  }};
}
const publish=(teacher,extra={},headers={})=>teacher.call("/assignments",{classId:"pilot-class-a",title:"Mon quartier en quatre phrases",instructions:"Présente un lieu de ton quartier en quatre phrases. Indique sa position et donne ton avis.",dueDate:"2026-10-01",...extra},{"Idempotency-Key":"publication-test-0001",...headers});

test('une session existante est refusée dans tout espace ne correspondant pas à son rôle',async t=>{
  const {DB,sqlite}=await setup(t);
  const profiles={admin:'pilot-local-admin',eleve:'pilot-a-student',parent:'pilot-a-parent',enseignant:'pilot-a-teacher'};
  for(const [actual,userId] of Object.entries(profiles)){
    const account=await client(DB,userId);
    for(const expected of [...Object.keys(profiles),'directeur']){
      const response=await account.call('/session?profil='+expected);
      if(expected===actual){assert.equal(response.status,200);assert.equal(response.data.user.role,actual);}
      else{assert.equal(response.status,403,`${actual} via ${expected}`);assert.equal(response.data.error.code,'profile_mismatch');assert.equal(response.data.user,undefined);assert.equal(response.data.csrfToken,undefined);}
    }
    assert.equal((await account.call('/session')).data.user.role,actual,'ancien lien compatible et session inchangée');
    for(const query of ['?profil=','?profil=admin&profil=eleve','?profil=superadmin'])assert.equal((await account.call('/session'+query)).status,400);
  }
  assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_sessions WHERE revoked_at IS NOT NULL').get().n,0);
});

test('la création atomique de session revérifie le profil avant insertion',async t=>{
  const {DB,sqlite}=await setup(t);
  await assert.rejects(issueSession(DB,'pilot-local-admin','oidc',false,'eleve'),error=>error instanceof Response&&error.status===403);
  sqlite.prepare('UPDATE pilot_memberships SET role=? WHERE user_id=?').run('parent','pilot-a-student');
  await assert.rejects(issueSession(DB,'pilot-a-student','oidc',false,'eleve'),error=>error instanceof Response&&error.status===403);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_sessions').get().n,0);
});

test('migration du profil choisi : les anciennes transactions et données sont conservées',()=>{
  const sqlite=new DatabaseSync(':memory:');
  try{
    sqlite.exec('PRAGMA foreign_keys=ON');
    const directory=new URL('../drizzle/',import.meta.url);
    for(const name of readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<'0005').sort())sqlite.exec(readFileSync(new URL(name,directory),'utf8'));
    seedLocalPilot(sqlite);
    sqlite.prepare('INSERT INTO pilot_auth_flows VALUES (?,?,?,?,?)').run('old-state','old-browser','old-verifier','old-nonce',2000000000);
    const users=sqlite.prepare('SELECT * FROM pilot_users ORDER BY id').all();
    sqlite.exec(readFileSync(new URL('0005_login_profile.sql',directory),'utf8'));
    assert.deepEqual(sqlite.prepare('SELECT * FROM pilot_users ORDER BY id').all(),users);
    assert.equal(sqlite.prepare('SELECT requested_role FROM pilot_auth_flows').get().requested_role,null);
    assert.equal(sqlite.prepare('SELECT verifier FROM pilot_auth_flows').get().verifier,'old-verifier');
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{sqlite.close();}
});
test('administration : droits exclusifs, création, rattachement scolaire et révocation',async t=>{
  const {DB,sqlite}=await setup(t),admin=await client(DB,'pilot-local-admin'),teacher=await client(DB,'pilot-a-teacher');
  assert.equal((await teacher.call('/admin')).status,403);
  assert.equal((await teacher.call('/session?profil=admin')).status,403);
  assert.equal((await teacher.call('/admin?profil=admin')).status,403);
  assert.equal((await teacher.call('/admin/schools',{id:'evil',name:'École interdite'})).status,403);
  assert.equal((await admin.call('/admin/schools',{id:'csrf',name:'Sans protection'},{'X-CSRF-Token':''})).status,403);
  assert.equal((await admin.call('/session')).data.user.role,'admin');
  assert.equal((await admin.call('/admin/schools',{id:'new-school',name:'École de test'})).status,200);
  assert.equal((await admin.call('/admin/schools',{id:'new-school',name:'École de test'})).status,200);
  assert.equal((await admin.call('/admin/classes',{id:'new-class',schoolId:'new-school',name:'5e AEP'})).status,200);
  const student={id:'new-student',name:'Élève de test',schoolId:'new-school',role:'eleve',classId:'new-class'};
  assert.equal((await admin.call('/admin/accounts',{...student,classId:'pilot-class-a'})).status,422);
  assert.equal((await admin.call('/admin/accounts',{...student,role:'admin'})).status,422);
  assert.equal((await admin.call('/admin/accounts',student)).status,200);
  assert.equal((await admin.call('/admin/accounts',student)).status,409);
  const parent={id:'new-parent',name:'Parent de test',schoolId:'new-school',role:'parent',childId:'pilot-a-student'};
  assert.equal((await admin.call('/admin/accounts',parent)).status,422);
  assert.equal((await admin.call('/admin/accounts',{...parent,childId:'new-student'})).status,200);
  assert.equal((await admin.call('/admin/identity',{id:'new-student',subject:'auth0|test1'})).status,200);
  assert.equal((await admin.call('/admin/identity',{id:'new-parent',subject:'auth0|test1'})).status,409);
  assert.equal((await admin.call('/admin/account-status',{id:'pilot-local-admin',active:false})).status,403);
  const s=await client(DB,'new-student');
  assert.equal((await s.call('/session')).data.authenticated,true);
  assert.equal((await admin.call('/admin/account-status',{id:'new-student',active:false})).status,200);
  assert.equal((await s.call('/workspace')).status,401);
  await admin.call('/admin/account-status',{id:'new-student',active:true});
  assert.equal((await s.call('/workspace')).status,401,'Une réactivation ne ressuscite pas une session.');
  const fresh=await client(DB,'new-student');
  await admin.call('/admin/school-status',{id:'new-school',active:false});
  assert.equal((await fresh.call('/workspace')).status,401);
  assert.equal((await admin.call('/admin/classes',{id:'blocked-class',schoolId:'new-school',name:'Classe bloquée'})).status,409);
  const listing=await admin.call('/admin');assert.equal(listing.status,200);
  assert.equal(listing.data.accounts.find(a=>a.id==='new-student').connected,1);
  assert.ok(listing.data.events.some(e=>e.action==='school_suspended'));
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
test("cycle SQL partagé : publier, remettre, corriger à zéro, lire côté parent",async t=>{
  const {DB,sqlite}=await setup(t),teacher=await client(DB,"pilot-a-teacher"),student=await client(DB,"pilot-a-student"),parent=await client(DB,"pilot-a-parent");
  const published=await publish(teacher);assert.equal(published.status,201,JSON.stringify(published.data));const id=published.data.assignment.id;
  assert.equal((await student.call("/workspace")).data.assignments[0].id,id);
  const submitted=await student.call(`/assignments/${id}/submission`,{body:answer,studentId:"pilot-b-student",schoolId:"pilot-school-b",xp:99999});assert.equal(submitted.status,201,JSON.stringify(submitted.data));
  const reviewed=await teacher.call(`/submissions/${submitted.data.id}/review`,{score:0,feedback:"Relis la consigne : présente le lieu puis précise sa position."});assert.equal(reviewed.status,201,JSON.stringify(reviewed.data));
  const family=(await parent.call("/workspace")).data;
  assert.equal(family.submissions.length,1);assert.equal(family.submissions[0].score,0);assert.equal(family.submissions[0].body,answer);assert.equal(family.submissions[0].studentId,"pilot-a-student");
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_reviews").get().n,1);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
  const again=await client(DB,"pilot-a-parent");assert.deepEqual((await again.call("/workspace")).data.submissions,family.submissions);
});
test("idempotence concurrente : une publication, une remise, une correction sans écrasement",async t=>{
  const {DB,sqlite}=await setup(t),teacher=await client(DB,"pilot-a-teacher"),student=await client(DB,"pilot-a-student");
  const results=await Promise.all([publish(teacher),publish(teacher)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
  const id=results[0].data.assignment.id;
  assert.equal((await publish(teacher,{title:"Une autre consigne incompatible"})).status,409);
  const submissions=await Promise.all([student.call(`/assignments/${id}/submission`,{body:answer}),student.call(`/assignments/${id}/submission`,{body:answer})]);
  assert.deepEqual(submissions.map(r=>r.status).sort(),[200,201]);const submissionId=submissions[0].data.id;
  const reviews=await Promise.all([teacher.call(`/submissions/${submissionId}/review`,{score:12,feedback:"Ajoute une phrase qui donne ton avis personnel."}),teacher.call(`/submissions/${submissionId}/review`,{score:12,feedback:"Ajoute une phrase qui donne ton avis personnel."})]);
  assert.deepEqual(reviews.map(r=>r.status).sort(),[200,201]);
  assert.equal((await student.call(`/assignments/${id}/submission`,{body:answer+" Une autre phrase."})).status,409);
  assert.equal((await teacher.call(`/submissions/${submissionId}/review`,{score:20,feedback:"Correction différente après publication."})).status,409);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM pilot_submissions").get().n,1);
});
test("isolation école, élève de même classe et lien parental révoqué",async t=>{
  const {DB,sqlite}=await setup(t),teacher=await client(DB,"pilot-a-teacher"),student=await client(DB,"pilot-a-student"),other=await client(DB,"pilot-a-other"),parent=await client(DB,"pilot-a-parent");
  const id=(await publish(teacher)).data.assignment.id,submission=(await student.call(`/assignments/${id}/submission`,{body:answer})).data.id;
  await other.call(`/assignments/${id}/submission`,{body:"Voici un autre texte que le parent de Lina ne doit pas consulter."});
  assert.equal((await parent.call("/workspace")).data.submissions.length,1);
  const otherData=(await other.call(`/assignments/${id}`)).data;assert.equal(otherData.submissions.length,1);assert.equal(otherData.submissions[0].studentId,"pilot-a-other");
  for(const who of ["pilot-b-teacher","pilot-b-student","pilot-b-parent"]){
    const outsider=await client(DB,who);assert.deepEqual((await outsider.call("/workspace")).data.assignments,[]);
    assert.equal((await outsider.call(`/assignments/${id}`)).status,404);
    if(who.endsWith("teacher"))assert.equal((await outsider.call(`/submissions/${submission}/review`,{score:20,feedback:"Je ne suis pas autorisé à noter cette copie."})).status,404);
  }
  assert.equal((await student.call(`/submissions/${submission}/review`,{score:20,feedback:"Je tente de noter ma copie."})).status,403);
  sqlite.prepare("UPDATE pilot_family_links SET active=0 WHERE parent_id=?").run("pilot-a-parent");
  assert.deepEqual((await parent.call("/workspace")).data.assignments,[]);assert.equal((await parent.call(`/assignments/${id}`)).status,404);
});
test("sessions opaques, expiration, révocation, CSRF et permissions retirées",async t=>{
  const {DB,sqlite}=await setup(t),teacher=await client(DB,"pilot-a-teacher");
  assert.match(teacher.cookie,/^jde_local_pilot=[\w-]{43}$/);
  assert.equal(sqlite.prepare("SELECT token_hash FROM pilot_sessions").get().token_hash,await hash(teacher.cookie.split("=")[1]));
  assert.equal((await publish(teacher,{}, {"X-CSRF-Token":"forged"})).status,403);
  assert.equal((await publish(teacher,{}, {origin:"https://evil.example"})).status,403);
  sqlite.prepare("UPDATE pilot_memberships SET role='parent' WHERE user_id=?").run("pilot-a-teacher");assert.equal((await publish(teacher)).status,403);
  sqlite.prepare("UPDATE pilot_memberships SET role='enseignant' WHERE user_id=?").run("pilot-a-teacher");
  assert.equal((await teacher.call("/logout",{})).status,200);assert.equal((await teacher.call("/workspace")).status,401);
  const expired=await client(DB,"pilot-a-student");sqlite.prepare("UPDATE pilot_sessions SET expires_at=?").run(now()-1);assert.equal((await expired.call("/workspace")).status,401);
});

test("deux classes dans une même école : les devoirs et corrections restent cloisonnés",async t=>{
  const {DB}=await setup(t),admin=await client(DB,"pilot-local-admin");
  const schoolId="pilot-school-a",classId="pilot-class-a-secondary";
  assert.equal((await admin.call("/admin/classes",{id:classId,schoolId,name:"5e AEP de test"})).status,200);
  for(const account of [
    {id:"same-school-teacher",name:"Enseignant seconde classe",role:"enseignant",classId},
    {id:"same-school-student",name:"Élève seconde classe",role:"eleve",classId},
    {id:"same-school-parent",name:"Parent seconde classe",role:"parent",childId:"same-school-student"},
  ])assert.equal((await admin.call("/admin/accounts",{schoolId,...account})).status,200);
  const firstTeacher=await client(DB,"pilot-a-teacher"),firstStudent=await client(DB,"pilot-a-student"),firstParent=await client(DB,"pilot-a-parent");
  const secondTeacher=await client(DB,"same-school-teacher"),secondStudent=await client(DB,"same-school-student"),secondParent=await client(DB,"same-school-parent");
  const firstAssignment=(await publish(firstTeacher)).data.assignment.id;
  const firstSubmission=(await firstStudent.call(`/assignments/${firstAssignment}/submission`,{body:answer})).data.id;
  for(const outsider of [secondTeacher,secondStudent,secondParent]){
    assert.deepEqual((await outsider.call("/workspace")).data.assignments,[]);
    assert.equal((await outsider.call(`/assignments/${firstAssignment}`)).status,404);
  }
  assert.equal((await secondStudent.call(`/assignments/${firstAssignment}/submission`,{body:answer})).status,404);
  assert.equal((await secondTeacher.call(`/submissions/${firstSubmission}/review`,{score:18,feedback:"Cette copie appartient à une autre classe."})).status,404);
  assert.equal((await publish(secondTeacher)).status,404);
  assert.equal((await publish(firstTeacher,{classId},{"Idempotency-Key":"wrong-class-publication"})).status,404);
  const secondPublished=await publish(secondTeacher,{classId,title:"Le jardin de notre école"},{"Idempotency-Key":"second-class-publication"});
  assert.equal(secondPublished.status,201);
  const secondAssignment=secondPublished.data.assignment.id;
  for(const insider of [secondStudent,secondParent]){
    assert.deepEqual((await insider.call("/workspace")).data.assignments.map(a=>a.id),[secondAssignment]);
    assert.equal((await insider.call(`/assignments/${secondAssignment}`)).status,200);
  }
  for(const outsider of [firstTeacher,firstStudent,firstParent]){
    assert.deepEqual((await outsider.call("/workspace")).data.assignments.map(a=>a.id),[firstAssignment]);
    assert.equal((await outsider.call(`/assignments/${secondAssignment}`)).status,404);
  }
});
test("validation : note vide, faux auteur, classe étrangère et serveur indisponible",async t=>{
  const {DB}=await setup(t),teacher=await client(DB,"pilot-a-teacher"),student=await client(DB,"pilot-a-student");
  assert.equal((await publish(teacher,{classId:"pilot-class-b"})).status,404);
  const result=await publish(teacher,{teacherId:"pilot-b-teacher",schoolId:"pilot-school-b"});assert.equal(result.status,201);
  const id=result.data.assignment.id;
  assert.equal((await student.call(`/assignments/${id}/submission`,{body:"court"})).status,422);
  const submitted=await student.call(`/assignments/${id}/submission`,{body:answer});
  for(const score of ["",null,"20",-1,21,2.5])assert.equal((await teacher.call(`/submissions/${submitted.data.id}/review`,{score,feedback:"Un retour pédagogique assez long."})).status,422);
  assert.equal((await publish(teacher,{dueDate:"2026-02-31"})).status,422);
  const response=await handleLocalPilot(new Request(origin+"/api/pilot/session"),{prepare(){throw new Error("offline");}});
  // Without a cookie the session endpoint can honestly report unauthenticated without querying DB.
  assert.equal(response.status,200);
  const broken=await handleLocalPilot(new Request(origin+"/api/pilot/workspace",{headers:{cookie:teacher.cookie}}),{prepare(){throw new Error("offline");}});
  assert.equal(broken.status,503);
});
test("Worker publié : aucune connexion fictive, même avec flags/en-têtes locaux",async t=>{
  const {DB}=await setup(t),fixture=await issueSession(DB,"pilot-a-teacher","local_fixture",true);
  const env={DB,PILOT_ENABLED:"true",LOCAL_AUTH:"true",PILOT_ORIGIN:"https://example.test",OIDC_ISSUER:"https://identity.example.test",OIDC_CLIENT_ID:"registered-client",OIDC_CLIENT_SECRET:"test-only-not-a-real-secret"};
  for(const method of ["GET","POST"]){const r=await worker.fetch(new Request("https://example.test/api/pilot/local/login",{method,headers:{host:"localhost","X-Local-Pilot":"1"}}),env);assert.equal(r.status,404);}
  const token=fixture.cookie.split(";")[0].split("=")[1];
  const r=await worker.fetch(new Request("https://example.test/api/pilot/workspace",{headers:{cookie:"__Host-jde_pilot="+token}}),env);assert.equal(r.status,401);
  assert.equal((await worker.fetch(new Request("https://example.test/api/pilot/auth/start"),{DB})).status,503);
});
test("le serveur de test refuse hôte externe, origine tierce et adresse distante",()=>{
  const local={socket:{remoteAddress:"127.0.0.1"},url:"/api/pilot/local/login",headers:{host:"127.0.0.1:5173",origin}};
  assert.equal(localPilotRequestAllowed(local),true);
  for(const change of [{socket:{remoteAddress:"10.0.0.2"}},{headers:{host:"evil.example"}},{headers:{host:"127.0.0.1:5173",origin:"https://evil.example"}}])assert.equal(localPilotRequestAllowed({...local,...change}),false);
});
test("plus de 200 remises : compteurs complets, détail indépendant et page suivante",async t=>{
  const {DB,sqlite}=await setup(t),teacher=await client(DB,"pilot-a-teacher");
  const ids=[];
  for(let n=0;n<8;n++){
    const id=crypto.randomUUID();ids.push(id);
    sqlite.prepare("INSERT INTO pilot_assignments VALUES (?,?,?,?,?,?,?,?,?,?)").run(id,"pilot-school-a","pilot-class-a","pilot-a-teacher","Mon quartier "+n,"Décris un lieu en quatre phrases.","2026-10-01",100+n,"key-number-"+n,"testhash");
  }
  for(let n=0;n<250;n++){
    const uid="many-student-"+n;
    sqlite.prepare("INSERT INTO pilot_users(id,display_name,created_at) VALUES (?,?,0)").run(uid,"Élève fictif "+n);
    sqlite.prepare("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES (?,?,'eleve')").run("pilot-school-a",uid);
    sqlite.prepare("INSERT INTO pilot_class_members VALUES (?,?,?)").run("pilot-school-a","pilot-class-a",uid);
    const assignmentId=n<29?ids[0]:ids[7];
    sqlite.prepare("INSERT INTO pilot_submissions VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(),"pilot-school-a",assignmentId,uid,"Réponse fictive de pagination.","testhash",100+n);
  }
  const data=(await teacher.call("/workspace")).data;
  assert.equal(data.counts.submitted,250);assert.equal(data.submissions.length,200);assert.equal(data.submissionsTruncated,true);
  const oldest=(await teacher.call(`/assignments/${ids[0]}`)).data;assert.equal(oldest.total,29);assert.equal(oldest.submissions.length,29);assert.equal(oldest.nextOffset,null);
  const firstPage=(await teacher.call(`/assignments/${ids[7]}`)).data;assert.equal(firstPage.submissions.length,200);assert.equal(firstPage.nextOffset,200);
  const nextPage=(await teacher.call(`/assignments/${ids[7]}?offset=200`)).data;assert.equal(nextPage.submissions.length,21);assert.equal(nextPage.nextOffset,null);
  assert.equal(new Set([...firstPage.submissions,...nextPage.submissions].map(s=>s.id)).size,221);
  assert.equal((await teacher.call(`/assignments/${ids[0]}?offset=-1`)).status,422);
});
test("base sur disque : retrouver le même travail après arrêt et nouvelle connexion",async()=>{
  const file=join(tmpdir(),"jde-pilot-test-"+crypto.randomUUID()+".sqlite");let store=openPilotDatabase(file);
  try{
    seedLocalPilot(store.sqlite);const teacher=await client(store.DB,"pilot-a-teacher"),id=(await publish(teacher)).data.assignment.id;
    const student=await client(store.DB,"pilot-a-student");await student.call(`/assignments/${id}/submission`,{body:answer});
    store.close();store=openPilotDatabase(file);
    const parent=await client(store.DB,"pilot-a-parent"),family=(await parent.call("/workspace")).data;assert.equal(family.submissions[0].body,answer);
  }finally{store.close();for(const suffix of ["","-wal","-shm"]){try{unlinkSync(file+suffix);}catch(e){if(e.code!=="ENOENT")throw e;}}}
});
test("readiness exige schéma pilote et configuration si le pilote est activé",async()=>{
  const sql=new DatabaseSync(":memory:");const DB=sqliteBinding(sql);
  const env={DB,PILOT_ENABLED:"true",PILOT_ORIGIN:"https://example.test",OIDC_ISSUER:"https://identity.example.test",OIDC_CLIENT_ID:"registered-client",OIDC_CLIENT_SECRET:"test-only"};
  try{
    sql.exec(readFileSync(new URL("../drizzle/0000_funny_stephen_strange.sql",import.meta.url),"utf8"));
    assert.equal((await worker.fetch(new Request("https://example.test/api/v1/ready"),env)).status,503);
    for(const file of readdirSync(new URL("../drizzle/",import.meta.url)).filter(f=>f.endsWith(".sql")&&!f.startsWith("0000")).sort())sql.exec(readFileSync(new URL("../drizzle/"+file,import.meta.url),"utf8"));
    assert.equal((await worker.fetch(new Request("https://example.test/api/v1/ready"),env)).status,200);
    assert.equal((await worker.fetch(new Request("https://example.test/api/v1/ready"),{...env,OIDC_ISSUER:""})).status,503);
  }finally{sql.close();}
});
