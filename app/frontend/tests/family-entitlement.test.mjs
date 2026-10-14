import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFamilyEntitlement } from '../supabase/functions/_shared/familyEntitlement.ts';
const now = Date.parse('2026-10-14T12:00:00Z');
const check = row => hasFamilyEntitlement(row, now);
test('expired, unpaid, paused and unknown family statuses do not authorize invitations', () => {
  for (const status of ['expired','unpaid','paused','on_trial','unknown']) {
    assert.equal(check({ tier: 'family', status }), false);
  }
});
test('active paid family and current retry behavior are preserved', () => {
  assert.equal(check({ tier: 'family', status: 'active' }), true);
  assert.equal(check({ tier: 'family', status: 'past_due' }), true);
  assert.equal(check({ tier: 'balanced', status: 'active' }), false);
});
test('cancellation retains access strictly until the paid end', () => {
  assert.equal(check({ tier: 'family', status: 'canceled', current_period_end: '2026-10-15T12:00:00Z' }), true);
  for (const end of ['2026-10-14T12:00:00Z','2026-10-13T12:00:00Z',null,'invalid']) {
    assert.equal(check({ tier: 'family', status: 'canceled', current_period_end: end }), false);
  }
});
test('existing valid family-level trials remain available without requiring paid tier', () => {
  assert.equal(check({ tier: 'free', status: 'active', trial_started_at: '2026-10-13T12:00:00Z' }), true);
  assert.equal(check({ tier: 'balanced', status: 'active', trial_started_at: '2026-10-13T12:00:00Z' }), true);
});
test('future, invalid and expired trial timestamps cannot authorize access', () => {
  for (const start of ['2026-10-15T12:00:00Z','invalid','2026-10-07T12:00:00Z']) {
    assert.equal(check({ tier: 'free', trial_started_at: start }), false);
  }
});
test('missing records and invalid clocks fail closed', () => {
  assert.equal(check(null), false);
  assert.equal(check(undefined), false);
  assert.equal(hasFamilyEntitlement({ tier: 'family', status: 'active' }, NaN), false);
});
