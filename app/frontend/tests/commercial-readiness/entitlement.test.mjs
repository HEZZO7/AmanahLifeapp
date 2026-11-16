import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveTier, hasEntitlement } from '../../supabase/functions/_shared/entitlement.ts';
const now=Date.parse('2026-11-15T00:00:00Z'), day=86400000;
const trial=(age,duration)=>({trial_used:true,trial_started_at:new Date(now-age*day).toISOString(),trial_expires_at:new Date(now+(duration-age)*day).toISOString()});
test('new and legacy expiry boundaries',()=>{
 assert.equal(effectiveTier(trial(6,7),now),'family');
 assert.equal(effectiveTier(trial(7,7),now),'free');
 assert.equal(effectiveTier(trial(10,14),now),'family');
 assert.equal(effectiveTier(trial(14,14),now),'free');
 assert.equal(effectiveTier(trial(-1,7),now),'free');
 assert.equal(effectiveTier({...trial(1,7),trial_used:false},now),'free');
 assert.equal(effectiveTier({...trial(1,7),trial_expires_at:null},now),'free');
});
test('paid status and trial floor',()=>{
 for(const status of ['canceled','expired','paused','trialing']) assert.equal(effectiveTier({tier:'family',status},now),'free');
 assert.equal(effectiveTier({tier:'balanced',status:'past_due'},now),'balanced');
 assert.equal(effectiveTier({tier:'family',status:'active'},now),'family');
 assert.equal(effectiveTier({...trial(1,7),tier:'balanced',status:'active'},now),'family');
});
test('lookup error and plan hierarchy',async()=>{
 const client=(data,error)=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data,error})})})})});
 assert.equal(await hasEntitlement(client({tier:'family',status:'active'},true),'test-user','family'),false);
 assert.equal(await hasEntitlement(client({tier:'balanced',status:'active'},null),'test-user','family'),false);
 assert.equal(await hasEntitlement(client({tier:'balanced',status:'active'},null),'test-user','balanced'),true);
});
