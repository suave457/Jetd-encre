import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../worker/index.js';
import { publicArticleDocument } from '../worker/public-article-document.js';
import { handlePublicArticles } from '../worker/public-articles.js';
import { handlePilot } from '../worker/pilot/api.js';
import { issueSession } from '../worker/pilot/session.js';
import { openPilotDatabase, seedLocalPilot, sqliteBinding } from '../scripts/pilot-local-store.mjs';
import { emptyArticle } from '../src/features/editorial/articleCore.js';
import { PUBLIC_BLOG_ARTICLES } from '../src/publicContentArticles.js';

const origin='http://127.0.0.1:5173';
const secureOrigin='https://example.test';
const adminBase='/api/pilot/admin/editorial';
const defaultArticle=overrides=>({...emptyArticle(),title:'Atelier de lecture à Rabat',excerpt:'Un atelier de communication pour présenter un lieu familier et poser des questions.',body:'Les enfants organisent une visite de leur quartier. Chaque binôme présente un lieu, écoute une question puis formule une réponse adaptée. La classe compare ensuite les propositions et choisit un itinéraire.',category:'Enseignants',theme:'Lecture et oral',author:'Équipe de recette du Mag',...overrides});
const template='<!doctype html><html lang="fr"><head><title>Ancien accueil du site</title><meta name="description" content="Ancienne description"><meta property="og:title" content="Ancien titre OG"><meta property="og:description" content="Ancienne description OG"><meta name="twitter:title" content="Ancien titre Twitter"><meta name="twitter:description" content="Ancienne description Twitter"><meta name="robots" content="index, follow"><link rel="canonical" href="https://old.example/"><meta property="og:url" content="https://old.example/"></head><body><div id="root" data-prerendered="true"><main>ACCUEIL_PRERENDU_SENTINELLE<div>IMBRICATION_PRERENDUE<div>Encore une section</div></div></main></div><!--jde-prerender-end--><script type="module" src="/assets/app-test.js"></script><footer id="shell-footer">Élément hors racine à préserver</footer></body></html>';
function assets(html=template,status=200){const calls=[];return {calls,fetch:async request=>{calls.push({url:new URL(request.url).pathname,method:request.method,accept:request.headers.get('accept')});return new Response(html,{status,headers:{'Content-Type':'text/html'}});}};}
async function setup(t){
  const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());
  const session=await issueSession(store.DB,'pilot-local-admin','local_fixture',true);
  const call=async(path,body)=>{
    const response=await handlePilot(new Request(origin+adminBase+path,{method:'POST',headers:{origin,'Content-Type':'application/json',cookie:session.cookie.split(';')[0],'X-CSRF-Token':session.csrfToken},body:JSON.stringify(body)}),{DB:store.DB},{local:true});
    const data=await response.json();assert.equal(response.status,201,JSON.stringify(data));return data;
  };
  const create=async(overrides={})=>{const command={id:crypto.randomUUID(),operationId:crypto.randomUUID(),action:'create',baseRevision:0,article:defaultArticle(overrides)};await call('',command);return command;};
  const publish=async(command,overrides={})=>call('/'+command.id+'/publication',{operationId:crypto.randomUUID(),action:'publish',basePublicationRevision:0,confirmed:true,baseRevision:1,sourceVersionId:command.operationId,imageId:PUBLIC_BLOG_ARTICLES[0].slug,imageAlt:'Illustration de lecture pour une activité de communication en français',...overrides});
  const withdraw=async(command,basePublicationRevision=1)=>call('/'+command.id+'/publication',{operationId:crypto.randomUUID(),action:'retract',basePublicationRevision,confirmed:true});
  return {...store,call,create,publish,withdraw};
}
const slug=command=>'article-'+command.id;
const documentRequest=(command,method='GET')=>new Request(secureOrigin+'/blog/'+slug(command),{method,headers:{Accept:'text/html'}});
async function api(DB,suffix='',method='GET'){
  const response=await handlePublicArticles(new Request(origin+'/api/public/articles'+suffix,{method}),{DB});
  return {status:response.status,headers:response.headers,data:method==='HEAD'?null:await response.json(),response};
}
const expectOk=result=>{assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};

