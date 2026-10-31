import {who,sb,fail,sameOrigin,reply} from './shared.js';
const COOKIE='__Host-aelio_studio';
export async function requireStudioFounder(req,env,allowCookie=false){
 let verified=req;
 if(allowCookie&&!req.headers.get('authorization')){
  const value=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(value){const headers=new Headers(req.headers);headers.set('authorization','Bearer '+value);verified=new Request(req,{headers});}
 }
 const user=await who(verified,env);
 const account=await sb(env,'/rest/v1/rpc/app_account_bootstrap',{token:user.token,method:'POST',data:{}});
 if(account.role!=='founder'||user.email?.toLowerCase()!=='jaja@vybr8.live'||!user.user?.email_confirmed_at)fail(403,'permission_denied','This workspace is private.');
 let claims;try{claims=JSON.parse(atob(user.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{}
 if(claims?.aal!=='aal2')fail(403,'mfa_required','Verify your second factor to open Studio Brain.');
 return user;
}
export async function studioSession(req,env){
 sameOrigin(req);
 if(req.method==='DELETE')return reply({ok:true},200,{'set-cookie':COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(req.method!=='POST')fail(405,'method_not_allowed','Method not allowed.');
 const user=await requireStudioFounder(req,env);
 // A short, HttpOnly browser navigation credential. Every page request revalidates Auth and the canonical DB role.
 return reply({url:'/studiobrain/'},200,{'set-cookie':COOKIE+'='+user.token+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=300'});
}
export function studioDenied(error){
 const status=[401,403].includes(error?.status)?error.status:503;
 return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Private workspace</title><body><main><h1>Private workspace</h1><p>Sign in with your authorized founder account and verify your second factor to open Studio Brain.</p><a href="/account/">Return to your account</a></main></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex, nofollow'}});
}
