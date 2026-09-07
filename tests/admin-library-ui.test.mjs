import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerSchoolNavigationGuard,interceptSchoolNavigation} from '../src/features/pilote/schoolNavigationGuard.js';
import {libraryCommand} from '../worker/pilot/admin-library.js';
test('library UI: router guard installed before unmount and disposed without clearing its successor',()=>{
 let called=0;assert.equal(interceptSchoolNavigation({}),false);const first=registerSchoolNavigationGuard(()=>{called++;return true;});assert.equal(interceptSchoolNavigation({}),true);
 const second=registerSchoolNavigationGuard(()=>true);first();assert.equal(interceptSchoolNavigation({}),true);second();assert.equal(interceptSchoolNavigation({}),false);assert.equal(called,1);
});
test('library UI: multiline description normalized; IDs strict without coercion',()=>{
 const valid={requestId:crypto.randomUUID(),manualId:'book',expectedRevision:1,action:'describe',title:'Titre',level:'Test',description:'Ligne 1\r\nLigne 2'};
 assert.equal(libraryCommand(valid,false).description,'Ligne 1\nLigne 2');
 for(const patch of [{manualId:null},{manualId:123},{requestId:{}},{action:'assign',schoolId:true,active:true},{title:'Titre\n2'},{description:'Invisible\u0001'}])assert.throws(()=>libraryCommand({...valid,...patch},false),e=>e.status===422);
});
test('library UI: local connected route distinct from unchanged demo; root guard and no public upload URL',async()=>{
 const main=await readFile('src/main.jsx','utf8'),ui=await readFile('src/features/pilote/AdminManualLibrary.jsx','utf8'),transport=await readFile('src/features/pilote/libraryApi.js','utf8');
 assert.match(main,/if\(!interceptSchoolNavigation\(event\)\)/);assert.match(main,/currentPath==='\/admin\/bibliotheque'&&new URLSearchParams\(window.location.search\).get\('mode'\)!=='demo'/);
 assert.match(ui,/registerSchoolNavigationGuard\(pop\)/);assert.match(ui,/\[400,413,415,422\]/);assert.match(ui,/receiptFor\(op,controller.signal\)/);assert.match(ui,/setDocuments\(\[\]\);setDetail\(null\);setDraft\(empty\)/);
 assert.match(transport,/\/api\/pilot\/admin\/library\/imports/);assert.doesNotMatch(transport,/localStorage|arrayBuffer|FileReader/);
});
