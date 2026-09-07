import { open, realpath } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import {privateManualImporter} from './private-manual-import.mjs';
import { LOCAL_PROFILES } from './pilot-local-store.mjs';

// Not imported by the Worker: private bytes stay on this machine.
export function privateManualFiles(root){
  const directory=path.resolve(root,'.local-media','private-manuals');
  return {libraryEnabled:true,...privateManualImporter(directory),allowedUsers:new Set(LOCAL_PROFILES.map(p=>p.id)),async open(record,range,head){
    if(!/^[a-f0-9]{64}\.pdf$/.test(record.storage_key)||record.storage_key!==record.sha256+'.pdf')return null;
    const expected=path.join(directory,record.storage_key);
    let handle;
    try{
      if(await realpath(directory)!==directory||await realpath(expected)!==expected)return null;
      handle=await open(expected,'r');
      const stats=await handle.stat();
      if(!stats.isFile()||stats.size!==record.byte_size){await handle.close();return null;}
      if(head){await handle.close();return {body:null,cancel:async()=>{}};}
      const stream=handle.createReadStream({start:range.start,end:range.end,autoClose:true});
      return {body:Readable.toWeb(stream),cancel:async()=>{if(stream.closed)return;await new Promise(resolve=>{stream.once('close',resolve);stream.destroy();});}};
    }catch{await handle?.close().catch(()=>{});return null;}
  }};
}
