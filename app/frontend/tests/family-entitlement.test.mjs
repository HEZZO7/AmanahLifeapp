import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFamilyEntitlement } from '../supabase/functions/_shared/familyEntitlement.ts';
const now = Date.parse('2026-10-15T12:00:00Z');
const paid = {tier:'family',status:'active',paid_access_until:'2026-10-16T12:00:00Z',
  lemonsqueezy_subscription_id:'verified-fixture-sub'};
const check = row => hasFamilyEntitlement(row,now);
test('verified paid period authorizes family access',()=>assert.equal(check(paid),true));
test('status or retry date alone never establishes paid access',()=>{
 for(const status of ['active','past_due']) {
  assert.equal(check({tier:'family',status,current_period_end:'2099-01-01'}),false);
  assert.equal(check({...paid,status,paid_access_until:null}),false);
  assert.equal(check({...paid,status,paid_access_until:'2026-10-14T12:00:00Z'}),false);
 }
});
test('past_due retains only time already proved paid, without extra grace',()=>{
 assert.equal(check({...paid,status:'past_due'}),true);
 assert.equal(check({...paid,status:'past_due',paid_access_until:new Date(now).toISOString()}),false);
});
test('cancellation preserves the earlier of paid end and cancellation end',()=>{
 assert.equal(check({...paid,status:'canceled',current_period_end:'2026-10-16T12:00:00Z'}),true);
 assert.equal(check({...paid,status:'canceled',current_period_end:new Date(now).toISOString()}),false);
 assert.equal(check({...paid,status:'canceled',paid_access_until:'2026-10-14T12:00:00Z'}),false);
});
test('revocation overrides paid access and trial access immediately',()=>{
 assert.equal(check({...paid,entitlement_revoked_at:'2026-10-15T11:00:00Z'}),false);
 assert.equal(check({trial_started_at:'2026-10-14T12:00:00Z',entitlement_revoked_at:'2026-10-15'}),false);
});
test('unpaid, expired, paused and unknown states do not authorize paid use',()=>{
 for(const status of ['unpaid','expired','paused','on_trial','unknown']) assert.equal(check({...paid,status}),false);
});
test('valid trials use a seven-day server-issued window',()=>{
 assert.equal(check({tier:'free',trial_started_at:'2026-10-14T12:00:00Z'}),true);
 for(const start of ['2026-10-16','invalid','2026-10-08T12:00:00Z']) assert.equal(check({trial_started_at:start}),false);
});
test('missing records, plan mismatch and missing provider binding fail closed',()=>{
 assert.equal(check(null),false);
 assert.equal(check({...paid,tier:'balanced'}),false);
 assert.equal(check({...paid,lemonsqueezy_subscription_id:null}),false);
 assert.equal(hasFamilyEntitlement(paid,NaN),false);
});
