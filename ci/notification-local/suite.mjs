// PROPOSED, NOT EXECUTED. Real native local Supabase Auth + REST + Edge.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {createNotificationPreferenceWriter} from '/source/app/frontend/src/lib/notificationPreferenceWrite.ts';
const {createClient}=createRequire(import.meta.url)('@supabase/supabase-js');
const phase=process.argv[2];
const origin='http://kong:8000';
const table='app_11941c8fec_notification_preferences';
const push='app_11941c8fec_push_subscriptions';
const flags=['prayer_reminders','bill_reminders','habit_reminders','fasting_reminders','savings_reminders','general_activity'];
const columns=['user_id',...flags,'timezone','language','prayer_calc_method','prayer_location_mode','prayer_manual_city'].join(',');
const result={subject:'f29d8df16e434e8cd064968e4b832e9c8f84e2fb',phase,checks:[],passed:false,hostedVerified:false,productionReady:false};
const pass=name=>{result.checks.push(name);console.log(`PASS: ${name}`);};
const safeFetch=async(input,init={})=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(u.origin!==origin)throw Error('Only local gateway allowed');
 return fetch(u,{...init,redirect:'error',signal:AbortSignal.timeout(phase==='warm'?120000:15000)});
};
const sdk=(key,request=safeFetch)=>createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}});
const assertOk=response=>assert.ok(response.status>=200&&response.status<300,'Expected successful local response');
const denied=response=>assert.ok([401,403].includes(response.status),'Expected authorization denial');
let users;
async function client(index,request=safeFetch){
 const c=sdk(users.publicKey,request);
 const {data,error}=await c.auth.signInWithPassword({email:users.accounts[index].email,password:users.accounts[index].password});
 assert.equal(error,null);assert.equal(data.user?.id,users.accounts[index].id);
 assert.equal((await c.auth.getUser()).data.user?.id,users.accounts[index].id);
 return c;
}
async function own(c,index){
 const {data,error}=await c.from(table).select(columns).eq('user_id',users.accounts[index].id).single();
 assert.equal(error,null);assert.equal(data.user_id,users.accounts[index].id);return data;
}
async function http(path,token,{method='GET',body,headers={}}={}){
 return safeFetch(origin+path,{method,headers:{apikey:users.publicKey,...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
}
async function edge(token,body,headers){return http('/functions/v1/app_11941c8fec_push_notify',token,{method:'POST',body,headers});}
try {
 if(phase==='warm'){
  const status=JSON.parse(readFileSync('/status.json','utf8'));
  const publicKey=status.ANON_KEY??status.anon_key;
  const runtime=await safeFetch(origin+'/functions/v1/ci_runtime_probe',{headers:{apikey:publicKey}});
  assert.equal(runtime.status,200);
  assert.deepEqual(await runtime.json(),{deno:'2.1.4',os:'linux',arch:'x86_64'});
  pass('Actual local Edge worker reports pinned Deno 2.1.4 on linux/x86_64');
  const response=await safeFetch(origin+'/functions/v1/app_11941c8fec_push_notify',{
   method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({action:'get_preferences'})});
  assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).error,'Unauthorized');
  pass('Original Edge module loaded and application guard reached without a user JWT');
 }else if(phase==='users'){
  const status=JSON.parse(readFileSync('/status.json','utf8'));
  const service=status.SERVICE_ROLE_KEY??status.service_role_key;
  const publicKey=status.ANON_KEY??status.anon_key;
  assert.ok(service&&publicKey);
  const admin=sdk(service);
  const accounts=[];
  for(const label of ['a','b']){
   const email=`notification-${label}@example.invalid`,password=randomBytes(24).toString('hex');
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{amanahlife_fixture:'notification-007'}});
   assert.equal(error,null);assert.match(data.user.id,/^[0-9a-f-]{36}$/);
   accounts.push({id:data.user.id,email,password});
  }
  writeFileSync('/results/accounts.local.json',JSON.stringify({publicKey,accounts}),{mode:0o600});
  pass('Exactly two native local Auth users, auto-confirmed without SMTP');
 } else {
  users=JSON.parse(readFileSync('/users.json','utf8'));
  if(phase==='cleanup'){
   const status=JSON.parse(readFileSync('/status.json','utf8'));
   const admin=sdk(status.SERVICE_ROLE_KEY??status.service_role_key);
   for(const user of users.accounts)assert.equal((await admin.auth.admin.deleteUser(user.id)).error,null);
   pass('Deleted only the two synthetic local Auth users after dependent rows');
  }else if(phase==='client'){
   const a=await client(0),b=await client(1);
   const ta=(await a.auth.getSession()).data.session.access_token;
   const tb=(await b.auth.getSession()).data.session.access_token;
   const payload=JSON.parse(Buffer.from(ta.split('.')[1],'base64url').toString());
   assert.equal(payload.sub,users.accounts[0].id);assert.equal(payload.role,'authenticated');
   assert.equal(payload.aud,'authenticated');assert.ok(payload.exp>Date.now()/1000);
   assert.notEqual(ta,tb);pass('Real Auth password login, SDK getSession/getUser and distinct JWT identities');
   for(const token of [undefined,'malformed.jwt',ta.split('.').map((part,i)=>i===1?Buffer.from(JSON.stringify({...payload,sub:users.accounts[1].id})).toString('base64url'):part).join('.')]){
    denied(await http(`/rest/v1/${table}?select=${columns}`,token));
    denied(await http(`/rest/v1/${table}?user_id=eq.${users.accounts[0].id}`,token,{method:'PATCH',body:{bill_reminders:true}}));
   }
   pass('Missing, malformed and tampered identity JWT rejected for read/write');
   const initial=await own(a,0);assert.equal(initial.bill_reminders,false);
   const foreign=await a.from(table).update({bill_reminders:true},{count:'exact'}).eq('user_id',users.accounts[1].id);
   assert.equal(foreign.error,null);assert.equal(foreign.count,0);
   const self=await a.from(table).update({bill_reminders:false},{count:'exact'}).eq('user_id',users.accounts[0].id);
   assert.equal(self.error,null);assert.equal(self.count,1);
   pass('Real PostgREST count=exact: own=1 and foreign=0');
   const settings={method:'UmmAlQura',mode:'manual',city:{name:'Fixture',nameAr:'Fixture',country:'Fixture',countryCode:'XX',lat:21,lon:39},timezone:'UTC',language:'ar'};
   await createNotificationPreferenceWriter(a).syncLocation(users.accounts[0].id,settings);
   assert.equal((await own(a,0)).bill_reminders,false);
   await createNotificationPreferenceWriter(a).restore(users.accounts[0].id,{...Object.fromEntries(flags.map(k=>[k,false])),user_id:users.accounts[1].id,id:'old',updated_at:'2099-01-01',last_suhoor_sent_date:'2099-01-01'});
   for(const k of flags)assert.equal((await own(a,0))[k],false);
   pass('PrayerTimes and BackupRestore actual facade preserves false and drops foreign identity/internal fields');
   // Two independent native Auth SDK sessions for B; no B row exists yet.
   let waiting=0,release;const barrier=new Promise(resolve=>{release=resolve;});const events=[];
   const raceFetch=async(input,init)=>{
    const response=await safeFetch(input,init);
    const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(u.pathname===`/rest/v1/${table}`&&['PATCH','POST'].includes(init?.method)){
     events.push({method:init.method,status:response.status});
     if(init.method==='PATCH'&&response.ok&&/\/0$/.test(response.headers.get('content-range')||'')){
      if(++waiting===2)release();
      await Promise.race([barrier,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Actual zero-row race did not occur')),10000);t.unref();})]);
     }
    }
    return response;
   };
   const b1=await client(1,raceFetch),b2=await client(1,raceFetch);
   await Promise.all([createNotificationPreferenceWriter(b1).syncLocation(users.accounts[1].id,settings),
    createNotificationPreferenceWriter(b2).restore(users.accounts[1].id,{bill_reminders:false,habit_reminders:false,user_id:users.accounts[0].id})]);
   assert.equal(waiting,2);assert.deepEqual(events.filter(e=>e.method==='POST').map(e=>e.status).sort(),[201,409]);
   assert.equal(events.filter(e=>e.method==='PATCH').length,3);
   const rb=await own(b,1);assert.equal(rb.bill_reminders,false);assert.equal(rb.habit_reminders,false);
   assert.equal(rb.prayer_manual_city.lat,21);assert.equal(rb.prayer_location_mode,'manual');assert.equal(rb.savings_reminders,true);
   pass('First INSERT race: 2 zero-row PATCHes, 201/23505, exactly one retry, no lost fields');
   for(const c of [a,b]){
    assert.ok((await c.from(table).select('*')).error);
    assert.ok((await c.from(push).select('endpoint,auth_key')).error);
    for(const patch of [{user_id:users.accounts[0].id},{updated_at:'2099-01-01'},{last_suhoor_sent_date:'2099-01-01'},{id:'99999999-9999-4999-8999-999999999999'}]){
     assert.ok((await c.from(table).update(patch).eq('user_id',users.accounts[1].id)).error);
    }
    assert.ok((await c.from(table).delete().eq('user_id',users.accounts[0].id)).error);
   }
   assert.deepEqual((await a.from(table).select(columns).eq('user_id',users.accounts[1].id)).data,[]);
   assert.deepEqual((await b.from(table).select(columns).eq('user_id',users.accounts[0].id)).data,[]);
   for(const [c,other] of [[a,1],[b,0]]){
    const foreignInsert=await c.from(table).insert({user_id:users.accounts[other].id,bill_reminders:true});
    assert.equal(foreignInsert.error?.code,'42501');
   }
   pass('Native JWT/RLS/column grants isolate A/B and protect identity/markers/Push');
   const pendingWriter=createNotificationPreferenceWriter(a);
   await a.auth.signOut();await assert.rejects(pendingWriter.restore(users.accounts[0].id,{bill_reminders:true}));
   await a.auth.signInWithPassword({email:users.accounts[1].email,password:users.accounts[1].password});
   await assert.rejects(pendingWriter.restore(users.accounts[0].id,{bill_reminders:true}));
   pass('Real SDK logout/account switch blocks stale-account writes');
  }else if(phase==='edge'){
   const a=await client(0),b=await client(1);const token=(await a.auth.getSession()).data.session.access_token;
   const beforeB=await own(b,1);
   const parts=token.split('.');const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());
   parts[1]=Buffer.from(JSON.stringify({...claims,sub:users.accounts[1].id})).toString('base64url');
   for(const bad of [undefined,'invalid.jwt',parts.join('.')]) denied(await edge(bad,{action:'get_preferences'}));
   const bearerOnly=await safeFetch(origin+'/functions/v1/app_11941c8fec_push_notify',{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'get_preferences'})});
   assert.equal(bearerOnly.status,200); // exact web/mobile header shape: no apikey
   const keyOnly=await safeFetch(origin+'/functions/v1/app_11941c8fec_push_notify',{
    method:'POST',headers:{apikey:users.publicKey,'Content-Type':'application/json'},body:JSON.stringify({action:'get_preferences'})});
   denied(keyOnly);
   denied(await edge(undefined,{action:'get_preferences'},{'X-Internal-Push-Secret':'synthetic-not-authorized'}));
   for(const body of [{action:'update_preferences',user_id:users.accounts[1].id,preferences:{bill_reminders:false}},
    {action:'update_preferences',preferences:{bill_reminders:false,user_id:users.accounts[1].id}},
    {action:'update_preferences',preferences:{role:'admin'}},
    {action:'update_preferences',preferences:{last_suhoor_sent_date:'2099-01-01'}}])assert.equal((await edge(token,body)).status,400);
   const enabled=await edge(token,{action:'update_preferences',preferences:{bill_reminders:true,savings_reminders:true}});
   assert.equal(enabled.status,200);assert.equal((await own(a,0)).bill_reminders,true);
   assert.equal((await own(a,0)).savings_reminders,true);
   const saved=await edge(token,{action:'update_preferences',preferences:{bill_reminders:false,savings_reminders:false}});
   assert.equal(saved.status,200);assert.equal((await saved.json()).success,true);
   const loaded=await edge(token,{action:'get_preferences'});assert.equal(loaded.status,200);
   const preferences=(await loaded.json()).preferences;assert.deepEqual(Object.keys(preferences).sort(),flags.slice().sort());
   assert.equal(preferences.bill_reminders,false);assert.equal(preferences.savings_reminders,false);
   assert.equal((await own(a,0)).bill_reminders,false);assert.deepEqual(await own(b,1),beforeB);
   pass('Actual Edge Auth.getUser + scoped service-role store: six fields, false persisted, B unchanged');
   pass('Edge missing/invalid JWT, internal-secret bypass and identity/role/marker injection rejected');
  }else if(phase==='network'){
   // Forbidden origin fails BEFORE fetch; never send a probe to real production.
   await assert.rejects(safeFetch('https://blocked-production.example.invalid/'));
   const canary=process.env.EGRESS_CANARY;
   assert.match(canary,/^http:\/\/172\.[0-9.]+:8080\/probe$/);
   let blocked=false;try{await fetch(canary,{redirect:'error',signal:AbortSignal.timeout(2000)});}catch{blocked=true;}
   assert.ok(blocked,'External-network canary reachable');
   pass('Local-origin guard rejects external URL; separate Docker-network canary unreachable');
  }else throw Error('Unknown phase');
 }
 result.passed=true;
}catch{
 console.error(`FAIL: ${phase}, after ${result.checks.length} checks; response and assertion data redacted`);
 process.exitCode=1;
}finally{
 writeFileSync(`/results/${phase}.json`,JSON.stringify(result,null,2)+'\n',{mode:0o600});
}
