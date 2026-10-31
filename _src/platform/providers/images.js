// Dedicated multimodal transports; same server credentials and routing configuration as text.
import {fail,limited,Problem} from '../shared.js';
import {validateFile} from '../storage.js';
const MAX_BYTES=25*1024*1024;
export function imageConfiguration(env){
 const issues=[],configs=[];
 const order=[env.AELIO_IMAGE_PRIMARY_PROVIDER||env.AELIO_PRIMARY_PROVIDER||'gemini','openai','gemini'];
 for(const provider of [...new Set(order)]){
  if(!['openai','gemini'].includes(provider))continue; // Groq is not assumed image-capable.
  const prefix=provider.toUpperCase(),key=env[prefix+'_API_KEY'],model=env[prefix+'_IMAGE_MODEL'];
  if(env['AELIO_'+prefix+'_ENABLED']==='false')continue;
  const problem=!key?'credentials_missing':!model?'image_model_missing':!(provider==='openai'?/^gpt-image-[a-z0-9.-]+$/.test(model):/^gemini-[a-z0-9.-]*image[a-z0-9.-]*$/.test(model))?'image_model_unsupported':!(Number.isFinite(Number(env[prefix+'_IMAGE_MAX_COST_USD']))&&Number(env[prefix+'_IMAGE_MAX_COST_USD'])>0&&Number(env[prefix+'_IMAGE_MAX_COST_USD'])<=1000000)?'image_budget_missing':null;
  if(problem){issues.push({provider,issue:problem});continue;}
  configs.push({provider,model,key,maxCost:Number(env[prefix+'_IMAGE_MAX_COST_USD']),inputPrice:Number(env[prefix+'_IMAGE_INPUT_USD_PER_MILLION']),outputPrice:Number(env[prefix+'_IMAGE_OUTPUT_USD_PER_MILLION'])});
 }
 return {configs,issues};
}
export function imageSetupMessage(issue){return ({credentials_missing:'Image creation needs its existing server credentials connected.',image_model_missing:'Image creation needs a supported image model selected in server settings.',image_model_unsupported:'The selected model does not support image generation. Select an image-capable model.',image_budget_missing:'Image creation needs an approved per-request spending limit.',permissions:'The image model needs image-generation permission on the connected account.',billing:'The connected image service needs billing or quota access.',model:'The configured image model is unavailable or does not support this operation.',safety:'The image service could not accept this request. Try a different description.',rate:'Image creation is temporarily at capacity. Please try again later.',ambiguous:'The image request ended without a confirmed result. It was not retried automatically.',output:'The image service returned no usable image. No image credits were charged.'})[issue]||'Image creation needs its server configuration reviewed.';}
function classify(status,detail){const value=JSON.stringify(detail).toLowerCase();if(/billing|quota|insufficient_quota|payment/.test(value))return 'billing';if(status===401||status===403)return 'permissions';if(status===404||/model.*(not found|not supported|invalid)|unsupported.*model/.test(value))return 'model';if(status===429)return 'rate';if(/safety|blocked|moderation|prohibited/.test(value))return 'safety';return 'output';}
function decode(data,mime){
 if(typeof data!=='string'||data.length>MAX_BYTES*1.38||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))fail(502,'image_output_invalid',imageSetupMessage('output'));
 let binary;try{binary=atob(data);}catch{fail(502,'image_output_invalid',imageSetupMessage('output'));}
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length>MAX_BYTES)fail(502,'image_output_invalid',imageSetupMessage('output'));
 const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime];validateFile('image.'+ext,mime,bytes);return {bytes,mime,extension:ext};
}
export async function generateImage(env,{prompt,source,aspect='square',signal,reserve,settle},fetcher=fetch){
 const {configs,issues}=imageConfiguration(env);
 if(!configs.length)fail(503,'image_configuration',imageSetupMessage(issues[0]?.issue));
 for(let index=0;index<configs.length;index++){
  const config=configs[index],{provider,model,key}=config;
  const attempt=await reserve(config);let ended=false;
  const finish=async(outcome,usage=null,zero=false)=>{if(ended)return;ended=true;const known=Number.isFinite(usage?.input_tokens)&&Number.isFinite(usage?.output_tokens)&&Number.isFinite(config.inputPrice)&&Number.isFinite(config.outputPrice)&&config.inputPrice>0&&config.outputPrice>0;await settle(attempt,{outcome,cost:zero?0:known?(usage.input_tokens*config.inputPrice+usage.output_tokens*config.outputPrice)/1e6:config.maxCost,estimated:!known&&!zero,usage});};
  let url,headers,body;
  if(provider==='openai'){
   url='https://api.openai.com/v1/images/'+(source?'edits':'generations');headers={authorization:'Bearer '+key};
   const size={square:'1024x1024',portrait:'1024x1536',landscape:'1536x1024'}[aspect];
   if(source){const form=new FormData();form.set('model',model);form.set('prompt',prompt);form.set('size',size);form.set('n','1');form.set('image',new Blob([source.bytes],{type:source.mime}),'source.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[source.mime]));body=form;}
   else {headers['content-type']='application/json';body=JSON.stringify({model,prompt,size,n:1});}
  }else{
   url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';headers={'x-goog-api-key':key,'content-type':'application/json'};
   const parts=[{text:prompt}];if(source)parts.push({inlineData:{mimeType:source.mime,data:source.base64}});
   body=JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:{square:'1:1',portrait:'2:3',landscape:'3:2'}[aspect]}}});
  }
  let response;
  try{response=await fetcher(url,{method:'POST',headers,body,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});}catch{
   await finish('image_network_ambiguous');throw new Problem(503,'image_request_ambiguous',imageSetupMessage('ambiguous'));
  }
  let result;try{result=JSON.parse(new TextDecoder().decode(await limited(response,36*1024*1024)));}catch{await finish('image_output_invalid');throw new Problem(502,'image_output_invalid',imageSetupMessage('output'));}
  if(!response.ok){const issue=classify(response.status,result);await finish('image_'+issue,null,response.status<500);console.warn(JSON.stringify({event:'image_provider_rejected',provider,model,status:response.status,category:issue}));
   if(['permissions','billing','model','rate'].includes(issue)&&index<configs.length-1)continue;
   throw new Problem(response.status===429?429:503,'image_'+issue,imageSetupMessage(issue));
  }
  let image,usage;
  try{
   if(provider==='openai'){image=decode(result.data?.[0]?.b64_json,'image/png');usage=result.usage;}
   else {const candidates=result.candidates||[],parts=candidates[0]?.content?.parts||[],part=parts.find(p=>p.inlineData?.data||p.inline_data?.data),inline=part?.inlineData||part?.inline_data;if(!inline)throw Error('no image');image=decode(inline.data,inline.mimeType||inline.mime_type);usage=result.usageMetadata?{input_tokens:result.usageMetadata.promptTokenCount,output_tokens:result.usageMetadata.candidatesTokenCount}:null;}
  }catch{await finish('image_output_invalid');throw new Problem(502,'image_output_invalid',imageSetupMessage('output'));}
  await finish('image_complete',usage);return image;
 }
 fail(503,'image_configuration',imageSetupMessage('model'));
}
