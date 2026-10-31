import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {PlazaMaterials} from './materials';
import type {architecture} from './architecture';

// World-space architecture, shared by the plaza and office cameras. Scenic districts
// stay closed; these meshes never imply working University/Harbor services.
export function coastalArchitecture(m:PlazaMaterials,kit:ReturnType<typeof architecture>){
 const {add,box,cylinder,arch}=kit;
 const at=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
 function band(r:number,x:number,y:number,z:number){add(new T.TorusGeometry(r,.055,5,72),m.gold,at(x,y,z),new T.Euler(Math.PI/2,0,0));}
 function pavilion(x:number,z:number,base:number,r:number,floors:number){
  for(let f=0;f<floors;f++){
   const y=base+f*3.6,rad=r-f*.38;
   cylinder(rad+.7,.32,x,y,z);band(rad+.7,x,y+.2,z);
   add(new T.CylinderGeometry(rad-.25,rad-.25,3.25,48,1,true),m.glass,at(x,y+1.8,z));
   for(let n=0;n<14;n++){const a=n/14*Math.PI*2;box(.18,3.4,.18,x+Math.cos(a)*rad,y+1.8,z+Math.sin(a)*rad);}
   cylinder(rad+.6,.16,x,y+3.45,z);band(rad+.6,x,y+3.55,z);
  }
  const top=base+floors*3.6,rad=r-floors*.38+.45;
  add(new T.SphereGeometry(rad,48,20,0,Math.PI*2,0,Math.PI/2),m.gold,at(x,top,z),new T.Euler(),at(1,.42,1));
  for(let n=0;n<12;n++){const points=[];for(let i=0;i<=20;i++){const a=i/20*Math.PI/2;points.push(at(Math.cos(a)*rad,Math.sin(a)*rad*.43,0));}add(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.045,4,false),m.darkGold,at(x,top,z),new T.Euler(0,n/12*Math.PI*2,0));}
 }
 // Linked cliff-side terraces rise inland rather than floating on unrelated islands.
 for(const [x,z,y,r] of [[-18,-52,5,24],[24,-61,10,28],[54,-91,18,32],[-45,-89,8,26]]){
  for(let t=0;t<3;t++){cylinder(r-t*.9,.6,x,y+t*.5,z,m.stone);band(r-t*.9,x,y+t*.5+.35,z);}
  for(let i=0;i<9;i++){const a=(i/8)*Math.PI;const ax=x+Math.cos(a)*(r-1),az=z+Math.sin(a)*(r-1);add(arch(3.2,5,.32,.7),m.stone,at(ax,y+1.3,az),new T.Euler(0,-a+Math.PI/2,0));}
 }
 pavilion(-19,-54,6.5,8,3);pavilion(24,-68,11.5,11,4);pavilion(54,-99,19.5,12,4);pavilion(-44,-91,9.5,8,3);
 // Slender ivory spires with recessed champagne fins; linked architectural language.
 for(let i=0;i<11;i++){
  const x=-38+i*9,z=-100-Math.sin(i*1.8)*15,base=10+Math.max(0,x)*.15,h=18+((i*7)%17);
  box(3.5,h,4,x,base+h/2,z);box(2.4,h-.7,4.08,x,base+h/2,z,m.glass);
  for(const dx of [-1.7,1.7])box(.16,h+3,.2,x+dx,base+h/2+1.5,z+2.15,m.gold);
  box(3.9,.25,4.5,x,base+h,z,m.gold);
 }
 // Bridges are real three-dimensional decks and arches, tied to the peninsula.
 for(const [x,y,z,w]of [[0,1,-35,10],[5,8,-55,16],[39,15,-82,14]]){
  box(w,.6,6,x,y,z);box(w,.08,.12,x,y+.38,z+2.7,m.gold);box(w,.08,.12,x,y+.38,z-2.7,m.gold);
  for(let i=0;i<4;i++)add(arch(2.5,5,.4,5.5),m.stone,at(x-w/2+i*3.3,y-5,z-2.5));
 }
 return {pavilion};
}

