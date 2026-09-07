import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DIRECTOR_SECTIONS} from '../src/features/pilote/directorCore.js';
const require=createRequire(import.meta.url),{buildSync}=createRequire(require.resolve('vite'))('esbuild');
const url=new URL('../src/features/pilote/SchoolDirectorPages.jsx',import.meta.url),compiled=buildSync({stdin:{contents:readFileSync(url,'utf8'),resolveDir:dirname(fileURLToPath(url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);const View=module.exports.default;
const snapshot={schoolId:'a',schoolName:'École fictive',source:'pilot_local_fixture',generatedAt:'2026-09-07T10:00:00Z',classes:[],students:[],teachers:[],definitions:{scope:'École courante',xp:'Récompenses confirmées',activity:'Traces de test'}};
const Link=({to,children,...props})=>createElement('a',{href:to,...props},children);
function render(section,detail=null){return renderToStaticMarkup(createElement(View,{snapshot,user:{name:'Direction fictive'},selection:{section,detail,invalid:false},days:'7',Link}));}
test('Direction: all ten views render outside DemoProvider with honest empty states',()=>{
 for(const section of DIRECTOR_SECTIONS){const html=render(section);assert.match(html,/<h1/);assert.doesNotMatch(html,/654|618|Al Manar|Benjelloun|32 min|NaN|null%|Invitation prête|ticket.*créé avec succès/);}
 assert.match(render('accueil'),/beta-role-kpis/);assert.match(render('affectations'),/pen-assignment-columns/);assert.match(render('eleves'),/pen-activation-overview/);assert.match(render('etablissement'),/pen-school-grid/);assert.match(render('rapports'),/report-grid/);
});
test('Direction: unknown detail refuses fallback, and management never pretends to write',()=>{
 for(const section of ['classes','enseignants','rapports'])assert.match(render(section,'other-school'),/Cette page n’est pas disponible/);
 assert.match(render('classes'),/disabled=""/);assert.match(render('enseignants'),/administration Jet d’Encre/);assert.doesNotMatch(render('actions'),/Marquer traité/);
 for(const id of ['summary','classes','activation'])assert.match(render('rapports',id),/Exporter le CSV/);
});
test('Direction: controller has stable navigation, private-data clearing, fresh exports and logout fallback',()=>{
 const code=readFileSync(new URL('../src/features/pilote/SchoolDirector.jsx',import.meta.url),'utf8');assert.doesNotMatch(code,/useDemoStore|localStorage|sessionStorage/);
 for(const term of ['DirectorNavigation','logoutSession','preserveLogout:true','data.schoolId!==next.user.schoolId','result.identity!==expected','result.ticket!==epoch.current','setSnapshot(null)','jde-pilot-session',"clean.searchParams.delete('connexion')"])assert.ok(code.includes(term),term);
 const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');assert.ok(main.indexOf('<SchoolDirector/>')<main.indexOf('<PilotApp />'));assert.match(main,/eleve\|parent\|enseignant\|directeur\|admin/);
});
