import{a as Ie,b as Xe,c as Fe}from"./chunk-RBBOGAJP.js";import{$ as C,A as $e,B as je,C as Qe,D as Je,E as et,F as tt,G as ot,H as nt,J as rt,K as at,L as oe,N as X,O as st,P as be,Q as it,R as ne,S as lt,T as ct,V as J,W as ye,X as K,Y as F,Z as Me,aa as H,ba as ut,c as We,ca as ft,d as pe,da as dt,e as q,f as Ge,g as Oe,ga as mt,h as he,ha as pt,i as He,ia as ht,j as te,ja as gt,m as ge,n as y,p as Ye,q as I,r as Ze,s as qe,t as ve,u as ie,v as we,w as P,x as Te,y as Ke,z as Q}from"./chunk-HKTOUVHM.js";import{a as Et,b as Ne}from"./chunk-LCHUMGRD.js";import{b as ze}from"./chunk-EK7ODJWE.js";var Z=ze(Et(),1);var le=class d extends P{constructor(){let s=d.SkyShader,w=new Q({name:s.name,uniforms:Ke.clone(s.uniforms),vertexShader:s.vertexShader,fragmentShader:s.fragmentShader,side:pe,depthWrite:!1});super(new Te(1,1,1),w),this.isSky=!0}};le.SkyShader={name:"SkyShader",uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new y},up:{value:new y(0,1,0)}},vertexShader:`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;
		uniform vec3 up;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( dot( vSunDirection, up ) );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorption + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,fragmentShader:`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform vec3 up;

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPosition );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
			L0 += ( vSunE * 19000.0 * Fex ) * sundisk;

			vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

			vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

			gl_FragColor = vec4( retColor, 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};function vt(){let d=[];function s(){let o=document.createElement("canvas");o.width=o.height=512;let i=o.getContext("2d");i.fillStyle="#f5efe4",i.fillRect(0,0,512,512);let u=173,l=()=>(u=u*16807%2147483647,u/2147483647);for(let b=0;b<12e3;b++){let f=150+Math.floor(l()*75);i.fillStyle=`rgba(${f},${f-8},${f-18},.09)`,i.fillRect(l()*512,l()*512,1+l()*3,1+l()*2)}for(let b=0;b<18;b++)i.beginPath(),i.moveTo(l()*512,0),i.bezierCurveTo(l()*512,180,l()*512,300,l()*512,512),i.strokeStyle="rgba(154,143,126,.12)",i.lineWidth=.3+l()*1.2,i.stroke();let m=new oe(o);return m.wrapS=m.wrapT=he,m.repeat.set(.3,.3),m.colorSpace=te,d.push(m),m}let w=s(),T=new C({color:16775401,map:w,bumpMap:w,bumpScale:.045,roughness:.42}),c=new C({color:15063490,map:w,bumpMap:w,bumpScale:.025,roughness:.44}),M=new C({color:14268536,metalness:.88,roughness:.24}),h=new C({color:7753775,metalness:.75,roughness:.34}),v=new H({color:2251877,metalness:.35,roughness:.12,clearcoat:1,transparent:!0,opacity:.65,side:q}),p=new C({color:1782845,roughness:.63}),a=new C({color:11840920,map:w,roughness:.96,flatShading:!1}),t=new C({color:5398844,roughness:.88,side:q}),e=new C({color:8217669,roughness:.9}),n=new C({color:16770996,emissive:16761451,emissiveIntensity:2.2,roughness:.25});return{stone:T,pavement:c,gold:M,darkGold:h,glass:v,dark:p,rock:a,leaf:t,trunk:e,light:n,textures:d}}function Tt(d,s=!1){let w=d[0].index!==null,T=new Set(Object.keys(d[0].attributes)),c=new Set(Object.keys(d[0].morphAttributes)),M={},h={},v=d[0].morphTargetsRelative,p=new we,a=0;for(let t=0;t<d.length;++t){let e=d[t],n=0;if(w!==(e.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let o in e.attributes){if(!T.has(o))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+'. All geometries must have compatible attributes; make sure "'+o+'" attribute exists among all geometries, or in none of them.'),null;M[o]===void 0&&(M[o]=[]),M[o].push(e.attributes[o]),n++}if(n!==T.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". Make sure all geometries have the same number of attributes."),null;if(v!==e.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let o in e.morphAttributes){if(!c.has(o))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+".  .morphAttributes must be consistent throughout all geometries."),null;h[o]===void 0&&(h[o]=[]),h[o].push(e.morphAttributes[o])}if(s){let o;if(w)o=e.index.count;else if(e.attributes.position!==void 0)o=e.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". The geometry must have either an index or a position attribute"),null;p.addGroup(a,o,t),a+=o}}if(w){let t=0,e=[];for(let n=0;n<d.length;++n){let o=d[n].index;for(let i=0;i<o.count;++i)e.push(o.getX(i)+t);t+=d[n].attributes.position.count}p.setIndex(e)}for(let t in M){let e=wt(M[t]);if(!e)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+t+" attribute."),null;p.setAttribute(t,e)}for(let t in h){let e=h[t][0].length;if(e===0)break;p.morphAttributes=p.morphAttributes||{},p.morphAttributes[t]=[];for(let n=0;n<e;++n){let o=[];for(let u=0;u<h[t].length;++u)o.push(h[t][u][n]);let i=wt(o);if(!i)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+t+" morphAttribute."),null;p.morphAttributes[t].push(i)}}return p}function wt(d){let s,w,T,c=-1,M=0;for(let a=0;a<d.length;++a){let t=d[a];if(s===void 0&&(s=t.array.constructor),s!==t.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(w===void 0&&(w=t.itemSize),w!==t.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(T===void 0&&(T=t.normalized),T!==t.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(c===-1&&(c=t.gpuType),c!==t.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;M+=t.count*w}let h=new s(M),v=new ve(h,w,T),p=0;for(let a=0;a<d.length;++a){let t=d[a];if(t.isInterleavedBufferAttribute){let e=p/w;for(let n=0,o=t.count;n<o;n++)for(let i=0;i<w;i++){let u=t.getComponent(n,i);v.setComponent(n+e,i,u)}}else h.set(t.array,p);p+=t.count*w}return c!==void 0&&(v.gpuType=c),v}function bt(d,s,w=!0){let T=new Map;function c(a,t,e,n=new I,o=new y(1,1,1)){let i=new Ye().compose(e,new ge().setFromEuler(n),o);a.applyMatrix4(i),a.getAttribute("uv")||a.setAttribute("uv",new ve(new Float32Array(a.getAttribute("position").count*2),2));let u=T.get(t)||[];u.push(a),T.set(t,u)}let M=(a,t,e,n,o,i,u=s.stone,l=0)=>c(new Te(a,t,e),u,new y(n,o,i),new I(0,l,0)),h=(a,t,e,n,o,i=s.stone)=>c(new X(a,a,t,64),i,new y(e,n,o));function v(a,t,e,n){let o=a/2+e,i=a/2,u=t-a/2,l=new ne;l.moveTo(-o,0),l.lineTo(o,0),l.lineTo(o,u),l.absarc(0,u,o,0,Math.PI,!1),l.lineTo(-o,0);let m=new it;return m.moveTo(-i,0),m.lineTo(-i,u),m.absarc(0,u,i,Math.PI,0,!0),m.lineTo(i,0),m.lineTo(-i,0),l.holes.push(m),new lt(l,{depth:n,bevelEnabled:!0,bevelSegments:2,steps:1,bevelSize:.055,bevelThickness:.055,curveSegments:24})}if(w){for(let t=0;t<15;t++){let e=-1.6+t*3.2/14,n=Math.sin(e)*24,o=-Math.cos(e)*24,i=new I(0,-e,0);c(v(4.05,7.7,.55,1.5),s.stone,new y(n,0,o),i),c(v(3.94,7.6,.075,.12),s.gold,new y(n+Math.sin(e)*.12,.02,o-Math.cos(e)*.12),i);for(let l of[-1,1]){let m=new y(l*2.7,0,0).applyEuler(i);M(.13,6.4,.1,n+m.x,3.2,o+m.z,s.gold,-e)}let u=new y(0,8.9,.65).applyEuler(i);if(M(5.7,.32,2.8,n+u.x,8.9,o+u.z,s.stone,-e),M(5.7,.09,2.9,n+u.x,9.12,o+u.z,s.gold,-e),t>1&&t<13){let l=new X(27.8,27.8,6.8,12,1,!0,e-.1,.2);c(l,s.glass,new y(0,4.8,0),new I(0,Math.PI,0))}}for(let t of[-1,1]){let e=t*22,n=-22;for(let i=0;i<3;i++){let u=9-i*1.5,l=i*3.6;c(new X(u,u,.45,64,1,!1,0,Math.PI*2),s.stone,new y(e,l+.2,n)),c(new F(u+.05,.06,5,80),s.gold,new y(e,l+.48,n),new I(Math.PI/2,0,0)),c(new X(u-.8,u-.8,3,48,1,!0),s.glass,new y(e,l+1.9,n));for(let m=0;m<12;m++){let b=m/12*Math.PI*2;M(.12,3.2,.12,e+Math.sin(b)*(u-.7),l+1.9,n+Math.cos(b)*(u-.7),s.gold)}}let o=new K(5.9,48,24,0,Math.PI*2,0,Math.PI/2);c(o,s.darkGold,new y(e,11.3,n),new I,new y(1,.43,1));for(let i=0;i<16;i++){let l=new st(0,0,5.95,2.57,0,Math.PI/2,!1,0).getPoints(24).map(b=>new y(b.x,b.y,0)),m=new Me(new be(l),24,.035,4,!1);c(m,s.gold,new y(e,11.3,n),new I(0,i/16*Math.PI*2,0))}c(v(4.8,8.4,.75,2),s.stone,new y(e,0,-13.5)),c(v(4.7,8.3,.12,.1),s.gold,new y(e,.02,-13.65))}for(let t=0;t<4;t++){let e=31.8+t*2.3,n=-t*.8;c(new X(e,e,.5,128),s.pavement,new y(0,n-.3,0)),c(new F(e,.07,5,160),s.gold,new y(0,n,0),new I(Math.PI/2,0,0))}h(31.5,.4,0,-.2,0,s.pavement);for(let t of[8,13.5,20.2,29.9])c(new F(t,.035,4,160),s.darkGold,new y(0,.025,0),new I(Math.PI/2,0,0));for(let t=0;t<48;t++){let e=t/48*Math.PI*2,n=31;h(.035,1.1,Math.sin(e)*n,.55,Math.cos(e)*n,s.gold)}c(new X(31,31,.92,128,1,!0,0,Math.PI*2),s.glass,new y(0,.55,0)),c(new F(31,.045,5,160),s.gold,new y(0,1.1,0),new I(Math.PI/2,0,0));for(let t=0;t<36;t++){let e=t/36*Math.PI*2;M(.018,.008,23,Math.sin(e)*19.5,.022,Math.cos(e)*19.5,s.darkGold,e)}for(let t=0;t<12;t++){let e=t/12*Math.PI*2,n=Math.sin(e)*16,o=Math.cos(e)*16;o>8||(M(3,.45,1,n,.5,o,s.stone,e),M(2.8,.09,.8,n,.77,o,s.darkGold,e),h(.12,.18,n,.12,o+1.4,s.light))}}function p(){for(let[a,t]of T){let e=Tt(t.map(o=>o.index?o.toNonIndexed():o),!1);if(!e)throw Error("Could not build the plaza architecture");let n=new P(e,a);n.castShadow=a!==s.glass,n.receiveShadow=!0,d.add(n),t.forEach(o=>o.dispose())}T.clear()}return{add:c,box:M,cylinder:h,arch:v,finish:p}}function yt(d,s,w,T){let c=w==="high",M=w==="low",h=(g,x,E,G,k)=>{let B=new X(E*.97,E*.78,G+13,112,28),z=B.attributes.position,_=[];for(let D=0;D<z.count;D++){let re=z.getX(D),$=z.getY(D),ae=z.getZ(D),N=Math.atan2(ae,re),se=1+.045*Math.sin(N*11+k)+.026*Math.sin(N*27+$*.8)+.015*Math.cos(N*43-$*1.3);z.setXYZ(D,re*se,$,ae*se);let ee=new qe().setHSL(.105,.1,.46+.1*Math.sin($*.73+N*.6)+.055*Math.sin(N*31+$*2.2));_.push(ee.r,ee.g,ee.b)}B.setAttribute("color",new ie(_,3)),B.computeVertexNormals();let V=new C({color:13814970,vertexColors:!0,roughness:.93,bumpMap:s.rock.map,bumpScale:.26}),L=new P(B,V);L.position.set(g,(G-13)/2,x),L.receiveShadow=!0,L.castShadow=!0,d.add(L)};h(0,0,37.5,-2.5,1);for(let[g,x,E,G,k]of[[-18,-52,24,4.9,2],[24,-61,28,9.9,3],[54,-91,32,17.9,4],[-45,-89,26,7.9,5],[5,-112,38,13,6]])h(g,x,E,G,k);let v=128,p=new Uint8Array(v*v*4);for(let g=0;g<v;g++)for(let x=0;x<v;x++){let E=(g*v+x)*4;p[E]=128+Math.round(9*Math.sin(x*.19+g*.22)+5*Math.sin(x*.61-g*.37)),p[E+1]=128+Math.round(9*Math.cos(g*.21-x*.13)+5*Math.cos(g*.43+x*.57)),p[E+2]=245,p[E+3]=255}let a=new ot(p,v,v,He);a.wrapS=a.wrapT=he,a.needsUpdate=!0;let t=new Q({uniforms:{time:{value:0},sun:{value:T}},vertexShader:"varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",fragmentShader:`
 varying vec3 vWorld;uniform float time;uniform vec3 sun;
 float ripple(vec2 p){return sin(p.x*.83+p.y*.34+time*.7)*.5+sin(p.y*1.31-p.x*.72-time*.5)*.22+sin(p.x*2.9+p.y*2.2+time)*.08;}
 void main(){vec2 p=vWorld.xz;float shore=abs(length(p)-37.);shore=min(shore,abs(length(p-vec2(24.,-61.))-28.));shore=min(shore,abs(length(p-vec2(-18.,-52.))-24.));
 float shallow=exp(-shore*.075);vec3 deep=vec3(.006,.095,.17);vec3 aqua=vec3(.008,.46,.49);vec3 base=mix(deep,aqua,shallow*.93);
 vec3 n=normalize(vec3((ripple(p+vec2(.12,0.))-ripple(p-vec2(.12,0.)))*.32,1.,(ripple(p+vec2(0.,.12))-ripple(p-vec2(0.,.12)))*.32));vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(eye,n),0.),4.);vec3 halfV=normalize(eye+sun);float spec=pow(max(dot(n,halfV),0.),200.);float foam=smoothstep(.75,1.1,sin(shore*3.1+sin(p.x*.9)*.7+sin(p.y*.8)-time*.65)+ripple(p)*.45)*exp(-shore*.62)*.18;
 vec3 color=mix(base,vec3(.24,.49,.58),fresnel*.55)+vec3(1.,.7,.35)*spec*.9+vec3(.55,.85,.8)*foam;gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}),e=new P(new J(1400,1400),t);e.rotation.x=-Math.PI/2,e.position.y=-12.5,d.add(e);for(let g of[-1,1]){let x=new P(new X(7,7,.12,64),new H({color:2537406,metalness:.3,roughness:.15,clearcoat:1}));x.position.set(g*24,-3.15,20),d.add(x);let E=new P(new F(7.15,.24,8,80),s.stone);E.rotation.x=Math.PI/2,E.position.copy(x.position),d.add(E)}let n=new Q({transparent:!0,depthWrite:!1,side:q,uniforms:{time:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec2 vUv;uniform float time;void main(){float streams=sin(vUv.x*192.+sin(vUv.y*20.-time*3.)*.5)*.5+.5;float edge=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x);float pulse=.34+.18*sin(vUv.y*75.-time*9.+vUv.x*9.);gl_FragColor=vec4(mix(vec3(.43,.78,.8),vec3(.95,.99,1.),streams*.85),edge*pulse);}"});for(let g of[-25,-18,18,25]){let x=new P(new J(3.4,9.2,10,24),n);x.position.set(g,-7.8,Math.sqrt(37**2-g*g)+.5),d.add(x)}for(let g=0;g<3;g++){let x=new J(230,90,100,40);x.rotateX(-Math.PI/2);let E=x.attributes.position;for(let k=0;k<E.count;k++){let B=E.getX(k),z=E.getZ(k),_=Math.pow(Math.max(0,1-Math.abs(B)/120),.6)*Math.max(0,1-Math.abs(z)/48),V=15+16*Math.pow(Math.sin(B*.039+g*2),2)+8*Math.sin(B*.091)+6*Math.cos(z*.081);E.setY(k,-14+_*V)}x.computeVertexNormals();let G=new P(x,new C({color:[4217167,6585205,8491147][g],roughness:1}));G.position.set(-170+g*180,-1,-170-g*32),d.add(G)}let o=51,i=()=>(o=o*16807%2147483647,o/2147483647),u=[[-20,9],[20,9],[-15,-13],[15,-13],[-28,-1],[28,-1],[-27,-47,7],[30,-48,12],[44,-75,20],[-38,-80,10],[15,-80,12],[-9,-58,7]],l=new ne;l.moveTo(0,-.18),l.quadraticCurveTo(.09,0,0,.18),l.quadraticCurveTo(-.09,0,0,-.18);let m=new ye(l,3),b=u.length*(M?350:700),f=new nt(m,s.leaf,b),r=new Ze,A=0;for(let[g,x,E=0]of u){let G=new P(new X(.11,.25,3.6,10,4),s.trunk);G.position.set(g,E+1.8,x),G.rotation.z=.07,G.castShadow=!0,d.add(G);for(let B=0;B<6;B++){let z=B/6*Math.PI*2,_=new y(g+Math.cos(z)*1.2,E+3.9+B%2*.5,x+Math.sin(z)*1.2),V=new y(g,E+2.5,x),L=_.clone().sub(V),D=new P(new X(.025,.08,L.length(),6),s.trunk);D.position.copy(V).add(_).multiplyScalar(.5),D.quaternion.setFromUnitVectors(new y(0,1,0),L.normalize()),d.add(D)}let k=M?350:700;for(let B=0;B<k;B++){let z=i()*Math.PI*2,_=Math.sqrt(i())*1.9,V=i()*1.6;r.position.set(g+Math.cos(z)*_,E+3.3+V,x+Math.sin(z)*_),r.rotation.set(i()*Math.PI,i()*Math.PI,i()*Math.PI),r.scale.setScalar(.7+i()*.8),r.updateMatrix(),f.setMatrixAt(A++,r.matrix)}}return f.castShadow=!M,d.add(f),{update:g=>{t.uniforms.time.value=g*.32,n.uniforms.time.value=g},dispose:()=>{a.dispose(),e.material.uniforms.mirrorSampler?.value?.dispose?.()}}}function Mt(d,s,w,T){for(let f=0;f<5;f++){let r=4.4-f*.3;w.cylinder(r,.15,0,.08+f*.15,0,f%2?s.stone:s.darkGold)}w.cylinder(1.5,.65,0,1.05,0,s.darkGold),w.cylinder(1.35,.08,0,1.4,0,s.light);let c=new je;c.position.set(0,4.8,0),d.add(c);let M=new H({color:14989404,metalness:.93,roughness:.19,clearcoat:1,clearcoatRoughness:.12}),h=new P(new K(2.7,64,48),new H({color:7886626,metalness:.76,roughness:.13,transparent:!0,opacity:.32,side:q,clearcoat:1}));c.add(h);let v=M;for(let f=0;f<4;f++){let r=new P(new F(3.05+f*.055,.045+f*.01,8,160),v);r.rotation.set(.3+f*.62,.4+f*.4,.25+f*.6),r.castShadow=!0,c.add(r)}for(let f=0;f<18;f++){let r=new P(new F(2.72,.012,4,96),s.gold);r.rotation.y=f/18*Math.PI,c.add(r)}for(let f=-3;f<=3;f++){let r=f*.6,A=Math.sqrt(2.72**2-r*r),g=new P(new F(A,.014,4,96),s.gold);g.rotation.x=Math.PI/2,g.position.y=r,c.add(g)}let p=new P(new K(.42,32,24),new C({color:16769186,emissive:16757579,emissiveIntensity:6,roughness:.2}));c.add(p);let a=document.createElement("canvas");a.width=a.height=128;let t=a.getContext("2d"),e=t.createRadialGradient(64,64,0,64,64,64);e.addColorStop(0,"rgba(255,231,175,1)"),e.addColorStop(.15,"rgba(255,190,75,.55)"),e.addColorStop(.5,"rgba(255,151,30,.10)"),e.addColorStop(1,"rgba(255,151,30,0)"),t.fillStyle=e,t.fillRect(0,0,128,128);let n=new oe(a),o=new tt(new et({map:n,color:16768160,transparent:!0,blending:Ge,depthWrite:!1}));o.scale.set(5,5,1),c.add(o);let i=[];for(let f=0;f<(T?120:350);f++){let r=f*2.399963,A=1.4+Math.sin(f*3.1)*1.25,g=f*79%100/100*4.6-2.3;i.push(Math.cos(r)*A,g,Math.sin(r)*A)}let u=new at(new we().setAttribute("position",new ie(i,3)),new rt({color:16768907,size:.035,transparent:!0,opacity:.9,blending:Ge,depthWrite:!1}));c.add(u);let l=new ft(16760667,50,15,2);l.position.copy(c.position),d.add(l);for(let f=0;f<12;f++){let r=f/12*Math.PI*2;w.box(.025,.015,2.3,Math.sin(r)*6.2,.05,Math.cos(r)*6.2,s.gold,r)}let m=new ne;for(let f=0;f<16;f++){let r=f/16*Math.PI*2,A=f%2?.11:.48,g=Math.cos(r)*A,x=Math.sin(r)*A;f===0?m.moveTo(g,x):m.lineTo(g,x)}m.closePath();let b=new P(new ye(m),s.light);return b.position.set(0,4.8,2.74),c.add(b),b.position.set(0,0,2.74),{update:f=>{u.rotation.y=f*.025},dispose:()=>n.dispose()}}function xt(d,s){let{add:w,box:T,cylinder:c,arch:M}=s,h=(a,t,e)=>new y(a,t,e);function v(a,t,e,n){w(new F(a,.055,5,72),d.gold,h(t,e,n),new I(Math.PI/2,0,0))}function p(a,t,e,n,o){for(let l=0;l<o;l++){let m=e+l*3.6,b=n-l*.38;c(b+.7,.32,a,m,t),v(b+.7,a,m+.2,t),w(new X(b-.25,b-.25,3.25,48,1,!0),d.glass,h(a,m+1.8,t));for(let f=0;f<14;f++){let r=f/14*Math.PI*2;T(.18,3.4,.18,a+Math.cos(r)*b,m+1.8,t+Math.sin(r)*b)}c(b+.6,.16,a,m+3.45,t),v(b+.6,a,m+3.55,t)}let i=e+o*3.6,u=n-o*.38+.45;w(new K(u,48,20,0,Math.PI*2,0,Math.PI/2),d.gold,h(a,i,t),new I,h(1,.42,1));for(let l=0;l<12;l++){let m=[];for(let b=0;b<=20;b++){let f=b/20*Math.PI/2;m.push(h(Math.cos(f)*u,Math.sin(f)*u*.43,0))}w(new Me(new be(m),20,.045,4,!1),d.darkGold,h(a,i,t),new I(0,l/12*Math.PI*2,0))}}for(let[a,t,e,n]of[[-18,-52,5,24],[24,-61,10,28],[54,-91,18,32],[-45,-89,8,26]]){for(let o=0;o<3;o++)c(n-o*.9,.6,a,e+o*.5,t,d.stone),v(n-o*.9,a,e+o*.5+.35,t);for(let o=0;o<9;o++){let i=o/8*Math.PI,u=a+Math.cos(i)*(n-1),l=t+Math.sin(i)*(n-1);w(M(3.2,5,.32,.7),d.stone,h(u,e+1.3,l),new I(0,-i+Math.PI/2,0))}}p(-19,-54,6.5,8,3),p(24,-68,11.5,11,4),p(54,-99,19.5,12,4),p(-44,-91,9.5,8,3);for(let a=0;a<11;a++){let t=-38+a*9,e=-100-Math.sin(a*1.8)*15,n=10+Math.max(0,t)*.15,o=18+a*7%17;T(3.5,o,4,t,n+o/2,e),T(2.4,o-.7,4.08,t,n+o/2,e,d.glass);for(let i of[-1.7,1.7])T(.16,o+3,.2,t+i,n+o/2+1.5,e+2.15,d.gold);T(3.9,.25,4.5,t,n+o,e,d.gold)}for(let[a,t,e,n]of[[0,1,-35,10],[5,8,-55,16],[39,15,-82,14]]){T(n,.6,6,a,t,e),T(n,.08,.12,a,t+.38,e+2.7,d.gold),T(n,.08,.12,a,t+.38,e-2.7,d.gold);for(let o=0;o<4;o++)w(M(2.5,5,.4,5.5),d.stone,h(a-n/2+o*3.3,t-5,e-2.5))}return{pavilion:p}}function St(d,s,w){let{add:T,box:c,cylinder:M,arch:h}=w,v=-24,p=-13,a=15,t=(r,A,g)=>new y(v+r,a+A,p+g);c(25,.45,20,v,a,p),c(26,.28,21,v,a+8,p),c(25,8,.5,v,a+4,p-10),c(.5,8,20,v-12.5,a+4,p);for(let r=0;r<3;r++)T(h(5.9,7.5,.3,.5),s.stone,t(12.25,0,-6.4+r*6.4),new I(0,Math.PI/2,0)),T(h(5.85,7.45,.055,.12),s.gold,t(12.8,.02,-6.4+r*6.4),new I(0,Math.PI/2,0));let e=new H({color:10212825,transparent:!0,opacity:.06,roughness:.09,metalness:.15,side:q,depthWrite:!1});T(new J(24.8,7.4),e,t(0,3.7,9.15)),T(new J(19.8,7.4),e,t(12.1,3.7,0),new I(0,Math.PI/2,0));for(let r of[-10,10])for(let A of[-7,7])M(.48,4.4,v+r,a-2.2,p+A);for(let r=0;r<3;r++)T(h(6.25,7.5,.35,.5),s.stone,t(-8.4+r*8.4,0,9.4)),T(h(6.2,7.45,.07,.12),s.gold,t(-8.4+r*8.4,.02,9.95));c(25,.12,.12,v,a+7.65,p+9.5,s.gold);for(let r of[-8,8])c(23,.04,.09,v,a+7.65,p+r,s.light);for(let r of[-10,10])c(.025,.014,17,v+r,a+.24,p,s.gold);for(let r of[-7,7])c(20,.014,.025,v,a+.24,p+r,s.gold);let n=document.createElement("canvas");n.width=512,n.height=128;let o=n.getContext("2d");o.fillStyle="#966c48",o.fillRect(0,0,512,128);for(let r=0;r<240;r++){o.strokeStyle=r%2?"#b88a5e40":"#4f321d30",o.lineWidth=.2+r%3*.15,o.beginPath();let A=r*.55;o.moveTo(0,A),o.bezierCurveTo(120,A+Math.sin(r)*5,350,A-2,512,A+1),o.stroke()}let i=new oe(n);i.colorSpace=te,s.textures.push(i);let u=new C({color:14924936,map:i,roughness:.35}),l=new C({color:14140840,roughness:.92}),m=(r,A,g,x,E,G,k=s.stone)=>T(new gt(r,A,g,5,Math.min(.18,A/3)),k,t(x,E,G));m(6,.25,2.8,4,1.15,3,u),m(1.8,1.1,1.5,4,.58,3);for(let r=0;r<3;r++)m(1.2,.24,1.2,1.8+r*2.1,.7,5.5,l),m(1.2,1.4,.24,1.8+r*2.1,1.15,6.1,l),M(.4,.7,v+1.8+r*2.1,a+.35,p+5.5,s.gold);let b=new H({color:2643035,roughness:.22,metalness:.45});m(1.1,.64,.06,4,1.75,3.5,b),c(.05,.3,.08,v+4,a+1.4,p+3.5,s.gold),m(1.5,.035,.6,4,1.3,2.8,s.darkGold);for(let r=0;r<2;r++)m(.45,.06,.6,2.3,1.33+r*.065,2.9,r?s.stone:u);m(4.8,.5,1.8,-7,.65,4,l),m(4.8,.8,.35,-7,1.15,4.8,l),M(1.2,.13,v-3,a+.8,p+5,s.darkGold),M(.18,.7,v-3,a+.4,p+5,s.gold);let f=new P(new ct(.65,3),new H({color:6082525,emissive:2004645,emissiveIntensity:.7,metalness:.4,roughness:.15,transparent:!0,opacity:.7}));f.position.copy(t(-3,1.8,5)),d.add(f);for(let r=0;r<3;r++)T(new F(1.02,.012,5,64),s.gold,t(-3,1.8,5),new I(.5+r*.5,.4+r,.2));for(let r=0;r<4;r++){c(10,.16,1,v-5,a+1.4+r*1.4,p-9,u);for(let A=0;A<12;A++)c(.25,.7+A%3*.12,.5,v-9.3+A*.75,a+1.83+r*1.4,p-9,A%3?s.stone:s.gold)}}var Y=ze(Ne(),1);function At({quality:d,mode:s,view:w,onUnavailable:T,location:c="plaza"}){let M=(0,Z.useRef)(null),h=(0,Z.useRef)(new Set),v=(0,Z.useRef)(()=>{}),p=(0,Z.useRef)(()=>{}),[a,t]=(0,Z.useState)(!1);return(0,Z.useEffect)(()=>v.current(w),[w]),(0,Z.useEffect)(()=>p.current(s),[s]),(0,Z.useEffect)(()=>{let e=M.current,n;try{n=new pt({antialias:!0,powerPreference:"low-power"})}catch{T();return}t(!1);let o=d==="low",i=d==="high";n.setPixelRatio(Math.min(devicePixelRatio,o?1:i?1.8:1.35)),n.toneMapping=Oe,n.toneMappingExposure=.95,n.outputColorSpace=te,n.shadowMap.enabled=!0,n.shadowMap.type=We,n.domElement.setAttribute("aria-label",c==="office"?"Principal\u2019s Office overlooking Orb Plaza, AUREVIA":"Orb Plaza, AUREVIA"),n.domElement.setAttribute("role","img"),e.prepend(n.domElement);let u=new Je;u.fog=new Qe(12900058,.0013);let l=new $e(55,1,.15,1600);l.rotation.order="YXZ";let m=new y(-.7,.24,.6).normalize(),b=new le;b.scale.setScalar(1e3),b.material.uniforms.turbidity.value=3.5,b.material.uniforms.rayleigh.value=1.8,b.material.uniforms.mieCoefficient.value=.004,b.material.uniforms.mieDirectionalG.value=.82,b.material.uniforms.sunPosition.value.copy(m),u.add(b);let f=new P(new K(800,48,24),new Q({side:pe,transparent:!0,depthWrite:!1,uniforms:{sun:{value:m}},vertexShader:"varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:`varying vec3 vDirection;uniform vec3 sun;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 float fbm(vec2 p){float n=0.;float a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+vec2(12.3,4.7);a*=.5;}return n;}
 void main(){vec3 d=normalize(vDirection);vec2 p=d.xz/(max(d.y,0.)+.14)*1.5;float density=smoothstep(.43,.73,fbm(p));density*=smoothstep(0.,.13,d.y);float light=fbm(p+vec2(.16,.1));vec3 col=mix(vec3(.56,.64,.7),vec3(1.,.91,.76),light*.8+.25);gl_FragColor=vec4(col,density*.9);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}));f.renderOrder=1,u.add(f),u.add(new ut(14084607,10261624,.65));let r=new dt(16766624,3.7);r.position.copy(m).multiplyScalar(90),r.castShadow=!0,r.shadow.mapSize.setScalar(o?1024:i?4096:2048),r.shadow.camera.left=-45,r.shadow.camera.right=45,r.shadow.camera.top=45,r.shadow.camera.bottom=-45,r.shadow.camera.near=1,r.shadow.camera.far=180,r.shadow.normalBias=.035,r.shadow.bias=-15e-5,u.add(r);let A=new mt(n),g=new ht,x=A.fromScene(g,.04);u.environment=x.texture,u.environmentIntensity=.65,g.dispose(),A.dispose();let E=vt(),G=bt(u,E,c==="plaza"),k=yt(u,E,d,m),B=c==="plaza"?Mt(u,E,G,o):{update:S=>{},dispose:()=>{}};c==="plaza"?xt(E,G):St(u,E,G),G.finish();let z=new y,_=new ge,V=!1,L=c==="plaza"&&s==="explore",D=0,re=matchMedia("(prefers-reduced-motion: reduce)");function $(S,R=!1){D=0;let U=c==="office"?{position:[-29,17.1,-18],look:[-22,17.8,5]}:Ie[S]||Ie.arrival;z.fromArray(U.position);let W=l.clone();W.position.copy(z),W.lookAt(new y().fromArray(U.look)),_.copy(W.quaternion),R||re.matches?(l.position.copy(z),l.quaternion.copy(_),V=!1):V=!0}function ae(S){if(D=0,L=c==="plaza"&&S==="explore",h.current.clear(),L){let R=[l.position.x,2.1,l.position.z];Xe(R)?l.position.fromArray(R):(l.position.set(9,2.1,16),l.lookAt(0,4,-3)),V=!1}}v.current=S=>$(S),p.current=ae,$(w,!0),L&&ae(s);let N=null,se=S=>{L&&(N={x:S.clientX,y:S.clientY},e.setPointerCapture(S.pointerId),e.focus())},ee=S=>{!N||!L||(l.rotation.y-=(S.clientX-N.x)*.0035,l.rotation.x=Math.max(-.95,Math.min(.95,l.rotation.x-(S.clientY-N.y)*.003)),N={x:S.clientX,y:S.clientY})},ue=()=>{N=null},Be=S=>{if(!L||["INPUT","SELECT","TEXTAREA","BUTTON"].includes(S.target.tagName))return;let R=S.key.toLowerCase();["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(R)&&(S.preventDefault(),h.current.add(R))},Ce=S=>h.current.delete(S.key.toLowerCase()),j=()=>{h.current.clear(),N=null};e.addEventListener("pointerdown",se),e.addEventListener("pointermove",ee),e.addEventListener("pointerup",ue),e.addEventListener("pointercancel",ue),e.addEventListener("keydown",Be),e.addEventListener("keyup",Ce),e.addEventListener("blur",j),window.addEventListener("blur",j);let Re=new ResizeObserver(()=>{D=0;let S=e.clientWidth,R=e.clientHeight;!S||!R||(n.setSize(S,R),l.aspect=S/R,l.updateProjectionMatrix())});Re.observe(e);let xe=0,Se=0,Ee=!0,Ae=0,Pe=!1,ke=!1,Ve=new IntersectionObserver(([S])=>{Ee=S.isIntersecting,Ee||j()});Ve.observe(e);let Le=S=>{S.preventDefault(),Pe=!0,T()};n.domElement.addEventListener("webglcontextlost",Le);let De=()=>{document.hidden&&j()};document.addEventListener("visibilitychange",De);function Ue(S){if(ke||Pe)return;if(xe=requestAnimationFrame(Ue),document.hidden||!Ee){Se=S;return}let R=(S-Se)/1e3;if(R<(o?1/24:i?1/45:1/30))return;Se=S;let U=Math.min(R,.05);Ae+=U;let W=h.current.size>0;if(V){let O=1-Math.exp(-U*6);l.position.lerp(z,O),l.quaternion.slerp(_,O),l.position.distanceTo(z)<.015&&(V=!1)}if(L&&W){let O=h.current,fe=Number(O.has("w")||O.has("arrowup"))-Number(O.has("s")||O.has("arrowdown")),de=Number(O.has("d")||O.has("arrowright"))-Number(O.has("a")||O.has("arrowleft")),_e=Math.hypot(fe,de)||1;fe/=_e,de/=_e;let me=l.rotation.y;l.position.fromArray(Fe(l.position.toArray(),(-Math.sin(me)*fe+Math.cos(me)*de)*U*4,(-Math.cos(me)*fe-Math.sin(me)*de)*U*4))}if(!re.matches)k.update(Ae),B.update(Ae);else if(!W&&!N&&!V&&D++>2)return;try{n.render(u,l),e.dataset.ready="true"}catch{Pe=!0,T()}}return xe=requestAnimationFrame(Ue),t(!0),()=>{ke=!0,cancelAnimationFrame(xe),j(),Re.disconnect(),Ve.disconnect(),window.removeEventListener("blur",j),document.removeEventListener("visibilitychange",De),e.removeEventListener("pointerdown",se),e.removeEventListener("pointermove",ee),e.removeEventListener("pointerup",ue),e.removeEventListener("pointercancel",ue),e.removeEventListener("keydown",Be),e.removeEventListener("keyup",Ce),e.removeEventListener("blur",j),n.domElement.removeEventListener("webglcontextlost",Le),delete e.dataset.ready,k.dispose(),B.dispose();let S=new Set,R=new Set;u.traverse(U=>{let W=U;W.geometry&&S.add(W.geometry),W.material&&(Array.isArray(W.material)?W.material:[W.material]).forEach(O=>R.add(O))}),S.forEach(U=>U.dispose()),R.forEach(U=>U.dispose()),E.textures.forEach(U=>U.dispose()),x.dispose(),n.dispose(),n.forceContextLoss(),n.domElement.remove(),v.current=()=>{},p.current=()=>{}}},[d,c]),(0,Y.jsxs)("div",{className:"aurevia-scene-wrap",children:[(0,Y.jsx)("div",{className:"aurevia-scene",ref:M,tabIndex:0,"aria-label":"Explore Orb Plaza. Drag to look. W A S D or arrow keys to walk."}),!a&&(0,Y.jsx)("p",{role:"status",children:"Opening Orb Plaza\u2026"}),c==="plaza"&&s==="explore"&&(0,Y.jsxs)(Y.Fragment,{children:[(0,Y.jsx)("div",{className:"aurevia-move",role:"group","aria-label":"Walking controls",children:[["w","Forward","\u2191"],["a","Left","\u2190"],["s","Back","\u2193"],["d","Right","\u2192"]].map(([e,n,o])=>(0,Y.jsx)("button",{"aria-label":"Walk "+n,onPointerDown:i=>{i.preventDefault(),i.currentTarget.setPointerCapture(i.pointerId),h.current.add(e)},onPointerUp:()=>h.current.delete(e),onPointerCancel:()=>h.current.delete(e),onLostPointerCapture:()=>h.current.delete(e),onKeyDown:i=>{(i.key==="Enter"||i.key===" ")&&(i.preventDefault(),h.current.add(e))},onKeyUp:()=>h.current.delete(e),onBlur:()=>h.current.delete(e),children:o},e))}),(0,Y.jsx)("p",{className:"aurevia-scene-note",children:"Drag to look \xB7 WASD / arrows to walk"})]})]})}export{At as default};
