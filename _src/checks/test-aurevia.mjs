import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aurevia} from '../platform/aurevia.js';
import {DESTINATIONS,destination,walkPosition} from '../shared/aurevia.js';
const uid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://local-fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'never-use-this-fixture-key'};
const req=(path='',method='GET',data,extra={})=>new Request('https://aelio.test/api/platform/aurevia'+path,{method,headers:{authorization:'Bearer member-fixture',origin:'https://aelio.test',...extra},body:data===undefined?undefined:JSON.stringify(data)});
async function fixture(run){const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts={})=>{const name=new URL(url).pathname.split('/').at(-1);calls.push({name,opts});let value;if(name==='user')value={id:uid};else if(name==='app_product_access')value=true;else if(name==='app_aurevia_state')value={residence:{owner_id:uid},meetings:[]};else if(name==='app_aurevia_preferences')value={owner_id:uid,...JSON.parse(opts.body)};else if(name==='app_aurevia_meeting')value={id:cid,...JSON.parse(opts.body)};else throw Error('Unexpected fixture '+name);return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});};try{await run(calls);}finally{globalThis.fetch=original;}}
test('Aurevia RPCs use the verified member JWT, never service credentials or client owner IDs',()=>fixture(async calls=>{
 const state=await(await aurevia(req(),env,'')).json();assert.equal(state.residence.owner_id,uid);
 await aurevia(req('','PATCH',{name:'My home',destination:'office',quality:'low',owner_id:cid}),env,'');
 await aurevia(req('/meetings','POST',{conversation_id:cid,purpose:'Plan together',owner_id:cid,transcript:'Must not be copied'}),env,'/meetings');
 const privateCalls=calls.filter(c=>c.name.startsWith('app_aurevia'));assert.equal(privateCalls.length,3);
 for(const c of privateCalls){assert.equal(c.opts.headers.authorization,'Bearer member-fixture');assert.equal(c.opts.headers.apikey,'public-fixture');const body=JSON.parse(c.opts.body);assert.equal(body.owner_id,undefined);assert.equal(body.transcript,undefined);}
 assert.equal(JSON.parse(privateCalls[2].opts.body).p_conversation,cid);
}));
test('Aurevia rejects anonymous, foreign-origin and PATHD requests before private RPCs',()=>fixture(async calls=>{
 await assert.rejects(aurevia(req('','GET',undefined,{authorization:''}),env,''),e=>e.status===401);
 await assert.rejects(aurevia(req('','PATCH',{}, {origin:'https://foreign.invalid'}),env,''),e=>e.status===403);
 await assert.rejects(aurevia(req('','GET',undefined,{'x-aelio-product':'pathd'}),env,''),e=>e.status===403);
 assert.equal(calls.filter(c=>c.name.startsWith('app_aurevia')).length,0);
}));
test('Aurevia bounds inputs and never creates simulated assessments or marketplace listings',()=>fixture(async calls=>{
 for(const d of [{name:'x',destination:'invented',quality:'low'},{name:'',destination:'plaza',quality:'high'},{name:'x',destination:'plaza',quality:'ultra'}])await assert.rejects(aurevia(req('','PATCH',d),env,''),e=>e.status===400);
 await assert.rejects(aurevia(req('/meetings','POST',{conversation_id:cid,purpose:'x'.repeat(501)}),env,'/meetings'),e=>e.status===400);
 assert.equal((await aurevia(req('/graduate','POST',{}),env,'/graduate')).status,404);
 assert.equal(calls.filter(c=>c.name.startsWith('app_aurevia')).length,0);
}));
test('3D walking stays within the coast and respects architecture collisions; jumps use canonical destinations',()=>{
 assert.equal(DESTINATIONS.length,7);for(const d of DESTINATIONS){assert.equal(destination(d.id),d);assert.ok(Math.hypot(d.position[0],d.position[2])<47);}
 const current=[0,2,20];assert.deepEqual(walkPosition(current,100,0),current);assert.deepEqual(walkPosition(current,0,-16,[[-5,5,-5,5]]),current);assert.deepEqual(walkPosition(current,2,-1),[2,2,19]);assert.equal(destination('__proto__'),undefined);
});
