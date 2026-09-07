import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require=createRequire(import.meta.url);
const {buildSync}=createRequire(require.resolve('vite'))('esbuild');
const viewUrl=new URL('../src/features/pilote/SchoolGamesCatalogue.jsx',import.meta.url);
const code=readFileSync(viewUrl,'utf8');
const compiled=buildSync({stdin:{contents:code,resolveDir:dirname(fileURLToPath(viewUrl)),sourcefile:'SchoolGamesCatalogue.jsx',loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic'}).outputFiles[0].text;
const isolated={exports:{}};
new Function('module','exports','require',compiled)(isolated,isolated.exports,require);
const Catalogue=isolated.exports.default;
const user={id:'real-student',schoolId:'real-school',role:'eleve',name:'Élève du compte'};
const summary=xp=>({data:{userId:user.id,schoolId:user.schoolId,children:[{studentId:user.id,xpTotal:xp}]}});
const render=(props={})=>renderToStaticMarkup(createElement(Catalogue,{user,summary:summary(0),...props}));
const sections=html=>[...html.matchAll(/<section\b[^>]*data-game="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].map(m=>({id:m[1],html:m[0]}));
const text=html=>html.replace(/<[^>]+>/g,'');
const balance=html=>html.match(/<div class="games-xp-balance">[\s\S]*?<strong>([^<]*)<\/strong>/)?.[1];
const ready=['mission-zellige','defi-du-jour','culture-generale','mot-juste','mots-fleches','souk-des-mots','defis-classe'];
const waiting=['debat'];

test('catalogue connecté : les huit cartes originales restent dans le même ordre',()=>{
  const html=render(),cards=sections(html);
  assert.deepEqual(cards.map(c=>c.id),['debat','mission-zellige','defi-du-jour','culture-generale','mot-juste','mots-fleches','souk-des-mots','defis-classe']);
  assert.deepEqual([...html.matchAll(/<h2>(.*?)<\/h2>/g)].map(m=>text(m[1])),[
    'Projet DÉBAT','Mission Zellige','Cinq questions, une nouvelle aventure','Quiz Culture générale','Le Mot juste','Mots fléchés','Le Souk des mots','La classe avance ensemble',
  ]);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.match(html,/<h1 class="">Mes jeux<\/h1>/);
});

test('catalogue connecté : composition, classes et illustrations originales conservées',()=>{
  const html=render(),original=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')+readFileSync(new URL('../src/features/games/TeacherGamesView.jsx',import.meta.url),'utf8');
  for(const className of ['game-feature-card debate-game-feature','game-feature-card mission-zellige-feature','game-feature-card daily-game-feature zellige-section','game-secondary-card word-choice-entry','game-secondary-card mots-fleches-entry','game-secondary-card market-shop-entry','game-secondary-card class-challenge-entry']){
    assert.ok(original.includes(className),className);assert.ok(html.includes('class="'+className+'"'),className);
  }
  const images=[...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(images,[
    '/games/projet-debat/assets/illustrations/welcome-debat.webp',
    '/assets/games/mission-zellige/mission-bibliotheque-v1-640.webp',
    '/assets/defi-du-jour-hero.webp',
    '/assets/games/word-choice/le-mot-juste-hero.webp',
    '/assets/games/market-shop/market-vendor-scene.webp',
    '/assets/games/class-challenges/defis-classes-hero.webp',
  ]);
  for(const image of images)assert.equal(existsSync(new URL('../public'+image,import.meta.url)),true,image);
  assert.doesNotMatch(code,/from\s+['"][^'"]*demo|useDemoStore\(|localStorage|sessionStorage|DEFAULT_STUDENT_XP/);
});

test('catalogue connecté : seulement sept liens vers les jeux réellement raccordés',()=>{
  const html=render(),cards=sections(html);
  assert.deepEqual([...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m=>m[1]),ready.map(id=>'/pilote/jeux/'+id));
  for(const id of ready){
    const card=cards.find(c=>c.id===id);
    assert.match(card.html,new RegExp('href="/pilote/jeux/'+id+'"'));assert.doesNotMatch(card.html,/disabled/);
  }
  for(const id of waiting){
    const card=cards.find(c=>c.id===id);
    assert.match(card.html,/<button\b[^>]*disabled=""/);
    assert.match(card.html,/>Pas encore relié au compte<\/button>/);
    assert.doesNotMatch(card.html,/<a\b|\b\d+\s*XP|fragments|is-completed/);
  }
  assert.equal((html.match(/>Pas encore relié au compte<\/button>/g)||[]).length,1);
  assert.doesNotMatch(html,/href="\/(?:eleve|enseignant|connexion)|mode=demo|data:/);
});

test('catalogue connecté : affiche les seuls XP confirmés du compte, y compris zéro',()=>{
  assert.equal(balance(render()),'0 XP');
  assert.equal(balance(render({summary:summary(237)})),'237 XP');
  for(const value of [undefined,null,-1,NaN,Infinity,1.5,'237']){
    assert.equal(balance(render({summary:summary(value)})),'En attente');
  }
  for(const value of [
    undefined,{}, {data:{}},
    {data:{...summary(999).data,userId:'another-student'}},
    {data:{...summary(999).data,schoolId:'another-school'}},
    {data:{...summary(999).data,children:[{studentId:'another-student',xpTotal:999}]}},
    {data:{...summary(999).data,children:{xpTotal:999}}},
  ]) assert.equal(balance(render({summary:value})),'En attente');
  assert.equal(balance(render({summary:{...summary(237),error:'failed'}})),'Indisponible');
  assert.match(render({summary:{error:'failed'}}),/role="alert"/);
});

test('catalogue connecté : aucune catégorie, date ou réussite quotidienne inventée',()=>{
  const html=render({summary:{...summary(0),daily:{dateKey:'1987-04-21',category:'CATÉGORIE NON CONFIRMÉE'},completedToday:{correctCount:4,questionCount:5}}});
  const card=sections(html).find(c=>c.id==='defi-du-jour');
  assert.match(text(card.html),/DÉFI DU JOUR/);
  assert.match(text(card.html),/catégorie à l’ouverture du jeu/);
  assert.doesNotMatch(html,/1987-04-21|CATÉGORIE NON CONFIRMÉE|4\/5|is-completed|Défi relevé|Voir mon résultat|Terminée aujourd’hui/);
  assert.doesNotMatch(code,/getDailyChallenge|getDailyMissionZellige|new Date|Date\.now/);
});

test('catalogue connecté : aucun lien de jeu élève pour un rôle absent ou incompatible',()=>{
  for(const role of [undefined,'parent','enseignant','directeur','admin']){
    const html=render({user:role?{...user,role}:null});
    assert.match(html,/role="alert"/);assert.doesNotMatch(html,/<a\b|data-game=|\b\d+ XP/);
  }
});
