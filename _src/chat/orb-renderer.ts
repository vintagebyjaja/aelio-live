// Analytic sphere normals: a perfectly round, pixel-smooth silhouette without mesh displacement.
export type OrbControls={state:string;intensity:number;audioLevel:number;reduced:boolean;interactive:boolean};
const fragment=`precision highp float;
uniform vec2 uResolution;
uniform float uTime,uIntensity,uAudioLevel,uWaveSpeed;
uniform vec3 uCopperLight,uCopperDark,uHighlightColor;
uniform vec2 uPointer;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float field(vec3 p){return noise(p)*.55+noise(p*2.03)*.3+noise(p*4.01)*.15;}
void main(){
 vec2 p=(gl_FragCoord.xy/uResolution*2.-1.)*1.025;
 float rr=dot(p,p);if(rr>1.){gl_FragColor=vec4(0.);return;}
 vec3 n=vec3(p,sqrt(1.-rr));
 // Material coordinates evolve internally. Sphere/normal coordinates never rotate.
 float t=uTime*.55;vec3 q=n*3.2+vec3(t*.24,-t*.15,t*.09);
 vec3 warp=vec3(field(q+1.),field(q+7.),field(q+13.));
 float liquid=field(q+warp*(1.5+uIntensity*.5)+vec3(0.,t*.3,0.));
 float veins=smoothstep(.28,.8,liquid+uWaveSpeed*.015);
 vec3 light=normalize(vec3(-.48,.65,1.1)+vec3(uPointer*.12,0.));
 float diffuse=max(dot(n,light),0.);
 vec3 reflected=reflect(vec3(0.,0.,-1.),n);
 float spec=pow(max(dot(reflected,light),0.),mix(42.,88.,liquid));
 float soft=pow(max(dot(n,normalize(light+vec3(0,0,1))),0.),14.);
 float rim=pow(1.-n.z,3.6);
 vec3 base=mix(uCopperDark,uCopperLight,.14+veins*.48*(.55+uIntensity));
 vec3 color=base*(.20+diffuse*.85)+uHighlightColor*(spec*.92+soft*.23);
 // Restrained warm environment reflection; darker lower hemisphere, thin amber silhouette.
 color+=uCopperLight*pow(max(0.,-n.y),3.)*.16;
 color+=uHighlightColor*rim*(.20+.25*diffuse);
 color+=uCopperLight*(liquid-.5)*uIntensity*.13;
 color+=uHighlightColor*uAudioLevel*(.035+.10*liquid);
 color=mix(color,uHighlightColor*.9,smoothstep(.986,1.,sqrt(rr))*.72);
 gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(.85)),1.);
}`;
const settings:Record<string,[number,number]>={idle:[.25,.35],listening:[.42,.55],thinking:[.7,.72],speaking:[.45,.55],loading:[.5,.58]};
let occupied=false;
export function renderOrb(canvas:HTMLCanvasElement,controls:()=>OrbControls,onReady:()=>void,onFallback:()=>void){
 if(occupied)return ()=>{}; // One decorative GPU context at a time; small instances keep the shared fallback.
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});
 if(!gl){onFallback();return ()=>{};}
 occupied=true;let lostContext=false,announced=false,disposed=false,frame=0,visible=true,elapsed=0,last=0,intensity=.35,audio=0,speed=.25,phase=0,pointer=[0,0];
 const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('orb_shader');}return s;};
 let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null;const shaders:WebGLShader[]=[];
 try{
 shaders.push(shader(gl.VERTEX_SHADER,'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}'),shader(gl.FRAGMENT_SHADER,fragment));
 program=gl.createProgram()!;shaders.forEach(s=>gl.attachShader(program!,s));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('orb_program');
 gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 const uniform=(n:string)=>gl.getUniformLocation(program!,n);
 const locations=Object.fromEntries(['uResolution','uTime','uIntensity','uAudioLevel','uWaveSpeed','uCopperLight','uCopperDark','uHighlightColor','uPointer'].map(n=>[n,uniform(n)]));
 gl.uniform3f(locations.uCopperLight,.73,.35,.13);gl.uniform3f(locations.uCopperDark,.075,.026,.012);gl.uniform3f(locations.uHighlightColor,1.,.76,.46);
 const resize=()=>{const maxRatio=matchMedia('(max-width:768px)').matches?1.35:1.75;const dpr=Math.min(devicePixelRatio||1,maxRatio);const box=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(locations.uResolution,canvas.width,canvas.height);};
 const draw=(stamp:number)=>{
  frame=0;if(disposed||lostContext||!visible||document.hidden)return;
  const c=controls(),dt=last?Math.min((stamp-last)/1000,.05):0;last=stamp;elapsed+=dt;
  const target=settings[c.state]||settings.idle,smooth=1-Math.exp(-dt*5);
  speed+=(target[0]-speed)*smooth;intensity+=(target[1]*c.intensity/.35-intensity)*smooth;
  const level=c.reduced?0:Math.max(0,Math.min(1,c.audioLevel||0));audio+=(level-audio)*(1-Math.exp(-dt*12));
  if(!c.reduced)phase+=dt*speed;
  gl.uniform1f(locations.uTime,phase);gl.uniform1f(locations.uWaveSpeed,speed);gl.uniform1f(locations.uIntensity,Math.min(intensity,1.5));gl.uniform1f(locations.uAudioLevel,audio);gl.uniform2f(locations.uPointer,pointer[0],pointer[1]);
  gl.drawArrays(gl.TRIANGLES,0,6);if(!announced){announced=true;onReady();}
  if(!c.reduced)frame=requestAnimationFrame(draw);
 };
 const wake=()=>{last=0;if(!frame&&!disposed&&!lostContext&&visible&&!document.hidden)frame=requestAnimationFrame(draw);};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else wake();});observer.observe(canvas);
 const ro=new ResizeObserver(()=>{resize();wake();});ro.observe(canvas);
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();};
 const move=(e:PointerEvent)=>{if(!controls().interactive)return;const r=canvas.getBoundingClientRect();pointer=[(e.clientX-r.left)/r.width-.5,.5-(e.clientY-r.top)/r.height];wake();};
 const lost=(e:Event)=>{e.preventDefault();lostContext=true;onFallback();cancelAnimationFrame(frame);frame=0;};
 document.addEventListener('visibilitychange',visibility);canvas.addEventListener('pointermove',move);canvas.addEventListener('webglcontextlost',lost);resize();wake();
 return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('webglcontextlost',lost);gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl.getExtension('WEBGL_lose_context')?.loseContext();occupied=false;};
 }catch{shaders.forEach(s=>gl.deleteShader(s));if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);occupied=false;onFallback();return ()=>{};}
}
