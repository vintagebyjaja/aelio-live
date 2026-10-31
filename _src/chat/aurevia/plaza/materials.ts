import * as T from 'three';

// Small deterministic PBR texture maps generated locally; no reference-image backdrop.
export function plazaMaterials(){
 const textures:T.Texture[]=[];
 function stoneMap(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const context=canvas.getContext('2d')!;context.fillStyle='#f5efe4';context.fillRect(0,0,512,512);
  let seed=173;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<12000;i++){const v=150+Math.floor(rnd()*75);context.fillStyle=`rgba(${v},${v-8},${v-18},.09)`;context.fillRect(rnd()*512,rnd()*512,1+rnd()*3,1+rnd()*2);}
  for(let i=0;i<18;i++){context.beginPath();context.moveTo(rnd()*512,0);context.bezierCurveTo(rnd()*512,180,rnd()*512,300,rnd()*512,512);context.strokeStyle='rgba(154,143,126,.12)';context.lineWidth=.3+rnd()*1.2;context.stroke();}
  const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(.3,.3);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);return tex;
 }
 const marble=stoneMap();
 const stone=new T.MeshStandardMaterial({color:0xfff8e9,map:marble,bumpMap:marble,bumpScale:.045,roughness:.42});
 const pavement=new T.MeshStandardMaterial({color:0xe5d9c2,map:marble,bumpMap:marble,bumpScale:.025,roughness:.44});
 const gold=new T.MeshStandardMaterial({color:0xd9b878,metalness:.88,roughness:.24});
 const darkGold=new T.MeshStandardMaterial({color:0x76502f,metalness:.75,roughness:.34});
 const glass=new T.MeshPhysicalMaterial({color:0x225c65,metalness:.35,roughness:.12,clearcoat:1,transparent:true,opacity:.65,side:T.DoubleSide});
 const dark=new T.MeshStandardMaterial({color:0x1b343d,roughness:.63});
 const rock=new T.MeshStandardMaterial({color:0xb4ad98,map:marble,roughness:.96,flatShading:false});
 const leaf=new T.MeshStandardMaterial({color:0x52613c,roughness:.88,side:T.DoubleSide});
 const trunk=new T.MeshStandardMaterial({color:0x7d6445,roughness:.9});
 const light=new T.MeshStandardMaterial({color:0xffe7b4,emissive:0xffc26b,emissiveIntensity:2.2,roughness:.25});
 return {stone,pavement,gold,darkGold,glass,dark,rock,leaf,trunk,light,textures};
}
export type PlazaMaterials=ReturnType<typeof plazaMaterials>;
