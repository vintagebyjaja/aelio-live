import {who,member,body,sb,reply,fail,own,table,uuid,sameOrigin} from './shared.js';
import {subscriptionAccess} from './billing.js';
import {proxyToEngine} from '../edge/engine-proxy.js';
export function projectDocument(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||typeof d.title!=='string'||!d.title.trim()||d.title.length>120||!['website','application','animation','design'].includes(d.kind))fail(400,'invalid_project','Give your project a title and supported type.');
 const files=d.files;if(!files||typeof files!=='object'||Array.isArray(files)||Object.keys(files).length>64)fail(400,'invalid_files','Use up to 64 text files.');
 let size=0;const encoder=new TextEncoder();
 for(const [path,content]of Object.entries(files)){
  if(!/^[A-Za-z0-9_@./-]{1,180}$/.test(path)||/(^\/|(^|\/)\.\.(\/|$)|\/\/|\/$)/.test(path)||/(^|\/)(\.git|node_modules|\.ssh|\.aws)(\/|$)/i.test(path)||(/(^|\/)\.env/i.test(path)&&!/(^|\/)\.env\.example$/i.test(path))||/(\.pem$|(^|\/)id_rsa$|(^|\/)\.npmrc$)/i.test(path)||typeof content!=='string'||encoder.encode(content).length>65536)fail(400,'invalid_files','Use safe relative text-file paths, at most 64 KB each. Keep credentials and generated dependencies out of projects.');
  size+=encoder.encode(content).length;
 }
 if(size>450000||encoder.encode(JSON.stringify(files)).length>524288)fail(400,'project_limit','This workspace supports 450 KB of project text.');
 const cfg=d.deployment||{};if(typeof cfg!=='object'||Array.isArray(cfg)||JSON.stringify(cfg).length>8000||Object.keys(cfg).some(k=>!['repository','branch','build_command','output_directory','domain','env_names'].includes(k)))fail(400,'invalid_deployment','Save deployment settings and environment names only; never secret values.');
 if(cfg.repository&&!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(cfg.repository))fail(400,'invalid_repository','Use an HTTPS GitHub repository URL without credentials or query parameters.');
 for(const k of ['repository','branch','build_command','output_directory','domain'])if(cfg[k]!==undefined&&(typeof cfg[k]!=='string'||cfg[k].length>500))fail(400,'invalid_deployment','Check the deployment fields.');
 if(cfg.env_names&&(!Array.isArray(cfg.env_names)||cfg.env_names.length>50||cfg.env_names.some(k=>typeof k!=='string'||! /^[A-Z_][A-Z0-9_]{0,79}$/.test(k))))fail(400,'invalid_environment','List environment variable names, without values.');
 if(d.memory!==undefined&&(typeof d.memory!=='string'||d.memory.length>20000))fail(400,'memory_limit','Project memory supports 20,000 characters.');
 return {title:d.title.trim(),kind:d.kind,files,memory:d.memory||'',deployment:cfg};
}
async function nativeRPC(env,u,name,data={}){try{return await sb(env,'/rest/v1/rpc/'+name,{token:u.token,method:'POST',data});}catch(e){if(e.code==='database_failure')fail(503,'native_setup_required','Project storage needs setup. Your existing chats and tools are still available.');throw e;}}
async function legacyWallet(req,env){
 if(!env.AELIO_ENGINE?.fetch&&!env.AELIO_ENGINE_ORIGIN)return {connected:false};
 try{const target=new URL(req.url);target.pathname='/api/my/wallet';target.search='';const response=await proxyToEngine({request:new Request(target,{headers:req.headers}),env});if(!response.ok)return {connected:false};const d=await response.json();
 return {connected:true,overview:d.overview?{plan_name:d.overview.plan_name,exempt:d.overview.exempt===true,total_available:d.overview.total_available,balances:d.overview.balances}:null,transactions:(d.transactions||[]).map(t=>({ts:t.ts,type:t.type,bucket:t.bucket,amount:t.amount})),purchases:(d.purchases||[]).map(p=>({id:p.id,status:p.status,amount_cents:p.amount_cents,currency:p.currency,credits:p.credits,created_at:p.created_at})),packages:(d.packages||[]).map(p=>({id:p.id,name:p.name,credits:p.credits,price_cents:p.price_cents,currency:p.currency})),payments:{configured:d.payments?.configured===true,usable:d.payments?.usable===true,mode:d.payments?.mode}};
 }catch{return {connected:false};}
}
export async function nativeWorkspace(req,env,path){
 sameOrigin(req);const u=await who(req,env);await member(env,u,'aelio');if(req.headers.get('x-aelio-product')==='pathd')fail(403,'aelio_only','Open Native Brain in AELIO.');
 if(path==='/wallet'&&req.method==='GET'){
  const [wallet,legacy,access]=await Promise.all([nativeRPC(env,u,'app_native_wallet').catch(e=>{if(e.code!=='native_setup_required')throw e;return {credits:null,earnings:null,transactions:[],payouts_enabled:false,payout_account_status:'not_connected',ledger_available:false};}),legacyWallet(req,env),env.AELIO_SUBSCRIPTIONS_ENABLED==='true'?subscriptionAccess(env,u):Promise.resolve({subscriptions:[],allowances:[]})]);
  const account=await sb(env,'/rest/v1/rpc/app_account_bootstrap',{token:u.token,method:'POST',data:{}});const entitlement=account.plans?.find(p=>p.product==='aelio');
  return reply({...wallet,credits:entitlement?.credits??wallet.credits,unlimited:entitlement?.unlimited===true,legacy,subscriptions:access.subscriptions||[],allowances:access.allowances||[]});
 }
 const receiptPath=path.match(/^\/receipts\/([A-Za-z0-9_-]{1,100})$/);
 if(receiptPath&&req.method==='GET'){
  const target=new URL(req.url);target.pathname='/api/my/payments/'+receiptPath[1];target.search='';const response=await proxyToEngine({request:new Request(target,{headers:req.headers}),env});
  if(!response.ok)fail(response.status===404?404:503,'receipt_unavailable','This receipt is not available.');const p=await response.json();
  if(!['paid','partially_refunded','refunded'].includes(p.status)||!p.receipt?.payment_id)fail(409,'receipt_pending','Payment confirmation has not arrived yet.');
  return reply({receipt:{payment_id:p.id,status:p.status,amount_cents:p.amount_cents,currency:p.currency,credits:p.credits,paid_at:p.receipt.paid_at}});
 }
 if(path==='/checkout'&&req.method==='POST'){
  const d=await body(req,2000);if(d.confirm!==true||typeof d.package_id!=='string'||!/^[a-z0-9_-]{1,100}$/i.test(d.package_id))fail(400,'confirmation_required','Confirm the selected credit package before continuing to secure checkout.');
  if(!env.AELIO_ENGINE?.fetch&&!env.AELIO_ENGINE_ORIGIN)fail(503,'checkout_unavailable','Credit checkout is not connected. You have not been charged.');
  const target=new URL(req.url);target.pathname='/api/my/checkout';target.search='';
  const headers=new Headers(req.headers);headers.delete('content-length');
  const response=await proxyToEngine({request:new Request(target,{method:'POST',headers,body:JSON.stringify({package_id:d.package_id,return_to:'/chat/#native'})}),env});
  if(!response.ok)fail(503,'checkout_unavailable','Secure checkout could not open. Check your wallet before retrying.');
  const result=await response.json();let url;try{url=new URL(result.url);}catch{}if(!url||url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password)fail(502,'checkout_invalid','The payment destination could not be verified.');return reply({url:url.href});
 }
 if(path==='/projects'&&req.method==='GET'){
  try{return reply({projects:await table(env,'app_native_projects','owner_id=eq.'+u.id+'&select=id,title,kind,revision,created_at,updated_at&order=updated_at.desc&limit=20',{token:u.token})});}catch(e){if(e.code==='database_failure')fail(503,'native_setup_required','Project storage needs setup. Your existing chats and tools are still available.');throw e;}
 }
 if(path==='/projects'&&req.method==='POST'){const d=await body(req,600000);return reply({project:await nativeRPC(env,u,'app_native_save',{pid:null,expected:0,document:projectDocument(d)})},201);}
 const match=path.match(/^\/projects\/([a-f0-9-]+)(\/versions)?$/i);
 if(match){const id=match[1];if(!uuid(id))fail(404,'not_found','Project not found.');await own(env,'app_native_projects',id,u);
  if(match[2]&&req.method==='GET')return reply({versions:await table(env,'app_native_project_versions','project_id=eq.'+id+'&order=revision.desc&limit=50',{token:u.token})});
  if(!match[2]&&req.method==='GET')return reply({project:await own(env,'app_native_projects',id,u)});
  if(!match[2]&&req.method==='PATCH'){const d=await body(req,600000);if(!Number.isInteger(d.expected)||d.expected<1)fail(400,'revision_required','Reload the project before saving.');return reply({project:await nativeRPC(env,u,'app_native_save',{pid:id,expected:d.expected,document:projectDocument(d)})});}
 }
 if(path==='/cloud'&&req.method==='GET')return reply({files:await table(env,'app_files','owner_id=eq.'+u.id+'&select=id,name,mime,size_bytes,category,created_at&status=eq.ready&order=created_at.desc&limit=200',{token:u.token})});
 fail(404,'not_found','This Native Brain action is not available.');
}
