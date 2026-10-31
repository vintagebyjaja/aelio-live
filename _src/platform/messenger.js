import {who,member,body,sb,reply,fail,uuid,table} from './shared.js';
import {imageEnvironment} from './images.js';
import {imageConfiguration} from './providers/images.js';
import {rpc} from './shared.js';
export async function messenger(req,env,path){const u=await who(req,env);await member(env,u,'aelio');if(req.headers.get('x-aelio-product')==='pathd')fail(403,'aelio_only','Open this workspace in AELIO.');
 if(path==='/core-eight'&&req.method==='POST')return reply({conversation:await sb(env,'/rest/v1/rpc/app_core_eight',{token:u.token,method:'POST',data:{}})});
 if(path==='/read'&&req.method==='POST'){const d=await body(req,1000);if(!uuid(d.message_id))fail(400,'invalid_message','Choose a saved message.');await sb(env,'/rest/v1/rpc/app_mark_message_read',{token:u.token,method:'POST',data:{mid:d.message_id}});return reply({ok:true});}
 if(path==='/reaction'&&req.method==='POST'){const d=await body(req,2000);if(!uuid(d.message_id)||!['👍','❤️','😂','✨','🤔'].includes(d.emoji))fail(400,'invalid_reaction','Choose a supported reaction.');return reply({reactions:await sb(env,'/rest/v1/rpc/app_react_message',{token:u.token,method:'POST',data:{mid:d.message_id,reaction:d.emoji}})});}
 fail(404,'not_found','Not found.');
}
export async function nativeCatalog(req,env){const u=await who(req,env);await member(env,u,'aelio');if(req.method!=='GET')fail(405,'method_not_allowed','Method not allowed.');let images={enabled:false,issue:'Image execution access has not been configured. Browsing is free.'};try{const config=await imageEnvironment(env);if(imageConfiguration(config).configs.length){const q=await rpc(env,'app_image_quote',{uid:u.id,editing:false});images={...q,issue:q.enabled?'Confirm the exact image cost in Chat before execution.':'Image access and pricing have not been enabled.'};}}catch{}return reply({images,development_plans:{available:true},aurevia:{available:true,assessments_available:false}});}
export async function decorateMessages(env,u,rows){if(!u||!rows.length)return {messages:rows,reactions_available:false};try{const reactions=await table(env,'app_message_reactions','owner_id=eq.'+u.id+'&message_id=in.('+rows.map(m=>m.id).join(',')+')',{token:u.token});return {messages:rows.map(m=>({...m,reactions:reactions.filter(r=>r.message_id===m.id).map(r=>({emoji:r.emoji,count:1,mine:true}))})),reactions_available:true};}catch{return {messages:rows,reactions_available:false};}}

export async function decorateInbox(env,u,rows){try{const counts=await sb(env,'/rest/v1/rpc/app_messaging_unread',{token:u.token,method:'POST',data:{}});return rows.map(t=>({...t,unread_count:counts.find(c=>c.conversation_id===t.id)?.unread_count||0}));}catch{return rows;}}
