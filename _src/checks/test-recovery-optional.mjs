import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recovery} from '../platform/recovery.js';
test('answer-only setup needs no guest secret and never changes password, sessions or codes',async()=>{
 const original=globalThis.fetch, calls=[];
 globalThis.fetch=async(url,opts={})=>{calls.push([String(url),opts]);let value;
 if(String(url).endsWith('/auth/v1/user'))value={id:'fixture-owner',email:'owner@example.test'};
 else if(String(url).includes('/auth/v1/token?'))value={user:{id:'fixture-owner'}};
 else if(String(url).endsWith('/app_limit'))value=true;
 else if(String(url).endsWith('/app_save_recovery_questions'))value=null;
 else throw Error('Unexpected privileged operation: '+url);
 return Response.json(value);};
 try{
 const request=new Request('https://aelio.test/api/platform/recovery/enroll',{method:'POST',headers:{authorization:'Bearer fixture-user','content-type':'application/json'},body:JSON.stringify({password:'unchanged-password',questions:['First private question?','Second private question?'],answers:['first answer','second answer']})});
 const response=await recovery(request,{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',AELIO_SESSION_SECRET:'short'},'/enroll');
 const result=await response.json();assert.equal(result.ok,true);assert.equal(result.password_changed,false);assert.equal(result.codes,undefined);
 const saved=JSON.parse(calls.find(([url])=>url.endsWith('/app_save_recovery_questions'))[1].body);
 assert.equal(saved.uid,'fixture-owner');assert.equal(saved.hashes.length,2);assert.notEqual(saved.hashes[0].salt,saved.hashes[1].salt);assert.ok(!JSON.stringify(saved).includes('first answer'));
 }finally{globalThis.fetch=original;}
});
