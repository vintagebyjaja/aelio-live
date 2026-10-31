// Shared spatial contract. Cinematic cameras and exploration use one scene, not image swaps.
export const PLAZA_VIEWS=Object.freeze({
 arrival:{label:'Arrival',position:[-11,4,20],look:[1,5,-19]},
 orb:{label:'The Orb',position:[5.8,3.5,9],look:[0,4.3,0]},
 arcade:{label:'The Arcade',position:[-12,2.1,13],look:[-3,4,-18]},
 coast:{label:'Coastal panorama',position:[-59,26,69],look:[8,7,-36]},
});
export const PLAZA_OBSTACLES=Object.freeze([
 [-4.6,4.6,-4.6,4.6],
 ...[-1,1].flatMap(side=>[[side*20-.5,side*20+.5,8.5,9.5],[side*15-.5,side*15+.5,-13.5,-12.5],[side*28-.5,side*28+.5,-1.5,-.5]]),
 ...Array.from({length:15},(_,i)=>{const a=-1.6+i*3.2/14;return [-1,1].map(side=>{const x=Math.sin(a)*24+Math.cos(a)*side*2.7,z=-Math.cos(a)*24+Math.sin(a)*side*2.7;return [x-.48,x+.48,z-.48,z+.48];});}).flat(),
]);
export const plazaWalkable=p=>Math.hypot(p[0],p[2])<29.8&&!PLAZA_OBSTACLES.some(b=>p[0]>b[0]-.32&&p[0]<b[1]+.32&&p[2]>b[2]-.32&&p[2]<b[3]+.32)&&!(p[2]<-1&&Math.hypot(p[0],p[2])>26.5);
export function plazaStep(current,dx,dz){
 const valid=plazaWalkable;
 // Swept steps prevent tunnelling; axis sliding keeps a user from sticking to corners.
 let next=[...current];const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
 if(steps>100)return current;
 for(let i=0;i<steps;i++){
  const both=[next[0]+dx/steps,2.1,next[2]+dz/steps];
  if(valid(both))next=both;
  else {const x=[next[0]+dx/steps,2.1,next[2]];if(valid(x))next=x;const z=[next[0],2.1,next[2]+dz/steps];if(valid(z))next=z;}
 }
 return next;
}
