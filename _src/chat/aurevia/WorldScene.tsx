import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {PLAZA_VIEWS,plazaStep,plazaWalkable} from '../../shared/aurevia-plaza.js';
import {plazaMaterials} from './plaza/materials';
import {architecture} from './plaza/architecture';
import {landscape} from './plaza/landscape';
import {landmark} from './plaza/landmark';
import {coastalArchitecture,principalOffice} from './plaza/coastal';

type Props={quality:string;mode:string;view:string;onUnavailable:()=>void;location?:string};
export default function WorldScene({quality,mode,view,onUnavailable,location="plaza"}:Props){
 const host=useRef<HTMLDivElement|null>(null),move=useRef(new Set<string>()),changeView=useRef<(v:string)=>void>(()=>{}),changeMode=useRef<(v:string)=>void>(()=>{});
 const [ready,setReady]=useState(false);
 useEffect(()=>changeView.current(view),[view]);
 useEffect(()=>changeMode.current(mode),[mode]);
 useEffect(()=>{
  const el=host.current!;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{onUnavailable();return;}
  setReady(false);const low=quality==='low',high=quality==='high';
  renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:high?1.8:1.35));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label',location==='office'?"Principal’s Office overlooking Orb Plaza, AUREVIA":'Orb Plaza, AUREVIA');renderer.domElement.setAttribute('role','img');el.prepend(renderer.domElement);
  const scene=new T.Scene();scene.fog=new T.FogExp2(0xc4d6da,.0013);const camera=new T.PerspectiveCamera(55,1,.15,1600);camera.rotation.order='YXZ';
  const sunVector=new T.Vector3(-.7,.24,.6).normalize();
  const sky=new Sky();sky.scale.setScalar(1000);sky.material.uniforms.turbidity.value=3.5;sky.material.uniforms.rayleigh.value=1.8;sky.material.uniforms.mieCoefficient.value=.004;sky.material.uniforms.mieDirectionalG.value=.82;sky.material.uniforms.sunPosition.value.copy(sunVector);scene.add(sky);
  const clouds=new T.Mesh(new T.SphereGeometry(800,48,24),new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,uniforms:{sun:{value:sunVector}},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDirection;uniform vec3 sun;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 float fbm(vec2 p){float n=0.;float a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+vec2(12.3,4.7);a*=.5;}return n;}
 void main(){vec3 d=normalize(vDirection);vec2 p=d.xz/(max(d.y,0.)+.14)*1.5;float density=smoothstep(.43,.73,fbm(p));density*=smoothstep(0.,.13,d.y);float light=fbm(p+vec2(.16,.1));vec3 col=mix(vec3(.56,.64,.7),vec3(1.,.91,.76),light*.8+.25);gl_FragColor=vec4(col,density*.9);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}));clouds.renderOrder=1;scene.add(clouds);
  scene.add(new T.HemisphereLight(0xd6e9ff,0x9c9478,.65));
  const sun=new T.DirectionalLight(0xffd6a0,3.7);sun.position.copy(sunVector).multiplyScalar(90);sun.castShadow=true;sun.shadow.mapSize.setScalar(low?1024:high?4096:2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
  const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
  const materials=plazaMaterials(),kit=architecture(scene,materials,location==='plaza'),coast=landscape(scene,materials,quality,sunVector),orb=location==='plaza'?landmark(scene,materials,kit,low):{update:(_time:number)=>{},dispose:()=>{}};if(location==='plaza')coastalArchitecture(materials,kit);else principalOffice(scene,materials,kit);kit.finish();
  const targetPosition=new T.Vector3(),targetRotation=new T.Quaternion();let transitioning=false,interaction=location==='plaza'&&mode==='explore',staticFrame=0;const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
  function cameraView(id:string,immediate=false){staticFrame=0;const shot=location==='office'?{position:[-29,17.1,-18],look:[-22,17.8,5]}:PLAZA_VIEWS[id]||PLAZA_VIEWS.arrival;targetPosition.fromArray(shot.position);const temp=camera.clone();temp.position.copy(targetPosition);temp.lookAt(new T.Vector3().fromArray(shot.look));targetRotation.copy(temp.quaternion);if(immediate||reducedQuery.matches){camera.position.copy(targetPosition);camera.quaternion.copy(targetRotation);transitioning=false;}else transitioning=true;}
  function setMode(v:string){staticFrame=0;interaction=location==='plaza'&&v==='explore';move.current.clear();if(interaction){const current=[camera.position.x,2.1,camera.position.z];if(plazaWalkable(current))camera.position.fromArray(current);else{camera.position.set(9,2.1,16);camera.lookAt(0,4,-3);}transitioning=false;}}
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
 },[quality,location]);
 return <div className="aurevia-scene-wrap"><div className="aurevia-scene" ref={host} tabIndex={0} aria-label="Explore Orb Plaza. Drag to look. W A S D or arrow keys to walk."/>{!ready&&<p role="status">Opening Orb Plaza…</p>}{location==='plaza'&&mode==='explore'&&<><div className="aurevia-move" role="group" aria-label="Walking controls">{[['w','Forward','↑'],['a','Left','←'],['s','Back','↓'],['d','Right','→']].map(([key,label,icon])=><button key={key} aria-label={'Walk '+label} onPointerDown={(e:any)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);move.current.add(key);}} onPointerUp={()=>move.current.delete(key)} onPointerCancel={()=>move.current.delete(key)} onLostPointerCapture={()=>move.current.delete(key)} onKeyDown={(e:any)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();move.current.add(key);}}} onKeyUp={()=>move.current.delete(key)} onBlur={()=>move.current.delete(key)}>{icon}</button>)}</div><p className="aurevia-scene-note">Drag to look · WASD / arrows to walk</p></>}</div>;
}
