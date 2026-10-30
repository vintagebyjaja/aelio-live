import React,{useEffect,useState} from 'react';
import {AelioOrb} from './AelioOrb';
import {consumerMessage,EXPERIENCE_STATES} from '../shared/experience.js';
export const friendly=(error:any)=>consumerMessage(error?.code,error?.message||error);
export function AelioLoading({context='space',onRetry,onExit}:{context?:'space'|'account'|'conversation';onRetry?:()=>void;onExit?:()=>void}){
 const [slow,setSlow]=useState(false);useEffect(()=>{const t=setTimeout(()=>setSlow(true),12000);return()=>clearTimeout(t);},[]);
 return <section className="experience-status" role="status"><AelioOrb state="loading" size={80}/><p>{context==='conversation'?'One moment, I’ve got you.':EXPERIENCE_STATES.loading}</p>{slow&&<><p>This is taking a little longer. You can try again or keep exploring.</p>{onRetry&&<button onClick={onRetry}>Try again</button>}{onExit?<button onClick={onExit}>Back</button>:<a href="/explore/">Keep exploring</a>}</>}</section>;
}
export function ConnectionNotice(){const [offline,setOffline]=useState(!navigator.onLine);useEffect(()=>{const update=()=>setOffline(!navigator.onLine);addEventListener('online',update);addEventListener('offline',update);return()=>{removeEventListener('online',update);removeEventListener('offline',update);};},[]);return offline?<p role="status" className="experience-notice">You’re offline. Your draft is here; reconnect when you’re ready.</p>:null;}
export class FeatureBoundary extends React.Component<{children:any;onExit?:()=>void},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){console.error(JSON.stringify({event:'aelio_view_failed'}));}
 render(){return this.state.failed?<section role="alert" className="panel"><h2>Let’s try that again.</h2><p>This part of your space needs a moment. Your drafts are still here.</p><button onClick={()=>this.setState({failed:false})}>Try again</button>{this.props.onExit&&<button onClick={this.props.onExit}>Back home</button>}</section>:this.props.children;}
}
