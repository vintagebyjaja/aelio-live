export const CHARACTER_OPTIONS=Object.freeze({style:['realistic','cinematic','stylized','anime','cartoon','custom'],presentation:['feminine','masculine','nonbinary'],body:['slim','balanced','athletic','curvy','broad'],face:['oval','heart','round','defined'],hair:['waves','bob','curls','braids','bun','short','bald'],texture:['straight','wavy','coily'],outfit:['casual','professional','hoodie','athletic','dress'],shoes:['sneakers','boots','formal'],accessories:['glasses','hoops','necklace','watch']});
export const CHARACTER_DEFAULT=Object.freeze({style:'cinematic',presentation:'feminine',body:'balanced',skin:'#bc805a',face:'oval',hair:'waves',hairColor:'#2e1b13',texture:'wavy',eyeColor:'#704d32',outfit:'casual',clothingColor:'#ddccb0',shoes:'sneakers',accessories:['hoops'],height:1,nose:.5,eyes:.5,jaw:.5});
export function characterConfig(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.prototype.hasOwnProperty.call(CHARACTER_DEFAULT,k)))throw Error('Choose supported character settings.');
 const c={...CHARACTER_DEFAULT,...value};
 for(const key of ['style','presentation','body','face','hair','texture','outfit','shoes'])if(!CHARACTER_OPTIONS[key].includes(c[key]))throw Error('Choose an available '+key+'.');
 for(const key of ['skin','hairColor','eyeColor','clothingColor'])if(typeof c[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(c[key]))throw Error('Choose a valid character color.');
 if(!Array.isArray(c.accessories)||c.accessories.length>4||new Set(c.accessories).size!==c.accessories.length||c.accessories.some(a=>!CHARACTER_OPTIONS.accessories.includes(a)))throw Error('Choose supported accessories.');
 for(const key of ['height','nose','eyes','jaw'])if(typeof c[key]!=='number'||!Number.isFinite(c[key])||c[key]<(key==='height'?.85:0)||c[key]>(key==='height'?1.15:1))throw Error('Adjust character proportions within the available range.');
 return c;
}
export function characterDocument(value){
 if(!value||value.version!==1||Object.keys(value).some(k=>!['version','current','presets'].includes(k)))throw Error('Choose a supported character configuration.');
 const current=characterConfig(value.current),presets=value.presets||[];
 if(!Array.isArray(presets)||presets.length>12)throw Error('Save up to 12 appearance presets.');
 const ids=new Set();return {version:1,current,presets:presets.map(p=>{if(!p||typeof p.id!=='string'||!/^[a-z0-9_-]{1,50}$/i.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>50)throw Error('Give each appearance preset a unique ID and name.');ids.add(p.id);return{id:p.id,name:p.name.trim(),config:characterConfig(p.config)};})};
}
