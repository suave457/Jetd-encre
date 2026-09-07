import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { LOCAL_CREDENTIALS } from '../scripts/pilot-local-credentials.mjs';
import { RECIPE_MANUAL } from '../scripts/pilot-local-recipe.mjs';
import { handleLocalPilot, localPilotRequestAllowed } from '../scripts/pilot-local-api.mjs';
import { handlePilot } from '../worker/pilot/api.js';
import { hash, now } from '../worker/pilot/session.js';

const origin='http://127.0.0.1:5173';
function setup(t){const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());return store;}
function request(path,body,headers={}) {return new Request(origin+'/api/pilot'+path,{method:body===undefined?'GET':'POST',headers:{origin,'Content-Type':'application/json','X-Local-Pilot':'1',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function call(DB,path,body,headers){const response=await handleLocalPilot(request(path,body,headers),DB);return {status:response.status,headers:response.headers,data:await response.json()};}
function credentials(profileId,profile,extra={}){const {identifier,password}=LOCAL_CREDENTIALS.find(item=>item.profileId===profileId);return {identifier,password,profile,...extra};}
async function login(DB,id,role,extra={},headers={}){return call(DB,'/local/credential-login',credentials(id,role,extra),headers);}
const cookie=result=>result.headers.get('set-cookie')?.split(';')[0];

test('recette : connexion via formulaire pour les huit comptes précréés, rôle et accueil vérifiés',async t=>{
  const {DB}=setup(t);
  for(const [id,role] of [['pilot-local-admin','admin'],['pilot-a-student','eleve'],['pilot-a-other','eleve'],['pilot-b-student','eleve'],['pilot-a-parent','parent'],['pilot-b-parent','parent'],['pilot-a-teacher','enseignant'],['pilot-b-teacher','enseignant']]){
    const result=await login(DB,id,role);assert.equal(result.status,200);assert.equal(result.data.destination,role==='admin'?'/admin/accueil?profil=admin':'/pilote?profil='+role);
    assert.match(result.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=10800/);
    const session=await call(DB,'/session?profil='+role,undefined,{cookie:cookie(result)});assert.equal(session.data.user.id,id);assert.equal(session.data.user.role,role);assert.equal(session.data.mode,'local_fixture');
  }
});
test('recette : mauvais espace refuse toutes les combinaisons sans changer la session ni exposer l’identité',async t=>{
  const {DB,sqlite}=setup(t),initial=await login(DB,'pilot-a-student','eleve');
  const headers={cookie:cookie(initial)};
  for(const [id,role] of [['pilot-local-admin','admin'],['pilot-a-student','eleve'],['pilot-a-parent','parent'],['pilot-a-teacher','enseignant']]){
    for(const expected of ['eleve','parent','enseignant','admin','directeur'].filter(item=>item!==role)){
      const result=await login(DB,id,expected,{},headers);assert.equal(result.status,403);assert.equal(result.data.error.code,'profile_mismatch');assert.equal(result.headers.has('set-cookie'),false);assert.equal(result.data.user,undefined);
    }
  }
  assert.equal((await call(DB,'/session',undefined,headers)).data.user.id,'pilot-a-student');
  assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_sessions').get().n,1);
});
test('recette : identifiant inconnu, mot de passe erroné et compte suspendu ont la même erreur',async t=>{
  const {DB,sqlite}=setup(t);const input=credentials('pilot-a-student','eleve');
  const wrong=await call(DB,'/local/credential-login',{...input,password:'wrong'});
  const unknown=await call(DB,'/local/credential-login',{...input,identifier:'inconnu@recette.invalid'});
  sqlite.prepare('UPDATE pilot_users SET active=0 WHERE id=?').run('pilot-a-student');
  const suspended=await call(DB,'/local/credential-login',input);
  assert.deepEqual(unknown.data,wrong.data);assert.deepEqual(suspended.data,wrong.data);assert.equal(wrong.status,403);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_sessions').get().n,0);
});
test('recette : le rôle est relu en base, jamais attribué par le carnet',async t=>{
  const {DB,sqlite}=setup(t);sqlite.prepare('UPDATE pilot_memberships SET role=? WHERE user_id=?').run('parent','pilot-a-student');
  assert.equal((await login(DB,'pilot-a-student','eleve')).data.error.code,'profile_mismatch');
  assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_sessions').get().n,0);
});
test('recette : le changement de compte réussi révoque l’ancienne session, pas le reste des données',async t=>{
  const {DB,sqlite}=setup(t);const before=sqlite.prepare('SELECT * FROM pilot_users ORDER BY id').all();
  const first=await login(DB,'pilot-a-student','eleve'),second=await login(DB,'pilot-a-parent','parent',{}, {cookie:cookie(first)});
  assert.equal((await call(DB,'/session',undefined,{cookie:cookie(first)})).data.authenticated,false);
  assert.equal((await call(DB,'/session',undefined,{cookie:cookie(second)})).data.user.id,'pilot-a-parent');
  assert.deepEqual(sqlite.prepare('SELECT * FROM pilot_users ORDER BY id').all(),before);
});
test('recette : retour activation borné à l’élève, aucun retour arbitraire',async t=>{
  const {DB}=setup(t);assert.equal((await login(DB,'pilot-a-student','eleve',{returnTo:'activation'})).data.destination,'/activation');
  for(const returnTo of ['https://evil.invalid','/admin/accueil','//evil.invalid','',null])assert.equal((await login(DB,'pilot-a-student','eleve',{returnTo})).status,422);
  assert.equal((await login(DB,'pilot-a-parent','parent',{returnTo:'activation'})).status,422);
});
test('recette : origine, en-tête local, taille et champs fermés obligatoires',async t=>{
  const {DB}=setup(t);
  for(const headers of [{'X-Local-Pilot':''},{origin:'https://evil.invalid'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await login(DB,'pilot-a-student','eleve',{},headers)).status,403);
  for(const extra of [{schoolId:'pilot-school-b'},{profile:'superadmin'},{password:[]},{identifier:'x'.repeat(255)}])assert.equal((await call(DB,'/local/credential-login',{...credentials('pilot-a-student','eleve'),...extra})).status,422);
  assert.equal((await call(DB,'/local/credential-login',{...credentials('pilot-a-student','eleve'),password:'x'.repeat(3000)})).status,413);
  assert.equal(localPilotRequestAllowed({url:'/api/pilot/local/credentials',socket:{remoteAddress:'192.168.1.2'},headers:{host:'127.0.0.1:5173'}}),false);
});
test('recette : déconnexion et expiration rendent les données privées indisponibles',async t=>{
  const {DB,sqlite}=setup(t),result=await login(DB,'pilot-a-student','eleve'),headers={cookie:cookie(result)};
  const session=await call(DB,'/session',undefined,headers);
  assert.equal((await call(DB,'/logout',{}, {...headers,'X-CSRF-Token':session.data.csrfToken})).status,200);
  assert.equal((await call(DB,'/workspace',undefined,headers)).status,401);
  const next=await login(DB,'pilot-a-parent','parent');
  sqlite.prepare('UPDATE pilot_sessions SET expires_at=? WHERE token_hash=?').run(now()-1,await hash(cookie(next).split('=')[1]));
  assert.equal((await call(DB,'/workspace',undefined,{cookie:cookie(next)})).status,401);
});
test('recette : catalogue fictif additif et idempotent, sans code ni réactivation implicite',async t=>{
  const {DB,sqlite}=setup(t);const before=sqlite.prepare('SELECT * FROM pilot_users ORDER BY id').all();
  assert.equal((await call(DB,'/local/prepare-recipe',{})).status,200);assert.equal((await call(DB,'/local/prepare-recipe',{})).status,200);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_manuals').get().n,1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM pilot_manual_codes').get().n,0);
  sqlite.prepare('UPDATE pilot_manuals SET active=0 WHERE id=?').run(RECIPE_MANUAL.id);await call(DB,'/local/prepare-recipe',{});
  assert.equal(sqlite.prepare('SELECT active FROM pilot_manuals').get().active,0);
  assert.deepEqual(sqlite.prepare('SELECT * FROM pilot_users ORDER BY id').all(),before);
  assert.equal((await call(DB,'/local/prepare-recipe',{title:'Autre manuel'})).status,422);
});
test('version distante : toutes les routes de recette sont refusées même avec les indicateurs locaux',async t=>{
  const {DB}=setup(t);
  for(const path of ['/local/credentials','/local/credential-login','/local/prepare-recipe']){
    const response=await handlePilot(request(path,path.endsWith('credentials')?undefined:{}),{DB},{local:false});assert.equal(response.status,404,path);
  }
});
test('version compilée : aucun carnet, mot de passe ou contrôleur de recette',()=>{
  const directory=new URL('../dist/client/assets/',import.meta.url);
  for(const name of readdirSync(directory).filter(name=>name.endsWith('.js'))){
    assert.doesNotMatch(name,/LocalRecipeLogin|LocalTestTools/);
    assert.doesNotMatch(readFileSync(new URL(name,directory),'utf8'),/JetEncre-Test-2026|@recette\.invalid|\/local\/credential-login|\/local\/prepare-recipe/);
  }
});
