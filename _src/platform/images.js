import {body,fail,member,own,reply,rpc,text,uuid,who,table} from './shared.js';
import {generateImage,imageConfiguration,imageSetupMessage} from './providers/images.js';
import {requireStudioFounder} from './studio-auth.js';
const b64=bytes=>{let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);};
export async function imageEnvironment(env){const settings=await rpc(env,'app_ai_router_config',{});return {...env,...settings};}
function input(d){const prompt=text(d.content||'',8000),source=d.source_image_id||null,aspect=d.aspect||'square';if(!prompt||source&&!uuid(source)||!['square','portrait','landscape'].includes(aspect))fail(400,'image_input','Describe an image, choose a valid source and select a supported format.');return {prompt,source,aspect};}
export async function imageRoutes(req,env,path){
 const u=await who(req,env);await member(env,u,'aelio');if(req.headers.get('x-aelio-product')==='pathd')fail(403,'image_product','Use AELIO to create and edit images.');
 if(path==='/quote'&&req.method==='POST'){
  const d=await body(req),fields=input(d);await own(env,'app_conversations',d.conversation_id,u);if(fields.source)await own(env,'app_files',fields.source,u);
  const configured=await imageEnvironment(env),{configs,issues}=imageConfiguration(configured);
  if(!configs.length)return reply({enabled:false,issue:imageSetupMessage(issues[0]?.issue)});
  const quote=await rpc(env,'app_image_quote',{uid:u.id,editing:!!fields.source});
  return reply({...quote,max_allowance_usd:quote.included?Math.max(...configs.map(c=>c.maxCost)):0,...(!quote.enabled?{issue:'Image access and prices have not been enabled for this account. You have not been charged.'}:{})});
 }
 if(path.startsWith('/status/')&&req.method==='GET'){const rid=path.slice(8);if(!uuid(rid))fail(404,'not_found','Not found.');const status=await rpc(env,'app_image_status',{uid:u.id,rid});if(!status)fail(404,'not_found','Not found.');return reply(status);}
 fail(404,'not_found','Not found.');
}
export async function imageChat(req,env,c,u,d){
 if(!u)fail(401,'authentication_required','Sign in to create and save images.');if(c.product!=='aelio')fail(403,'image_product','Create images in your AELIO conversations.');
 const {prompt,source,aspect}=input(d),rid=d.request_id;if(!uuid(rid))fail(400,'invalid_request_id','Use a valid request identifier.');
 if(d.consent!==true)fail(403,'consent_required','Accept the AI disclosure before creating images.');
 if(!env.AELIO_STORAGE)fail(503,'storage_not_configured','Connect private storage before creating images.');
 const configured=await imageEnvironment(env),{configs,issues}=imageConfiguration(configured);if(!configs.length)fail(503,'image_configuration',imageSetupMessage(issues[0]?.issue));
 const currentQuote=await rpc(env,'app_image_quote',{uid:u.id,editing:!!source});
 if(currentQuote.included&&(!Number.isFinite(d.image_accepted_max_usd)||d.image_accepted_max_usd<Math.max(...configs.map(c=>c.maxCost))))fail(409,'image_quote_changed','The image allowance limit changed. Review the new cost before confirming.');
 const target=d.target&&d.target!=='group'?d.target:c.participants[0];if(!c.participants.includes(target))fail(403,'image_target','Choose a companion in this conversation.');await own(env,'app_agents',target,u);
 let original;
 if(source){const file=await own(env,'app_files',source,u);if(file.status!=='ready'||!['image/png','image/jpeg','image/webp'].includes(file.mime)||file.expires_at&&Date.parse(file.expires_at)<=Date.now())fail(400,'image_source','Choose an available image from your account.');const object=await env.AELIO_STORAGE.get(file.object_key);if(!object)fail(404,'image_source','The original image is unavailable.');const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length>25*1024*1024)fail(413,'image_source','The original image is too large.');original={bytes,mime:file.mime,base64:b64(bytes)};}
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({prompt,source,aspect,target})));
 const fingerprint=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 const start=await rpc(env,'app_image_begin',{uid:u.id,cid:c.id,rid,fingerprint,prompt,source,aspect,agent:target,quote_version:d.image_quote_version,accepted_credits:d.image_accepted_credits});
 if(start.replayed){if(start.status!=='complete')fail(409,start.status==='running'?'image_in_progress':'image_previous_failed',start.status==='running'?'This image is still being created. Check its status before retrying.':'The earlier image request failed and was refunded. Start a new request.');return saved(rid,start.file_id,true);}
 let record=null,stored=false,commitStarted=false;const attempts=new Map();
 try{
  const image=await generateImage(configured,{prompt,source:original,aspect,signal:req.signal,
   reserve:async config=>{const id=crypto.randomUUID();await rpc(env,'app_ai_reserve',{attempt:id,rid,uid:u.id,product_scope:'aelio',provider_name:config.provider,model_name:config.model,reserve_usd:config.maxCost,daily_limit:Number(configured.AELIO_DAILY_AI_BUDGET_USD),monthly_limit:Number(configured.AELIO_MONTHLY_AI_BUDGET_USD),emergency_limit:Number(configured.AELIO_OPENAI_EMERGENCY_BUDGET_USD||0),provider_daily_limit:Number(configured[config.provider.toUpperCase()+'_DAILY_BUDGET_USD']||configured.AELIO_DAILY_AI_BUDGET_USD),provider_monthly_limit:Number(configured[config.provider.toUpperCase()+'_MONTHLY_BUDGET_USD']||configured.AELIO_MONTHLY_AI_BUDGET_USD)});attempts.set(id,Date.now());return id;},
   settle:async(id,result)=>{await rpc(env,'app_ai_settle',{attempt:id,actual_usd:result.cost,result:result.outcome,latency:Date.now()-attempts.get(id),in_tokens:result.usage?.input_tokens??null,out_tokens:result.usage?.output_tokens??null,is_estimated:result.estimated});},
  });
  const id=crypto.randomUUID();record={id,owner_id:u.id,conversation_id:c.id,agent_id:target,category:'generated-assets',object_key:'generated-assets/'+u.id+'/'+id,name:'AELIO-'+(source?'edit':'image')+'-'+id.slice(0,8)+'.'+image.extension,mime:image.mime,size_bytes:image.bytes.length};
  await rpc(env,'app_reserve_file',{record});await env.AELIO_STORAGE.put(record.object_key,image.bytes,{httpMetadata:{contentType:image.mime},customMetadata:{owner:u.id,id}});stored=true;
  await table(env,'app_files','id=eq.'+id+'&owner_id=eq.'+u.id,{method:'PATCH',service:true,data:{status:'ready',parent_file_id:source}});
  commitStarted=true;
  await rpc(env,'app_image_finish',{rid,ok:true,fid:id});return saved(rid,id);
 }catch(error){
  if(commitStarted){
   const status=await rpc(env,'app_image_status',{uid:u.id,rid}).catch(()=>null);
   if(status?.status==='complete'&&status.file_id===record.id)return saved(rid,record.id,true);
   if(!status||status.status==='running'){
    // Database acknowledgement can be lost after commit. Preserve the saved asset; never delete a possibly committed result.
    error.code='image_save_uncertain';error.message='Your image was saved to Library, but chat confirmation was interrupted. Check Library and this request status before retrying.';error.requestId=rid;throw error;
   }
  }
  if(record){if(stored)await env.AELIO_STORAGE.delete(record.object_key).catch(()=>{});await table(env,'app_files','id=eq.'+record.id+'&owner_id=eq.'+u.id,{method:'DELETE',service:true}).catch(()=>{});}
  await rpc(env,'app_image_finish',{rid,ok:false}).catch(()=>console.error(JSON.stringify({event:'image_refund_pending',request_id:rid})));
  error.requestId=rid;throw error;
 }
}
function saved(rid,fid,replayed=false){return new Response(JSON.stringify({type:'image',file_id:fid,request_id:rid,replayed})+'\n'+JSON.stringify({type:'saved',request_id:rid,replayed})+'\n',{headers:{'content-type':'application/x-ndjson','cache-control':'no-store','x-request-id':rid}});}
export async function studioImages(req,env){
 const u=await requireStudioFounder(req,env);if(!['GET','PATCH'].includes(req.method))fail(405,'method_not_allowed','Method not allowed.');const settings=req.method==='PATCH'?(await body(req,5000)).settings:null;
 const policy=await rpc(env,'app_image_policy',{uid:u.id,settings}),configured=await imageEnvironment(env),{configs,issues}=imageConfiguration(configured);
 return reply({policy,configured_models:configs.map(({provider,model,maxCost})=>({provider,model,max_cost_usd:maxCost})),issues,verification:'Requires a successful live generation and edit test; configuration alone is insufficient.'});
}

export async function imageCapabilityChat(env,c,u,d){
 if(!u)fail(401,'authentication_required','Sign in to create and save images.');
 const configured=await imageEnvironment(env),{configs,issues}=imageConfiguration(configured);
 let message;if(!configs.length)message=imageSetupMessage(issues[0]?.issue);else{const quote=await rpc(env,'app_image_quote',{uid:u.id,editing:false});message=quote.enabled?"Tell me what you'd like to create, or attach an image to edit. You'll see the exact image cost before confirming.":'Image creation is available in AELIO, but image access and pricing have not been enabled for your account. You have not been charged.';}
 const agent=await own(env,'app_agents',c.participants[0],u);
 const rid=d.request_id||crypto.randomUUID();if(!uuid(rid))fail(400,'invalid_request_id','Use a valid request identifier.');
 await rpc(env,'app_image_explain',{uid:u.id,cid:c.id,rid,input:d.content,answer:message});
 return new Response(JSON.stringify({type:'delta',agent_id:c.participants[0],speaker:agent.name,text:message})+'\n'+JSON.stringify({type:'saved',request_id:rid})+'\n',{headers:{'content-type':'application/x-ndjson','cache-control':'no-store','x-request-id':rid}});
}
