import {test} from 'node:test';import assert from 'node:assert/strict';
import {coordinateGroup,COMPANIONS} from '../shared/companions.js';
import {UNC_MESSAGES,groupDemo} from '../group-demo.mjs';
import {responseBody} from '../platform/providers/openai.js';
const agents=[...COMPANIONS.slice(2).map(a=>({...a,kind:a.id})),{id:'dre',kind:'custom',name:'Big Dre',personality:'Relaxed',specialty:'Sports and lounge planning'}];
test('custom group mentions target exact identities; everyone is explicit; ordinary turns stay bounded',()=>{
 assert.deepEqual(coordinateGroup(agents,'@Big Dre, thoughts?').map(a=>a.name),['Big Dre']);
 assert.deepEqual(coordinateGroup(agents,'@Naomi and @Reggie, help me').map(a=>a.name),['Naomi','Reggie']);
 assert.equal(coordinateGroup(agents,'Everyone, what do you think?').length,agents.length);
 assert.ok(coordinateGroup(agents,'lounge sports ideas').length<=3);
 assert.ok(coordinateGroup([{kind:'custom',name:'Marcus',specialty:'Finance'}],'hello').length===1);
});
test('group replies see earlier speakers while preserving their own personality',()=>{
 const payload={agents,group:{tone:'relaxed'},content:'What do you think?',group_turn_replies:[{speaker:'Reggie',content:'Look at the rent first.'}],page_context:{path:'/create/',title:'Create'}};
 const body=responseBody({},payload,agents.at(-1));assert.match(body.instructions,/Big Dre/);assert.match(body.instructions,/Do not invent other speakers/);assert.match(body.instructions,/relaxed/);assert.match(body.input.at(-1).content,/Reggie/);assert.match(body.instructions,/public_page_context/);
});
test('marketing demo preserves the exact supplied conversation and stays explicitly scripted',()=>{
 assert.equal(UNC_MESSAGES.length,4);assert.equal(UNC_MESSAGES[0][1],"Fellas, I'm thinking about opening a lounge. What y'all think?");
 assert.equal(UNC_MESSAGES[3][1],"See, I'm thinking we do both. Live music on Fridays, sports on Sundays. But we need to figure out who we trying to attract.");
 assert.match(groupDemo(),/Scripted example/);assert.match(groupDemo(),/newGroup=1/);assert.match(groupDemo(),/data-unc-replay/);
});

test('Dream Team ranking invites independent relevant voices and exact addressing stays scoped',async()=>{
 const {coordinateTeam}=await import('../shared/companions.js');
 const six=agents.slice(0,6);
 assert.ok(coordinateTeam(six,'Rank these creative ideas').length>=3);
 assert.deepEqual(coordinateTeam(six,'@Chloe, rank these ideas').map(a=>a.kind),['chloe']);
 assert.equal(coordinateTeam(six,'Everyone, give your ranking').length,6);
});
test('server rejects unknown attribution and another companion’s name-labelled response',async()=>{
 const {attributedAgent,assertOwnVoice}=await import('../platform/group-attribution.js');
 assert.throws(()=>attributedAgent({agent_id:'forged'},agents),e=>e.code==='reply_identity_invalid');
 const chloe=agents.find(a=>a.kind==='chloe');
 assert.throws(()=>assertOwnVoice('My idea.\n**Reggie:** Pay the rent.',chloe,agents),e=>e.code==='reply_voice_invalid');
 assert.doesNotThrow(()=>assertOwnVoice('I disagree with Reggie about the timing.',chloe,agents));
});
test('actual server orchestration calls each speaker separately and persists distinct participant records',async()=>{
 const {chatRoutes}=await import('../platform/messaging.js');
 const uid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222';
 const people=agents.slice(0,6).map((a,i)=>({...a,id:`33333333-3333-4333-8333-${String(i+1).padStart(12,'0')}`,owner_id:uid}));
 const thread={id:cid,owner_id:uid,participants:people.map(a=>a.id),product:'aelio',permanent_key:'dream-team'};
 const env={SUPABASE_URL:'https://fixture.test',SUPABASE_PUBLISHABLE_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-only',AELIO_AI_PROVIDER:'openai',OPENAI_API_KEY:'fixture-openai'};
 const original=globalThis.fetch,calls=[];let saved;
 globalThis.fetch=async(url,init={})=>{
  const u=new URL(url);const name=u.pathname.split('/').at(-1);
  if(u.hostname==='api.openai.com'){
   const body=JSON.parse(init.body);calls.push(body);
   const speaker=people.find(a=>body.instructions.startsWith('You are '+a.name+','));assert.ok(speaker);
   const wire=x=>'data: '+JSON.stringify(x)+'\n\n';
   return new Response(wire({type:'response.output_text.delta',delta:speaker.name+' independent fixture ranking.'})+wire({type:'response.completed',response:{usage:{input_tokens:10,output_tokens:5}}}));
  }
  let value=[];
  if(name==='user')value={id:uid};
  else if(name==='app_product_access'||name==='app_limit')value=true;
  else if(name==='app_conversations')value=[thread];
  else if(name==='app_agents')value=people.filter(a=>'eq.'+a.id===u.searchParams.get('id'));
  else if(name==='app_chat_request_lookup')value=null;
  else if(name==='app_reserve_chat')value=99;
  else if(name==='app_commit_chat'){saved=JSON.parse(init.body);value=null;}
  return Response.json(value);
 };
 try{
  const request=new Request('https://aelio.test/api/platform/conversations/'+cid+'/respond',{method:'POST',headers:{authorization:'Bearer fixture',origin:'https://aelio.test','content-type':'application/json'},body:JSON.stringify({content:'Everyone, rank these ideas',consent:true})});
  const response=await chatRoutes(request,env,'/conversations/'+cid+'/respond');const events=(await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length,6);assert.equal(saved.responses.length,6);assert.equal(new Set(saved.responses.map(r=>r.agent_id)).size,6);
  for(const person of people){const row=saved.responses.find(r=>r.agent_id===person.id);assert.equal(row.speaker,person.name);assert.equal(row.content,person.name+' independent fixture ranking.');}
  assert.match(JSON.stringify(calls[1].input),new RegExp(people[0].name+' independent fixture'));
  assert.equal(events.at(-1).type,'saved');assert.ok(events.filter(e=>e.type==='delta').every(e=>people.some(a=>a.id===e.agent_id&&a.name===e.speaker)));
 }finally{globalThis.fetch=original;}
});
