import {test} from 'node:test';import assert from 'node:assert/strict';
import {COMPANIONS,DREAM_TEAM,coordinateTeam} from '../shared/companions.js';
import {consumerMessage,EXPERIENCE_STATES} from '../shared/experience.js';
import {milaStyleInstruction} from '../shared/mila-style.js';
import {responseBody} from '../platform/providers/openai.js';
test('permanent identities, portrait assignment and coordinator stay separate from custom agents',()=>{
 assert.deepEqual(COMPANIONS.map(c=>c.id),['aelio','mila','naomi','angelo','oliver','simone','chloe','reggie']);
 const agents=DREAM_TEAM.map(a=>({...a,kind:a.id}));assert.deepEqual(coordinateTeam(agents,'Naomi, can you debug this app?').map(a=>a.kind),['naomi']);
 assert.deepEqual(coordinateTeam(agents,'@Oliver and @Simone, help me write a pitch').map(a=>a.kind),['oliver','simone']);
 assert.equal(coordinateTeam(agents,'Everybody, what do you think?').length,6);assert.ok(coordinateTeam(agents,'hello').length<=2);assert.ok(coordinateTeam(agents,'brainstorm product ideas and a business plan').length<=3);
 for(let i=0;i<6;i++)assert.equal(DREAM_TEAM[i].portrait,'companions/'+DREAM_TEAM[i].id+'.webp');
});
test('consumer failures retain security meaning without infrastructure details',()=>{
 assert.equal(Object.keys(EXPERIENCE_STATES).length,10);assert.doesNotMatch(consumerMessage('session_not_configured','secret'),/secret|runtime|Cloudflare/i);
 assert.equal(consumerMessage('permission_denied','This account cannot access that resource.'),'This account cannot access that resource.');
 assert.doesNotMatch(consumerMessage('unknown','PGRST202 service-role configuration error'),/PGRST|service-role/);
});
test('MILA styles preserve identity and official agent instructions reach the provider',()=>{
 for(const style of ['homegirl','ceo','auntie','advisor','teacher','mom'])assert.match(milaStyleInstruction(style),/same career, life and accountability companion/);
 const body=responseBody({}, {content:'A question',history:[],career:[]},{kind:'naomi',name:'Unexpected alias',id:'fixture'});assert.match(body.instructions,/You are Naomi/);assert.doesNotMatch(body.instructions,/Unexpected alias/);
});

test('portrait crop controls are bounded and preserve custom-only data',async()=>{
 const {avatarCrop}=await import('../platform/messaging.js');assert.deepEqual(avatarCrop({x:0,y:100,zoom:3}),{x:0,y:100,zoom:3});assert.throws(()=>avatarCrop({x:-1,y:50,zoom:1}));assert.throws(()=>avatarCrop({x:50,y:50,zoom:4}));assert.throws(()=>avatarCrop({x:50,y:50,zoom:1,officialAvatar:'override'}));
});
