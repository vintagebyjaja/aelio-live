import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {destination,walkPosition} from '../../shared/aurevia.js';

// Procedural architecture study guided by the supplied images, not finished art/avatars.
export default function WorldScene({place,quality,onUnavailable}:any){
 const host=useRef<HTMLDivElement|null>(null),travel=useRef<(id:string)=>void>(()=>{}),move=useRef(new Set<string>());
 const [ready,setReady]=useState(false);
 useEffect(()=>travel.current(place),[place]);
 useEffect(()=>{
  const el=host.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:quality!=='low',powerPreference:'low-power'});}catch{onUnavailable();return;}
  setReady(false);renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?2:quality==='low'?1:1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label','AUREVIA coastal architecture study');renderer.domElement.setAttribute('role','img');el.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#9bb5c0');scene.fog=new THREE.Fog('#c4c8b8',65,180);
  const camera=new THREE.PerspectiveCamera(62,1,0.1,240);camera.rotation.order='YXZ';
  scene.add(new THREE.HemisphereLight(0xc8e6ff,0x8f7151,2.5));const sun=new THREE.DirectionalLight(0xffd6a0,3.5);sun.position.set(-45,38,30);scene.add(sun);
  const ivory=new THREE.MeshStandardMaterial({color:0xf1e1c7,roughness:.74});const bronze=new THREE.MeshStandardMaterial({color:0xb8894b,metalness:.8,roughness:.28});const stone=new THREE.MeshStandardMaterial({color:0xcec0a7,roughness:.9});const leaves=new THREE.MeshStandardMaterial({color:0x506b42,roughness:1});
  const waterMat=new THREE.MeshStandardMaterial({color:0x116c87,metalness:.35,roughness:.22});const sea=new THREE.Mesh(new THREE.PlaneGeometry(450,450),waterMat);sea.rotation.x=-Math.PI/2;sea.position.y=-5;scene.add(sea);
  const objects:THREE.Mesh[]=[];const obstacles:number[][]=[];
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);scene.add(o);objects.push(o);return o;}
  function cylinder(radius:number,height:number,x:number,y:number,z:number,m=ivory){return mesh(new THREE.CylinderGeometry(radius,radius,height,quality==='low'?24:48),m,x,y,z);}
  cylinder(49,5,0,-2.6,0,stone);cylinder(41,.35,0,.04,0);cylinder(10,.35,0,.35,0,bronze);cylinder(9.7,.2,0,.6,0);
  // AELIO remains a golden orb; there is no humanoid AELIO.
  const orb=mesh(new THREE.SphereGeometry(3.5,32,24),new THREE.MeshStandardMaterial({color:0xf8c263,emissive:0xd97c12,emissiveIntensity:.8,metalness:.85,roughness:.15}),0,6,0);
  for(let i=0;i<3;i++){const ring=mesh(new THREE.TorusGeometry(4.7,.1,8,80),bronze,0,6,0);ring.rotation.set(i*.65,0,i*.7);}
  cylinder(2.5,1,0,1,0,bronze);obstacles.push([-5,5,-5,5]);
  const buildings=[[-33,-12,10,8,14],[30,-28,15,12,18],[35,0,11,10,12],[-30,4,12,8,10],[0,-34,18,7,7]];
  for(const [x,z,w,d,h] of buildings){
   mesh(new THREE.BoxGeometry(w,h,d),ivory,x,h/2,z);obstacles.push([x-w/2,x+w/2,z-d/2,z+d/2]);
   mesh(new THREE.BoxGeometry(w+1,.25,d+1),bronze,x,h+.1,z);
   // Bronze-lined colonnades and domes establish the Mediterranean reference vocabulary.
   for(let n=-1;n<=1;n++){cylinder(.35,h*.75,x+n*w/3,h*.375,z+d/2+.8,bronze);const arch=mesh(new THREE.TorusGeometry(w/6,.2,8,24,Math.PI),bronze,x+n*w/3,h*.75,z+d/2+.8);arch.rotation.z=0;}
   const dome=mesh(new THREE.SphereGeometry(Math.min(w,d)*.42,24,12,0,Math.PI*2,0,Math.PI/2),ivory,x,h+.2,z);dome.scale.y=.6;
  }
  // Coastal terraces, harbor walkways, restrained foliage and waterfall planes.
  for(const side of [-1,1]){
   for(let n=0;n<5;n++){const z=side*25,x=-15+n*7;const trunk=cylinder(.18,3,x,1.5,z,stone);mesh(new THREE.SphereGeometry(1.5,12,8),leaves,trunk.position.x,3.4,z);}
   for(let n=0;n<3;n++)cylinder(8-n,.45,side*23,-n*.55-.2,side*22,stone);
  }
  mesh(new THREE.BoxGeometry(7,.3,17),ivory,0,-.05,43);
  const falls:THREE.Mesh[]=[];for(let n=0;n<4;n++){const m=new THREE.MeshStandardMaterial({color:0xc2eaff,transparent:true,opacity:.58,roughness:.3,side:THREE.DoubleSide});falls.push(mesh(new THREE.PlaneGeometry(1.4,6),m,-18+n*12,-2,48));}
  // Ocean glints are static geometry; motion is subtle and disabled for reduced motion.
  const glints=new THREE.Group();for(let n=0;n<50;n++){const g=new THREE.Mesh(new THREE.PlaneGeometry(1+(n%4),.08),new THREE.MeshBasicMaterial({color:0xf6d298,transparent:true,opacity:.22}));g.rotation.x=-Math.PI/2;g.position.set(-50+(n*17)%100,-4.95,55+(n*13)%100);glints.add(g);}scene.add(glints);
  const jump=(id:string)=>{const d=destination(id)||destination('plaza')!;camera.position.set(...d.position as [number,number,number]);camera.lookAt(...d.look as [number,number,number]);};travel.current=jump;jump(place);
  let drag:{x:number,y:number}|null=null;
  const down=(e:PointerEvent)=>{drag={x:e.clientX,y:e.clientY};el.setPointerCapture(e.pointerId);el.focus();};
  const pointer=(e:PointerEvent)=>{if(!drag)return;camera.rotation.y-=(e.clientX-drag.x)*.004;camera.rotation.x=Math.max(-1.1,Math.min(1.1,camera.rotation.x-(e.clientY-drag.y)*.003));drag={x:e.clientX,y:e.clientY};};
  const up=()=>drag=null;
  const keys=(e:KeyboardEvent)=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes((e.target as HTMLElement).tagName))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();move.current.add(k);}};
  const keyup=(e:KeyboardEvent)=>move.current.delete(e.key.toLowerCase());const clear=()=>{move.current.clear();drag=null;};
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',pointer);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('keydown',keys);el.addEventListener('keyup',keyup);el.addEventListener('blur',clear);
  const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(el);
  let frame=0,last=0,visible=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const observer=new IntersectionObserver(([e])=>visible=e.isIntersecting);observer.observe(el);
  function draw(now:number){frame=requestAnimationFrame(draw);if(document.hidden||!visible){last=now;return;}const dt=Math.min((now-last)/1000,.05);if(dt<(quality==='low'?1/30:1/60))return;last=now;const k=move.current;
   let f=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown')),s=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'));const len=Math.hypot(f,s)||1;f/=len;s/=len;const a=camera.rotation.y;const next=walkPosition(camera.position.toArray(),(-Math.sin(a)*f+Math.cos(a)*s)*dt*7,(-Math.cos(a)*f-Math.sin(a)*s)*dt*7,obstacles);camera.position.set(...next as [number,number,number]);
   if(!reduced){orb.rotation.y=now*.00012;falls.forEach((o,i)=>{(o.material as THREE.MeshStandardMaterial).opacity=.48+Math.sin(now*.001+i)*.08;});}renderer.render(scene,camera);
  }
  const lost=(e:Event)=>{e.preventDefault();onUnavailable();};renderer.domElement.addEventListener('webglcontextlost',lost);frame=requestAnimationFrame(draw);setReady(true);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();clear();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',pointer);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('keydown',keys);el.removeEventListener('keyup',keyup);el.removeEventListener('blur',clear);renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();const mats=Array.isArray(m.material)?m.material:[m.material];mats.forEach(m=>m?.dispose());});renderer.dispose();renderer.domElement.remove();travel.current=()=>{};};
 },[quality]);
 return <div className="aurevia-scene-wrap"><div className="aurevia-scene" ref={host} tabIndex={0} aria-label="Explore AUREVIA. Drag to look. W A S D or arrow keys to walk." />{!ready&&<p role="status">Preparing the coast…</p>}<div className="aurevia-move" role="group" aria-label="Walking controls">{[['w','Forward','↑'],['a','Left','←'],['s','Back','↓'],['d','Right','→']].map(([key,label,icon])=><button key={key} aria-label={'Walk '+label} onPointerDown={(e:any)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);move.current.add(key);}} onPointerUp={()=>move.current.delete(key)} onPointerCancel={()=>move.current.delete(key)} onLostPointerCapture={()=>move.current.delete(key)} onKeyDown={(e:any)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();move.current.add(key);}}} onKeyUp={()=>move.current.delete(key)} onBlur={()=>move.current.delete(key)}>{icon}</button>)}</div><p className="aurevia-scene-note">3D architecture study · drag to look · WASD / arrows to walk</p></div>;
}
