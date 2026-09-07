import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {PassThrough} from 'node:stream';
import {privateManualImporter,parsePdfInfo,inspectPdf} from '../scripts/private-manual-import.mjs';
import {lazyRequestBody} from '../scripts/pilot-local-api.mjs';
const request=(body,signal)=>new Request('http://localhost/import',{method:'POST',headers:{'Content-Type':'application/pdf'},body,...(body instanceof ReadableStream?{duplex:'half'}:{}),signal});
async function fixture(t,inspect=async()=>2){const root=await mkdtemp(path.join(tmpdir(),'jde-import-test-'));t.after(async()=>{assert.equal(path.dirname(root),path.resolve(tmpdir()));assert.match(path.basename(root),/^jde-import-test-/);await rm(root,{recursive:true,force:true});});return {root,importer:privateManualImporter(root,{inspect})};}
test('PDF import: strict parser metadata and encrypted/ambiguous/oversized inputs',()=>{
 assert.equal(parsePdfInfo('Title: Example\nPages: 8\nEncrypted: no\n'),8);
 for(const text of ['Pages: 1\nEncrypted: yes (print:yes)','Pages: 1\nPages: 2\nEncrypted: no','Pages: 2001\nEncrypted: no','Pages: 0\nEncrypted: no','Pages: x\nEncrypted: no','Pages: 1\nEncrypted: no\nEncrypted: no'])assert.throws(()=>parsePdfInfo(text),e=>e.status===422);
});
test('PDF import: progressive chunks, immutable duplicate, private hash and exact cleanup',async t=>{
 const {root,importer}=await fixture(t),bytes=Buffer.from('%PDF-test-file');let i=0;
 const stream=new ReadableStream({pull(c){if(i===bytes.length)c.close();else c.enqueue(bytes.subarray(i,++i));}});
 const record=await importer.receive(request(stream),bytes.length);assert.equal(record.byte_size,bytes.length);assert.equal(record.page_count,2);
 assert.deepEqual(await readFile(path.join(root,record.storage_key)),bytes);assert.equal(await importer.verify(record),true);
 assert.deepEqual(await importer.receive(request(bytes),bytes.length),record);assert.deepEqual(await readdir(root),[record.storage_key]);
 for(const [body,size,status]of [['not-a-pdf',9,422],['%PDF-short',20,422],['%PDF-long',3,413]])await assert.rejects(importer.receive(request(body),size),e=>e.status===status);
 assert.deepEqual(await readdir(root),[record.storage_key]);assert.equal(await importer.verify({...record,byte_size:1}),false);
});
test('PDF import: open idle upload cancels promptly; lock released and temporary removed',async t=>{
 const {root,importer}=await fixture(t),source=new PassThrough(),signal=new AbortController();t.after(()=>source.destroy());
 const result=importer.receive(request(lazyRequestBody(source),signal.signal),10);source.write('%PDF-');
 await new Promise(r=>setTimeout(r,25));signal.abort();
 await assert.rejects(Promise.race([result,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('hung cancellation')),1000);timer.unref();})]),e=>e instanceof Response&&e.status===503);
 assert.deepEqual(await readdir(root),[]);assert.equal((await importer.receive(request('%PDF-valid'),10)).byte_size,10);
});
test('PDF import: cancelled validator fully closes before removing temp and releasing lock',async t=>{
 let started,closed=false;const ready=new Promise(r=>started=r);
 const {root,importer}=await fixture(t,async(filename,signal)=>{started();await new Promise(resolve=>signal.addEventListener('abort',()=>setTimeout(resolve,30),{once:true}));assert.ok(await readFile(filename));closed=true;throw Error('cancelled');});
 const signal=new AbortController(),result=importer.receive(request('%PDF-valid',signal.signal),10);await ready;
 await assert.rejects(importer.receive(request('%PDF-valid'),10),e=>e.status===409);signal.abort();await assert.rejects(result,e=>e.status===503);
 assert.equal(closed,true);assert.deepEqual(await readdir(root),[]);
});
test('PDF import: real Poppler validates the existing eight-page PDF',async()=>{
 const filename=path.resolve('public/assets/mediatheque/bouquins/petites-histoires-du-maroc.pdf');
 // Optional environment integration; unit validation above remains portable outside the desktop runtime.
 const exe=process.env.JDE_PDFINFO_PATH||path.join(process.env.USERPROFILE||'', '.cache','codex-runtimes','codex-primary-runtime','dependencies','native','poppler','Library','bin','pdfinfo.exe');
 const {existsSync}=await import('node:fs');if(!existsSync(exe))return;
 assert.equal(await inspectPdf(filename,new AbortController().signal),8);
});
