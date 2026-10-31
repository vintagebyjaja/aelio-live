import"./chunk-EK7ODJWE.js";var O=`precision highp float;
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
}`,H={idle:[.25,.35],listening:[.42,.55],thinking:[.7,.72],speaking:[.45,.55],loading:[.5,.58]},p=!1;function k(r,L,D,g){if(p)return()=>{};let e=r.getContext("webgl",{alpha:!0,antialias:!0,premultipliedAlpha:!1,powerPreference:"low-power"});if(!e)return g(),()=>{};p=!0;let v=!1,E=!1,x=!1,n=0,f=!0,W=0,d=0,b=.35,w=0,h=.25,y=0,A=[0,0],R=(u,C)=>{let i=e.createShader(u);if(e.shaderSource(i,C),e.compileShader(i),!e.getShaderParameter(i,e.COMPILE_STATUS))throw e.deleteShader(i),Error("orb_shader");return i},a=null,s=null,m=[];try{if(m.push(R(e.VERTEX_SHADER,"attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}"),R(e.FRAGMENT_SHADER,O)),a=e.createProgram(),m.forEach(t=>e.attachShader(a,t)),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw Error("orb_program");e.useProgram(a),s=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,s),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),e.STATIC_DRAW);let u=e.getAttribLocation(a,"position");e.enableVertexAttribArray(u),e.vertexAttribPointer(u,2,e.FLOAT,!1,0,0);let C=t=>e.getUniformLocation(a,t),i=Object.fromEntries(["uResolution","uTime","uIntensity","uAudioLevel","uWaveSpeed","uCopperLight","uCopperDark","uHighlightColor","uPointer"].map(t=>[t,C(t)]));e.uniform3f(i.uCopperLight,.73,.35,.13),e.uniform3f(i.uCopperDark,.075,.026,.012),e.uniform3f(i.uHighlightColor,1,.76,.46);let S=()=>{let t=matchMedia("(max-width:768px)").matches?1.35:1.75,o=Math.min(devicePixelRatio||1,t),l=r.getBoundingClientRect();r.width=Math.max(1,Math.round(l.width*o)),r.height=Math.max(1,Math.round(l.height*o)),e.viewport(0,0,r.width,r.height),e.uniform2f(i.uResolution,r.width,r.height)},P=t=>{if(n=0,x||v||!f||document.hidden)return;let o=L(),l=d?Math.min((t-d)/1e3,.05):0;d=t,W+=l;let I=H[o.state]||H.idle,B=1-Math.exp(-l*5);h+=(I[0]-h)*B,b+=(I[1]*o.intensity/.35-b)*B;let z=o.reduced?0:Math.max(0,Math.min(1,o.audioLevel||0));w+=(z-w)*(1-Math.exp(-l*12)),o.reduced||(y+=l*h),e.uniform1f(i.uTime,y),e.uniform1f(i.uWaveSpeed,h),e.uniform1f(i.uIntensity,Math.min(b,1.5)),e.uniform1f(i.uAudioLevel,w),e.uniform2f(i.uPointer,A[0],A[1]),e.drawArrays(e.TRIANGLES,0,6),E||(E=!0,D()),o.reduced||(n=requestAnimationFrame(P))},c=()=>{d=0,!n&&!x&&!v&&f&&!document.hidden&&(n=requestAnimationFrame(P))},M=new IntersectionObserver(t=>{f=t[0].isIntersecting,f?c():(cancelAnimationFrame(n),n=0)});M.observe(r);let T=new ResizeObserver(()=>{S(),c()});T.observe(r);let _=()=>{document.hidden?(cancelAnimationFrame(n),n=0):c()},q=t=>{if(!L().interactive)return;let o=r.getBoundingClientRect();A=[(t.clientX-o.left)/o.width-.5,.5-(t.clientY-o.top)/o.height],c()},F=t=>{t.preventDefault(),v=!0,g(),cancelAnimationFrame(n),n=0};return document.addEventListener("visibilitychange",_),r.addEventListener("pointermove",q),r.addEventListener("webglcontextlost",F),S(),c(),()=>{x=!0,cancelAnimationFrame(n),M.disconnect(),T.disconnect(),document.removeEventListener("visibilitychange",_),r.removeEventListener("pointermove",q),r.removeEventListener("webglcontextlost",F),e.deleteBuffer(s),e.deleteProgram(a),m.forEach(t=>e.deleteShader(t)),e.getExtension("WEBGL_lose_context")?.loseContext(),p=!1}}catch{return m.forEach(u=>e.deleteShader(u)),a&&e.deleteProgram(a),s&&e.deleteBuffer(s),p=!1,g(),()=>{}}}export{k as renderOrb};
