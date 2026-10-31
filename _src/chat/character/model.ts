import * as T from 'three';
import {RoundedBoxGeometry}from'three/addons/geometries/RoundedBoxGeometry.js';
import type{CharacterConfig}from'../../shared/character.js';
// Code-authored, parameterized adult humanoid. This is actual editable geometry,
// not the supplied character painting. Named body parts prepare later rig mapping;
// no rigged movement/cloth physics or reference-level production likeness is claimed.
export function characterModel(c:CharacterConfig){
 const root=new T.Group();root.name='aelio-humanoid-v1';
 const mat=(color:string,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const skin=mat(c.skin,.58),hair=mat(c.hairColor,.52),fabric=mat(c.clothingColor,.83),shirt=mat(c.outfit==='professional'?'#f0e8d8':'#f2e9d7',.82),shoe=mat(c.shoes==='formal'?'#33291f':c.shoes==='boots'?'#706052':'#e9e4da',.66),gold=mat('#d5ad66',.3,.8),dark=mat('#211b19',.65),white=mat('#f5eee3',.24);
 function mesh(g:T.BufferGeometry,m:T.Material,name:string,x:number,y:number,z:number,sx=1,sy=1,sz=1){const o=new T.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
 const sphere=(r:number,m:T.Material,name:string,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>mesh(new T.SphereGeometry(r,32,24),m,name,x,y,z,sx,sy,sz);
 function tube(points:number[][],radius:number,m:T.Material,name:string,segments=28){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])));return mesh(new T.TubeGeometry(curve,segments,radius,8,false),m,name,0,0,0);}
 function taper(a:number[],b:number[],r1:number,r2:number,m:T.Material,name:string){const start=new T.Vector3(...a as [number,number,number]),end=new T.Vector3(...b as [number,number,number]),delta=end.clone().sub(start);const g=new T.CylinderGeometry(r2,r1,delta.length(),24,14);const p=g.attributes.position;for(let i=0;i<p.count;i++){const t=p.getY(i)/delta.length()+.5,fold=m===fabric?1+.014*Math.sin(t*48+p.getX(i)*72):1+.04*Math.sin(t*Math.PI);p.setX(i,p.getX(i)*fold);p.setZ(i,p.getZ(i)*fold);}g.computeVertexNormals();const mid=start.add(end).multiplyScalar(.5);const o=mesh(g,m,name,mid.x,mid.y,mid.z);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
 function torso(profile:number[][],m:T.Material,name:string,sx=1,sz=.68){const g=new T.LatheGeometry(profile.map(p=>new T.Vector2(p[0],p[1])),64);return mesh(g,m,name,0,0,0,sx,1,sz);}
 const broad=c.body==='broad'?1.18:c.body==='slim'?.87:c.body==='athletic'?1.08:1,hips=(c.presentation==='feminine'?.265:.245)*(c.body==='curvy'?1.18:broad),waist=(c.presentation==='feminine'?.175:.23)*(c.body==='curvy'?1.05:broad),shoulder=(c.presentation==='masculine'?.34:.285)*broad;
 const legMaterial=c.outfit==='professional'?fabric:c.outfit==='athletic'?dark:fabric;
 for(const side of [-1,1]){
  const x=side*hips*.58;
  taper([x,.13,.015],[x, .67,-.015],.085*broad,.105*broad,c.outfit==='dress'?skin:legMaterial,'LowerLeg_'+side);taper([x,.67,-.015],[x*1.06,1.29,-.01],.105*broad,.145*broad,legMaterial,'UpperLeg_'+side);
  const foot=mesh(new RoundedBoxGeometry(.19*broad,c.shoes==='boots'?.24:.135,.39,5,.045),shoe,'Foot_'+side,x,c.shoes==='boots'?.12:.07,.09);foot.rotation.y=side*-.055;
  mesh(new RoundedBoxGeometry(.2*broad,.025,.4,3,.012),c.shoes==='formal'?dark:white,'Sole_'+side,x,.025,.09);
  if(c.shoes==='sneakers')for(let n=0;n<4;n++)tube([[x-.055,.139,.06+n*.035],[x,.15,.06+n*.035],[x+.055,.139,.06+n*.035]],.004,white,'Lace_'+side+'_'+n,8);
 }
 torso([[0,1.12],[hips*.8,1.12],[hips,1.25],[hips*.94,1.39],[waist*1.05,1.49],[0,1.49]],legMaterial,'Hips');
 torso([[0,1.4],[waist,1.4],[waist*.98,1.55],[shoulder*.87,1.93],[shoulder,2.075],[shoulder*.85,2.14],[.10,2.17],[0,2.17]],skin,'Torso');
 torso([[waist*1.13,1.39],[waist*1.06,1.58],[shoulder*.9,1.95],[shoulder*1.025,2.075],[.11,2.13]],c.outfit==='hoodie'?fabric:shirt,'Top');
 if(c.outfit==='dress')torso([[hips*1.6,.72],[hips*1.6,.75],[hips*1.1,1.22],[waist*1.04,1.55],[shoulder*.89,1.95],[.105,2.13]],fabric,'Dress');
 if(c.outfit==='professional'){
  const jacket=torso([[waist*1.16,1.37],[waist*1.2,1.43],[shoulder*1.02,1.9],[shoulder*1.1,2.11],[.115,2.16]],fabric,'Jacket');
  for(const side of [-1,1]){const shape=new T.Shape();shape.moveTo(side*.035,1.72);shape.lineTo(side*.16,2.09);shape.lineTo(side*.055,2.14);shape.lineTo(side*.018,1.74);const lapel=mesh(new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:2,steps:1}),fabric,'Lapel_'+side,0,0,.2);}
  for(let i=0;i<2;i++)sphere(.012,gold,'JacketButton_'+i,.028,1.49+i*.12,.155);
 }
 taper([0,2.10,0],[0,2.38,0],.095,.105,skin,'Neck');
 for(const side of [-1,1]){
  const sleeve=c.outfit==='hoodie'||c.outfit==='professional'?fabric:skin;
  taper([side*shoulder*.96,2.055,0],[side*(shoulder+.08),1.62,.025],.08*broad,.061*broad,sleeve,'UpperArm_'+side);taper([side*(shoulder+.08),1.62,.025],[side*(shoulder+.095),1.25,.075],.061*broad,.043*broad,sleeve,'Forearm_'+side);
  const handX=side*(shoulder+.10);sphere(.075,skin,'Hand_'+side,handX,1.17,.075,.65,1,.48);
  for(let f=0;f<4;f++){const fx=handX+(f-1.5)*.021;const len=.095-(Math.abs(f-1.5)*.017);taper([fx,1.15,.09],[fx,1.15-len,.10],.010,.008,skin,'Finger_'+side+'_'+f);sphere(.009,skin,'FingerTip_'+side+'_'+f,fx,1.15-len,.10);}
  taper([handX-side*.03,1.205,.11],[handX-side*.07,1.15,.14],.016,.012,skin,'Thumb_'+side);
 }
 const headScale=c.style==='cartoon'?1.14:c.style==='anime'?1.08:c.style==='realistic'?.95:1.04;
 const head=new T.Group();head.name='Head';head.position.set(0,2.58,0);head.scale.setScalar(headScale);root.add(head);
 function faceMesh(g:T.BufferGeometry,m:T.Material,name:string,x:number,y:number,z:number,sx=1,sy=1,sz=1){const o=new T.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;head.add(o);return o;}
 const skull=new T.SphereGeometry(.285,64,48),sp=skull.attributes.position;
 for(let i=0;i<sp.count;i++){let x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i),t=y/.285;const jaw=t<-.2?(c.face==='defined'?.93:c.face==='round'?.94:c.face==='heart'?.65:.75)+.17*(t+1):1;const brow=1+(c.jaw-.5)*.13;sp.setXYZ(i,x*jaw*brow,y*(c.face==='round'?1.12:1.22),z*(z>0?.86:1.01)+(z>0?.016*Math.exp(-Math.pow((y+.04)/.09,2)):0));}skull.computeVertexNormals();faceMesh(skull,skin,'SculptedHead',0,0,0);
 const iris=new T.MeshPhysicalMaterial({color:c.eyeColor,roughness:.2,clearcoat:1}),pupil=mat('#100c0a',.15),lip=new T.MeshStandardMaterial({color:new T.Color(c.skin).multiplyScalar(.64).lerp(new T.Color('#a05d51'),.45),roughness:.63});
 const eyeScale=(c.style==='anime'?1.22:c.style==='cartoon'?1.14:c.style==='realistic'?.92:1.04),eyeX=.103+(c.eyes-.5)*.024;
 for(const side of [-1,1]){
  faceMesh(new T.SphereGeometry(.062,32,24),white,'EyeWhite_'+side,side*eyeX,.022,.235,eyeScale,.68*eyeScale,.49);
  faceMesh(new T.SphereGeometry(.028,32,20),iris,'Iris_'+side,side*eyeX,.022,.264,eyeScale,eyeScale,.23);
  faceMesh(new T.SphereGeometry(.013,24,16),pupil,'Pupil_'+side,side*eyeX,.022,.273,eyeScale,eyeScale,.25);
  faceMesh(new T.SphereGeometry(.006,16,12),white,'Catchlight_'+side,side*eyeX-.009,.033,.279);
  const brow=new T.CatmullRomCurve3([new T.Vector3(side*(eyeX-.048),.101,.243),new T.Vector3(side*eyeX,.119,.255),new T.Vector3(side*(eyeX+.047),.103,.229)]);faceMesh(new T.TubeGeometry(brow,24,.008,6,false),hair,'Eyebrow_'+side,0,0,0);
  faceMesh(new T.SphereGeometry(.055,28,20),skin,'Ear_'+side,side*.279,-.025,-.004,.45,1,.65);
 }
 faceMesh(new T.SphereGeometry(.039,32,24),skin,'NoseBridge',0,-.032,.248,.63,1.5,.7+c.nose*.55);faceMesh(new T.SphereGeometry(.032,28,20),skin,'NoseTip',0,-.073,.27,.86,.65,.75+c.nose*.6);
 const mouth=(y:number,r:number,lower=false)=>{const curve=new T.CatmullRomCurve3([new T.Vector3(-.058,y,.228),new T.Vector3(-.025,y+(lower?-.009:.004),.247),new T.Vector3(0,y+(lower?-.014:.002),.251),new T.Vector3(.025,y+(lower?-.009:.004),.247),new T.Vector3(.058,y,.228)]);faceMesh(new T.TubeGeometry(curve,30,r,8,false),lip,lower?'LowerLip':'UpperLip',0,0,0);};mouth(-.139,.009);mouth(-.145,.011,true);
 if(c.hair!=='bald'){
  const cap=new T.SphereGeometry(.296,48,30,0,Math.PI*2,0,Math.PI*.46);faceMesh(cap,hair,'HairCap',0,.045,-.025,1.03,1.18,1.01);
  const short=['short','curls','bun'].includes(c.hair),bob=c.hair==='bob';
  for(let n=0;n<(short?48:36);n++){
   const a=(n/(short?48:36))*Math.PI*2,back=Math.cos(a),start=new T.Vector3(Math.sin(a)*.267,.19+Math.abs(Math.cos(a))*.09,Math.cos(a)*.247-.025);
   if(back>.1&&Math.abs(start.x)<.18&&!short)continue;
   const points=[];const len=short?.16:bob?.38:.72;for(let j=0;j<=18;j++){const t=j/18,amp=c.texture==='straight'?.008:c.texture==='coily'?.035:.022;const wave=Math.sin(t*(c.texture==='coily'?40:13)+n)*amp;points.push(new T.Vector3(start.x*(1+t*.26)+wave,start.y-t*len,start.z+(back<0?-.02:.015)*t+Math.cos(t*13+n)*amp));}
   faceMesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),36,c.hair==='braids'?.023:short?.035:.027,8,false),hair,'HairStrand_'+n,0,0,0);
  }
  if(c.hair==='bun'){for(let n=0;n<14;n++){const a=n/14*Math.PI*2;const curve=new T.CatmullRomCurve3(Array.from({length:25},(_,i)=>{const t=i/24*Math.PI*2;return new T.Vector3(Math.cos(t)*(.11+n*.002),.27+Math.sin(t)*.08,-.22+Math.sin(t*2+a)*.025);}));faceMesh(new T.TubeGeometry(curve,30,.025,8,true),hair,'TwistedBun_'+n,0,0,0);}}
 }
 if(c.accessories.includes('glasses')){for(const side of [-1,1]){faceMesh(new T.TorusGeometry(.076,.0045,6,48),gold,'Glasses_'+side,side*eyeX,.025,.285,1,.78,1);}const bridge=new T.CatmullRomCurve3([new T.Vector3(-.025,.027,.285),new T.Vector3(0,.037,.29),new T.Vector3(.025,.027,.285)]);faceMesh(new T.TubeGeometry(bridge,12,.004,5,false),gold,'GlassesBridge',0,0,0);}
 if(c.accessories.includes('hoops'))for(const side of [-1,1])faceMesh(new T.TorusGeometry(.057,.006,8,48),gold,'Earring_'+side,side*.286,-.12,.015,.7,1,1);
 if(c.accessories.includes('necklace')){const neck=new T.CatmullRomCurve3([new T.Vector3(-.10,2.12,.10),new T.Vector3(-.07,2.02,.18),new T.Vector3(0,1.98,.205),new T.Vector3(.07,2.02,.18),new T.Vector3(.10,2.12,.10)]);mesh(new T.TubeGeometry(neck,40,.004,5,false),gold,'Necklace',0,0,0);sphere(.018,gold,'Pendant',0,1.965,.21,1,1.4,.3);}
 if(c.accessories.includes('watch')){const w=mesh(new T.TorusGeometry(.046,.009,8,40),gold,'WatchStrap',-shoulder-.095,1.30,.075);w.rotation.x=Math.PI/2;mesh(new RoundedBoxGeometry(.054,.065,.018,3,.006),gold,'WatchFace',-shoulder-.095,1.30,.121);}
 root.scale.y=c.height;
 return root;
}
export function disposeCharacter(root:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();root.traverse(o=>{const m=o as T.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>materials.add(x));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
