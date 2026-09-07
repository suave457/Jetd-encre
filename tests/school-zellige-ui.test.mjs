import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MISSION_ZELLIGE_MISSIONS as missions,getDailyMissionZellige} from '../src/features/games/mission-zellige/missionZelligeData.js';
const require=createRequire(import.meta.url),{buildSync}=createRequire(require.resolve('vite'))('esbuild');
const url=new URL('../src/features/games/mission-zellige/MissionZellige.jsx',import.meta.url);
const compiled=buildSync({stdin:{contents:readFileSync(url,'utf8'),resolveDir:dirname(fileURLToPath(url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
const isolated={exports:{}};new Function('module','exports','require',compiled)(isolated,isolated.exports,require);
const daily=getDailyMissionZellige('2026-09-07'),mission=missions[daily.missionIndex];
const base={mission,missions,daily,missionIndex:daily.missionIndex,phase:'location',orderedPieces:[],availablePieces:mission.pieces,currentXp:40,fragmentCount:0,isDailyMission:true,studentName:'Lina',phaseLabel:'1 · Observer',sentence:'',showTranscript:false};
const render=changes=>renderToStaticMarkup(createElement(isolated.exports.MissionZelligeView,{model:{...base,...changes}}));
test('Zellige shared original view retains four scenes, eight assets, radio keyboard semantics and original layout',()=>{
  for(const m of missions){assert.ok(existsSync(new URL('../public'+m.imageSrc,import.meta.url)));for(const part of m.imageSrcSet.split(','))assert.ok(existsSync(new URL('../public'+part.trim().split(' ')[0],import.meta.url)));}
  const html=render({});for(const text of ['class="mission-zellige"','class="mz-topbar"','class="mz-scene"','class="mz-mission-panel"','mz-sentence-dock','aria-label="Mes jeux"','role="radiogroup"','aria-label="Choisir un repère"','Valider ce repère'])assert.ok(html.includes(text),text);
  assert.equal((html.match(/role="radio"/g)||[]).length,3);assert.equal((html.match(/aria-current="step"/g)||[]).length,1);assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.doesNotMatch(html,/Terminer la mission|Bravo Lina|\+20 XP/);
});
test('Zellige sentence stays separate from completion and preserves reorder/remove accessible controls',()=>{
  const sentence=render({phase:'sentence',orderedPieces:mission.correctOrder,availablePieces:[],locationSolved:true});
  assert.match(sentence,/Déplacer «/);assert.match(sentence,/Retirer «/);assert.match(sentence,/aria-live="polite"/);assert.match(sentence,/Valider ma phrase/);assert.doesNotMatch(sentence,/Terminer la mission|mz-result-card/);
  const solved=render({phase:'sentence',orderedPieces:mission.correctOrder,availablePieces:[],locationSolved:true,sentenceSolved:true});
  assert.match(solved,/Terminer la mission/);assert.doesNotMatch(solved,/mz-result-card/);
});
test('Zellige results distinguish guided daily success from reward-free practice',()=>{
  const dailyResult=render({phase:'complete',result:{xpEarned:20,masteryLabel:'Réussite accompagnée'},fragmentCount:1});
  assert.match(dailyResult,/Bravo Lina !/);assert.match(dailyResult,/Réussite accompagnée/);assert.match(dailyResult,/\+20 XP/);assert.match(dailyResult,/1\/4 dans ta fresque/);
  const practice=render({phase:'complete',result:{preview:true,xpEarned:0,alreadyRecorded:true},fragmentCount:1});
  assert.match(practice,/SITUATION TESTÉE/);assert.match(practice,/Déjà récompensée/);assert.doesNotMatch(practice,/\+20 XP/);
});
test('Zellige school adapter preserves exact uncertain retries and never uses demo XP or progress storage',()=>{
  const source=readFileSync(new URL('../src/features/pilote/SchoolZellige.jsx',import.meta.url),'utf8');
  for(const text of ['MissionZelligeView model={model}','responseUncertain','pending.current','assertOwner','useDemoStore','onAwardXp'])if(['assertOwner','useDemoStore','onAwardXp'].includes(text))assert.ok(!source.includes(text));else assert.ok(source.includes(text));
  assert.match(source,/session\.user\.schoolId!==previous\.user\.schoolId/);assert.match(source,/new BroadcastChannel\('jde-pilot-session'\)/);
  assert.match(source,/target\.isConnected&&!target\.disabled/);assert.match(source,/setSpeaking\(false\)/);
  assert.equal((source.match(/localStorage\.setItem/g)||[]).length,1);assert.match(source,/localStorage\.setItem\('jde\.mission-zellige:transcript-visible'/);
});
