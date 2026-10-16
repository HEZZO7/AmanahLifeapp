// Actual preference action + scoped store, deliberately privileged fake backend.
// No Supabase, SMTP, Web Push or paid API connection; run with deny-network.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePreferenceAction, preferenceKeys } from '../supabase/functions/_shared/notificationPreferences.ts';
import { scopedPreferenceStore } from '../supabase/functions/_shared/notificationPreferencesStore.ts';

const actor='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const table='app_11941c8fec_notification_preferences';
const sensitive='DO_NOT_EXPOSE_TOKEN_OR_DATABASE_DETAILS';
const defaults=Object.fromEntries(preferenceKeys.map(key=>[key,true]));
function fixture() {
  const rows=new Map([
    [actor,{...defaults,user_id:actor,bill_reminders:false,language:'ar',timezone:'Asia/Riyadh',last_iftar_sent_date:'fixture-date'}],
    [other,{...defaults,user_id:other,habit_reminders:false,language:'en',role:'private-other-account'}],
  ]);
  const calls=[];
  const client={from:name=>{
    assert.equal(name,table);calls.push(['table',name]);
    return {
      select:columns=>{
        calls.push(['select',columns]);
        return {eq:(column,id)=>{
          calls.push(['filter',column,id]);assert.equal(column,'user_id');
          return {maybeSingle:async()=>({data:rows.get(id)??null,error:null})};
        }};
      },
      upsert:async(row,options)=>{
        calls.push(['upsert',structuredClone(row),options]);
        rows.set(row.user_id,{...(rows.get(row.user_id)||defaults),...row});
        return {data:null,error:null};
      },
    };
  }};
  const deps={
    user:async token=>{calls.push(['auth',token]);return token==='actor-token'?{id:actor}:token==='other-token'?{id:other}:null;},
    store:id=>{calls.push(['store',id]);return scopedPreferenceStore(client,id);},
  };
  const invoke=async(body,authorization='Bearer actor-token',headers={})=>{
    const req=new Request('https://isolated.invalid/push',{method:'POST',headers:{...(authorization?{Authorization:authorization}:{}),...headers},body:JSON.stringify(body)});
    // Same parsing/dispatch boundary as the index; only the preference handler runs.
    return handlePreferenceAction(req,await req.json(),deps,{});
  };
  return {rows,calls,client,deps,invoke};
}
const untouched=f=>{assert.equal(f.calls.some(x=>['store','table','upsert','select'].includes(x[0])),false);};

