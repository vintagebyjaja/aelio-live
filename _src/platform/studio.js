import {studioImages} from './images.js';
import {sameOrigin,reply} from './shared.js';
import {studioOperations} from './billing.js';
import {requireStudioFounder,studioSession,studioDenied} from './studio-auth.js';
import {serveAppShell} from '../edge/app-shell.js';
export async function studioAPI(req,env){
 try{
  sameOrigin(req);
  const path=new URL(req.url).pathname.replace(/^\/api\/studio\/ai/,'');
  if(path==='/session')return await studioSession(req,env);
  if(path==='/access'&&req.method==='GET'){const u=await requireStudioFounder(req,env);return reply({founder:true,user:{email:u.email}});}
  if(path==='/images')return await studioImages(req,env);
  if(path==='/operations')return await studioOperations(req,env);
  return reply({error:'Not found.'},404);
 }catch(e){return reply({error:e.status===403?'Studio Brain is restricted to the verified founder with second-factor authentication.':e.status===401?'Sign in to continue.':'Studio Brain is temporarily unavailable.',code:e.code||'studio_unavailable'},e.status||503);}
}
export async function studioPage(req,env){
 try{await requireStudioFounder(req,env,true);const r=await serveAppShell({request:req,env});const headers=new Headers(r.headers);headers.set('cache-control','private, no-store');headers.set('x-robots-tag','noindex, nofollow');headers.set('x-frame-options','DENY');headers.set('content-security-policy',"frame-ancestors 'none'");headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','no-referrer');return new Response(r.body,{status:r.status,headers});}catch(e){return studioDenied(e);}
}
