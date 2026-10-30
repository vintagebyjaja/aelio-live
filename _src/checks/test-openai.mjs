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
