// Public world metadata only. No private identities, conversations or permissions.
export const DESTINATIONS=Object.freeze([
 {id:'plaza',title:'Orb Plaza',subtitle:'The heart of AUREVIA',image:'city',position:[0,2.1,17],look:[0,6,0]},
 {id:'residence',title:'Your Residence',subtitle:'A quiet place above the ocean',image:'residence',position:[-23,2.1,12],look:[-30,4,-2]},
 {id:'office',title:"Principal’s Office",subtitle:'Bring your ideas and companions together',image:'office',position:[-24,2.1,-5],look:[-34,4,-12]},
 {id:'university',title:'AELIO University',subtitle:'Evidence before achievement',image:'university',position:[22,2.1,-12],look:[30,5,-28]},
 {id:'court',title:'Courthouse',subtitle:'Reflection, evidence and accountability',image:'accountability',position:[23,2.1,10],look:[34,5,0]},
 {id:'harbor',title:'The Harbor',subtitle:'An open horizon',image:'city',position:[0,2.1,39],look:[0,3,70]},
 {id:'terraces',title:'The Terraces',subtitle:'Room to imagine what comes next',image:'conference',position:[-3,2.1,-20],look:[0,4,-35]},
]);
export const destination=id=>DESTINATIONS.find(d=>d.id===id);
export const QUALITY=Object.freeze(['low','balanced','high']);
// Shared movement contract used by the scene and regression tests.
export function walkPosition(current,dx,dz,obstacles=[]){
 const next=[current[0]+dx,current[1],current[2]+dz];
 if(Math.hypot(next[0],next[2])>47)return current;
 if(obstacles.some(b=>next[0]>b[0]-0.7&&next[0]<b[1]+0.7&&next[2]>b[2]-0.7&&next[2]<b[3]+0.7))return current;
 return next;
}
