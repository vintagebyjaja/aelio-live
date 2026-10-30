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
