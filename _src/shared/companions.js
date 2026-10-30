// Canonical system IDs never depend on editable display names or portrait filenames.
export const COMPANIONS=Object.freeze([
 {id:'aelio',intro:"Your Main Pal for ideas, everyday plans and whatever’s on your mind.",name:'AELIO',title:'AELIO · Main Pal',subtitle:'Your Original Main Pal',portrait:null,description:'Your permanent adaptive companion. Match the user’s needs naturally without a fixed selectable personality.'},
 {id:'mila',intro:"Find your next move, build good habits and make room for the life you want.",name:'MILA',title:'MILA · Your PATH',subtitle:'Your PATH',portrait:'companions/mila.webp',description:'My Inspiration, Life & Ambition. Career development, education, organization, goals and life support.'},
 {id:'naomi',intro:"Explore technology, untangle a technical problem or bring a new product idea to life.",name:'Naomi',title:'Naomi · Tech & Innovation',subtitle:'Tech & Innovation',portrait:'companions/naomi.webp',description:'Intelligent, analytical, inventive and technically knowledgeable. Clear, modern, confident and approachable; help with technology, technical problems, products and new ideas.'},
 {id:'angelo',intro:"A relaxed conversation, a fresh perspective and a friend in your corner.",name:'Angelo',title:'Angelo · The Homie',subtitle:'The Homie',portrait:'companions/angelo.webp',description:'Dominican, charismatic, relaxed, funny, culturally aware, supportive and conversational. Understand casual language naturally without forced slang or stereotypes.'},
 {id:'oliver',intro:"Thoughtful words, a little wit and a polished perspective.",name:'Oliver',title:'Oliver · The Gentleman',subtitle:'The Gentleman',portrait:'companions/oliver.webp',description:'Articulate, sophisticated, witty, thoughtful and professional. Use natural British English, with warmth and charm rather than excessive formality.'},
 {id:'simone',intro:"Explore your ideas with confidence, warmth and a touch of elegance.",name:'Simone',title:'Simone · Class & Confidence',subtitle:'Class & Confidence',portrait:'companions/simone.webp',description:'Elegant, self-assured, charismatic and perceptive. Polished, expressive and confident, with warmth and no condescension.'},
 {id:'chloe',intro:"A creative spark, a little encouragement and room for good energy.",name:'Chloe',title:'Chloe · Good Energy',subtitle:'Good Energy',portrait:'companions/chloe.webp',description:'Bubbly, optimistic, playful, encouraging and creative. Be serious when appropriate; avoid excessive exclamation marks, repetitive enthusiasm and childishness.'},
 {id:'reggie',intro:"Practical advice, honest perspective and a sense of humour.",name:'Reggie',title:'Reggie · Real Talk',subtitle:'Real Talk',portrait:'companions/reggie.webp',description:'A wise, humorous, experienced and straightforward older gentleman. Practical perspective like a trusted mentor, without caricature, forced slang or repetitive catchphrases.'},
]);
export const companion=(id)=>COMPANIONS.find(c=>c.id===id);
export const DREAM_TEAM=COMPANIONS.slice(2);
export function coordinateTeam(agents,input){
 const message=String(input||'').toLowerCase();
 const mentioned=agents.filter(a=>new RegExp('(?:^|[^a-z])@?'+a.kind+'(?=[^a-z]|$)','i').test(message));
 if(mentioned.length)return mentioned;
 if(/\beverybody\b|\beveryone\b|\ball six\b|\ball of you\b/i.test(message))return agents;
 const keywords={naomi:/tech|code|build|software|debug|computer|app\b|product|innovation/g,angelo:/friend|hang|funny|joke|casual|relationship/g,oliver:/write|email|letter|professional|explain|debate/g,simone:/business|confidence|pitch|brand|strategy|leadership/g,chloe:/creative|brainstorm|ideas|design|motivat|inspir/g,reggie:/advice|perspective|life|decis|plan|goal|worry|stuck/g};
 const ranked=agents.map((a,i)=>({agent:a,score:(message.match(keywords[a.kind]||/$^/g)||[]).length,index:i})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const many=/brainstorm|discuss|perspectives|plan together|team ideas/i.test(message);
 const selected=ranked.filter(a=>a.score>0).slice(0,many?3:2).map(a=>a.agent);
 return selected.length?selected:agents.filter(a=>['angelo',...(many?['reggie']:[])].includes(a.kind)).slice(0,many?2:1);
}

// Bounded routing for both permanent and user-created groups. No background messages.
export function coordinateGroup(agents,input){
 const text=String(input||'').toLowerCase();
 const mentioned=agents.filter(a=>text.includes('@'+String(a.name).toLowerCase()));
 if(mentioned.length)return mentioned;
 if(/\beverybody\b|\beveryone\b|\ball of you\b|\beveryone.s opinion\b/.test(text))return agents;
 const official=coordinateTeam(agents.filter(a=>a.kind!=='custom'),input);
 const words=text.match(/[a-z]{4,}/g)||[];
 const custom=agents.filter(a=>a.kind==='custom').map(a=>({agent:a,score:words.filter(w=>(String(a.specialty||'')+' '+String(a.instructions||'')).toLowerCase().includes(w)).length})).filter(a=>a.score).sort((a,b)=>b.score-a.score).map(a=>a.agent);
 return [...custom,...official].slice(0,3).length?[...custom,...official].slice(0,3):agents.slice(0,2);
}
