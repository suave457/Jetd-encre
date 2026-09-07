import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {endSchoolSession,clearDemoLogin} from '../src/features/pilote/schoolLogout.js';
import {createDemoStore,createMemoryStorage,DEMO_STORAGE_KEY,DEMO_ACCOUNTS} from '../src/demoStoreCore.js';

test('déconnexion : attend la révocation scolaire avec le jeton CSRF obtenu',async()=>{
 const calls=[];await endSchoolSession(async(path,options)=>{calls.push([path,options]);return path==='/session'?{authenticated:true,csrfToken:'scoped-token'}:{ok:true};});
 assert.deepEqual(calls,[['/session',undefined],['/logout',{body:{},csrf:'scoped-token'}]]);
});
test('déconnexion : pas de faux succès en cas de panne serveur',async()=>{
 await assert.rejects(()=>endSchoolSession(async()=>{throw new Error('offline');}),/offline/);
 let writes=0;await endSchoolSession(async(path)=>{if(path==='/logout')writes++;return {authenticated:false};});assert.equal(writes,0);
});
test('déconnexion : efface uniquement la connexion démo, conserve les travaux locaux',()=>{
 const storage=createMemoryStorage(),store=createDemoStore({storage});store.actions.signIn('eleve',DEMO_ACCOUNTS.eleve);
 const before=JSON.parse(storage.getItem(DEMO_STORAGE_KEY));clearDemoLogin(storage);const after=JSON.parse(storage.getItem(DEMO_STORAGE_KEY));
 assert.equal(after.session.authenticated,false);assert.equal(after.session.userId,null);
 for(const key of Object.keys(before).filter(key=>!['session','meta'].includes(key)))assert.deepEqual(after[key],before[key],key);
 const empty=createMemoryStorage();clearDemoLogin(empty);assert.equal(empty.getItem(DEMO_STORAGE_KEY),null);
});
test('connexion normale : ne charge ni ne liste de comptes de test',()=>{
 for(const path of ['PilotApp.jsx','AccessAdmin.jsx']){
  const source=readFileSync(new URL('../src/features/pilote/'+path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\/local\/profiles|pilot-local-admin|Ouvrir l’administration de test/);
 }
 const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(main,/import\.meta\.env\.DEV \? lazy\(\(\) => import\('.\/features\/pilote\/LocalTestTools.jsx'\)\)/);
 assert.match(main,/currentPath==='\/outils-test'.*window.location.hostname/);
});

test('version publiée : aucun panneau ni identité de connexion locale dans les scripts',()=>{
 const directory=new URL('../dist/client/assets/',import.meta.url);
 const scripts=readdirSync(directory).filter(name=>name.endsWith('.js'));
 assert.ok(scripts.length>0,'Lancer la compilation avant les tests de publication.');
 for(const name of scripts)assert.doesNotMatch(readFileSync(new URL(name,directory),'utf8'),/Outils de vérification locale|pilot-local-admin|\/local\/profiles/,name);
});
