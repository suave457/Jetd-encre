import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MARKET_MISSIONS as missions,MARKET_TIERS as tiers,getMarketProduct} from '../src/features/games/market-shop/marketShopData.js';
import {buildMarketTierProgress,buildMarketTierSummary} from '../src/features/games/market-shop/marketShopEngine.js';
const require=createRequire(import.meta.url),{buildSync}=createRequire(require.resolve('vite'))('esbuild');
const url=new URL('../src/features/games/market-shop/MarketShopGame.jsx',import.meta.url);
const compiled=buildSync({stdin:{contents:readFileSync(url,'utf8'),resolveDir:dirname(fileURLToPath(url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
const isolated={exports:{}};new Function('module','exports','require',compiled)(isolated,isolated.exports,require);
const api=isolated.exports;
const progress=buildMarketTierProgress(tiers,missions,[]);
const base={screen:'journey',profileXp:60,sessionXp:0,assets:api.DEFAULT_ASSETS,completedTierCount:0,tierProgress:progress};
const render=changes=>renderToStaticMarkup(createElement(api.MarketShopView,{model:{...base,...changes}}));
test('Souk shared journey preserves original markup, three tiers and all ten existing images',()=>{
 const original=renderToStaticMarkup(createElement(api.default,{studentId:'test',currentXp:60}));
 assert.equal(render({}),original);
 const images=new Set([...Object.values(api.DEFAULT_ASSETS),...missions.flatMap(m=>m.productIds.map(id=>getMarketProduct(id).image))]);
 assert.equal(images.size,10);
 for(const image of images)assert.ok(existsSync(new URL('../public'+image,import.meta.url)),String(image));
 assert.equal((original.match(/<h1\b/g)||[]).length,1);assert.match(original,/aria-label="Mes jeux"/);assert.match(original,/Découverte/);assert.match(original,/Consolidation/);assert.match(original,/Défi/);
});
test('Souk shared mission preserves quantity buttons, formulas, help, audio and redacted answer rendering',()=>{
 for(const mission of missions){
  const {expectedBasket,...visible}=mission;
  const html=render({screen:'game',mission:visible,activeTier:progress.find(t=>t.id===mission.tierId),activeTierMissionIndex:mission.order-1,products:mission.productIds.slice(0,mission.difficulty.visibleProductCount).map(getMarketProduct),basket:{},selectedFormulaId:'',helpUsed:false,solved:false});
  for(const part of ['ms-stage','ms-market','ms-product-grid','ms-basket-dock','aria-label="Paliers"','Valider','Écouter'])assert.ok(html.includes(part),part);
  assert.equal((html.match(/class="ms-product-card/g)||[]).length,mission.difficulty.visibleProductCount);
  assert.ok(!html.includes('undefined'));assert.ok(!html.includes('NaN'));
 }
});
test('Souk results distinguish aided success from autonomous practice without perfect-quiz claims',()=>{
 const results=missions.slice(0,4).map(m=>({missionId:m.id,correct:true,helpUsed:true,xpEarned:10}));
 const summary=buildMarketTierSummary(tiers[0],missions,results,tiers[0].missionIds,'run');
 const html=render({screen:'results',summary});assert.match(html,/Découverte · Marché conclu/);assert.match(html,/40/);assert.doesNotMatch(html,/quiz parfait|100 %|sans faute/i);
 const replay=render({screen:'results',summary:{...summary,runMode:'revision',xpEarned:0}});
 assert.match(replay,/révision/i);
});
test('Souk school adapter never awards locally and keeps uncertain request identity, role checks and audio fallback',()=>{
 const src=readFileSync(new URL('../src/features/pilote/SchoolMarket.jsx',import.meta.url),'utf8');
 for(const part of ['MarketShopView model={model}','responseUncertain','pending.current','session.user.schoolId!==previous.user.schoolId',"new BroadcastChannel('jde-pilot-session')","'SpeechSynthesisUtterance' in window"])assert.ok(src.includes(part),part);
 assert.doesNotMatch(src,/useDemoStore|onAwardXp|localStorage|sessionStorage/);
 assert.match(src,/pending\.current\?transmit\(\)/);assert.match(src,/revision:snapshot\.current\.revision/);
});
