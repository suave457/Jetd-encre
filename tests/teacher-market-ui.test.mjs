import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MARKET_TIERS} from '../worker/pilot/market-content-v1.js';
import {getSchoolSection} from '../src/features/pilote/schoolNavigationCore.js';
const require=createRequire(import.meta.url),{buildSync}=createRequire(require.resolve('vite'))('esbuild');
const url=new URL('../src/features/games/market-shop/TeacherMarketDashboard.jsx',import.meta.url),compiled=buildSync({stdin:{contents:readFileSync(url,'utf8'),resolveDir:dirname(fileURLToPath(url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);const View=module.exports.default;
const snapshot={students:[],tiers:MARKET_TIERS,classes:[],source:'pilot_local_fixture',generatedAt:'2026-09-07T10:00:00Z',definitions:{scope:'Mes classes uniquement'}};
test('connected teacher view keeps original structure without fictitious cohort, date or null percentage',()=>{
 const html=renderToStaticMarkup(createElement(View,{school:{snapshot}}));
 for(const css of ['tmd-hero','tmd-summary-grid','tmd-tier-overview','tmd-roster','tmd-filters','tmd-priorities'])assert.ok(html.includes(css),css);
 assert.doesNotMatch(html,/Lina Mansouri|Yassine|Classe 5A|Classe 5B|2026-08-30|null %|null%|NaN/);
 assert.match(html,/Missions réussies/);assert.match(html,/Guidées au départ/);assert.match(html,/Filtrer par activité récente/);assert.match(html,/Aucun élève dans cette vue/);
 assert.doesNotMatch(html,/data:text\/csv/);assert.match(html,/Exporter la vue/);
});
test('original demo teacher view is still separate and retains its own sample cohort',()=>{
 const html=renderToStaticMarkup(createElement(View));assert.match(html,/Lina Mansouri/);assert.match(html,/Classes 5A et 5B/);assert.match(html,/Données locales de démonstration/);
});
test('school teacher navigation restores analyses and direct detail only for the teacher role',()=>{
 for(const section of ['analyses','souk']){assert.equal(getSchoolSection('?section='+section+'&profil=enseignant','enseignant'),section);assert.equal(getSchoolSection('?section='+section,'eleve'),'accueil');assert.equal(getSchoolSection('?section='+section,'parent'),'accueil');}
 const home=readFileSync(new URL('../src/features/pilote/SchoolHome.jsx',import.meta.url),'utf8');assert.match(home,/role==='enseignant'\)items.push\(\{id:'analyses'/);
});
test('school controller revalidates fiches and exports and clears data on session change',()=>{
 const code=readFileSync(new URL('../src/features/pilote/SchoolTeacherMarket.jsx',import.meta.url),'utf8');assert.doesNotMatch(code,/useDemoStore|localStorage|sessionStorage/);
 for(const value of ['jde-pilot-session','/session?profil=enseignant','/teacher/market','setSnapshot(null)','passive:true','ticket!==operation.current','data.classes.some','onVerify','schoolMarketCsv'])assert.ok(code.includes(value),value);
 const view=readFileSync(url,'utf8');assert.match(view,/effectiveClass/);assert.match(view,/school\?"Guidées au départ":"Aides"/);
});
