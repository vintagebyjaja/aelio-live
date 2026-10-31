import * as T from 'three';
import type {PlazaMaterials} from './materials';
import type {architecture} from './architecture';

export function landmark(scene:T.Scene,m:PlazaMaterials,kit:ReturnType<typeof architecture>,low:boolean){
 // Human-scaled 6m armillary monument, with a latticed champagne-gold shell and radiant core.
 for(let i=0;i<5;i++){const r=4.4-i*.3;kit.cylinder(r,.15,0,.08+i*.15,0,i%2?m.stone:m.darkGold);}
 kit.cylinder(1.5,.65,0,1.05,0,m.darkGold);kit.cylinder(1.35,.08,0,1.4,0,m.light);
 const monument=new T.Group();monument.position.set(0,4.8,0);scene.add(monument);
 const gold=new T.MeshPhysicalMaterial({color:0xe4b85c,metalness:.93,roughness:.19,clearcoat:1,clearcoatRoughness:.12});
 const inner=new T.Mesh(new T.SphereGeometry(2.7,64,48),new T.MeshPhysicalMaterial({color:0x785722,metalness:.76,roughness:.13,transparent:true,opacity:.32,side:T.DoubleSide,clearcoat:1}));monument.add(inner);
 const ringMaterial=gold;
 for(let i=0;i<4;i++){
  const orbit=new T.Mesh(new T.TorusGeometry(3.05+i*.055,.045+i*.01,8,160),ringMaterial);orbit.rotation.set(.3+i*.62,.4+i*.4,.25+i*.6);orbit.castShadow=true;monument.add(orbit);
 }
 // Longitude ribs and latitude lines form a detailed globe rather than a solid orange ball.
 for(let n=0;n<18;n++){const meridian=new T.Mesh(new T.TorusGeometry(2.72,.012,4,96),m.gold);meridian.rotation.y=n/18*Math.PI;monument.add(meridian);}
 for(let n=-3;n<=3;n++){const y=n*.6,r=Math.sqrt(2.72**2-y*y);const latitude=new T.Mesh(new T.TorusGeometry(r,.014,4,96),m.gold);latitude.rotation.x=Math.PI/2;latitude.position.y=y;monument.add(latitude);}
 const core=new T.Mesh(new T.SphereGeometry(.42,32,24),new T.MeshStandardMaterial({color:0xffe0a2,emissive:0xffb34b,emissiveIntensity:6,roughness:.2}));monument.add(core);
 // A softly luminous, view-facing halo follows the real core; no postprocessed screenshot.
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const ctx=glowCanvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,231,175,1)');gradient.addColorStop(.15,'rgba(255,190,75,.55)');gradient.addColorStop(.5,'rgba(255,151,30,.10)');gradient.addColorStop(1,'rgba(255,151,30,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const glowTexture=new T.CanvasTexture(glowCanvas);const glow=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:0xffdca0,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));glow.scale.set(5,5,1);monument.add(glow);
 const points:number[]=[];for(let i=0;i<(low?120:350);i++){const phi=i*2.399963,r=1.4+Math.sin(i*3.1)*1.25,y=((i*79)%100)/100*4.6-2.3;points.push(Math.cos(phi)*r,y,Math.sin(phi)*r);}
 const particles=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3)),new T.PointsMaterial({color:0xffdf8b,size:.035,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));monument.add(particles);
 const lamp=new T.PointLight(0xffbf5b,50,15,2);lamp.position.copy(monument.position);scene.add(lamp);
 // Inlaid compass and radial filigree anchor the monument in the plaza architecture.
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;kit.box(.025,.015,2.3,Math.sin(a)*6.2,.05,Math.cos(a)*6.2,m.gold,a);}
 const starShape=new T.Shape();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=i%2?.11:.48;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)starShape.moveTo(x,y);else starShape.lineTo(x,y);}starShape.closePath();const star=new T.Mesh(new T.ShapeGeometry(starShape),m.light);star.position.set(0,4.8,2.74);monument.add(star);star.position.set(0,0,2.74);
 return {update:(time:number)=>{particles.rotation.y=time*.025;},dispose:()=>glowTexture.dispose()};
}
