import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {privateManualFiles} from '../scripts/private-manual-files.mjs';

test('private file adapter: actual full/range/HEAD/cancellation and invalid metadata',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'jde-private-file-test-'));
 // Only this test-created, resolved temporary directory may be removed.
 t.after(async()=>{assert.equal(path.dirname(root),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('jde-private-file-test-'));await rm(root,{recursive:true,force:true});});
 const bytes=Buffer.alloc(400000,65);bytes.write('%PDF-');
 const sha=createHash('sha256').update(bytes).digest('hex'),key=sha+'.pdf',dir=path.join(root,'.local-media','private-manuals');
 await mkdir(dir,{recursive:true});await writeFile(path.join(dir,key),bytes,{flag:'wx'});
 const files=privateManualFiles(root),record={storage_key:key,sha256:sha,byte_size:bytes.length};
 const full=await files.open(record,{start:0,end:bytes.length-1},false);assert.deepEqual(Buffer.from(await new Response(full.body).arrayBuffer()),bytes);
 const range=await files.open(record,{start:0,end:4},false);assert.equal(await new Response(range.body).text(),'%PDF-');
 const head=await files.open(record,{start:0,end:4},true);assert.equal(head.body,null);await head.cancel();
 const cancelled=await files.open(record,{start:0,end:bytes.length-1},false);await cancelled.cancel();await cancelled.cancel();
 const partial=await files.open(record,{start:0,end:bytes.length-1},false);const reader=partial.body.getReader();assert.equal((await reader.read()).done,false);await reader.cancel();await partial.cancel();
 for(const broken of [{...record,storage_key:'../outside.pdf'},{...record,sha256:'b'.repeat(64)},{...record,byte_size:4},{...record,storage_key:'b'.repeat(64)+'.pdf',sha256:'b'.repeat(64)}])assert.equal(await files.open(broken,{start:0,end:4},false),null);
 assert.ok(files.allowedUsers.has('pilot-a-student'));assert.ok(!files.allowedUsers.has('unregistered-user'));
});
