import { mkdirSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { handlePilot } from "../worker/pilot/api.js";
import { hash, issueSession, now, readCookie, readInput, reply, run, sameOrigin, TOKEN } from "../worker/pilot/session.js";
import { LOCAL_PROFILES, openPilotDatabase, seedLocalPilot } from "./pilot-local-store.mjs";
export function localPilotRequestAllowed(request) {
  if(!["127.0.0.1","::1","::ffff:127.0.0.1"].includes(request.socket?.remoteAddress))return false;
  try{const url=new URL(request.url,`http://${request.headers.host}`);return ["127.0.0.1","localhost","[::1]"].includes(url.hostname)&&(!request.headers.origin||request.headers.origin===url.origin);}
  catch{return false;}
}
export async function handleLocalPilot(request,DB) {
  try{
    const route=new URL(request.url).pathname;
    if(route==="/api/pilot/local/profiles"&&request.method==="GET")return reply({profiles:LOCAL_PROFILES});
    if(route==="/api/pilot/local/login"&&request.method==="POST"){
      sameOrigin(request);
      if(request.headers.get("X-Local-Pilot")!=="1")return reply({error:{code:"local_request_required",message:"Requête locale invalide."}},403);
      const input=await readInput(request),profile=LOCAL_PROFILES.find(p=>p.id===input.profileId);
      if(!profile)return reply({error:{code:"unknown_fixture",message:"Ce profil fictif n’existe pas."}},403);
      const old=readCookie(request,"jde_local_pilot");
      if(old&&TOKEN.test(old))await run(DB,"UPDATE pilot_sessions SET revoked_at=? WHERE token_hash=?",now(),await hash(old));
      const result=await issueSession(DB,profile.id,"local_fixture",true);
      return reply({ok:true},200,{"Set-Cookie":result.cookie});
    }
    return handlePilot(request,{DB},{local:true});
  }catch(error){return error instanceof Response?error:reply({error:{code:"local_unavailable",message:"Le serveur local n’a pas confirmé l’opération."}},503);}
}
export function pilotLocalApi(){
  return {name:"jet-dencre-local-pilot",apply:"serve",configureServer(server){
    if(server.config.mode==="production")return;
    const directory=path.resolve(server.config.root,".local-data");mkdirSync(directory,{recursive:true});
    const store=openPilotDatabase(path.join(directory,"pilot.sqlite"));seedLocalPilot(store.sqlite);
    server.httpServer?.once("close",()=>store.close());
    server.middlewares.use(async(req,res,next)=>{
      if(!String(req.url).split("?")[0].startsWith("/api/pilot/"))return next();
      res.setHeader("Cache-Control","no-store");res.setHeader("Cross-Origin-Resource-Policy","same-origin");res.setHeader("X-Content-Type-Options","nosniff");
      if(!localPilotRequestAllowed(req)){res.statusCode=403;res.end("Accès local requis.");return;}
      try{
        const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(","):value);
        const method=req.method||"GET",body=["GET","HEAD"].includes(method)?undefined:Readable.toWeb(req);
        const request=new Request(new URL(req.url,`http://${req.headers.host}`),{method,headers,...(body?{body,duplex:"half"}:{})});
        const response=await handleLocalPilot(request,store.DB);res.statusCode=response.status;
        response.headers.forEach((value,key)=>{if(key!=="set-cookie")res.setHeader(key,value);});
        if(response.headers.getSetCookie().length)res.setHeader("Set-Cookie",response.headers.getSetCookie());
        res.end(Buffer.from(await response.arrayBuffer()));
      }catch{res.statusCode=503;res.end(JSON.stringify({error:{message:"Le serveur local est indisponible."}}));}
    });
  }};
}
