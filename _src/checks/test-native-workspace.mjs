import {test}from'node:test';import assert from'node:assert/strict';
import {nativeWorkspace,projectDocument}from'../platform/native.js';
import worker from'../edge/worker.js';import {withStudioFixture,studioToken}from'./studio-fixtures.mjs';
const U='17171717-0000-4000-8000-000000000001',P='17171717-0000-4000-8000-000000000003';
const env={SUPABASE_URL:'https://native-fixture.test',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'not-for-members'};
const request=(path,method='GET',data,extra={})=>new Request('https://aelio.test/api/platform/native'+path,{method,headers:{authorization:'Bearer member-fixture',origin:'https://aelio.test',...extra},body:data?JSON.stringify(data):undefined});
const doc={title:'Owner project',kind:'website',files:{'index.html':'<h1>Project</h1>'},memory:'Owner knowledge',deployment:{env_names:['SERVER_KEY_NAME']}};
async function fixture(run){const original=fetch,calls=[];globalThis.fetch=async(url,opts={})=>{const u=new URL(url),name=u.pathname.split('/').at(-1);calls.push({name,url:String(url),opts});let result=[];
 if(name==='user')result={id:U};else if(name==='app_product_access')result=true;else if(name==='app_account_bootstrap')result={plans:[{product:'aelio',credits:43,unlimited:false}]};else if(name==='app_native_wallet')result={credits:43,earnings:{gross_cents:0,fee_cents:0,net_cents:0,pending_cents:0,available_cents:0,paid_cents:0},transactions:[],payouts_enabled:false,payout_account_status:'not_connected'};
 else if(name==='app_native_save')result={...JSON.parse(opts.body).document,id:P,owner_id:U,revision:2};
 else if(name==='app_native_projects')result=u.searchParams.get('id')==='eq.'+P?[{...doc,id:P,owner_id:U,revision:1}]:u.searchParams.has('id')?[]:[{id:P,title:doc.title}];
 return Response.json(result);};try{await run(calls);}finally{globalThis.fetch=original;}}
test('Native project documents reject unsafe paths, credentials, oversized text and secret-value configuration',()=>{
 assert.deepEqual(projectDocument({...doc,owner_id:'forged'}),doc);
 for(const path of ['../escape','/absolute','src/../../escape','.env','.env.local','.git/config','.ssh/id','key.pem','id_rsa','.npmrc'])assert.throws(()=>projectDocument({...doc,files:{[path]:'x'}}));
 assert.throws(()=>projectDocument({...doc,files:{'large.txt':'x'.repeat(65537)}}));
 assert.throws(()=>projectDocument({...doc,deployment:{env_values:{TOKEN:'secret'}}}));
 assert.throws(()=>projectDocument({...doc,deployment:{repository:'https://token@github.com/owner/repo'}}));
 assert.throws(()=>projectDocument({...doc,deployment:{env_names:['KEY=value']}}));
 assert.doesNotThrow(()=>projectDocument({...doc,files:{'.env.example':'KEY=placeholder'}}));
});
test('Native projects use verified member identity/RLS token and optimistic revisions, never client owners',()=>fixture(async calls=>{
 await nativeWorkspace(request('/projects','POST',{...doc,owner_id:'forged'}),env,'/projects');
 const call=calls.find(c=>c.name==='app_native_save');assert.equal(call.opts.headers.authorization,'Bearer member-fixture');assert.equal(call.opts.headers.apikey,'public-fixture');const data=JSON.parse(call.opts.body);assert.equal(data.document.owner_id,undefined);assert.equal(data.pid,null);assert.equal(data.expected,0);
 await nativeWorkspace(request('/projects/'+P,'PATCH',{...doc,expected:1}),env,'/projects/'+P);const saved=calls.filter(c=>c.name==='app_native_save').at(-1);assert.equal(JSON.parse(saved.opts.body).expected,1);
 await assert.rejects(nativeWorkspace(request('/projects/18181818-0000-4000-8000-000000000001'),env,'/projects/18181818-0000-4000-8000-000000000001'),e=>e.status===404);
}));
test('Wallet exposes real account credits, keeps creator balances distinct and browsing never creates a payment',()=>fixture(async calls=>{
 const data=await(await nativeWorkspace(request('/wallet'),env,'/wallet')).json();assert.equal(data.credits,43);assert.equal(data.earnings.available_cents,0);assert.equal(data.legacy.connected,false);assert.equal(data.payouts_enabled,false);
 assert.ok(!calls.some(c=>/checkout|app_ai_reserve|app_image_begin|payout/.test(c.name)));assert.doesNotMatch(JSON.stringify(data),/not-for-members|gemini|groq|openai|service_role/);
}));
test('Anonymous/PATHD accounts, missing cost confirmation and unavailable runners cannot mutate Native state',()=>fixture(async calls=>{
 await assert.rejects(nativeWorkspace(request('/projects','GET',null,{authorization:''}),env,'/projects'),e=>e.status===401);
 await assert.rejects(nativeWorkspace(request('/wallet','GET',null,{'x-aelio-product':'pathd'}),env,'/wallet'),e=>e.status===403);
 await assert.rejects(nativeWorkspace(request('/checkout','POST',{package_id:'small'}),env,'/checkout'),e=>e.status===400);
 await assert.rejects(nativeWorkspace(request('/checkout','POST',{package_id:'small',confirm:true}),env,'/checkout'),e=>e.status===503);
 for(const path of ['/execute','/deploy','/payout','/voice','/marketplace/publish'])await assert.rejects(nativeWorkspace(request(path,'POST',{owner_id:U,approved:true}),env,path),e=>e.status===404);
 assert.ok(!calls.some(c=>c.name==='app_native_save'));
}));
test('Voice engineering routes reject members, subscribers, creators, forged roles and first-factor founder tokens',()=>withStudioFixture(async({env})=>{
 for(const kind of ['member','paid','creator'])for(const path of ['/api/voices','/api/voices/id/synthesize','/api/voices%2fid/approve']){
  const r=await worker.fetch(new Request('https://aelio.test'+path,{method:'POST',headers:{authorization:'Bearer '+studioToken(kind,'aal2',{role:'founder'}),origin:'https://aelio.test'},body:'{}'}),env);assert.equal(r.status,403);
 }
 const r=await worker.fetch(new Request('https://aelio.test/api/voices',{headers:{authorization:'Bearer '+studioToken('founder','aal1')}}),env);assert.equal(r.status,403);
}));
