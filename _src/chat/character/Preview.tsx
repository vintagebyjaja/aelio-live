import React,{useEffect,useRef}from'react';
import * as T from'three';
import {OrbitControls}from'three/addons/controls/OrbitControls.js';
import {RoomEnvironment}from'three/addons/environments/RoomEnvironment.js';
import {characterModel,disposeCharacter}from'./model';
import type{CharacterConfig}from'../../shared/character.js';
export default function CharacterPreview({config,onReady,onUnavailable}:any){
 const host=useRef<HTMLDivElement|null>(null),update=useRef<(c:CharacterConfig)=>void>(()=>{}),current=useRef(config),callbacks=useRef({onReady,onUnavailable});current.current=config;callbacks.current={onReady,onUnavailable};
 useEffect(()=>{update.current(config);},[config]);
 useEffect(()=>{
  const el=host.current!;let renderer:T.WebGLRenderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});}catch{callbacks.current.onUnavailable();return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.2:1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute('aria-label','Editable 3D custom character');renderer.domElement.setAttribute('role','img');el.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.05,40);camera.position.set(0,1.5,5.8);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.5,0);controls.enablePan=false;controls.minDistance=3.1;controls.maxDistance=8.5;controls.minPolarAngle=.9;controls.maxPolarAngle=1.85;controls.update();
  scene.add(new T.HemisphereLight(0xffedce,0x777689,2));const key=new T.DirectionalLight(0xffe5c5,3);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.setScalar(innerWidth<700?512:1024);key.shadow.normalBias=.018;scene.add(key);const rim=new T.DirectionalLight(0xffc886,2.4);rim.position.set(3,4,-3);scene.add(rim);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.7;room.dispose();pmrem.dispose();
  const floor=new T.Mesh(new T.CircleGeometry(.95,64),new T.ShadowMaterial({opacity:.3}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.005;scene.add(floor);
  let model:T.Group|null=null,frame=0,disposed=false;const draw=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(disposed)return;renderer.render(scene,camera);el.dataset.ready='true';});};
  function rebuild(c:CharacterConfig){if(model){scene.remove(model);disposeCharacter(model);}model=characterModel(c);scene.add(model);controls.target.y=1.5*c.height;controls.update();draw();}
  update.current=rebuild;rebuild(current.current);
  const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();draw();});resize.observe(el);controls.addEventListener('change',draw);
  const lost=(e:Event)=>{e.preventDefault();callbacks.current.onUnavailable();};renderer.domElement.addEventListener('webglcontextlost',lost);
  callbacks.current.onReady({rotate:(delta:number)=>{const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new T.Vector3(0,1,0),delta);camera.position.copy(controls.target).add(offset);controls.update();draw();},zoom:(ratio:number)=>{const offset=camera.position.clone().sub(controls.target);offset.setLength(Math.max(3.1,Math.min(8.5,offset.length()*ratio)));camera.position.copy(controls.target).add(offset);controls.update();draw();},capture:()=>new Promise<Blob>((resolve,reject)=>{if(disposed)return reject(Error('3D preview is not ready.'));cancelAnimationFrame(frame);const portrait=camera.clone();portrait.fov=25;portrait.aspect=1;portrait.position.set(0,2.4*current.current.height,4);portrait.lookAt(0,2.4*current.current.height,0);portrait.updateProjectionMatrix();const size=renderer.getSize(new T.Vector2());renderer.setSize(512,512,false);renderer.setClearColor(0x1b1714,1);renderer.render(scene,portrait);renderer.domElement.toBlob(blob=>{renderer.setClearColor(0x000000,0);renderer.setSize(size.x,size.y);draw();if(blob)resolve(blob);else reject(Error('Could not capture your character portrait.'));},'image/png');})});
  return()=>{disposed=true;cancelAnimationFrame(frame);callbacks.current.onReady(null);resize.disconnect();controls.removeEventListener('change',draw);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);if(model)disposeCharacter(model);floor.geometry.dispose();(floor.material as T.Material).dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();update.current=()=>{};};
 },[]);
 return <div className="character-live-preview" ref={host}/>;
}