for(const field of ['user_id','id','owner_id','role','is_admin','created_at','updated_at','last_suhoor_sent_date','last_iftar_sent_date','timezone','language','prayer_calc_method','prayer_location_mode','prayer_manual_city','__proto__','constructor']) {
  test(`reject forbidden nested field ${field} without opening privileged storage`,async()=>{
    const f=fixture();const before=structuredClone([...f.rows]);
    const preferences=JSON.parse(`{"bill_reminders":true,"${field}":"${other}"}`);
    const r=await f.invoke({action:'update_preferences',preferences});
    assert.equal(r.status,400);untouched(f);assert.deepEqual([...f.rows],before);
  });
}
for(const action of ['update_preferences','get_preferences']) {
  for(const field of ['user_id','id','target_user_id','role','filter','headers','preferences']) {
    if(action==='update_preferences'&&field==='preferences')continue;
    test(`${action}: rejects top-level target/control field ${field}`,async()=>{
      const f=fixture();const body={action,...(action==='update_preferences'?{preferences:{bill_reminders:true}}:{}),[field]:other};
      const r=await f.invoke(body);assert.equal(r.status,400);untouched(f);
    });
  }
  for(const auth of ['', 'Basic actor-token','Bearer forged','Bearer expired-token','Bearer two tokens']) {
    test(`${action}: unauthorized or malformed JWT ${auth||'absent'} cannot read/write`,async()=>{
      const f=fixture();const r=await f.invoke({action,...(action==='update_preferences'?{preferences:{bill_reminders:false}}:{})},auth);
      assert.equal(r.status,401);untouched(f);
    });
  }
  test(`${action}: internal scheduler secret alone is not a preference authorization`,async()=>{
    const f=fixture();const r=await f.invoke({action,preferences:{bill_reminders:false}},'',{'X-Internal-Push-Secret':'fake-internal-secret'});
    assert.equal(r.status,401);untouched(f);
  });
  test(`${action}: auth outage is fail closed and redacted`,async()=>{
    const f=fixture();f.deps.user=async()=>{throw new Error(sensitive);};
    const r=await f.invoke({action,...(action==='update_preferences'?{preferences:{bill_reminders:false}}:{})});
    assert.equal(r.status,503);assert.equal((await r.text()).includes(sensitive),false);untouched(f);
  });
  test(`${action}: credential/client setup failure cannot fall through to the legacy handler`,async()=>{
    const f=fixture();f.deps.store=()=>{throw new Error(sensitive);};
    const r=await f.invoke({action,...(action==='update_preferences'?{preferences:{bill_reminders:false}}:{})});
    assert.ok(r instanceof Response);assert.equal(r.status,503);assert.equal((await r.text()).includes(sensitive),false);
  });
}
for(const value of [null,[],true,false,'false',1,{}, {bill_reminders:'false'}, {bill_reminders:0}, {bill_reminders:null}, {bill_reminders:[]}, {bill_reminders:{}}, {bill_reminders:true,unknown:true}]) {
  test(`invalid patch ${JSON.stringify(value)} rejected without partial write`,async()=>{
    const f=fixture();const r=await f.invoke({action:'update_preferences',preferences:value});
    assert.equal(r.status,400);untouched(f);
  });
}
test('a correct partial patch changes only own allowed flags and server timestamp',async()=>{
  const f=fixture();const beforeOther=structuredClone(f.rows.get(other));const beforeOwn=structuredClone(f.rows.get(actor));
  const r=await f.invoke({action:'update_preferences',preferences:{bill_reminders:true,savings_reminders:false}});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{success:true});
  assert.deepEqual(f.rows.get(other),beforeOther);assert.equal(f.rows.get(actor).bill_reminders,true);assert.equal(f.rows.get(actor).savings_reminders,false);
  for(const key of ['language','timezone','last_iftar_sent_date','habit_reminders'])assert.equal(f.rows.get(actor)[key],beforeOwn[key]);
  const write=f.calls.find(x=>x[0]==='upsert');
  assert.deepEqual(Object.keys(write[1]).sort(),['bill_reminders','savings_reminders','user_id','updated_at'].sort());
  assert.equal(write[1].user_id,actor);assert.ok(Number.isFinite(Date.parse(write[1].updated_at)));assert.deepEqual(write[2],{onConflict:'user_id'});
  assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('the existing six-boolean web payload is preserved, including all-false values',async()=>{
  const f=fixture();const preferences=Object.fromEntries(preferenceKeys.map(key=>[key,false]));
  assert.equal((await f.invoke({action:'update_preferences',preferences})).status,200);
  const r=await f.invoke({action:'get_preferences'});assert.deepEqual(await r.json(),{preferences});
  assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('two authenticated users only read/write their own row even with a privileged backend',async()=>{
  const f=fixture();
  await f.invoke({action:'update_preferences',preferences:{habit_reminders:true}},'Bearer other-token');
  assert.equal(f.rows.get(other).habit_reminders,true);assert.equal(f.rows.get(actor).bill_reminders,false);
  for(const [token,id] of [['actor-token',actor],['other-token',other]]) {
    const r=await f.invoke({action:'get_preferences'},`Bearer ${token}`);const data=await r.json();
    assert.deepEqual(data.preferences,Object.fromEntries(preferenceKeys.map(key=>[key,f.rows.get(id)[key]])));
    assert.deepEqual(Object.keys(data.preferences).sort(),[...preferenceKeys].sort());
    assert.equal(f.calls.filter(x=>x[0]==='filter').at(-1)[2],id);
  }
  assert.equal(f.calls.filter(x=>x[0]==='select').every(x=>x[1]==='user_id,'+preferenceKeys.join(',')),true);
});
test('missing own row returns defaults without creating a row or reading someone else',async()=>{
  const f=fixture();f.rows.delete(actor);
  const r=await f.invoke({action:'get_preferences'});assert.equal(r.status,200);assert.deepEqual(await r.json(),{preferences:defaults});
  assert.equal(f.rows.has(actor),false);assert.equal(f.calls.some(x=>x[0]==='upsert'),false);
});
test('an unexpected foreign or corrupt database row is never exposed',async()=>{
  for(const row of [{...defaults,user_id:other,private:sensitive},{...defaults,user_id:actor,bill_reminders:sensitive}]) {
    const f=fixture();f.rows.set(actor,row);
    const r=await f.invoke({action:'get_preferences'});assert.equal(r.status,503);
    const output=await r.text();assert.equal(output.includes(other),false);assert.equal(output.includes(sensitive),false);
  }
});
test('storage errors return no database details or false success',async()=>{
  for(const action of ['get_preferences','update_preferences']) {
    const f=fixture();f.deps.store=()=>({read:async()=>{throw new Error(sensitive);},write:async()=>{throw new Error(sensitive);}});
    const r=await f.invoke({action,...(action==='update_preferences'?{preferences:{bill_reminders:false}}:{})});
    assert.equal(r.status,503);assert.equal((await r.text()).includes(sensitive),false);
  }
});
test('the scoped store independently rejects an unvalidated identity-bearing patch',async()=>{
  const f=fixture();const store=scopedPreferenceStore(f.client,actor);
  await assert.rejects(store.write({user_id:other,bill_reminders:true}));assert.equal(f.calls.some(x=>x[0]==='upsert'),false);
});
test('the actual store handles returned database errors as failures, never as default/success',async()=>{
  for(const action of ['get_preferences','update_preferences']) {
    const f=fixture();f.client.from=()=>({
      select:()=>({eq:()=>({maybeSingle:async()=>({data:f.rows.get(other),error:{message:sensitive}})})}),
      upsert:async()=>({data:null,error:{message:sensitive}}),
    });
    const r=await f.invoke({action,...(action==='update_preferences'?{preferences:{bill_reminders:false}}:{})});
    assert.equal(r.status,503);assert.equal((await r.text()).includes(sensitive),false);
  }
});
test('unrelated push actions are delegated without preference auth or storage activity',async()=>{
  for(const action of ['subscribe','unsubscribe','send_notification','unknown']) {
    const f=fixture();assert.equal(await f.invoke({action}),null);assert.deepEqual(f.calls,[]);
  }
});
test('malformed action values cannot invoke coercion or privileged preference storage',async()=>{
  for(const action of [{toString:sensitive},[],null,1]) {
    const f=fixture();assert.equal(await f.invoke({action}),null);assert.deepEqual(f.calls,[]);
  }
});
