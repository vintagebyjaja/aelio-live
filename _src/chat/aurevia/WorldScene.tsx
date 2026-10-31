import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {PLAZA_VIEWS,plazaStep,plazaWalkable} from '../../shared/aurevia-plaza.js';
import {plazaMaterials} from './plaza/materials';
import {architecture} from './plaza/architecture';
import {landscape} from './plaza/landscape';
import {landmark} from './plaza/landmark';

type Props={quality:string;mode:string;view:string;onUnavailable:()=>void};
export default function WorldScene({quality,mode,view,onUnavailable}:Props){
 const host=useRef<HTMLDivElement|null>(null),move=useRef(new Set<string>()),changeView=useRef<(v:string)=>void>(()=>{}),changeMode=useRef<(v:string)=>void>(()=>{});
 const [ready,setReady]=useState(false);
 useEffect(()=>changeView.current(view),[view]);
 useEffect(()=>changeMode.current(mode),[mode]);
 useEffect(()=>{
  const el=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{onUnavailable();return;}
  setReady(false);const low=quality==='low',high=quality==='high';
  renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:high?1.8:1.35));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','Orb Plaza, AUREVIA');renderer.domElement.setAttribute('role','img');el.prepend(renderer.domElement);
  const scene=new T.Scene();scene.fog=new T.FogExp2(0xc9a585,.0022);const camera=new T.PerspectiveCamera(55,1,.15,1600);camera.rotation.order='YXZ';
  const sunVector=new T.Vector3(-.8,.095,-.55).normalize();
  const sky=new T.Mesh(new T.SphereGeometry(1000,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sun:{value:sunVector}},vertexShader:'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',fragmentShader:`varying vec3 world;uniform vec3 sun;void main(){vec3 d=normalize(world-cameraPosition);float h=max(d.y,0.);vec3 color=mix(vec3(.94,.66,.43),vec3(.11,.28,.44),pow(h,.38));float glow=pow(max(dot(d,sun),0.),20.);color+=vec3(.55,.23,.06)*glow;float disk=smoothstep(.9996,.99985,dot(d,sun));gl_FragColor=vec4(mix(color,vec3(4.,2.3,.9),disk),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}));scene.add(sky);
  scene.add(new T.HemisphereLight(0xafc9dc,0x9c774b,.8));
  const sun=new T.DirectionalLight(0xffc27b,3.0);sun.position.copy(sunVector).multiplyScalar(90);sun.castShadow=true;sun.shadow.mapSize.setScalar(low?1024:high?4096:2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
  const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
  const materials=plazaMaterials(),kit=architecture(scene,materials),coast=landscape(scene,materials,quality,sunVector),orb=landmark(scene,materials,kit,low);kit.finish();
  const targetPosition=new T.Vector3(),targetRotation=new T.Quaternion();let transitioning=false,interaction=mode==='explore',staticFrame=0;const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
  function cameraView(id:string,immediate=false){staticFrame=0;const shot=PLAZA_VIEWS[id]||PLAZA_VIEWS.arrival;targetPosition.fromArray(shot.position);const temp=camera.clone();temp.position.copy(targetPosition);temp.lookAt(new T.Vector3().fromArray(shot.look));targetRotation.copy(temp.quaternion);if(immediate||reducedQuery.matches){camera.position.copy(targetPosition);camera.quaternion.copy(targetRotation);transitioning=false;}else transitioning=true;}
  function setMode(v:string){staticFrame=0;interaction=v==='explore';move.current.clear();if(interaction){const current=[camera.position.x,2.1,camera.position.z];if(plazaWalkable(current))camera.position.fromArray(current);else{camera.position.set(9,2.1,16);camera.lookAt(0,4,-3);}transitioning=false;}}
  changeView.current=(v)=>cameraView(v);changeMode.current=setMode;cameraView(view,true);if(interaction)setMode(mode);
  let drag:{x:number,y:number}|null=null;
  const down=(e:PointerEvent)=>{if(!interaction)return;drag={x:e.clientX,y:e.clientY};el.setPointerCapture(e.pointerId);el.focus();};
  const pointer=(e:PointerEvent)=>{if(!drag||!interaction)return;camera.rotation.y-=(e.clientX-drag.x)*.0035;camera.rotation.x=Math.max(-.95,Math.min(.95,camera.rotation.x-(e.clientY-drag.y)*.003));drag={x:e.clientX,y:e.clientY};};
  const up=()=>{drag=null;};
  const keys=(e:KeyboardEvent)=>{if(!interaction||['INPUT','SELECT','TEXTAREA','BUTTON'].includes((e.target as HTMLElement).tagName))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();move.current.add(k);}};
  const keyup=(e:KeyboardEvent)=>move.current.delete(e.key.toLowerCase()),clear=()=>{move.current.clear();drag=null;};
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',pointer);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('keydown',keys);el.addEventListener('keyup',keyup);el.addEventListener('blur',clear);window.addEventListener('blur',clear);
  const resize=new ResizeObserver(()=>{staticFrame=0;const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(el);
  let frame=0,last=0,visible=true,elapsed=0,failed=false,disposed=false;const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible)clear();});observer.observe(el);
  const contextLost=(e:Event)=>{e.preventDefault();failed=true;onUnavailable();};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const visibility=()=>{if(document.hidden)clear();};document.addEventListener('visibilitychange',visibility);
  function draw(now:number){
   if(disposed||failed)return;frame=requestAnimationFrame(draw);
   if(document.hidden||!visible){last=now;return;}
   const raw=(now-last)/1000;if(raw<(low?1/24:high?1/45:1/30))return;last=now;const dt=Math.min(raw,.05);elapsed+=dt;
   const moving=move.current.size>0;
   if(transitioning){const t=1-Math.exp(-dt*6);camera.position.lerp(targetPosition,t);camera.quaternion.slerp(targetRotation,t);if(camera.position.distanceTo(targetPosition)<.015)transitioning=false;}
   if(interaction&&moving){const k=move.current;let f=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown')),s=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'));const len=Math.hypot(f,s)||1;f/=len;s/=len;const a=camera.rotation.y;camera.position.fromArray(plazaStep(camera.position.toArray(),(-Math.sin(a)*f+Math.cos(a)*s)*dt*4,(-Math.cos(a)*f-Math.sin(a)*s)*dt*4));}
   if(!reducedQuery.matches){coast.update(elapsed);orb.update(elapsed);}else if(!moving&&!drag&&!transitioning&&staticFrame++>2)return;
   try{renderer.render(scene,camera);el.dataset.ready='true';}catch{failed=true;onUnavailable();}
  }
  frame=requestAnimationFrame(draw);setReady(true);
  return()=>{
   disposed=true;cancelAnimationFrame(frame);clear();resize.disconnect();observer.disconnect();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',pointer);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('keydown',keys);el.removeEventListener('keyup',keyup);el.removeEventListener('blur',clear);renderer.domElement.removeEventListener('webglcontextlost',contextLost);delete el.dataset.ready;
   coast.dispose();orb.dispose();const geometries=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();scene.traverse(o=>{const mesh=o as T.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>mats.add(m));});geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());materials.textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();changeView.current=()=>{};changeMode.current=()=>{};
  };
 },[quality]);
 return <div className="aurevia-scene-wrap"><div className="aurevia-scene" ref={host} tabIndex={0} aria-label="Explore Orb Plaza. Drag to look. W A S D or arrow keys to walk."/>{!ready&&<p role="status">Opening Orb Plaza…</p>}{mode==='explore'&&<><div className="aurevia-move" role="group" aria-label="Walking controls">{[['w','Forward','↑'],['a','Left','←'],['s','Back','↓'],['d','Right','→']].map(([key,label,icon])=><button key={key} aria-label={'Walk '+label} onPointerDown={(e:any)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);move.current.add(key);}} onPointerUp={()=>move.current.delete(key)} onPointerCancel={()=>move.current.delete(key)} onLostPointerCapture={()=>move.current.delete(key)} onKeyDown={(e:any)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();move.current.add(key);}}} onKeyUp={()=>move.current.delete(key)} onBlur={()=>move.current.delete(key)}>{icon}</button>)}</div><p className="aurevia-scene-note">Drag to look · WASD / arrows to walk</p></>}</div>;
}
