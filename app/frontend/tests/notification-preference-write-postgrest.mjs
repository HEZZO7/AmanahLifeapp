// Exercises the SAME flow facade as PrayerTimes/BackupRestore using the real
// Supabase SDK and real PostgREST; only local Auth session acquisition is fixed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createNotificationPreferenceWriter} from '../src/lib/notificationPreferenceWrite.ts';
import {claims, flags, location} from './notification-postgrest-target.mjs';
const require=createRequire(process.env.NOTIFICATION_TEST_SDK_PACKAGE_JSON || new URL('../package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const settings={method:'UmmAlQura',mode:'manual',city:{name:'Fixture',nameAr:'Fixture',country:'Fixture',countryCode:'XX',lat:21,lon:39},timezone:'UTC',language:'ar'};
const newUser='33333333-3333-4333-8333-333333333333';
export async function exercisePreferenceWriteFlows(config,read,ok) {
 const events=[];
 let barrierCount=0;let release;
 const barrier=new Promise(resolve=>{release=resolve;});
 const client=(token,barrierEnabled=false)=>{
  const actor=claims(token).sub;
  const sdk=createClient(config.origin,config.publicKey || 'isolated-public-placeholder',{
   accessToken:async()=>token,
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
   global:{fetch:async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(url.origin,config.origin);assert.equal(url.pathname,'/rest/v1/app_11941c8fec_notification_preferences');
    const method=init?.method || 'GET';
    const headers=new Headers(init?.headers);assert.equal(headers.get('Authorization'),`Bearer ${token}`);
    assert.equal(url.searchParams.has('select'),false);assert.equal(url.searchParams.has('on_conflict'),false);
    assert.equal(headers.get('Prefer')?.includes('return=representation') ?? false,false);
    assert.equal(headers.get('Prefer')?.includes('resolution=merge-duplicates') ?? false,false);
    assert.ok(method==='PATCH'||method==='POST');
    const body=JSON.parse(init.body);
    if(method==='PATCH') {
     assert.equal('user_id' in body,false);assert.equal(url.searchParams.get('user_id'),`eq.${actor}`);
     assert.ok(headers.get('Prefer')?.includes('count=exact'));
    } else assert.equal(body.user_id,actor);
    for(const key of ['id','created_at','updated_at','last_suhoor_sent_date','last_iftar_sent_date','auth_key','role']) assert.equal(key in body,false);
    if(config.mode==='local-ci') url.pathname=url.pathname.slice('/rest/v1'.length);
    const response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});
    events.push({method,status:response.status,newUser:actor===newUser});
    if(barrierEnabled && method==='PATCH' && response.ok && /\/0$/.test(response.headers.get('content-range') || '')) {
     if(++barrierCount===2)release();
     await Promise.race([barrier,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Concurrent first-insert barrier timed out')),10000);t.unref();})]);
    }
    return response;
   }},
  });
  return {from:sdk.from.bind(sdk),auth:{getSession:async()=>({data:{session:{access_token:token,user:{id:actor}}},error:null})}};
 };
 const result=[];
 for(let i=0;i<2;i++) {
  const actor=config.users[i];const other=1-i;
  const before=await read(i);const otherBefore=await read(other);
  const writer=createNotificationPreferenceWriter(client(config.tokens[i]));
  await writer.syncLocation(actor,settings);
  const afterLocation=await read(i);
  for(const key of flags)assert.deepEqual(afterLocation[key],before[key],'Location write changed an unrelated flag');
  assert.equal(afterLocation.prayer_manual_city.lat,21);assert.equal(afterLocation.prayer_location_mode,'manual');
  const restored=Object.fromEntries(flags.map(key=>[key,afterLocation[key]!==true]));
  await writer.restore(actor,{...restored,user_id:config.users[other],id:'legacy-id',updated_at:'2099-01-01',
   last_suhoor_sent_date:'2099-01-01',role:'admin',timezone:'UTC',language:'ar'});
  const afterRestore=await read(i);
  for(const key of flags)assert.equal(afterRestore[key],restored[key]);
  assert.deepEqual(afterRestore.prayer_manual_city,afterLocation.prayer_manual_city,'Partial backup reset location');
  assert.deepEqual(await read(other),otherBefore,'A flow modified another account');
  const requests=events.length;
  await assert.rejects(writer.restore(config.users[other],{bill_reminders:true}));
  assert.equal(events.length,requests,'Foreign account mismatch reached storage');
  result.push({client:`PrayerTimes and BackupRestore / user ${i+1}`,status:'PASS'});
 }
 ok('actual PrayerTimes/BackupRestore facade with Supabase SDK saves both accounts and blocks target swapping');
 if(config.mode==='local-ci') {
  // C exists only in the disposable auth fixture and initially has no row.
  // Two independent clients force both PATCHes to see zero rows, then race
  // their real INSERTs. The losing insert must use the bounded PATCH retry.
  const token=process.env.NOTIFICATION_TEST_JWT_C;
  assert.equal(claims(token).sub,newUser);
  const one=createNotificationPreferenceWriter(client(token,true));
  const two=createNotificationPreferenceWriter(client(token,true));
  await Promise.all([one.syncLocation(newUser,settings),two.restore(newUser,{bill_reminders:false,habit_reminders:false,user_id:config.users[0]})]);
  const race=events.filter(e=>e.newUser);
  assert.deepEqual(race.filter(e=>e.method==='POST').map(e=>e.status).sort(),[201,409]);
  assert.equal(race.filter(e=>e.method==='PATCH').length,3);
  result.push({client:'concurrent first-row location and restore',status:'PASS'});
  ok('real concurrent first INSERT, UNIQUE conflict and bounded retry preserve independent fields');
 }
 assert.ok(events.length>0);assert.ok(events.every(e=>e.status>=200 && e.status<300 || e.status===409));
 ok('SDK request audit: no identity UPDATE, forbidden reads, representation or merge-duplicates');
 return result;
}
