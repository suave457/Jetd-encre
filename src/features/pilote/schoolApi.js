export async function schoolApi(path,{signal,body,csrf,headers={}}={}){
  let response;
  try{response=await fetch('/api/pilot'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,
    headers:{...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf||''}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch(error){if(error.name==='AbortError')throw error;throw new Error('Le serveur n’a pas confirmé l’opération. Votre texte reste dans cette page : réessayez sans le modifier.');}
  let data;
  try{data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('invalid_response');}
  catch{throw Object.assign(new Error('Le serveur n’a pas confirmé l’opération. Réessayez sans modifier votre demande.'),{status:response.status,responseUncertain:true});}
  if(!response.ok)throw Object.assign(new Error(data.error?.message||'Le service est momentanément indisponible.'),{status:response.status,code:data.error?.code,mode:data.mode});
  return data;
}
