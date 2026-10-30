import {useEffect,useRef,useState} from 'react';
import type {OrbControls} from './orb-renderer';
export type AelioOrbState='idle'|'listening'|'thinking'|'speaking'|'loading';
export function AelioOrb({state='idle',size,intensity=.35,audioLevel=0,interactive=false,small=false,reducedMotion=false}:{state?:AelioOrbState;size?:number;intensity?:number;audioLevel?:number;interactive?:boolean;small?:boolean;reducedMotion?:boolean}){
 const canvas=useRef<HTMLCanvasElement|null>(null),root=useRef<HTMLDivElement|null>(null),current=useRef<OrbControls>({state,intensity,audioLevel,reduced:reducedMotion,interactive});
 const [ready,setReady]=useState(false),[reduce,setReduce]=useState(reducedMotion);
 current.current={state,intensity,audioLevel,reduced:reduce||reducedMotion,interactive};
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion:reduce)');const update=()=>setReduce(query.matches||root.current?.closest('[data-motion]')?.getAttribute('data-motion')==='reduced');update();query.addEventListener('change',update);const observer=new MutationObserver(update);if(root.current?.closest('[data-motion]'))observer.observe(root.current.closest('[data-motion]')!,{attributes:true,attributeFilter:['data-motion']});return()=>{query.removeEventListener('change',update);observer.disconnect();};},[]);
 useEffect(()=>{
  if(small||(size!==undefined&&size<72))return;let active=true,dispose=()=>{};
  import('./orb-renderer').then(({renderOrb})=>{if(active&&canvas.current)dispose=renderOrb(canvas.current,()=>current.current,()=>setReady(true),()=>setReady(false));}).catch(()=>setReady(false));
  return()=>{active=false;dispose();};
 },[small,size,reduce,reducedMotion]);
 return <div ref={root} className={'aelio-orb '+(small?'orb-small':'')} style={{...(size?{width:size,height:size}:{}),"--orb-audio":Math.max(0,Math.min(1,audioLevel||0))} as any} data-state={state} data-renderer={ready?'webgl':'fallback'} data-reduced={reduce||reducedMotion?'true':'false'} role="img" aria-label={state==='idle'?'AELIO':`AELIO is ${state}`}>
 <span className="orb-metal"/><span className="orb-halo"/>{!small&&<canvas ref={canvas} className="orb-canvas" aria-hidden="true" style={{opacity:ready?1:0}}/>}
 </div>;
}
// A caller may pass a real microphone or playback MediaStream. No fabricated audio values.
export function useAudioLevel(stream:MediaStream|null){
 const [level,setLevel]=useState(0);
 useEffect(()=>{if(!stream||typeof AudioContext==='undefined')return;const context=new AudioContext(),analyser=context.createAnalyser(),source=context.createMediaStreamSource(stream);source.connect(analyser);analyser.fftSize=256;const values=new Uint8Array(analyser.fftSize);let frame=0,last=0;void context.resume().catch(()=>{});const sample=(now:number)=>{if(now-last>60){analyser.getByteTimeDomainData(values);const rms=Math.sqrt(values.reduce((sum,v)=>sum+((v-128)/128)**2,0)/values.length);setLevel(Math.min(1,rms*4));last=now;}frame=requestAnimationFrame(sample);};frame=requestAnimationFrame(sample);return()=>{cancelAnimationFrame(frame);source.disconnect();void context.close();setLevel(0);};},[stream]);return level;
}
