import {COMPANIONS} from './companions.js';
export const OFFICIAL_KEYS=Object.freeze([...COMPANIONS.map(c=>c.id),'dream-team','core-eight']);
export const isOfficialThread=t=>OFFICIAL_KEYS.includes(t?.permanent_key);
export const inboxThreads=(threads,environment)=>threads.filter(t=>!t.archived&&(environment==='aelio'?isOfficialThread(t):!isOfficialThread(t)));
export function conversationTitle(t,agents){return t?.permanent_key==='dream-team'?'Dream Team':t?.permanent_key==='core-eight'?'Core 8':t?.title||agents.find(a=>a.id===t?.participants?.[0])?.name||'Conversation';}
export function bubbleInk(hex){if(!/^#[0-9a-f]{6}$/i.test(hex||''))return '#fff9f0';const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]>.179?'#1b1b1d':'#fff9f0';}

export function readableInk(background,preferred){
 const luminance=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 if(/^#[0-9a-f]{6}$/i.test(background||'')&&/^#[0-9a-f]{6}$/i.test(preferred||'')){const a=luminance(background),b=luminance(preferred);if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5)return preferred;}
 return bubbleInk(background);
}
