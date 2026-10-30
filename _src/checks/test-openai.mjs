import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openAIResponses,responseBody} from '../platform/providers/openai.js';
const env={OPENAI_API_KEY:'sk-fixture-never-real',OPENAI_MODEL:'gpt-4.1-mini'},agent={id:'fixture-agent',kind:'aelio',name:'Renamed',personality:'The Homie'};
const payload={agents:[agent],content:'A real user question',history:[{role:'user',content:'Earlier context'}],attachments:[],ecosystem_tools:true};
const event=data=>'data: '+JSON.stringify(data)+'\n\n';
const done={type:'response.completed',response:{usage:{input_tokens:10,output_tokens:4}}};
test('request preserves permanent identities, scoped context, tool architecture and bounded output',()=>{
 const body=responseBody({...env,OPENAI_MAX_OUTPUT_TOKENS:'99999'}, {...payload,career:[{private:'career-fixture'}]},agent);
 assert.match(body.instructions,/permanent Original Main Pal/);assert.doesNotMatch(body.instructions,/The Homie|career-fixture/);assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false);assert.equal(body.stream,true);assert.equal(body.max_output_tokens,4096);assert.ok(body.tools.some(t=>t.name==='propose_ecosystem_handoff'));
 const mila=responseBody(env,{...payload,career:[{private:'career-fixture'}]},{kind:'mila',name:'MILA'});assert.match(mila.instructions,/career-fixture/);
 assert.throws(()=>responseBody({...env,OPENAI_MODEL:'https://evil.test'},payload,agent),/model name/);
});
test('first delta is delivered before provider completion; the key stays server-side',async()=>{
 let release;const encoder=new TextEncoder();let sent;
 const upstream=new ReadableStream({start(c){c.enqueue(encoder.encode(event({type:'response.output_text.delta',delta:'First text'})));release=()=>{c.enqueue(encoder.encode(event(done)));c.close();};}});
 const res=await openAIResponses(env,payload,undefined,{reserve:async()=>{},fetch:async(url,init)=>{sent={url,init};return new Response(upstream);}});
 const reader=res.body.getReader(),first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/First text/);assert.doesNotMatch(first,/sk-fixture/);assert.equal(sent.url,'https://api.openai.com/v1/responses');assert.equal(sent.init.headers.authorization,'Bearer '+env.OPENAI_API_KEY);release();let tail='';for(;;){const next=await reader.read();if(next.done)break;tail+=new TextDecoder().decode(next.value);}assert.match(tail,/complete/);
});
test('UTF-8 split chunks stream incrementally without corrupting text',async()=>{
 const bytes=new TextEncoder().encode(event({type:'response.output_text.delta',delta:'Hello 🌊'})+event(done));let offset=0;
 const upstream=new ReadableStream({pull(c){if(offset>=bytes.length){c.close();return;}c.enqueue(bytes.slice(offset,offset+=3));}});
 const res=await openAIResponses(env,payload,undefined,{reserve:async()=>{},fetch:async()=>new Response(upstream)});assert.match(await res.text(),/Hello 🌊/);
});
test('provider authentication, capacity and interrupted streams give useful errors without raw secrets',async()=>{
 for(const [status,code] of [[401,'provider_credentials_rejected'],[429,'provider_capacity']]){
  const res=await openAIResponses(env,payload,undefined,{reserve:async()=>{},fetch:async()=>Response.json({error:{message:'raw '+env.OPENAI_API_KEY}},{status})});const text=await res.text();assert.match(text,new RegExp(code));assert.ok(!text.includes(env.OPENAI_API_KEY));
 }
 const res=await openAIResponses(env,payload,undefined,{reserve:async()=>{},fetch:async()=>new Response(event({type:'response.output_text.delta',delta:'partial'}))});assert.match(await res.text(),/stream_interrupted/);
});
test('cancelling the browser-facing stream aborts the upstream fetch',async()=>{
 let aborted=false;const res=await openAIResponses(env,payload,undefined,{reserve:async()=>{},fetch:async(url,init)=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(event({type:'response.output_text.delta',delta:'partial'})));init.signal.addEventListener('abort',()=>{aborted=true;try{c.close();}catch{}});}}))});const reader=res.body.getReader();await reader.read();await reader.cancel();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(aborted,true);
});
test('daily safety refusal occurs before any paid provider call',async()=>{
 let requests=0;const res=await openAIResponses(env,payload,undefined,{reserve:async()=>{throw Error('fixture limit');},fetch:async()=>{requests++;return new Response('');}});await res.text();assert.equal(requests,0);
});

test('signed-in AI safety reservation does not depend on guest-cookie signing',async()=>{
 const original=globalThis.fetch;let reserved=false;
 globalThis.fetch=async(url,options)=>{assert.match(String(url),/\/rpc\/app_limit$/);const request=JSON.parse(options.body);assert.equal(request.k.length,64);reserved=true;return Response.json(true);};
 try{const response=await openAIResponses({...env,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',AELIO_SESSION_SECRET:'short'},payload,undefined,{fetch:async()=>new Response(event({type:'response.output_text.delta',delta:'fixture reply'})+event({type:'response.completed',response:{usage:{input_tokens:1,output_tokens:1}}}))});await response.text();assert.equal(reserved,true);}finally{globalThis.fetch=original;}
});

test('provider CRLF frames may split between chunks without losing completion',async()=>{
 const wire=(event({type:'response.output_text.delta',delta:'Split newline reply'})+event({type:'response.completed',response:{}})).replace(/\n/g,'\r\n');
 const upstream=new ReadableStream({start(c){for(const character of wire)c.enqueue(new TextEncoder().encode(character));c.close();}});
 const response=await openAIResponses(env,payload,undefined,{reserve:async()=>{},fetch:async()=>new Response(upstream)});const text=await response.text();assert.match(text,/Split newline reply/);assert.match(text,/"type":"complete"/);assert.doesNotMatch(text,/stream_interrupted/);
});

test('HTTP 200 failed Responses events classify nested errors and terminate without completion or automatic retry',async()=>{
 for(const [providerCode,expected] of [['insufficient_quota','provider_billing_unavailable'],['rate_limit_exceeded','provider_capacity'],['model_not_found','model_unavailable'],['server_error','provider_unavailable']]){
  let calls=0;const logs=[],original=console.error;console.error=value=>logs.push(JSON.parse(value));
  try{
   const response=await openAIResponses(env,{...payload,request_id:'fixture-request'},undefined,{reserve:async()=>{},fetch:async()=>{calls++;return new Response(event({type:'response.output_text.delta',delta:'Partial'})+event({type:'response.failed',response:{error:{code:providerCode,message:'sensitive '+env.OPENAI_API_KEY}}}),{headers:{'x-request-id':'req_fixture'}});}});
   const wire=await response.text();assert.match(wire,/Partial/);assert.match(wire,new RegExp(expected));assert.doesNotMatch(wire,/"type":"complete"/);assert.equal(calls,1);
   const diagnostic=logs.find(x=>x.event==='openai_provider_failure');assert.equal(diagnostic.http_status,200);assert.equal(diagnostic.provider_error_code,providerCode);assert.equal(diagnostic.provider_request_id,'req_fixture');assert.equal(diagnostic.request_id,'fixture-request');assert.ok(!JSON.stringify(logs).includes(env.OPENAI_API_KEY));assert.ok(!wire.includes(env.OPENAI_API_KEY));
  }finally{console.error=original;}
 }
});
