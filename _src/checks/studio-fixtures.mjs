// Local synthetic Auth + canonical DB-role fixture. Never a hosted account or real credential.
import {createHmac} from 'node:crypto';
export const STUDIO_IDS={founder:'11111111-1111-4111-8111-111111111111',member:'22222222-2222-4222-8222-222222222222',paid:'33333333-3333-4333-8333-333333333333',creator:'44444444-4444-4444-8444-444444444444'};
const key='local-auth-fixture-not-real';
export const studioToken=(kind='founder',aal='aal2',metadata={})=>{const h=Buffer.from('{"alg":"HS256"}').toString('base64url'),p=Buffer.from(JSON.stringify({sub:STUDIO_IDS[kind],aal,exp:Math.floor(Date.now()/1000)+3600,user_metadata:metadata})).toString('base64url');return h+'.'+p+'.'+createHmac('sha256',key).update(h+'.'+p).digest('base64url');};
export async function withStudioFixture(run){const original=fetch,calls=[],roles=new Map(Object.entries(STUDIO_IDS).map(([k,id])=>[id,k==='founder'?'founder':'member']));const env={SUPABASE_URL:'https://local-fixture.test',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',GEMINI_API_KEY:'never-public',AELIO_SESSION_SECRET:'fixture-session-key-long-enough-to-sign'};
 globalThis.fetch=async(url,opts={})=>{const path=new URL(url).pathname,name=path.split('/').at(-1),headers=new Headers(opts.headers),raw=(headers.get('authorization')||'').replace(/^Bearer /,'');calls.push(name);let claims;try{const[h,p,s]=raw.split('.');if(s!==createHmac('sha256',key).update(h+'.'+p).digest('base64url'))throw Error();claims=JSON.parse(Buffer.from(p,'base64url'));if(claims.exp<=Date.now()/1000||!roles.has(claims.sub))throw Error();}catch{if(name==='user')return Response.json({error:'invalid'}, {status:401});}
 if(name==='user')return Response.json({id:claims.sub,email:'fixture@example.test',user_metadata:claims.user_metadata});
 if(name==='app_account_bootstrap')return Response.json({role:roles.get(claims?.sub)||'member'});
 if(name==='app_ai_router_config')return Response.json({GEMINI_MODEL:'fixture-model'});
 if(name==='app_ai_operations')return Response.json({providers:[{provider:'gemini',requests:3}],allocation:[],daily_usd:.1,monthly_usd:1,fallbacks:0});
 if(name==='app_ai_update_router_config')return Response.json(null);
 throw Error('Unexpected fixture request '+path);
 };
 try{await run({env,calls,roles});}finally{globalThis.fetch=original;}
}
