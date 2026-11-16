import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionIntent, rememberSubscriptionIntent, consumeSubscriptionIntent } from '../../src/lib/subscriptionIntent.ts';

test('only internal subscription destinations are allowed', () => {
  assert.equal(subscriptionIntent('?next=https://example.com'), null);
  assert.equal(subscriptionIntent('?next=subscription&plan=family&billing=yearly'), '/subscription?plan=family&billing=yearly');
  assert.equal(subscriptionIntent('?next=subscription&plan=balanced&billing=bad'), '/subscription?plan=balanced&billing=monthly');
  assert.equal(subscriptionIntent('?next=subscription&plan=unknown'), '/subscription');
});

test('intent survives same-tab auth and is consumed once', () => {
  const data = new Map();
  globalThis.sessionStorage = {
    setItem: (k, v) => data.set(k, v),
    getItem: k => data.get(k) ?? null,
    removeItem: k => data.delete(k),
  };
  rememberSubscriptionIntent('?next=subscription&plan=family&billing=yearly');
  assert.equal(consumeSubscriptionIntent(), '/subscription?plan=family&billing=yearly');
  assert.equal(consumeSubscriptionIntent(), '/');
  data.set('amanahlife-subscription-intent', 'https://example.com');
  assert.equal(consumeSubscriptionIntent(), '/');
  delete globalThis.sessionStorage;
});
