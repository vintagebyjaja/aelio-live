import * as T from 'three';
import type {PlazaMaterials} from './materials';

export function landscape(scene:T.Scene,m:PlazaMaterials,quality:string,sun:T.Vector3){
 const high=quality==='high',low=quality==='low';
 // Continuous layered limestone coastline, with a peninsula rising inland.
 const addCliff=(x:number,z:number,r:number,top:number,seed:number)=>{
  const g=new T.CylinderGeometry(r*.97,r*.78,top+13,112,28);const p=g.attributes.position;
  const colors=[];
  for(let i=0;i<p.count;i++){
   const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),a=Math.atan2(pz,px);
   const ripple=1+.045*Math.sin(a*11+seed)+.026*Math.sin(a*27+py*.8)+.015*Math.cos(a*43-py*1.3);
   p.setXYZ(i,px*ripple,py,pz*ripple);
   const c=new T.Color().setHSL(.105,.10,.46+.10*Math.sin(py*.73+a*.6)+.055*Math.sin(a*31+py*2.2));colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
  const mat=new T.MeshStandardMaterial({color:0xd2ccba,vertexColors:true,roughness:.93,bumpMap:m.rock.map,bumpScale:.26});
  const cliff=new T.Mesh(g,mat);cliff.position.set(x,(top-13)/2,z);cliff.receiveShadow=true;cliff.castShadow=true;scene.add(cliff);
 };
 addCliff(0,0,37.5,-2.5,1);
 for(const [x,z,r,top,seed]of [[-18,-52,24,4.9,2],[24,-61,28,9.9,3],[54,-91,32,17.9,4],[-45,-89,26,7.9,5],[5,-112,38,13,6]])addCliff(x,z,r,top,seed);
 // A generated small normal field drives water reflection/ripples. No scene photographs.
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=128+Math.round(9*Math.sin(x*.19+y*.22)+5*Math.sin(x*.61-y*.37));data[i+1]=128+Math.round(9*Math.cos(y*.21-x*.13)+5*Math.cos(y*.43+x*.57));data[i+2]=245;data[i+3]=255;}
 const normals=new T.DataTexture(data,size,size,T.RGBAFormat);normals.wrapS=normals.wrapT=T.RepeatWrapping;normals.needsUpdate=true;
 const oceanMaterial=new T.ShaderMaterial({uniforms:{time:{value:0},sun:{value:sun}},vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`
 varying vec3 vWorld;uniform float time;uniform vec3 sun;
 float ripple(vec2 p){return sin(p.x*.83+p.y*.34+time*.7)*.5+sin(p.y*1.31-p.x*.72-time*.5)*.22+sin(p.x*2.9+p.y*2.2+time)*.08;}
 void main(){vec2 p=vWorld.xz;float shore=abs(length(p)-37.);shore=min(shore,abs(length(p-vec2(24.,-61.))-28.));shore=min(shore,abs(length(p-vec2(-18.,-52.))-24.));
 float shallow=exp(-shore*.075);vec3 deep=vec3(.006,.095,.17);vec3 aqua=vec3(.008,.46,.49);vec3 base=mix(deep,aqua,shallow*.93);
 vec3 n=normalize(vec3((ripple(p+vec2(.12,0.))-ripple(p-vec2(.12,0.)))*.32,1.,(ripple(p+vec2(0.,.12))-ripple(p-vec2(0.,.12)))*.32));vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(eye,n),0.),4.);vec3 halfV=normalize(eye+sun);float spec=pow(max(dot(n,halfV),0.),200.);float foam=smoothstep(.75,1.1,sin(shore*3.1+sin(p.x*.9)*.7+sin(p.y*.8)-time*.65)+ripple(p)*.45)*exp(-shore*.62)*.18;
 vec3 color=mix(base,vec3(.24,.49,.58),fresnel*.55)+vec3(1.,.7,.35)*spec*.9+vec3(.55,.85,.8)*foam;gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const sea=new T.Mesh(new T.PlaneGeometry(1400,1400),oceanMaterial);sea.rotation.x=-Math.PI/2;sea.position.y=-12.5;scene.add(sea);
 // Turquoise cascade basins cut into lower sea terraces.
 for(const side of [-1,1]){
  const basin=new T.Mesh(new T.CylinderGeometry(7,7,.12,64),new T.MeshPhysicalMaterial({color:0x26b7be,metalness:.3,roughness:.15,clearcoat:1}));basin.position.set(side*24,-3.15,20);scene.add(basin);
  const rim=new T.Mesh(new T.TorusGeometry(7.15,.24,8,80),m.stone);rim.rotation.x=Math.PI/2;rim.position.copy(basin.position);scene.add(rim);
 }
 const waterfallMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;void main(){float streams=sin(vUv.x*192.+sin(vUv.y*20.-time*3.)*.5)*.5+.5;float edge=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);float pulse=.34+.18*sin(vUv.y*75.-time*9.+vUv.x*9.);gl_FragColor=vec4(mix(vec3(.43,.78,.8),vec3(.95,.99,1.),streams*.85),edge*pulse);}`});
 for(const x of [-25,-18,18,25]){const fall=new T.Mesh(new T.PlaneGeometry(3.4,9.2,10,24),waterfallMaterial);fall.position.set(x,-7.8,Math.sqrt(37**2-x*x)+.5);scene.add(fall);}
 // Distant sculpted coastal landforms, built from continuous height fields.
 for(let island=0;island<3;island++){
  const g=new T.PlaneGeometry(230,90,100,40);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),envelope=Math.pow(Math.max(0,1-Math.abs(x)/120),.6)*Math.max(0,1-Math.abs(z)/48);const ridge=15+16*Math.pow(Math.sin(x*.039+island*2),2)+8*Math.sin(x*.091)+6*Math.cos(z*.081);p.setY(i,-14+envelope*ridge);}
  g.computeVertexNormals();const mountain=new T.Mesh(g,new T.MeshStandardMaterial({color:[0x40594f,0x647b75,0x81908b][island],roughness:1}));mountain.position.set(-170+island*180,-1,-170-island*32);scene.add(mountain);
 }
 // Dense instanced olive leaves and natural branching; no spherical tree canopies.
 let seed=51;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const trees=[[-20,9],[20,9],[-15,-13],[15,-13],[-28,-1],[28,-1],[-27,-47,7],[30,-48,12],[44,-75,20],[-38,-80,10],[15,-80,12],[-9,-58,7]];
 const leafShape=new T.Shape();leafShape.moveTo(0,-.18);leafShape.quadraticCurveTo(.09,0,0,.18);leafShape.quadraticCurveTo(-.09,0,0,-.18);
 const leafGeometry=new T.ShapeGeometry(leafShape,3),leafCount=trees.length*(low?350:700),leafInstances=new T.InstancedMesh(leafGeometry,m.leaf,leafCount);const dummy=new T.Object3D();let index=0;
 for(const [x,z,base=0] of trees){
  const trunk=new T.Mesh(new T.CylinderGeometry(.11,.25,3.6,10,4),m.trunk);trunk.position.set(x,base+1.8,z);trunk.rotation.z=.07;trunk.castShadow=true;scene.add(trunk);
  for(let b=0;b<6;b++){const a=b/6*Math.PI*2,end=new T.Vector3(x+Math.cos(a)*1.2,base+3.9+(b%2)*.5,z+Math.sin(a)*1.2),start=new T.Vector3(x,base+2.5,z);const dir=end.clone().sub(start);const branch=new T.Mesh(new T.CylinderGeometry(.025,.08,dir.length(),6),m.trunk);branch.position.copy(start).add(end).multiplyScalar(.5);branch.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());scene.add(branch);}
  const count=low?350:700;
  for(let n=0;n<count;n++){const a=random()*Math.PI*2,r=Math.sqrt(random())*1.9,h=random()*1.6;dummy.position.set(x+Math.cos(a)*r,base+3.3+h,z+Math.sin(a)*r);dummy.rotation.set(random()*Math.PI,random()*Math.PI,random()*Math.PI);dummy.scale.setScalar(.7+random()*.8);dummy.updateMatrix();leafInstances.setMatrixAt(index++,dummy.matrix);}
 }
 leafInstances.castShadow=!low;scene.add(leafInstances);
 return {update:(time:number)=>{oceanMaterial.uniforms.time.value=time*.32;waterfallMaterial.uniforms.time.value=time;},dispose:()=>{normals.dispose();const shader=sea.material as T.ShaderMaterial;shader.uniforms.mirrorSampler?.value?.dispose?.();}};
}
