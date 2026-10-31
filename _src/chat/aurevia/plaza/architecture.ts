import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {PlazaMaterials} from './materials';

// A single authored plaza kit: dimensional arch openings, curved glass and stepped cornices.
// Static architectural parts batch by material; this avoids one draw call per detail.
export function architecture(scene:T.Scene,m:PlazaMaterials,buildPlaza=true){
 const batches=new Map<T.Material,T.BufferGeometry[]>();
 function add(geometry:T.BufferGeometry,material:T.Material,position:T.Vector3,rotation=new T.Euler(),scale=new T.Vector3(1,1,1)){
  const matrix=new T.Matrix4().compose(position,new T.Quaternion().setFromEuler(rotation),scale);geometry.applyMatrix4(matrix);
  if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
  const list=batches.get(material)||[];list.push(geometry);batches.set(material,list);
 }
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material=m.stone,angle=0)=>add(new T.BoxGeometry(w,h,d),mat,new T.Vector3(x,y,z),new T.Euler(0,angle,0));
 const cylinder=(r:number,h:number,x:number,y:number,z:number,mat:T.Material=m.stone)=>add(new T.CylinderGeometry(r,r,h,64),mat,new T.Vector3(x,y,z));
 function arch(w:number,h:number,thickness:number,depth:number){
  const outer=w/2+thickness,inner=w/2,base=h-w/2;
  const shape=new T.Shape();shape.moveTo(-outer,0);shape.lineTo(outer,0);shape.lineTo(outer,base);shape.absarc(0,base,outer,0,Math.PI,false);shape.lineTo(-outer,0);
  const hole=new T.Path();hole.moveTo(-inner,0);hole.lineTo(-inner,base);hole.absarc(0,base,inner,Math.PI,0,true);hole.lineTo(inner,0);hole.lineTo(-inner,0);shape.holes.push(hole);
  return new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.055,bevelThickness:.055,curveSegments:24});
 }
 // Colonnade follows a real arc around the plaza, framing the Orb against the ocean.
 if(buildPlaza){
 const radius=24;
 for(let i=0;i<15;i++){
  const a=-1.6+i*3.2/14;
  // Leave the seaward entrance open; both views render these exact same meshes.
  const x=Math.sin(a)*radius,z=-Math.cos(a)*radius;
  const rotation=new T.Euler(0,-a,0);
  add(arch(4.05,7.7,.55,1.5),m.stone,new T.Vector3(x,0,z),rotation);
  add(arch(3.94,7.6,.075,.12),m.gold,new T.Vector3(x+Math.sin(a)*.12,.02,z-Math.cos(a)*.12),rotation);
  for(const side of [-1,1]){
   const offset=new T.Vector3(side*2.7,0,0).applyEuler(rotation);
   box(.13,6.4,.1,x+offset.x,3.2,z+offset.z,m.gold,-a);
  }
  const crown=new T.Vector3(0,8.9,.65).applyEuler(rotation);box(5.7,.32,2.8,x+crown.x,8.9,z+crown.z,m.stone,-a);box(5.7,.09,2.9,x+crown.x,9.12,z+crown.z,m.gold,-a);
  // Recessed glass creates depth beyond the open arcade, with vertical mullions.
  if(i>1&&i<13){const glass=new T.CylinderGeometry(27.8,27.8,6.8,12,1,true,a-.10,.20);add(glass,m.glass,new T.Vector3(0,4.8,0),new T.Euler(0,Math.PI,0));}
 }
 // Twin pavilion wings: swept terraces, copper domes, nested arch entrances.
 for(const side of [-1,1]){
  const x=side*22,z=-22;
  for(let floor=0;floor<3;floor++){
   const r=9-floor*1.5;const base=floor*3.6;
   add(new T.CylinderGeometry(r,r,.45,64,1,false,0,Math.PI*2),m.stone,new T.Vector3(x,base+.2,z));
   add(new T.TorusGeometry(r+.05,.06,5,80),m.gold,new T.Vector3(x,base+.48,z),new T.Euler(Math.PI/2,0,0));
   add(new T.CylinderGeometry(r-.8,r-.8,3,48,1,true),m.glass,new T.Vector3(x,base+1.9,z));
   for(let n=0;n<12;n++){const a=n/12*Math.PI*2;box(.12,3.2,.12,x+Math.sin(a)*(r-.7),base+1.9,z+Math.cos(a)*(r-.7),m.gold);}
  }
  const dome=new T.SphereGeometry(5.9,48,24,0,Math.PI*2,0,Math.PI/2);add(dome,m.darkGold,new T.Vector3(x,11.3,z),new T.Euler(),new T.Vector3(1,.43,1));
  for(let n=0;n<16;n++){const curve=new T.EllipseCurve(0,0,5.95,2.57,0,Math.PI/2,false,0);const points=curve.getPoints(24).map(p=>new T.Vector3(p.x,p.y,0));const rib=new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.035,4,false);add(rib,m.gold,new T.Vector3(x,11.3,z),new T.Euler(0,n/16*Math.PI*2,0));}
  add(arch(4.8,8.4,.75,2),m.stone,new T.Vector3(x,0,-13.5));add(arch(4.7,8.3,.12,.1),m.gold,new T.Vector3(x,.02,-13.65));
 }
 // Terraced stone promenade, inset floor bands and curved glass balustrades.
 for(let tier=0;tier<4;tier++){
  const r=31.8+tier*2.3,y=-tier*.8;
  add(new T.CylinderGeometry(r,r,.5,128),m.pavement,new T.Vector3(0,y-.3,0));
  add(new T.TorusGeometry(r,.07,5,160),m.gold,new T.Vector3(0,y,0),new T.Euler(Math.PI/2,0,0));
 }
 // Main deck sits above the lower seaward terraces.
 cylinder(31.5,.4,0,-.2,0,m.pavement);
 for(const r of [8,13.5,20.2,29.9])add(new T.TorusGeometry(r,.035,4,160),m.darkGold,new T.Vector3(0,.025,0),new T.Euler(Math.PI/2,0,0));
 for(let n=0;n<48;n++){
  const a=n/48*Math.PI*2;const r=31;
  cylinder(.035,1.1,Math.sin(a)*r,.55,Math.cos(a)*r,m.gold);
 }
 add(new T.CylinderGeometry(31,31,.92,128,1,true,0,Math.PI*2),m.glass,new T.Vector3(0,.55,0));
 add(new T.TorusGeometry(31,.045,5,160),m.gold,new T.Vector3(0,1.1,0),new T.Euler(Math.PI/2,0,0));
 // Radial pavement joints are real geometry, not a flat photographic texture.
 for(let n=0;n<36;n++){const a=n/36*Math.PI*2;box(.018,.008,23,Math.sin(a)*19.5,.022,Math.cos(a)*19.5,m.darkGold,a);}
 // Sculptural benches and warm floor lights outside the safe walking ring.
 for(let i=0;i<12;i++){
  const a=i/12*Math.PI*2,x=Math.sin(a)*16,z=Math.cos(a)*16;
  if(z>8)continue;box(3,.45,1,x,.5,z,m.stone,a);box(2.8,.09,.8,x,.77,z,m.darkGold,a);
  cylinder(.12,.18,x,.12,z+1.4,m.light);
 }
 }
 function finish(){for(const [mat,geometries] of batches){const geometry=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g),false);if(!geometry)throw Error('Could not build the plaza architecture');const mesh=new T.Mesh(geometry,mat);mesh.castShadow=mat!==m.glass;mesh.receiveShadow=true;scene.add(mesh);geometries.forEach(g=>g.dispose());}batches.clear();}
 return {add,box,cylinder,arch,finish};
}
