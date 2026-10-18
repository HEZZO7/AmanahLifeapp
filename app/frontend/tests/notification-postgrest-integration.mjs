// Opt-in real HTTP/JWT/RLS tests; no signup, admin key, RPC, Edge invocation,
// notifications, payment, resource creation, or production target is supported.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {claims, columns, flags, location, target} from './notification-postgrest-target.mjs';
const config = target(process.env);
const table = 'app_11941c8fec_notification_preferences';
const push = 'app_11941c8fec_push_subscriptions';
const report = {mode:config.mode, checks:[], compatibility:[], hostedAuthVerified:false};
const ok = name => {report.checks.push(name); console.log(`PASS: ${name}`);};
// Never print response bodies, URLs containing identity filters, tokens or users.
async function http(base, path, token, method='GET', data, prefer) {
  const headers = {'Content-Type':'application/json'};
  if (config.publicKey) headers.apikey = config.publicKey;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(base + '/' + path, {method, headers,
    body:data === undefined ? undefined : JSON.stringify(data), redirect:'error', signal:AbortSignal.timeout(15000)});
  let body; try {body=await response.json();} catch {body=null;}
  return {status:response.status,body};
}
const rest = (...args) => http(config.rest,...args);
const path = (user, select=columns) => `${table}?user_id=eq.${user}&select=${select}`;
function success(r) {assert.ok(r.status>=200 && r.status<300, `Expected success, HTTP ${r.status}`);}
function forbidden(r) {assert.ok(r.status===401 || r.status===403, `Expected authorization denial, HTTP ${r.status}`);}
async function read(index) {
  const r = await rest(path(config.users[index]), config.tokens[index]); success(r);
  assert.ok(Array.isArray(r.body) && r.body.length===1,'Preseed exactly one synthetic row per user');
  assert.deepEqual(Object.keys(r.body[0]).sort(),columns.split(',').sort(),'Unexpected returned fields');
  assert.equal(r.body[0].user_id,config.users[index]); return r.body[0];
}
async function patch(index,data) {
  const r = await rest(path(config.users[index]),config.tokens[index],'PATCH',data,'return=representation');
  success(r); assert.ok(Array.isArray(r.body) && r.body.length===1,'Own PATCH did not save exactly one row');
  return r.body[0];
}
let before;
let changed = false;
try {
  if (config.mode==='isolated-hosted') {
    for (let i=0;i<2;i++) {
      const r=await http(config.origin,'auth/v1/user',config.tokens[i]); success(r);
      assert.equal(r.body?.id,config.users[i],'Auth identity differs from JWT subject');
      assert.equal(r.body?.user_metadata?.amanahlife_fixture,'notification-007','Dedicated synthetic fixture metadata required');
    }
    report.hostedAuthVerified=true; ok('both sessions verified by hosted Supabase Auth');
  }
  before=await Promise.all([read(0),read(1)]); ok('two users read only allowed own columns');
  changed=true; // even an unexpectedly successful foreign write needs cleanup
  for (let i=0;i<2;i++) {
    const r=await rest(path(config.users[1-i]),config.tokens[i]); success(r); assert.deepEqual(r.body,[]);
    const update=await rest(path(config.users[1-i]),config.tokens[i],'PATCH',{bill_reminders:false},'return=representation');
    success(update); assert.deepEqual(update.body,[]);
  }
  ok('cross-account reads and updates affect no rows (both directions)');
  forbidden(await rest(`${table}?select=${columns}`,undefined));
  forbidden(await rest(`${table}?select=${columns}`,'not-a-jwt'));
  const pieces=config.tokens[0].split('.');
  pieces[1]=Buffer.from(JSON.stringify({...claims(config.tokens[0]),sub:config.users[1]})).toString('base64url');
  const forged=pieces.join('.');
  forbidden(await rest(`${table}?select=${columns}`,forged));
  forbidden(await rest(path(config.users[1]),forged,'PATCH',{bill_reminders:false}));
  ok('missing, malformed and forged identity JWTs cannot read or write');
  for (const token of config.tokens) {
    forbidden(await rest(`${table}?select=*`,token));
    forbidden(await rest(`${push}?select=endpoint,p256dh,auth_key`,token));
    forbidden(await rest(`${push}`,token,'POST',{user_id:config.users[0],endpoint:'https://fixture.invalid/no-send',p256dh:'fixture',auth_key:'fixture'}));
  }
  ok('wildcard/internal preference reads and Push secret reads/writes blocked');
  // Every permitted mutation is restored, even if a later assertion fails.
  changed=true;
  for (let i=0;i<2;i++) {
    const patchFlags=Object.fromEntries(flags.map(k=>[k,before[i][k]!==true]));
    const saved=await patch(i,patchFlags);
    for (const k of flags) assert.equal(saved[k],patchFlags[k],'Flag response does not match saved value');
    const savedLocation=await patch(i,{timezone:'UTC',language:'ar',prayer_calc_method:'UmmAlQura',prayer_location_mode:'manual',
      prayer_manual_city:{name:'Fixture',nameAr:'Fixture',country:'Fixture',countryCode:'XX',lat:21,lon:39}});
    for (const k of flags) assert.equal(savedLocation[k],patchFlags[k],'Location PATCH reset a flag');
    assert.equal(savedLocation.timezone,'UTC');assert.equal(savedLocation.prayer_location_mode,'manual');
    assert.equal(savedLocation.prayer_manual_city?.lat,21);
  }
  ok('own six-flag writes and five location fields persist without resetting flags');
  for (let i=0;i<2;i++) {
    for (const body of [{user_id:config.users[1-i]},{updated_at:'2099-01-01'},{id:'99999999-9999-4999-8999-999999999999'},
      {last_suhoor_sent_date:'2099-01-01'},{last_iftar_sent_date:'2099-01-01'},{created_at:'2099-01-01'}]) {
      forbidden(await rest(path(config.users[i]),config.tokens[i],'PATCH',body));
    }
    forbidden(await rest(`${table}`,config.tokens[i],'POST',{user_id:config.users[1-i],bill_reminders:false}));
    forbidden(await rest(path(config.users[i]),config.tokens[i],'DELETE'));
  }
  ok('identity/internal fields, foreign INSERT and DELETE blocked for both users');
  // This probes the CURRENT Supabase-js location/restore shape. PostgREST
  // merge-duplicates also updates user_id, unlike the hand-written SQL test.
  for (const [name,body] of [
    ['PrayerTimes location upsert',{user_id:config.users[0],timezone:'UTC',language:'ar',prayer_calc_method:'UmmAlQura',prayer_location_mode:'manual',prayer_manual_city:null}],
    ['BackupRestore preference upsert',{user_id:config.users[0],bill_reminders:false}],
  ]) {
    const r=await rest(`${table}?on_conflict=user_id`,config.tokens[0],'POST',body,'resolution=merge-duplicates,return=minimal');
    if(r.status===401 || r.status===403) {
      report.compatibility.push({client:name,status:'BLOCKED',reason:'PostgREST merge-duplicates requires UPDATE(user_id), intentionally not granted'});
      console.log(`BLOCKER: current ${name} is incompatible with the identity-column restriction`);
    } else {success(r);report.compatibility.push({client:name,status:'accepted'});}
  }
} catch (error) {
  // Assert failures may contain actual data: do not log raw error/stack/body.
  report.failure=true;
  console.error(`FAIL: integration check ${report.checks.length+1}; HTTP/assertion details redacted`);
  process.exitCode=1;
} finally {
  if (changed && before) {
    try {
      for (let i=0;i<2;i++) {
        await patch(i,Object.fromEntries([...flags,...location].map(k=>[k,before[i][k]])));
        assert.deepEqual(await read(i),before[i],'Synthetic preference restore mismatch');
      }
      ok('confirmed original allowed preferences restored for both synthetic users');
    } catch {report.restoreFailed=true;process.exitCode=1;console.error('FAIL: synthetic account restoration; isolated operator cleanup required');}
  }
  report.securityPassed=!report.failure&&!report.restoreFailed;
  report.rolloutReady=false; // CI is not hosted deployment approval; compatibility gates remain.
  writeFileSync('notification-postgrest-results.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Security checks: ${report.securityPassed?'PASS':'FAIL'}; hosted Auth verified: ${report.hostedAuthVerified}; rollout: NOT APPROVED`);
}
