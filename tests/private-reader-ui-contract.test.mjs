import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('private PDF codec assets match the inspected official release and preserve core vendor files',async()=>{
 const hashes={
  'public/assets/pdfjs/5.7.284/wasm/jbig2.wasm':'E6BEE67724A7B5436FE8162638E3708CFC8D52B6342DB69A49715E30FF27CFDC',
  'public/assets/pdfjs/5.7.284/wasm/jbig2_nowasm_fallback.js':'04C795A6657A4553A64B781EA3E85256203D913C3B71B72B85FA3CE00622F458',
  'public/assets/pdfjs/5.7.284/wasm/LICENSE_JBIG2':'9E66B7F1B934A28B37F3BC4DAC97915DE1674271E79A0A88182A18ED9731B4D1',
  'public/assets/pdfjs/5.7.284/wasm/LICENSE_PDFJS_JBIG2':'AAD3CCE09842E00E9E11AD5E8FEF8CC02FBC3A3768FE2F007443B9CEE37AAEE5',
  'src/features/mediatheque/vendor/pdf.min.mjs':'9782EF0C332F1BEEA55BB4DF28AA406ABE2602713EE880FD9B99D32F029243AC',
  'src/features/mediatheque/vendor/pdf.worker.min.mjs':'7DEDAD74A392F1795711AEB17BF4CA7462B52824A400E99D26E7940791E59AD5',
 };
 for(const [file,expected] of Object.entries(hashes))assert.equal(createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex').toUpperCase(),expected,file);
});

test('private reader keeps independent page checks, denial cleanup and demo navigation',async()=>{
 const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
 const library=await read('src/features/pilote/SchoolManualLibrary.jsx'),reader=await read('src/features/mediatheque/PdfReader.jsx'),app=await read('src/App.jsx');
 assert.match(library,/pageRequests\.current\.add\(controller\)/);
 assert.match(library,/const accessError=\(\)=>\{\+\+epoch\.current;abort\.current\?\.abort\(\);clear\(\)/);
 assert.match(library,/allowFileActions=\{false\} onAccessError=\{accessError\}/);
 assert.match(reader,/disableAutoFetch:true,disableStream:true,rangeChunkSize:262144,stopAtErrors:true/);
 assert.match(reader,/wasmUrl: new URL\("\/assets\/pdfjs\/5\.7\.284\/wasm\/"/);
 assert.match(reader,/source && allowFileActions/);
 assert.match(app,/"\/admin\/bibliotheque"\]\.includes\(to\)\)return to\+"\?mode=demo"/);
});
