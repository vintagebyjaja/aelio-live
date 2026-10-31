import * as T from 'three';
import {Water} from 'three/addons/objects/Water.js';
import type {PlazaMaterials} from './materials';

export function landscape(scene:T.Scene,m:PlazaMaterials,quality:string,sun:T.Vector3){
 const high=quality==='high',low=quality==='low';
 const cliffGeometry=new T.CylinderGeometry(37.5,29,13,128,14);
 const cp=cliffGeometry.attributes.position;
 for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i),y=cp.getY(i);const a=Math.atan2(z,x);const n=1+.025*Math.sin(a*17+y*1.7)+.019*Math.cos(a*31-y*.7);cp.setXYZ(i,x*n,y,z*n);}cliffGeometry.computeVertexNormals();
 const cliff=new T.Mesh(cliffGeometry,m.rock);cliff.position.y=-8;cliff.receiveShadow=true;scene.add(cliff);
 // A generated small normal field drives water reflection/ripples. No scene photographs.
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=128+Math.round(28*Math.sin(x*.6+y*.22));data[i+1]=128+Math.round(28*Math.cos(y*.55-x*.12));data[i+2]=245;data[i+3]=255;}
 const normals=new T.DataTexture(data,size,size,T.RGBAFormat);normals.wrapS=normals.wrapT=T.RepeatWrapping;normals.needsUpdate=true;
 const sea=new Water(new T.PlaneGeometry(900,900),{textureWidth:low?256:high?1024:512,textureHeight:low?256:high?1024:512,waterNormals:normals,sunDirection:sun,sunColor:0xffdeb0,waterColor:0x168f99,distortionScale:2.4,fog:true});sea.rotation.x=-Math.PI/2;sea.position.y=-12.5;scene.add(sea);
 // Turquoise cascade basins cut into lower sea terraces.
 for(const side of [-1,1]){
  const basin=new T.Mesh(new T.CylinderGeometry(7,7,.12,64),new T.MeshPhysicalMaterial({color:0x26b7be,metalness:.3,roughness:.15,clearcoat:1}));basin.position.set(side*24,-3.15,20);scene.add(basin);
  const rim=new T.Mesh(new T.TorusGeometry(7.15,.24,8,80),m.stone);rim.rotation.x=Math.PI/2;rim.position.copy(basin.position);scene.add(rim);
 }
 const waterfallMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;void main(){float streams=sin(vUv.x*92.+sin(vUv.y*20.-time*3.)*.5)*.5+.5;float edge=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);float pulse=.64+.18*sin(vUv.y*75.-time*9.+vUv.x*9.);gl_FragColor=vec4(mix(vec3(.43,.78,.8),vec3(.95,.99,1.),streams*.65),edge*pulse);}`});
 for(const x of [-25,-18,18,25]){const fall=new T.Mesh(new T.PlaneGeometry(1.5,9.2,4,12),waterfallMaterial);fall.position.set(x,-7.8,29);scene.add(fall);}
 // Distant sculpted coastal landforms, built from continuous height fields.
 for(let island=0;island<3;island++){
  const g=new T.PlaneGeometry(230,90,100,40);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),envelope=Math.pow(Math.max(0,1-Math.abs(x)/120),.6)*Math.max(0,1-Math.abs(z)/48);const ridge=15+16*Math.pow(Math.sin(x*.039+island*2),2)+8*Math.sin(x*.091)+6*Math.cos(z*.081);p.setY(i,-14+envelope*ridge);}
  g.computeVertexNormals();const mountain=new T.Mesh(g,new T.MeshStandardMaterial({color:[0x6d8390,0x869ca2,0xa2b0ad][island],roughness:1}));mountain.position.set(-170+island*180,-1,-170-island*32);scene.add(mountain);
 }
 // Dense instanced olive leaves and natural branching; no spherical tree canopies.
 let seed=51;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const trees=[[-20,9],[20,9],[-15,-13],[15,-13],[-28,-1],[28,-1]];
 const leafShape=new T.Shape();leafShape.moveTo(0,-.18);leafShape.quadraticCurveTo(.09,0,0,.18);leafShape.quadraticCurveTo(-.09,0,0,-.18);
 const leafGeometry=new T.ShapeGeometry(leafShape,3),leafCount=trees.length*(low?350:700),leafInstances=new T.InstancedMesh(leafGeometry,m.leaf,leafCount);const dummy=new T.Object3D();let index=0;
 for(const [x,z] of trees){
  const trunk=new T.Mesh(new T.CylinderGeometry(.11,.25,3.6,10,4),m.trunk);trunk.position.set(x,1.8,z);trunk.rotation.z=.07;trunk.castShadow=true;scene.add(trunk);
  for(let b=0;b<6;b++){const a=b/6*Math.PI*2,end=new T.Vector3(x+Math.cos(a)*1.2,3.9+(b%2)*.5,z+Math.sin(a)*1.2),start=new T.Vector3(x,2.5,z);const dir=end.clone().sub(start);const branch=new T.Mesh(new T.CylinderGeometry(.025,.08,dir.length(),6),m.trunk);branch.position.copy(start).add(end).multiplyScalar(.5);branch.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());scene.add(branch);}
  const count=low?350:700;
  for(let n=0;n<count;n++){const a=random()*Math.PI*2,r=Math.sqrt(random())*1.9,h=random()*1.6;dummy.position.set(x+Math.cos(a)*r,3.3+h,z+Math.sin(a)*r);dummy.rotation.set(random()*Math.PI,random()*Math.PI,random()*Math.PI);dummy.scale.setScalar(.7+random()*.8);dummy.updateMatrix();leafInstances.setMatrixAt(index++,dummy.matrix);}
 }
 leafInstances.castShadow=!low;scene.add(leafInstances);
 return {update:(time:number)=>{(sea.material as T.ShaderMaterial).uniforms.time.value=time*.32;waterfallMaterial.uniforms.time.value=time;},dispose:()=>{normals.dispose();const shader=sea.material as T.ShaderMaterial;shader.uniforms.mirrorSampler?.value?.dispose?.();}};
}
