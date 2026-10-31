import React from 'react';
import {Icon} from './Icon';
// One ordered navigation model for both workspaces and both desktop/mobile surfaces.
export function SharedNavigation({panel,environment,onNavigate,onChats,onDreamTeam,onAurevia,onWorkspace}:any){
 const primary=[['chats','Chats','chat'],['companions','Companions','agents'],['dream-team','Dream Team','sparkle'],['echo','Echo','echo'],['library','Library','library']];
 return <nav className="shared-navigation" aria-label="Workspace navigation">
  {primary.map(([id,label,icon])=><button key={id} title={label} aria-current={(id==='chats'&&['inbox','history',''].includes(panel))||(id==='companions'&&panel==='core')||panel===id?'page':undefined} onClick={()=>id==='chats'?onChats():id==='dream-team'?onDreamTeam():onNavigate(id)}><Icon name={icon} size={22}/><small>{label}</small></button>)}
  <a href="https://grooveville.org/guide/" target="_blank" rel="noopener noreferrer" title="Open Groove Guide in a new tab" aria-label="Groove Guide (opens in a new tab)"><img src="/assets/img/brand/groove-guide-official.png" alt=""/><small>Groove Guide</small></a>
  <a href="https://vybr8.live/" target="_blank" rel="noopener noreferrer" title="Open VYBR8 in a new tab" aria-label="VYBR8 (opens in a new tab)"><img src="/assets/img/brand/vybr8-official.png" alt=""/><small>VYBR8</small></a>
  <details className="shared-more"><summary title="More navigation"><Icon name="more" size={22}/><small>More</small></summary><div>{[['discover','Discover'],['projects','Projects'],['appearance','Appearance / Themes'],['connected-apps','Connected apps'],['reminders','Reminders'],['files','Private files'],['agents','Manage agents'],['settings','Settings'],['allowance','Plans & allowance'],['account','Profile'],['home','AELIO home']].map(([id,label])=><button key={id} onClick={(e:any)=>{e.currentTarget.closest('details').open=false;onNavigate(id);}}>{label}</button>)}<button onClick={onAurevia}>Enter AUREVIA ↗</button><button onClick={()=>onWorkspace('native')}>Native Brain</button></div></details>
 </nav>;
}
