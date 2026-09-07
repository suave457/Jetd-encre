import { privateManualFiles } from "./private-manual-files.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { handlePilot } from "../worker/pilot/api.js";
import { handlePublicArticles } from '../worker/public-articles.js';
import { publicArticleDocument } from '../worker/public-article-document.js';
import { hash, issueSession, now, readCookie, readInput, reply, run, sameOrigin, TOKEN } from "../worker/pilot/session.js";
import { LOCAL_PROFILES, openPilotDatabase, seedLocalPilot } from "./pilot-local-store.mjs";
import { credentialRecipe, LOCAL_CREDENTIALS, requireLocalRecipeRequest } from './pilot-local-credentials.mjs';
import { prepareLocalRecipe } from './pilot-local-recipe.mjs';
export function localPilotRequestAllowed(request) {
  if(!["127.0.0.1","::1","::ffff:127.0.0.1"].includes(request.socket?.remoteAddress))return false;
  try{const url=new URL(request.url,`http://${request.headers.host}`);return ["127.0.0.1","localhost","[::1]"].includes(url.hostname)&&(!request.headers.origin||request.headers.origin===url.origin);}
  catch{return false;}
}
export async function handleLocalPilot(request,DB,manualFiles=null) {
  try{
    const route=new URL(request.url).pathname;
    if(route==='/api/public/articles'||route.startsWith('/api/public/articles/'))return handlePublicArticles(request,{DB});
    if(route==="/api/pilot/local/profiles"&&request.method==="GET")return reply({profiles:LOCAL_PROFILES});
    if(route==='/api/pilot/local/credentials'&&request.method==='GET'){
      requireLocalRecipeRequest(request);
      return reply({accounts:LOCAL_CREDENTIALS.map(account=>({...account,...LOCAL_PROFILES.find(profile=>profile.id===account.profileId)}))});
    }
    if(route==='/api/pilot/local/credential-login'&&request.method==='POST')return await credentialRecipe(request,DB);
    if(route==='/api/pilot/local/prepare-recipe'&&request.method==='POST'){
      requireLocalRecipeRequest(request,true);
      const input=await readInput(request,128);
      if(Object.keys(input).length)return reply({error:{code:'invalid_recipe_input',message:'La recette ne permet pas de modifier le catalogue scolaire.'}},422);
      return reply(await prepareLocalRecipe(DB));
    }
    if(route==="/api/pilot/local/login"&&request.method==="POST"){
      sameOrigin(request);
      if(request.headers.get("X-Local-Pilot")!=="1")return reply({error:{code:"local_request_required",message:"Requête locale invalide."}},403);
      const input=await readInput(request),profile=LOCAL_PROFILES.find(p=>p.id===input.profileId);
      if(!profile)return reply({error:{code:"unknown_fixture",message:"Ce profil fictif n’existe pas."}},403);
      const result=await issueSession(DB,profile.id,"local_fixture",true,profile.role);
      const old=readCookie(request,"jde_local_pilot");
      if(old&&TOKEN.test(old))await run(DB,"UPDATE pilot_sessions SET revoked_at=? WHERE token_hash=?",now(),await hash(old));
      return reply({ok:true},200,{"Set-Cookie":result.cookie});
    }
    return handlePilot(request,{DB,LOCAL_MANUAL_FILES:manualFiles},{local:true});
  }catch(error){return error instanceof Response?error:reply({error:{code:"local_unavailable",message:"Le serveur local n’a pas confirmé l’opération."}},503);}
}
// Do not consume an unauthenticated upload; pull only when its handler reads the body.
export function lazyRequestBody(req){
  let pending=null;
  req.pause();
  return new ReadableStream({pull(controller){
    return new Promise(resolve=>{
      const clean=()=>{req.off('readable',read);req.off('end',end);req.off('error',error);req.off('close',closed);pending=null;};
      const finish=action=>{clean();action?.();resolve();};
      const end=()=>finish(()=>controller.close());
      const error=e=>finish(()=>controller.error(e));
      const closed=()=>req.complete?end():error(new Error('request_disconnected'));
      const read=()=>{try{const chunk=req.read();if(chunk!==null)finish(()=>controller.enqueue(chunk));else if(req.readableEnded)end();else if(req.destroyed)closed();}catch(e){error(e);}};
      pending=()=>finish();req.on('readable',read);req.once('end',end);req.once('error',error);req.once('close',closed);read();
    });
  },cancel(){pending?.();req.pause();}},{highWaterMark:0});
}
export function pilotLocalApi(){
  return {name:"jet-dencre-local-pilot",apply:"serve",configureServer(server){
    if(server.config.mode==="production")return;
    const directory=path.resolve(server.config.root,".local-data");mkdirSync(directory,{recursive:true});
    const store=openPilotDatabase(path.join(directory,"pilot.sqlite"));seedLocalPilot(store.sqlite);
    const manualFiles=privateManualFiles(server.config.root);
    server.httpServer?.once("close",()=>store.close());
    server.middlewares.use(async(req,res,next)=>{
      const documentMatch=String(req.url).split('?')[0].match(/^\/blog\/(article-[a-f0-9-]{36})\/?$/);
      if(!documentMatch&&!String(req.url).split("?")[0].startsWith("/api/pilot/")&&!String(req.url).split("?")[0].startsWith('/api/public/articles'))return next();
      res.setHeader("Cache-Control","no-store");res.setHeader("Cross-Origin-Resource-Policy","same-origin");res.setHeader("X-Content-Type-Options","nosniff");
      if(!localPilotRequestAllowed(req)){res.statusCode=403;res.end("Accès local requis.");return;}
      try{
        const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(","):value);
        const disconnected=new AbortController();
        req.on("close",()=>{if(!req.complete)disconnected.abort();});res.on("close",()=>{if(!res.writableFinished)disconnected.abort();});
        const method=req.method||"GET",body=["GET","HEAD"].includes(method)?undefined:lazyRequestBody(req);
        const request=new Request(new URL(req.url,`http://${req.headers.host}`),{method,headers,signal:disconnected.signal,...(body?{body,duplex:"half"}:{})});
        const response=documentMatch?await publicArticleDocument(request,{DB:store.DB,ASSETS:{fetch:async()=>new Response(await server.transformIndexHtml(req.url,readFileSync(path.resolve(server.config.root,'index.html'),'utf8')),{headers:{'Content-Type':'text/html'}})}},documentMatch[1]):await handleLocalPilot(request,store.DB,manualFiles);
        if(res.destroyed||res.writableEnded){await response.body?.cancel();return;}
        if(body&&!req.complete){res.setHeader('Connection','close');res.once('finish',()=>{if(!req.complete)req.destroy();});}
        res.statusCode=response.status;
        response.headers.forEach((value,key)=>{if(key!=="set-cookie")res.setHeader(key,value);});
        if(response.headers.getSetCookie().length)res.setHeader("Set-Cookie",response.headers.getSetCookie());
        if(response.body){const stream=Readable.fromWeb(response.body);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}else res.end();
      }catch{res.statusCode=503;res.end(JSON.stringify({error:{message:"Le serveur local est indisponible."}}));}
    });
  }};
}
