import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{buildSync}=createRequire(require.resolve('vite'))('esbuild');
const url=new URL('../src/features/games/word-choice/WordChoiceGame.jsx',import.meta.url);
const compiled=buildSync({stdin:{contents:readFileSync(url,'utf8'),resolveDir:dirname(fileURLToPath(url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);
const render=(name,props)=>renderToStaticMarkup(createElement(module.exports[name],props));
const summary={scorePercent:0,correctCount:0,questionCount:1,xpEarned:0,bestStreak:0,categoryResults:{Lexique:{total:1,correct:0}}};
test('Mot juste shared welcome keeps original artwork, controls and empty-filter feedback',()=>{
  const html=render('WordChoiceWelcome',{level:'Tous',category:'Toutes',questionCount:10});
  for(const content of ['wj-main wj-welcome','wj-settings','le-mot-juste-hero.webp','Choisis ton parcours','Tous les niveaux','Toutes les compétences','Commencer'])assert.ok(html.includes(content));
  assert.match(render('WordChoiceWelcome',{level:'3e AEP',category:'Lexique',questionCount:0}),/disabled=""/);
  assert.match(render('WordChoiceWelcome',{level:'3e AEP',category:'Lexique',questionCount:1}),/<small>phrase<\/small>/);
  assert.match(render('WordChoiceHeader',{phase:'welcome',questionNumber:1,total:1,streak:0,sessionXp:0}),/aria-label="Mes jeux"/);
});
test('Mot juste shared results do not invent a strength after zero correct answers',()=>{
  const html=render('WordChoiceResults',{summary,profileXpStart:20,profileXpTotal:20});
  assert.match(html,/>À poursuivre</);assert.doesNotMatch(html,/>Lexique</);
});
test('Mot juste shared results preserve server totals when another game changes the balance',()=>{
  const s={...summary,correctCount:1,xpEarned:10,scorePercent:100,categoryResults:{Lexique:{total:1,correct:1}}};
  const same=render('WordChoiceResults',{summary:s,profileXpStart:20,profileXpTotal:30});assert.match(same,/<small>=<\/small>/);
  const concurrent=render('WordChoiceResults',{summary:s,profileXpStart:20,profileXpTotal:50});assert.match(concurrent,/Total actuel enregistré/);assert.match(concurrent,/>50 XP</);assert.doesNotMatch(concurrent,/<small>=<\/small>/);
});
test('Mot juste connected controller reopens existing choices without deleting saved results and retains live announcements',()=>{
  const source=readFileSync(new URL('../src/features/pilote/SchoolQuiz.jsx',import.meta.url),'utf8');
  assert.match(source,/attempt=preparing\?null:ready\?\.attempt/);assert.match(source,/onRestart=\{\(\)=>setPreparing\(true\)\}/);
  assert.match(source,/className="wj-sr-only" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(source,/useDemoStore|onAwardXp|sessionStorage|localStorage/);
});
