import {Problem} from './shared.js';
// Validate structured identities at the server boundary. Never manufacture messages
// by splitting one generated transcript into invented participants.
export function attributedAgent(event,agents){
 const agent=agents.find(a=>a.id===event.agent_id);
 if(!agent)throw new Problem(502,'reply_identity_invalid','A companion reply had invalid attribution. Please retry.');
 return agent;
}
export function assertOwnVoice(content,agent,participants){
 for(const other of participants){
  if(other.id===agent.id)continue;
  const name=String(other.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const label=new RegExp('(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:[-*]\\s*)?(?:\\*\\*)?\\[?'+name+'\\]?(?:\\*\\*)?\\s*:', 'i');
  if(label.test(content))throw new Problem(502,'reply_voice_invalid','A companion tried to speak for another participant. Please retry this turn.');
 }
}