export function principalOffice(scene:T.Scene,m:PlazaMaterials,kit:ReturnType<typeof architecture>){
 const {add,box,cylinder,arch}=kit;
 const x=-24,z=-13,y=15,at=(dx:number,dy:number,dz:number)=>new T.Vector3(x+dx,y+dy,z+dz);
 // An actual room above the west pavilion, with open panoramic arch windows.
 box(25,.45,20,x,y,z);box(26,.28,21,x,y+8,z);box(25,8,.5,x,y+4,z-10);
 box(.5,8,20,x-12.5,y+4,z);
 for(let n=0;n<3;n++){
  add(arch(5.9,7.5,.3,.5),m.stone,at(12.25,0,-6.4+n*6.4),new T.Euler(0,Math.PI/2,0));
  add(arch(5.85,7.45,.055,.12),m.gold,at(12.8,.02,-6.4+n*6.4),new T.Euler(0,Math.PI/2,0));
 }
 const glazing=new T.MeshPhysicalMaterial({color:0x9bd5d9,transparent:true,opacity:.06,roughness:.09,metalness:.15,side:T.DoubleSide,depthWrite:false});
 add(new T.PlaneGeometry(24.8,7.4),glazing,at(0,3.7,9.15));
 add(new T.PlaneGeometry(19.8,7.4),glazing,at(12.1,3.7,0),new T.Euler(0,Math.PI/2,0));
 for(const dx of [-10,10])for(const dz of [-7,7])cylinder(.48,4.4,x+dx,y-2.2,z+dz);
 for(let n=0;n<3;n++){
   add(arch(6.25,7.5,.35,.5),m.stone,at(-8.4+n*8.4,0,9.4));
   add(arch(6.2,7.45,.07,.12),m.gold,at(-8.4+n*8.4,.02,9.95));
 }
 // Continuous cornice, illuminated ceiling coves and marble floor inlay.
 box(25,.12,.12,x,y+7.65,z+9.5,m.gold);
 for(const dz of [-8,8])box(23,.04,.09,x,y+7.65,z+dz,m.light);
 for(const dx of [-10,10])box(.025,.014,17,x+dx,y+.24,z,m.gold);
 for(const dz of [-7,7])box(20,.014,.025,x,y+.24,z+dz,m.gold);
 const grainCanvas=document.createElement('canvas');grainCanvas.width=512;grainCanvas.height=128;const gc=grainCanvas.getContext('2d')!;gc.fillStyle='#966c48';gc.fillRect(0,0,512,128);for(let n=0;n<240;n++){gc.strokeStyle=n%2?'#b88a5e40':'#4f321d30';gc.lineWidth=.2+n%3*.15;gc.beginPath();const yy=n*.55;gc.moveTo(0,yy);gc.bezierCurveTo(120,yy+Math.sin(n)*5,350,yy-2,512,yy+1);gc.stroke();}const grain=new T.CanvasTexture(grainCanvas);grain.colorSpace=T.SRGBColorSpace;m.textures.push(grain);
 const wood=new T.MeshStandardMaterial({color:0xe3bc88,map:grain,roughness:.35});
 const fabric=new T.MeshStandardMaterial({color:0xd7c5a8,roughness:.92});
 const rounded=(w:number,h:number,d:number,dx:number,dy:number,dz:number,mat:T.Material=m.stone)=>add(new RoundedBoxGeometry(w,h,d,5,Math.min(.18,h/3)),mat,at(dx,dy,dz));
 // Executive table and sculptural chairs are visible foreground geometry.
 rounded(6,.25,2.8,4,1.15,3,wood);rounded(1.8,1.1,1.5,4,.58,3);
 for(let i=0;i<3;i++){
  rounded(1.2,.24,1.2,1.8+i*2.1,.7,5.5,fabric);rounded(1.2,1.4,.24,1.8+i*2.1,1.15,6.1,fabric);cylinder(.4,.7,x+1.8+i*2.1,y+.35,z+5.5,m.gold);
 }
 const screen=new T.MeshPhysicalMaterial({color:0x28545b,roughness:.22,metalness:.45});
 rounded(1.1,.64,.06,4,1.75,3.5,screen);box(.05,.3,.08,x+4,y+1.4,z+3.5,m.gold);rounded(1.5,.035,.6,4,1.3,2.8,m.darkGold);
 for(let n=0;n<2;n++)rounded(.45,.06,.6,2.3,1.33+n*.065,2.9,n?m.stone:wood);
 // Low curved seating and a small table by the window.
 rounded(4.8,.5,1.8,-7,.65,4,fabric);rounded(4.8,.8,.35,-7,1.15,4.8,fabric);
 cylinder(1.2,.13,x-3,y+.8,z+5,m.darkGold);cylinder(.18,.7,x-3,y+.4,z+5,m.gold);
 // Restrained holographic companion core: decorative, never fake operational data.
 const holo=new T.Mesh(new T.IcosahedronGeometry(.65,3),new T.MeshPhysicalMaterial({color:0x5ccfdd,emissive:0x1e96a5,emissiveIntensity:.7,metalness:.4,roughness:.15,transparent:true,opacity:.7}));holo.position.copy(at(-3,1.8,5));scene.add(holo);
 for(let n=0;n<3;n++)add(new T.TorusGeometry(1.02,.012,5,64),m.gold,at(-3,1.8,5),new T.Euler(.5+n*.5,.4+n,.2));
 // Shelving against the rear wall, with bounded decorative books.
 for(let n=0;n<4;n++){box(10,.16,1,x-5,y+1.4+n*1.4,z-9,wood);for(let b=0;b<12;b++)box(.25,.7+(b%3)*.12,.5,x-9.3+b*.75,y+1.83+n*1.4,z-9,b%3?m.stone:m.gold);}
}
