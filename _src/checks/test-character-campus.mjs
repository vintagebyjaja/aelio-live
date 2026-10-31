import {test}from'node:test';import assert from'node:assert/strict';
import {CHARACTER_DEFAULT,characterDocument}from'../shared/character.js';
import {CAMPUS_LOCATIONS,campusLocation,mapZoom}from'../shared/campus-map.js';
import {chatRoutes}from'../platform/messaging.js';
const document={version:1,current:{...CHARACTER_DEFAULT},presets:[]};
test('Character configurations validate real customization choices and reject unknown/arbitrary input',()=>{
 const d=characterDocument(document);assert.equal(d.current.hair,'waves');assert.ok(Array.isArray(d.current.accessories));
 for(const patch of [{skin:'url(https://invalid)'},{hair:'external-provider-asset'},{height:9},{eyes:NaN},{accessories:['admin']},{constructor:'forged'}])assert.throws(()=>characterDocument({...document,current:{...CHARACTER_DEFAULT,...patch}}));
 assert.throws(()=>characterDocument({...document,presets:Array.from({length:13},()=>({id:'x',name:'x',config:CHARACTER_DEFAULT}))}));
 assert.throws(()=>characterDocument({...document,presets:[{id:'x',name:'a',config:CHARACTER_DEFAULT},{id:'x',name:'b',config:CHARACTER_DEFAULT}]}));
});
test('Campus anchors uniquely cover approved Dolphin destinations and distinguish existing experiences from planned places',()=>{
 assert.equal(new Set(CAMPUS_LOCATIONS.map(d=>d.id)).size,CAMPUS_LOCATIONS.length);for(const d of CAMPUS_LOCATIONS){assert.ok(d.x>0&&d.x<1&&d.y>0&&d.y<1);assert.ok(d.title&&d.activities);}
 assert.equal(campusLocation('dolphins').title,'Dolphin Pride Plaza');assert.equal(campusLocation('plaza').access,'playable');assert.equal(campusLocation('residence').access,'settings');assert.equal(campusLocation('court').access,'planned');assert.equal(campusLocation('__proto__'),undefined);assert.equal(mapZoom(99),3);assert.equal(mapZoom(.1),.4);
});
async function fixture(kind,run){const original=fetch,calls=[];const uid='18181818-0000-4000-8000-000000000001',aid='18181818-0000-4000-8000-000000000002';const env={SUPABASE_URL:'https://char-fixture.test',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'private-fixture'};globalThis.fetch=async(url,opts={})=>{const u=new URL(url),name=u.pathname.split('/').at(-1);calls.push({name,opts});let d=[];if(name==='user')d={id:uid};if(name==='app_product_access')d=true;if(name==='app_agents')d=[{id:aid,kind,name:kind==='custom'?'Owner companion':'Naomi',owner_id:uid,instructions:'KEEP',memories:['KEEP'],...((opts.method==='PATCH')?JSON.parse(opts.body):{})}];return Response.json(d);};try{await run({env,calls,aid});}finally{globalThis.fetch=original;}}
const req=(id,body)=>new Request('https://aelio.test/api/platform/agents/'+id,{method:'PATCH',headers:{origin:'https://aelio.test',authorization:'Bearer member-fixture'},body:JSON.stringify(body)});
test('Official Core 8 cannot receive custom characters or substituted profile images via direct API requests',()=>fixture('naomi',async({env,aid,calls})=>{
 for(const body of [{character:document},{avatar_file_id:'18181818-0000-4000-8000-000000000003'}])await assert.rejects(chatRoutes(req(aid,body),env,'/agents/'+aid),e=>e.status===403);
 assert.ok(!calls.some(c=>c.name==='app_agents'&&c.opts.method==='PATCH'));
}));
test('Appearance-only custom-agent saves preserve existing instructions, memories and all thread IDs',()=>fixture('custom',async({env,aid,calls})=>{
 const result=await(await chatRoutes(req(aid,{character:document}),env,'/agents/'+aid)).json();assert.equal(result.agent.instructions,'KEEP');assert.deepEqual(result.agent.memories,['KEEP']);
 const written=JSON.parse(calls.find(c=>c.name==='app_agents'&&c.opts.method==='PATCH').opts.body);assert.deepEqual(Object.keys(written),['character']);assert.ok(!calls.some(c=>c.name==='app_messages'||c.name==='app_conversations'));
}));
