export async function uploadLibrary(command,file,csrf,{signal}={}){
  const header=encodeURIComponent(JSON.stringify(command));
  if(header.length>12000)throw Object.assign(new Error('Raccourcissez les informations du document avant de l’importer.'),{status:422});
  let response;
  try{response=await fetch('/api/pilot/admin/library/imports',{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/pdf','X-CSRF-Token':csrf,'X-Library-Command':header},body:file});}
  catch(e){if(e.name==='AbortError')throw e;throw new Error('La confirmation de l’import n’a pas été reçue. Vérifiez son état avant de réessayer.');}
  let result;try{result=await response.json();}catch{throw new Error('La réponse n’a pas pu être confirmée. Vérifiez l’état de l’import.');}
  if(!response.ok)throw Object.assign(new Error(result.error?.message||'L’import n’a pas été confirmé.'),{status:response.status,code:result.error?.code});
  return result;
}
