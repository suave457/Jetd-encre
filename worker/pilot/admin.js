import { all, first, fail, now, readInput, reply, requiredText, LIVE_SESSION_SQL, liveValues } from './session.js';

export async function isPlatformAdmin(db, session) {
  return Boolean(await first(db, 'SELECT user_id FROM pilot_admins WHERE user_id=? AND active=1', session.user_id));
}
export async function handleAdmin(request, env, session, local) {
  const db=env.DB, path=new URL(request.url).pathname;
  if(!await isPlatformAdmin(db,session)) fail(403,'admin_required','Cet espace est réservé aux administrateurs Jet d’Encre.');
  const guard=`EXISTS (SELECT 1 FROM pilot_admins WHERE user_id=? AND active=1) AND ${LIVE_SESSION_SQL}`;
  const values=[session.user_id,...liveValues(session)];
  const statement=(sql,...params)=>db.prepare(sql).bind(...params);
  async function commit(action,target,statements) {
    const result=await db.batch([statements[0],statement(`INSERT INTO pilot_admin_events(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0 AND ${guard}`,crypto.randomUUID(),session.user_id,action,target,now(),...values),...statements.slice(1)]);
    if(!result[0]?.meta?.changes) fail(409,'access_changed','L’accès ou les données ont changé. Actualisez avant de réessayer.');
    return reply({ok:true,id:target});
  }
  if(request.method==='GET'&&path==='/api/pilot/admin') {
    const schools=await all(db,'SELECT * FROM pilot_schools ORDER BY name');
    const accounts=await all(db,`SELECT u.id,u.display_name name,u.active,m.school_id schoolId,m.role,
      (SELECT count(*) FROM pilot_identities i WHERE i.user_id=u.id) connected,
      (SELECT count(*) FROM pilot_sessions s WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>?) sessions
      FROM pilot_users u JOIN pilot_memberships m ON m.user_id=u.id ORDER BY u.display_name`,now());
    const classes=await all(db,'SELECT id,school_id schoolId,name FROM pilot_classes WHERE active=1 ORDER BY name');
    const events=await all(db,`SELECT e.action,e.target_id targetId,e.created_at createdAt,u.display_name actor FROM pilot_admin_events e JOIN pilot_users u ON u.id=e.actor_id ORDER BY e.created_at DESC,e.rowid DESC LIMIT 30`);
    return reply({userId:session.user_id,schools,accounts,classes,events});
  }
  if(request.method!=='POST') fail(404,'not_found','Route inexistante.');
  const input=await readInput(request);
  // A client-generated identifier makes a retry safe without creating duplicates.
  const id=requiredText(input.id,'Référence',1,100);
  if(path==='/api/pilot/admin/schools') {
    const name=requiredText(input.name,'Nom de l’école',3,140);
    const existing=await first(db,'SELECT name FROM pilot_schools WHERE id=?',id);
    if(existing){if(existing.name!==name)fail(409,'conflict','Cette référence est déjà utilisée.');return reply({ok:true,id});}
    return commit('school_created',id,[statement(`INSERT INTO pilot_schools(id,name) SELECT ?,? WHERE ${guard}`,id,name,...values)]);
  }
  if(path==='/api/pilot/admin/classes') {
    const name=requiredText(input.name,'Classe',2,100),school=requiredText(input.schoolId,'École',1,100);
    const existing=await first(db,'SELECT name,school_id FROM pilot_classes WHERE id=?',id);
    if(existing){if(existing.name!==name||existing.school_id!==school)fail(409,'conflict','Cette référence est déjà utilisée.');return reply({ok:true,id});}
    return commit('class_created',id,[statement(`INSERT INTO pilot_classes(id,school_id,name) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM pilot_schools WHERE id=? AND active=1) AND ${guard}`,id,school,name,school,...values)]);
  }
  if(path==='/api/pilot/admin/accounts') {
    const name=requiredText(input.name,'Nom',2,120),school=requiredText(input.schoolId,'École',1,100),role=input.role;
    if(!['enseignant','eleve','parent'].includes(role))fail(422,'invalid_role','Choisissez enseignant, élève ou parent.');
    if(!await first(db,'SELECT id FROM pilot_schools WHERE id=? AND active=1',school))fail(422,'school_unavailable','Choisissez une école active.');
    const classId=role!=='parent'?requiredText(input.classId,'Classe',1,100):null;
    const childId=role==='parent'?requiredText(input.childId,'Enfant',1,100):null;
    if(classId&&!await first(db,'SELECT id FROM pilot_classes WHERE id=? AND school_id=? AND active=1',classId,school))fail(422,'class_unavailable','Cette classe n’appartient pas à l’école choisie.');
    if(childId&&!await first(db,`SELECT m.user_id FROM pilot_memberships m JOIN pilot_users u ON u.id=m.user_id WHERE m.school_id=? AND m.user_id=? AND m.role='eleve' AND m.active=1 AND u.active=1`,school,childId))fail(422,'child_unavailable','Choisissez un élève actif de cette école.');
    const existing=await first(db,'SELECT id FROM pilot_users WHERE id=?',id);
    if(existing)fail(409,'account_exists','Ce compte existe déjà. Actualisez la liste avant de poursuivre.');
    const items=[statement(`INSERT INTO pilot_users(id,display_name,created_at) SELECT ?,?,? WHERE ${guard}`,id,name,now(),...values),
      statement(`INSERT INTO pilot_memberships(school_id,user_id,role) SELECT ?,?,? WHERE ${guard}`,school,id,role,...values)];
    if(classId)items.push(statement(`INSERT INTO pilot_class_members(school_id,class_id,user_id) SELECT ?,?,? WHERE ${guard}`,school,classId,id,...values));
    if(childId)items.push(statement(`INSERT INTO pilot_family_links(school_id,parent_id,student_id) SELECT ?,?,? WHERE ${guard}`,school,id,childId,...values));
    return commit('account_created',id,items);
  }
  if(path==='/api/pilot/admin/identity') {
    if(!await first(db,'SELECT user_id FROM pilot_memberships WHERE user_id=?',id))fail(404,'account_missing','Compte scolaire introuvable.');
    if(await isPlatformAdmin(db,{user_id:id}))fail(403,'protected_admin','Le rattachement administrateur nécessite une intervention séparée.');
    const subject=requiredText(input.subject,'Identifiant Auth0',7,160);
    if(!/^auth0\|[a-zA-Z0-9_-]+$/.test(subject))fail(422,'invalid_subject','Recopiez le User ID du compte créé dans Auth0, commençant par auth0|.');
    const issuer=local?'https://local-fixture.example/':env.OIDC_ISSUER;
    if(!issuer)fail(503,'issuer_missing','Le fournisseur de connexion n’est pas configuré.');
    if(await first(db,'SELECT user_id FROM pilot_identities WHERE user_id=? OR (issuer=? AND subject=?)',id,issuer,subject))fail(409,'identity_exists','Le compte ou cet identifiant est déjà rattaché. Aucun remplacement effectué.');
    return commit('identity_linked',id,[statement(`INSERT INTO pilot_identities(issuer,subject,user_id) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM pilot_identities WHERE user_id=? OR (issuer=? AND subject=?)) AND ${guard}`,issuer,subject,id,id,issuer,subject,...values)]);
  }
  if(path==='/api/pilot/admin/school-status'||path==='/api/pilot/admin/account-status'||path==='/api/pilot/admin/revoke') {
    const school=path.endsWith('school-status');
    if(!school&&await isPlatformAdmin(db,{user_id:id}))fail(403,'protected_admin','Les comptes administrateurs sont gérés séparément.');
    const table=school?'pilot_schools':'pilot_users';
    if(!await first(db,`SELECT id FROM ${table} WHERE id=?`,id))fail(404,'not_found','École ou compte introuvable.');
    const revoke=path.endsWith('/revoke');
    if(!revoke&&typeof input.active!=='boolean')fail(422,'invalid_status','Statut invalide.');
    const target=school?'user_id IN (SELECT user_id FROM pilot_memberships WHERE school_id=?)':'user_id=?';
    const items=revoke?[statement(`UPDATE pilot_users SET active=active WHERE id=? AND ${guard}`,id,...values)]:[statement(`UPDATE ${table} SET active=? WHERE id=? AND ${guard}`,Number(input.active),id,...values)];
    if(revoke||!input.active)items.push(statement(`UPDATE pilot_sessions SET revoked_at=? WHERE ${target} AND revoked_at IS NULL AND ${guard}`,now(),id,...values));
    return commit(revoke?'sessions_revoked':`${school?'school':'account'}_${input.active?'activated':'suspended'}`,id,items);
  }
  fail(404,'not_found','Route inexistante.');
}
