import {useEffect,useState} from 'react';
import {COMPANIONS,companion} from '../shared/companions.js';
import {fileURL} from './client';
import {Orb} from './Icon';
export function AgentAvatar({agent,group=false,shape='circle'}:{agent?:any;group?:boolean;shape?:'circle'|'rounded'}){
 const official=companion(agent?.kind),[custom,setCustom]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true,url='';setCustom('');setFailed(false);
  if(!official&&agent?.avatar_file_id)fileURL(agent.avatar_file_id).then(value=>{url=value;if(live)setCustom(value);else URL.revokeObjectURL(value);}).catch(()=>{});
  return()=>{live=false;if(url)URL.revokeObjectURL(url);};
 },[agent?.avatar_file_id,agent?.kind]);
 if(official?.id==='aelio')return <span className="companion-avatar"><Orb small/></span>;
 const src=official?(official.portrait?'/assets/img/'+official.portrait:''):custom;
 const crop=official?{x:50,y:30,zoom:1}:{x:50,y:35,zoom:1,...agent?.avatar_crop};
 return <span className={'companion-avatar '+(shape==='rounded'?'avatar-rounded ':'')+(group?'team-avatar':'')}>
 {src&&!failed?<img src={src} onError={()=>setFailed(true)} alt="" loading="lazy" style={{objectPosition:`${crop.x}% ${crop.y}%`,transform:`translate(${(50-crop.x)*(crop.zoom-1)}%, ${(50-crop.y)*(crop.zoom-1)}%) scale(${crop.zoom})`}}/>:group?'✦':(official?.name||agent?.name||'A').slice(0,1)}
 </span>;
}
export function CompanionNavigation({agents,threads,current,query,onOpen,onSelect}:{agents:any[];threads:any[];current:any;query:string;onOpen:(a:any)=>void;onSelect:(t:any)=>void}){
 const matches=(values:any[])=>values.join(' ').toLowerCase().includes(query.toLowerCase());
 return <div className="companion-navigation"><h2>Your Companions</h2>{COMPANIONS.map(official=>{const agent=agents.find(a=>a.kind===official.id);return agent&&matches([official.name,official.title])?<button key={agent.id} className={'companion-link '+(current?.participants?.length===1&&current.participants[0]===agent.id?'selected':'')} onClick={()=>onOpen(agent)}><AgentAvatar agent={agent}/><span><b>{official.name}</b><small>{official.subtitle}</small></span></button>:null;})}
 <h2>Group Chats</h2>{threads.filter(t=>t.participants.length>1&&(t.permanent_key==='dream-team'||!t.archived)&&matches([t.title,t.subtitle])).map(t=><button key={t.id} className={'companion-link '+(current?.id===t.id?'selected':'')} onClick={()=>onSelect(t)}><AgentAvatar group/><span><b>{t.permanent_key==='dream-team'?'Dream Team':t.title}</b><small>{t.subtitle||'Your group conversation'}</small></span></button>)}
 {agents.some(a=>a.kind==='custom')&&<><h2>Your Agents</h2>{agents.filter(a=>a.kind==='custom'&&matches([a.name,a.subtitle])).map(a=><button key={a.id} className="companion-link" onClick={()=>onOpen(a)}><AgentAvatar agent={a}/><span><b>{a.name}</b><small>{a.subtitle}</small></span></button>)}</>}
 </div>;
}
export function CompanionLibrary({agents,threads,onOpen,onSelect,onCustomize,onEdit}:{agents:any[];threads:any[];onOpen:(a:any)=>void;onSelect:(t:any)=>void;onCustomize:(a:any)=>void;onEdit:(a:any)=>void}){
 return <div className="companion-grid">{[...COMPANIONS.map(official=>agents.find(a=>a.kind===official.id)).filter(Boolean),...agents.filter(a=>a.kind==='custom')].map(agent=>{const official=companion(agent.kind);return <article className="companion-card" key={agent.id} onClick={(event:any)=>{if(!event.target.closest("button,a,input,select"))onOpen(agent);}}><button className="companion-open" onClick={()=>onOpen(agent)} aria-label={'Open '+agent.name+' chat'}><AgentAvatar agent={agent}/><span><b>{official?.title||agent.name}</b><small>{official?.subtitle||agent.subtitle}</small></span></button><p>{agent.kind==='custom'?agent.specialty:official?.intro}</p><button onClick={()=>onCustomize(agent)}>Chat appearance</button>{agent.kind==='custom'&&<button onClick={()=>onEdit(agent)}>Edit agent</button>}</article>;})}
 {threads.filter(t=>t.permanent_key==='dream-team').map(t=><article className="companion-card" key={t.id}><button className="companion-open" onClick={()=>onSelect(t)} aria-label="Open Dream Team chat"><AgentAvatar group/><span><b>Dream Team</b><small>Six minds. One conversation.</small></span></button><p>Naomi, Angelo, Oliver, Simone, Chloe and Reggie. Bring an idea to the group, or ask someone directly.</p></article>)}</div>;
}
