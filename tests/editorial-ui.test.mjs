import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {emptyArticle,normalizeArticle,parseArticleLocation,editorialRequest} from '../src/features/editorial/articleCore.js';
import {usesSchoolDocumentNavigation} from '../src/routeCore.js';

test('article : liens profonds stricts et absence de substitution',()=>{
  const id=crypto.randomUUID();assert.equal(parseArticleLocation('?article='+id).id,id);
  assert.equal(parseArticleLocation('?article=nouveau').creating,true);
  assert.deepEqual(parseArticleLocation(''),{id:null,creating:false,error:''});
  for(const query of ['?article=','?article=inconnu','?article='+id+'&article='+id])assert.ok(parseArticleLocation(query).error);
  assert.equal(usesSchoolDocumentNavigation('/admin/blog'),true);
});
test('article : tous les champs sont conservés et les limites restent explicites',()=>{
  const draft={...emptyArticle(),title:'  Écrire au Maroc  ',excerpt:' Écouter et parler. ',body:'أهلاً\r\n\r\nBonjour ⵣ',theme:' Oral ',author:' Équipe '};
  assert.deepEqual(normalizeArticle(draft),{title:'Écrire au Maroc',excerpt:'Écouter et parler.',body:'أهلاً\n\nBonjour ⵣ',category:'Parents',theme:'Oral',author:'Équipe',status:'draft'});
  for(const change of [{body:'x'.repeat(12001)},{title:'ab'},{author:null},{category:'Public'},{status:'published'},{status:'review'},{level:'5e'}])assert.throws(()=>normalizeArticle({...draft,...change}));
});
test('article : API client refuse une autre identité, sans données démo',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({userId:'other',item:{title:'private'}}));
  await assert.rejects(()=>editorialRequest('',{userId:'admin',fetcher}),error=>error.status===403);
});
test('article : coupure et réponse non JSON gardent une confirmation inconnue en français',async()=>{
  for(const fetcher of [async()=>{throw new Error('Failed to fetch');},async()=>new Response('<html>502</html>',{status:502})]){
    await assert.rejects(()=>editorialRequest('',{userId:'admin',body:{id:'pending'},fetcher}),error=>!error.status&&/envoi/.test(error.message)&&!error.message.includes('fetch'));
  }
});
test('article : erreur métier garde son statut et requête privée garde CSRF/no-store',async()=>{
  await assert.rejects(()=>editorialRequest('',{userId:'admin',csrf:'csrf-test',body:{title:'test'},fetcher:async(path,options)=>{
    assert.equal(path,'/api/pilot/admin/editorial');assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.headers['X-CSRF-Token'],'csrf-test');
    return new Response(JSON.stringify({error:{code:'revision_conflict',message:'Version différente'}}),{status:409});
  }}),error=>error.status===409&&error.code==='revision_conflict');
});

test('article : un refus d’accès non JSON efface aussi les données privées',async()=>{
  for(const status of [401,403])await assert.rejects(()=>editorialRequest('',{userId:'admin',fetcher:async()=>new Response('<html>Accès refusé</html>',{status})}),error=>error.status===status);
});

const require=createRequire(import.meta.url),{buildSync}=createRequire(require.resolve('vite'))('esbuild');
const url=new URL('../src/features/editorial/ArticleEditorView.jsx',import.meta.url);
const compiled=buildSync({stdin:{contents:readFileSync(url,'utf8'),resolveDir:dirname(fileURLToPath(url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic'}).outputFiles[0].text;
const isolated={exports:{}};new Function('module','exports','require',compiled)(isolated,isolated.exports,require);
const Editor=isolated.exports.default;
const render=props=>renderToStaticMarkup(createElement(Editor,{form:{...emptyArticle(),title:'Un brouillon privé'},setForm(){},onSave(){},onBack(){},connected:true,ui:{PageHeader:({title})=>createElement('h1',null,title),DemoBadge:()=>createElement('span',null,'Démo')},...props}));
test('éditeur : composition partagée, vraie soumission, publication bloquée et auteur non inventé',()=>{
  const html=render();for(const name of ['blog-editor-layout','blog-editor-form','form-two','rich-textarea','article-preview-panel','mini-article-preview','blog-editor-actions'])assert.ok(html.includes(name));
  assert.match(html,/<form id="article-editor-form"/);assert.match(html,/type="submit" form="article-editor-form"/);
  assert.match(html,/disabled=""[^>]*>.*?Publier l’article/);
  for(const invented of ['Nadia El Mansouri','6 min','2026-09-15'])assert.equal(html.includes(invented),false);
});
test('éditeur : texte HTML inerte, champs verrouillés pendant confirmation incertaine',()=>{
  const html=render({locked:true,form:{...emptyArticle(),title:'<script>alert(1)</script>',excerpt:'<img src=x onerror=alert(1)>',body:'<script>bad()</script>'}});
  assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img src=x'),false);assert.ok(html.includes('&lt;script&gt;'));
  assert.match(html,/<textarea[^>]*disabled=""/);assert.match(html,/<button[^>]*type="submit"[^>]*disabled=""/);
});
test('éditeur : adaptateur de démonstration utilise la même vue sans être remplacé',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');assert.match(app,/if\(mode==="editor"\)return <ArticleEditorView/);
  const html=render({connected:false,form:{...emptyArticle(),title:'Article démo',status:'Brouillon',author:'Signature de démonstration'}});
  assert.ok(html.includes('aperçu local'));assert.ok(html.includes('Planifié'));assert.ok(html.includes('Démo'));
});
