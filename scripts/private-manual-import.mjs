import {mkdir, mkdtemp, open, realpath, link, unlink, rmdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import path from 'node:path';
import {fail} from '../worker/pilot/session.js';

export const MAX_PDF_BYTES=200*1024*1024;
export function parsePdfInfo(stdout){
  const lines=stdout.split(/\r?\n/),pages=lines.filter(l=>/^Pages:/.test(l)),encrypted=lines.filter(l=>/^Encrypted:/.test(l));
  if(pages.length!==1||encrypted.length!==1||!/^Pages:\s+\d+\s*$/.test(pages[0])||!/^Encrypted:\s+no\s*$/.test(encrypted[0]))fail(422,'pdf_invalid','Choisissez un PDF lisible, non chiffré et sans mot de passe.');
  const count=Number(pages[0].replace(/^Pages:\s+/,''));
  if(!Number.isSafeInteger(count)||count<1||count>2000)fail(422,'pdf_pages','Le PDF doit contenir entre 1 et 2 000 pages.');
  return count;
}
export function inspectPdf(filename,signal){
  const executable=process.env.JDE_PDFINFO_PATH||path.join(process.env.USERPROFILE||'', '.cache','codex-runtimes','codex-primary-runtime','dependencies','native','poppler','Library','bin','pdfinfo.exe');
  return new Promise((resolve,reject)=>{
    let outcome;
    const child=execFile(executable,['-enc','UTF-8',filename],{windowsHide:true,shell:false,timeout:15000,maxBuffer:64*1024,signal},(error,stdout)=>{outcome={error,stdout};});
    // Wait for close even when AbortSignal invokes execFile's callback before Windows releases the file.
    child.once('close',()=>{
      const {error,stdout}=outcome||{};
      if(error||!stdout){try{fail(error?.code==='ENOENT'||error?.killed?503:422,'pdf_validation_failed','La vérification du PDF n’a pas abouti. Aucun document n’a été remplacé.');}catch(e){reject(e);}return;}
      try{resolve(parsePdfInfo(stdout));}catch(e){reject(e);}
    });
  });
}
async function digestFile(filename){
  const handle=await open(filename,'r');
  try{const hash=createHash('sha256');for await(const chunk of handle.createReadStream({autoClose:false}))hash.update(chunk);return hash.digest('hex');}
  finally{await handle.close();}
}
// Local Node binding only. No file path or uploaded byte is imported into the Worker bundle.
export function privateManualImporter(directory,{inspect=inspectPdf}={}){
  let busy=false;
  async function safeDirectory(){await mkdir(directory,{recursive:true});if(await realpath(directory)!==directory)fail(503,'private_storage','Le dossier privé ne peut pas être utilisé.');}
  return {
    async verify(record){
      if(!/^[a-f0-9]{64}$/.test(record.sha256)||record.storage_key!==record.sha256+'.pdf')return false;
      try{const filename=path.join(directory,record.storage_key);await safeDirectory();if(await realpath(filename)!==filename)return false;const f=await open(filename,'r');let stat;try{stat=await f.stat();}finally{await f.close();}return stat.isFile()&&stat.size===record.byte_size&&await digestFile(filename)===record.sha256;}catch{return false;}
    },
    async receive(request,expectedSize){
      if(busy)fail(409,'import_busy','Un import est déjà en cours sur cet ordinateur. Réessayez dans un instant.');
      if(!Number.isSafeInteger(expectedSize)||expectedSize<1||expectedSize>MAX_PDF_BYTES)fail(413,'pdf_size','Le PDF doit peser au maximum 200 Mo.');
      if(request.headers.get('Content-Type')!=='application/pdf'||request.headers.get('Content-Encoding'))fail(415,'pdf_required','Envoyez un fichier PDF sans compression de transport.');
      const declared=request.headers.get('Content-Length');
      if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)!==expectedSize))fail(422,'pdf_length','La taille annoncée du PDF est incohérente.');
      if(!request.body)fail(422,'pdf_required','Choisissez un fichier PDF.');
      busy=true;let temp,handle,reader,idle,total,abort,validation;
      const controller=new AbortController();
      try{
        total=setTimeout(()=>controller.abort(),120000);
        abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)controller.abort();
        controller.signal.throwIfAborted();await safeDirectory();controller.signal.throwIfAborted();temp=await mkdtemp(path.join(directory,'.import-'));handle=await open(path.join(temp,'upload.pdf'),'wx');
        const hash=createHash('sha256');let size=0,header=Buffer.alloc(0);
        reader=request.body.getReader();
        const stopped=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>{reader?.cancel().catch(()=>{});reject(new Error('import_aborted'));},{once:true});if(controller.signal.aborted)reject(new Error('import_aborted'));});
        // Also consumed while the validator runs, so cancellation cannot become an unhandled rejection.
        stopped.catch(()=>{});
        while(true){
          idle=setTimeout(()=>controller.abort(),15000);
          const chunk=await Promise.race([reader.read(),stopped]);clearTimeout(idle);controller.signal.throwIfAborted();
          if(chunk.done)break;
          size+=chunk.value.length;
          if(size>expectedSize||size>MAX_PDF_BYTES)fail(413,'pdf_size','Le fichier dépasse la taille autorisée.');
          if(header.length<5)header=Buffer.concat([header,chunk.value.subarray(0,5-header.length)]);
          hash.update(chunk.value);
          let offset=0;while(offset<chunk.value.length){const result=await handle.write(chunk.value,offset,chunk.value.length-offset);if(!result.bytesWritten)throw new Error('short_write');offset+=result.bytesWritten;}
        }
        if(size!==expectedSize||header.toString('ascii')!=='%PDF-')fail(422,'pdf_invalid','Le fichier reçu n’est pas un PDF complet.');
        await handle.sync();await handle.close();handle=null;
        validation=inspect(path.join(temp,'upload.pdf'),controller.signal);
        const pages=await Promise.race([validation,stopped]);
        if(!Number.isSafeInteger(pages)||pages<1||pages>2000)fail(422,'pdf_pages','Le PDF doit contenir entre 1 et 2 000 pages.');
        if(controller.signal.aborted)throw new Error('import_aborted');
        const sha=hash.digest('hex'),target=path.join(directory,sha+'.pdf');
        try{await link(path.join(temp,'upload.pdf'),target);}catch(e){if(e.code!=='EEXIST')throw e;if(await realpath(target)!==target||await digestFile(target)!==sha)throw new Error('storage_collision');}
        return {storage_key:sha+'.pdf',sha256:sha,byte_size:size,page_count:pages};
      }catch(e){if(e instanceof Response)throw e;fail(503,'import_incomplete','L’import n’a pas été confirmé. Vérifiez son état avant de réessayer.');}
      finally{
        clearTimeout(idle);clearTimeout(total);if(abort)request.signal.removeEventListener('abort',abort);
        if(validation)await validation.catch(()=>{});
        await reader?.cancel().catch(()=>{});reader?.releaseLock();await handle?.close().catch(()=>{});
        // Only the exact temporary files created above are removed; immutable versions are never deleted.
        if(temp){await unlink(path.join(temp,'upload.pdf')).catch(()=>{});await rmdir(temp).catch(()=>{});}
        busy=false;
      }
    }
  };
}
