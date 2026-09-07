import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{buildSync}=createRequire(require.resolve('vite'))('esbuild');
function component(path){
 const url=new URL('../src/'+path,import.meta.url),compiled=buildSync({stdin:{contents:readFileSync(url,'utf8'),resolveDir:dirname(fileURLToPath(url)),loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',external:['react','react/jsx-runtime'],jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
 const isolated={exports:{}};new Function('module','exports','require',compiled)(isolated,isolated.exports,require);return isolated.exports;
}
const Student=component('features/games/class-challenges/ClassChallengesStudent.jsx').default,Teacher=component('features/games/class-challenges/ClassChallengesTeacher.jsx').default;
const baseChallenge={id:'test-challenge',title:'Les explorateurs du Maroc',status:'en_cours',classId:'server-class',classLabel:'5e AEP · ma classe',level:'5e AEP',theme:'Culture marocaine',bankLabel:'Banque publiée',questionIds:['a','b','c','d','e'],endAt:'2099-09-07T10:00:00Z',participantCount:0,canPlay:true,ownResult:null};
const school={mode:'hub',counts:{active:1,finished:0,total:1,participants:0},classes:[],questionMetadata:[],banks:[],detail:null};
const student=(changes={},challenge={})=>renderToStaticMarkup(createElement(Student,{school:{...school,...changes},challenges:[{...baseChallenge,...challenge}]}));
test('class connected hub preserves original composition, image and actions without a seeded identity',()=>{
 const html=student();
 for(const value of ['cc-student-topbar','cc-student-main','cc-student-hero','cc-tabs','cc-challenge-card','Notre classe avance ensemble','Participer','5 questions'])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/Plume Indigo|classe-5a|participant-plume|undefined|NaN/);
 assert.equal((html.match(/<h1/g)||[]).length,1);
 assert.ok(existsSync(new URL('../public/assets/games/class-challenges/defis-classes-hero.webp',import.meta.url)));
 assert.match(student({}, {ownResult:{status:'en_cours'}}),/Reprendre/);
});
test('closed untouched class challenge never invents a saved result, success or zero score',()=>{
 const detail={challenge:{...baseChallenge,status:'termine',canPlay:false},leaderboard:{rows:[],viewerRank:null}};
 const html=student({mode:'result',detail});
 assert.match(html,/Tu n’as pas participé/);assert.match(html,/Les résultats de ma classe/);
 assert.doesNotMatch(html,/RÉSULTAT ENREGISTRÉ|Bravo|0\/5|XP attribués|cc-result-stats/);
 assert.match(html,/cc-leaderboard/);
});
test('partial participation remains unranked while complete zero is a real result',()=>{
 const partial={status:'en_cours',correctCount:2,questionCount:5,progressPercent:80,xpEarned:20};
 const detail={challenge:{...baseChallenge,status:'termine',ownResult:partial,pseudonym:'Nuage Menthe 1234ABCD'},leaderboard:{rows:[],viewerRank:null}};
 const html=student({mode:'result',detail});assert.match(html,/Participation inachevée/);assert.match(html,/4 réponses et tes 20 XP/);assert.doesNotMatch(html,/Bravo|RÉSULTAT ENREGISTRÉ/);
 const completed=student({mode:'result',detail:{...detail,challenge:{...detail.challenge,ownResult:{...partial,status:'termine',correctCount:0,score:0,xpEarned:0}},leaderboard:{rows:[],viewerRank:{rank:2,tied:true}}}});
 assert.match(completed,/RÉSULTAT ENREGISTRÉ/);assert.match(completed,/0\/5/);assert.match(completed,/#2/);assert.match(completed,/ex æquo/);
});
test('server-generated aliases render without forcing the twelve demo alias whitelist',()=>{
 const detail={challenge:{...baseChallenge,status:'termine'},leaderboard:{rows:[{pseudonym:'Nuage Menthe 8A00BB23',rank:1,tied:true,score:400,progressPercent:100,status:'termine',isViewer:true}],viewerRank:{rank:1,tied:true}}};
 const html=student({mode:'result',detail});assert.match(html,/Nuage Menthe 8A00BB23/);assert.match(html,/C’est toi/);assert.doesNotMatch(html,/Pseudonyme protégé/);
});
test('teacher connected page uses only confirmed counters and safe server leaderboard',()=>{
 const detail={challenge:baseChallenge,leaderboard:{rows:[]}};
 const html=renderToStaticMarkup(createElement(Teacher,{school:{...school,detail},challenges:[baseChallenge]}));
 for(const value of ['cc-teacher-hero','cc-teacher-layout','Défis de classe','Créer un défi','Clôturer maintenant','Classement pseudonymisé'])assert.ok(html.includes(value),value);
 assert.equal((html.match(/<h1/g)||[]).length,1);assert.doesNotMatch(html,/classe-5a|Plume Indigo|undefined|NaN/);
});
test('class controller guards identity, uncertain sends and source separation',()=>{
 const code=readFileSync(new URL('../src/features/pilote/SchoolClassChallenges.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(code,/useDemoStore|localStorage|sessionStorage|CURRENT_CLASS_PARTICIPANT/);
 for(const value of ['schoolApi','csrf:owner?.csrfToken','result.userId!==owner.user.id','result.schoolId!==owner.user.schoolId','jde-pilot-session','requestId:crypto.randomUUID()','responseUncertain','Réessayer le même envoi','beforeunload','inert='])assert.ok(code.includes(value),value);
 assert.match(code,/async function recoverList[\s\S]*setDetail\(null\);setData\(null\);setMode\('hub'\)[\s\S]*await read\(root\)/);
 assert.ok(code.includes('JSON.stringify(next.classes)!==JSON.stringify(prior.classes)'));
 assert.ok((code.match(/e.status===404/g)||[]).length>=3);
 const studentCode=readFileSync(new URL('../src/features/games/class-challenges/ClassChallengesStudent.jsx',import.meta.url),'utf8');
 assert.match(studentCode,/const tablist=event.currentTarget/);assert.doesNotMatch(studentCode,/requestAnimationFrame\(\(\) => event.currentTarget/);
 const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.ok(main.indexOf("currentPath==='/pilote/jeux/defis-classe'")<main.indexOf('return <DemoProvider>'));
});