test('Mag document : publication200, métadonnées propres et suppression exacte de la racine accueil pré-rendue',async t=>{
  const f=await setup(t),a=await f.create();await f.publish(a);const ASSETS=assets();
  const response=await publicArticleDocument(documentRequest(a),{DB:f.DB,ASSETS},slug(a)),html=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
  assert.match(response.headers.get('Content-Type'),/^text\/html; charset=utf-8$/);
  assert.ok(html.includes('<title>'+a.article.title+' — Jet d’Encre</title>'));
  assert.ok(html.includes('<meta name="description" content="'+a.article.excerpt+'">'));
  assert.ok(html.includes('<meta property="og:title" content="'+a.article.title+' — Jet d’Encre">'));
  assert.ok(html.includes('<meta name="twitter:description" content="'+a.article.excerpt+'">'));
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.ok(html.includes('<meta property="og:type" content="article">'));
  assert.ok(html.includes('<meta property="og:image" content="'+secureOrigin+PUBLIC_BLOG_ARTICLES[0].image+'">'));
  assert.ok(html.includes('<meta name="twitter:image:alt" content="Illustration de lecture pour une activité de communication en français">'));
  assert.equal((html.match(/<div id="root"><\/div>/g)||[]).length,1);
  for(const obsolete of ['ACCUEIL_PRERENDU_SENTINELLE','IMBRICATION_PRERENDUE','data-prerendered','Ancien accueil','old.example','rel="canonical"','property="og:url"'])assert.equal(html.includes(obsolete),false,obsolete);
  assert.ok(html.includes('<script type="module" src="/assets/app-test.js"></script>'));assert.ok(html.includes('id="shell-footer"'));
  assert.deepEqual(ASSETS.calls,[{url:'/index.html',method:'GET',accept:'text/html'}]);
});

test('Mag document : métadonnées échappées et caractères de remplacement $& conservés littéralement',async t=>{
  const f=await setup(t),a=await f.create({title:'École $& </title><script>alert("x")</script>',excerpt:'Une description $& " citée > <img src=x onerror=alert(1)> & lisible.'});await f.publish(a);
  const response=await publicArticleDocument(documentRequest(a),{DB:f.DB,ASSETS:assets()},slug(a)),html=await response.text();
  assert.equal(response.status,200);
  const title='École $&amp; &lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; — Jet d’Encre';
  const excerpt='Une description $&amp; &quot; citée &gt; &lt;img src=x onerror=alert(1)&gt; &amp; lisible.';
  assert.ok(html.includes('<title>'+title+'</title>'));
  for(const key of ['og:title','twitter:title'])assert.ok(html.includes('="'+key+'" content="'+title+'"'),key);
  for(const key of ['description','og:description','twitter:description'])assert.ok(html.includes('="'+key+'" content="'+excerpt+'"'),key);
  assert.equal(html.includes('<script>alert("x")</script>'),false);assert.equal(html.includes('<img src=x'),false);
  assert.equal((html.match(/<title>/g)||[]).length,1);assert.equal((html.match(/<script/g)||[]).length,1);
  assert.equal(html.includes('Ancienne description'),false);
});

test('Mag document : brouillon et article retiré renvoient un vrai404 sans ancien contenu public',async t=>{
  const f=await setup(t),a=await f.create(),ASSETS=assets();
  const check=async()=>{
    const response=await publicArticleDocument(documentRequest(a),{DB:f.DB,ASSETS},slug(a)),html=await response.text();
    assert.equal(response.status,404);assert.match(html,/<title>Article indisponible — Jet d’Encre<\/title>/);
    assert.equal(html.includes(a.article.title),false);assert.equal(html.includes('ACCUEIL_PRERENDU_SENTINELLE'),false);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  };
  await check();await f.publish(a);await f.withdraw(a);await check();
});

test('Mag document : base, assets ou modèle indisponibles renvoient503 sans détails internes',async t=>{
  const f=await setup(t),a=await f.create();await f.publish(a);
  const cases=[
    {ASSETS:assets()},
    {DB:{prepare(){throw new Error('PRIVATE_DATABASE_FAILURE_SENTINELLE');}},ASSETS:assets()},
    {DB:f.DB,ASSETS:assets('Modèle non trouvé',404)},
    {DB:f.DB,ASSETS:assets('<html><div id="root" data-prerendered="true"><h1>ACCUEIL_PRERENDU_SENTINELLE</h1></div></html>')},
    {DB:f.DB,ASSETS:assets('<html><main>Modèle sans racine connue</main></html>')},
    {DB:f.DB,ASSETS:{fetch:async()=>{throw new Error('PRIVATE_ASSETS_FAILURE_SENTINELLE');}}},
  ];
  for(const env of cases){
    const response=await publicArticleDocument(documentRequest(a),env,slug(a)),html=await response.text();
    assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
    assert.equal(html.includes('PRIVATE_'),false);assert.equal(html.includes('ACCUEIL_PRERENDU_SENTINELLE'),false);
  }
});

