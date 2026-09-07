// Explicit local-only import. Never called by the web server or the Worker.
import {createReadStream,constants} from 'node:fs';
import {mkdir,realpath,stat,copyFile,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openPilotDatabase} from './pilot-local-store.mjs';
async function digest(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
const [source,id,title,pages]=process.argv.slice(2),pageCount=Number(pages);
if(!source||!path.isAbsolute(source)||!/^manuel-test-[a-z0-9-]{1,70}$/.test(id||'')||!title||title.length>160||!Number.isInteger(pageCount)||pageCount<1||pageCount>2000)throw Error('Source absolue, identifiant de test, titre et nombre de pages vérifiés requis.');
const root=fileURLToPath(new URL('../',import.meta.url)),directory=path.join(root,'.local-media','private-manuals'),file=await realpath(source),info=await stat(file);
if(!info.isFile()||info.size<=0||info.size>209715200)throw Error('Taille du PDF hors limites.');
const handle=await open(file,'r'),magic=Buffer.alloc(5);try{await handle.read(magic,0,5,0);}finally{await handle.close();}if(magic.toString()!=='%PDF-')throw Error('Signature PDF absente.');
const sha=await digest(file),key=sha+'.pdf';await mkdir(directory,{recursive:true});
if(await realpath(directory)!==directory)throw Error('Dossier privé détourné.');
const target=path.join(directory,key);
try{await copyFile(file,target,constants.COPYFILE_EXCL);}catch(error){if(error.code!=='EEXIST')throw error;}
if(await realpath(target)!==target||await digest(target)!==sha)throw Error('Le fichier existant ne correspond pas à son empreinte ; aucun écrasement.');
const store=openPilotDatabase(path.join(root,'.local-data','pilot.sqlite')),db=store.sqlite;
try{
 const old=db.prepare('SELECT m.*,f.storage_key,f.sha256,f.byte_size,f.page_count,f.scope FROM pilot_manuals m LEFT JOIN pilot_manual_files f ON f.manual_id=m.id WHERE m.id=?').get(id);
 if(old){if(old.title!==title||old.storage_key!==key||old.byte_size!==info.size||old.page_count!==pageCount||old.scope!=='local_test')throw Error('Référence existante différente ; aucun remplacement.');}
 else{db.exec('BEGIN');try{db.prepare('INSERT INTO pilot_manuals VALUES(?,?,?,1)').run(id,title,'Document de test privé');db.prepare('INSERT INTO pilot_manual_files VALUES(?,?,?,?,?,?,?)').run(id,key,sha,info.size,pageCount,'local_test',Math.floor(Date.now()/1000));db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
 console.log(JSON.stringify({id,sha256:sha,bytes:info.size,pages:pageCount,scope:'local_test',replayed:Boolean(old)}));
}finally{store.close();}
