import {body,fail,member,reply,sb,text,uuid,who,sameOrigin} from './shared.js';
import {destination,QUALITY} from '../shared/aurevia.js';
const memberRPC=(env,name,data,u)=>sb(env,'/rest/v1/rpc/'+name,{method:'POST',data,token:u.token});
export async function aurevia(req,env,path){
 sameOrigin(req);const u=await who(req,env);await member(env,u,'aelio');
 if(req.headers.get('x-aelio-product')==='pathd')fail(403,'aurevia_unavailable','AUREVIA belongs to AELIO.');
 if(path===''&&req.method==='GET')return reply(await memberRPC(env,'app_aurevia_state',{},u));
 if(path===''&&req.method==='PATCH'){
  const d=await body(req,2000);const name=text(d.name,80);
  if(!name||!destination(d.destination)||!QUALITY.includes(d.quality))fail(400,'invalid_input','Choose valid residence preferences.');
  return reply({residence:await memberRPC(env,'app_aurevia_preferences',{p_name:name,p_destination:d.destination,p_quality:d.quality},u)});
 }
 if(path==='/meetings'&&req.method==='POST'){
  const d=await body(req,3000),purpose=text(d.purpose,500);
  if(!uuid(d.conversation_id)||!purpose)fail(400,'invalid_input','Choose a conversation and describe your meeting.');
  return reply({meeting:await memberRPC(env,'app_aurevia_meeting',{p_conversation:d.conversation_id,p_purpose:purpose},u)},201);
 }
 return reply({error:'Not found.'},404);
}