test('Mag document : HEAD conserve statuts et protections sans corps ; autres méthodes refusées',async t=>{
  const f=await setup(t),a=await f.create();await f.publish(a);
  for(const [env,expected] of [[{DB:f.DB,ASSETS:assets()},200],[{ASSETS:assets()},503],[{DB:f.DB,ASSETS:assets('invalide')},503]]){
    const response=await publicArticleDocument(documentRequest(a,'HEAD'),env,slug(a));assert.equal(response.status,expected);assert.equal(await response.text(),'');assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
  await f.withdraw(a);
  const gone=await publicArticleDocument(documentRequest(a,'HEAD'),{DB:f.DB,ASSETS:assets()},slug(a));assert.equal(gone.status,404);assert.equal(await gone.text(),'');
  const ASSETS=assets(),refused=await publicArticleDocument(documentRequest(a,'POST'),{DB:f.DB,ASSETS},slug(a));assert.equal(refused.status,405);assert.equal(refused.headers.get('Allow'),'GET, HEAD');assert.equal(ASSETS.calls.length,0);
});

test('Mag worker : route publication indépendante d’Auth0, vraie404, CSP et no-store sur document et API',async t=>{
  const f=await setup(t),a=await f.create();await f.publish(a);const ASSETS=assets(),env={DB:f.DB,ASSETS};
  for(const pathname of ['/blog/'+slug(a),'/blog/'+slug(a)+'/', '/api/public/articles/'+slug(a),'/api/public/articles']){
    const response=await worker.fetch(new Request(secureOrigin+pathname,{headers:{Accept:'text/html'}}),env);
    assert.equal(response.status,200,pathname);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
    const policy=response.headers.get('Content-Security-Policy');assert.match(policy,/script-src 'self'(?:;|$)/);assert.match(policy,/object-src 'none'(?:;|$)/);assert.equal(policy.includes("script-src 'self' 'unsafe-inline'"),false);
    assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN');assert.match(response.headers.get('Strict-Transport-Security'),/max-age=31536000/);
  }
  const head=await worker.fetch(documentRequest(a,'HEAD'),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
  await f.withdraw(a);
  for(const pathname of ['/blog/'+slug(a),'/api/public/articles/'+slug(a)]){
    const response=await worker.fetch(new Request(secureOrigin+pathname),env);assert.equal(response.status,404);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.ok(response.headers.get('Content-Security-Policy'));
  }
  const unavailable=await worker.fetch(documentRequest(a),{ASSETS});assert.equal(unavailable.status,503);assert.ok(unavailable.headers.get('Content-Security-Policy'));
});

test('Mag API : HEAD des listes, détails,404 et503 ne transmet jamais de corps',async t=>{
  const f=await setup(t),a=await f.create();await f.publish(a);
  for(const suffix of ['', '/'+slug(a)]){
    const response=await handlePublicArticles(new Request(origin+'/api/public/articles'+suffix,{method:'HEAD'}),{DB:f.DB});
    assert.equal(response.status,200);assert.equal(await response.text(),'');assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
  await f.withdraw(a);
  for(const [DB,suffix,expected] of [[f.DB,'/'+slug(a),404],[undefined,'',503]]){
    const response=await handlePublicArticles(new Request(origin+'/api/public/articles'+suffix,{method:'HEAD'}),{DB});assert.equal(response.status,expected);assert.equal(await response.text(),'');
  }
});

test('Mag recherche : É, Œ et Ç sont trouvés en minuscules ou majuscules dans titre, chapô et thème',async t=>{
  const f=await setup(t);
  const rows=[
    await f.create({title:'ÉCOLE et apprentissage communicatif'}),
    await f.create({title:'Lire ensemble au quotidien',excerpt:'Des ŒUVRES courtes à lire en groupe pour préparer une présentation orale.'}),
    await f.create({title:'Coopérer pendant la lecture',theme:'ÇA COMMENCE EN BINÔME'}),
  ];
  for(const row of rows)await f.publish(row);
  for(const [q,row] of [['école',rows[0]],['ÉCOLE',rows[0]],['œuvres',rows[1]],['ŒUVRES',rows[1]],['ça commence',rows[2]],['ÇA COMMENCE',rows[2]]]){
    const found=expectOk(await api(f.DB,'?q='+encodeURIComponent(q)));assert.deepEqual(found.items.map(item=>item.slug),[slug(row)],q);
  }
});

test('Mag pagination : révision64 stable pour les brouillons et obligatoire pour continuer une liste',async t=>{
  const f=await setup(t),rows=[];
  for(let i=0;i<27;i++){const row=await f.create({title:'Article publié numéro '+String(i).padStart(2,'0')});await f.publish(row);rows.push(row);}
  const first=expectOk(await api(f.DB));assert.match(first.revision,/^[a-f0-9]{64}$/);assert.equal(first.items.length,25);assert.equal(first.nextOffset,25);
  const next=expectOk(await api(f.DB,'?offset=25&revision='+first.revision));assert.equal(next.items.length,2);assert.equal(next.nextOffset,null);assert.equal(next.revision,first.revision);
  assert.equal(new Set([...first.items,...next.items].map(item=>item.slug)).size,27);
  assert.equal((await api(f.DB,'?offset=25')).status,409);
  for(const bad of ['short','g'.repeat(64),'A'.repeat(64),first.revision+'&revision='+first.revision])assert.equal((await api(f.DB,'?offset=25&revision='+bad)).status,400);
  await f.create({title:'Brouillon nouveau mais pas publié'});
  await f.call('',{id:rows[0].id,operationId:crypto.randomUUID(),action:'save',baseRevision:1,article:defaultArticle({title:'Modification privée ultérieure'})});
  assert.equal(expectOk(await api(f.DB)).revision,first.revision);
  assert.equal((await api(f.DB,'?offset=25&revision='+first.revision)).status,200);
});

test('Mag pagination : retrait et nouvelle publication invalident la révision antérieure avec409',async t=>{
  const f=await setup(t),a=await f.create();await f.publish(a);
  const first=expectOk(await api(f.DB));
  await f.withdraw(a);
  const stale=await api(f.DB,'?offset=25&revision='+first.revision);assert.equal(stale.status,409);assert.equal(stale.data.error.code,'catalogue_changed');assert.equal(stale.data.items,undefined);
  const second=expectOk(await api(f.DB));assert.notEqual(second.revision,first.revision);assert.deepEqual(second.items,[]);
  assert.equal((await api(f.DB,'?revision='+first.revision)).status,409);
  const b=await f.create({title:'Un nouvel article public'});await f.publish(b);
  assert.equal((await api(f.DB,'?offset=25&revision='+second.revision)).status,409);
  const third=expectOk(await api(f.DB));assert.notEqual(third.revision,second.revision);assert.deepEqual(third.items.map(item=>item.slug),[slug(b)]);
});

test('Mag readiness : migration0010 exigée même lorsque le pilote Auth0 n’est pas activé',async t=>{
  const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());sqlite.exec('PRAGMA foreign_keys=ON');
  t.mock.method(console,'error',()=>{});
  const directory=new URL('../drizzle/',import.meta.url),migrations=readdirSync(directory).filter(name=>name.endsWith('.sql')).sort(),publication=migrations.find(name=>name.startsWith('0010'));
  assert.ok(publication);
  for(const name of migrations.filter(name=>name<publication))sqlite.exec(readFileSync(new URL(name,directory),'utf8'));
  const DB=sqliteBinding(sqlite);
  for(const route of ['/api/v1/health','/api/v1/ready']){
    const response=await worker.fetch(new Request(secureOrigin+route),{DB});assert.equal(response.status,503);assert.equal((await response.json()).error.code,'database_schema_unavailable');
  }
  sqlite.exec(readFileSync(new URL(publication,directory),'utf8'));
  const ready=await worker.fetch(new Request(secureOrigin+'/api/v1/ready'),{DB});assert.equal(ready.status,200);assert.equal((await ready.json()).storage.schema,'checked');
  assert.equal(sqlite.prepare('SELECT count(*) n FROM beta_article_publication_events').get().n,0);assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
