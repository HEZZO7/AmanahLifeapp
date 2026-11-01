import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { accountPushSubscription, recordPushOwner, releaseDevicePush } from '../src/lib/devicePush.ts';
const prior = { storage: globalThis.localStorage, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
after(() => {
  if (prior.storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = prior.storage;
  if (prior.navigator) Object.defineProperty(globalThis, 'navigator', prior.navigator); else delete globalThis.navigator;
});
function fixture(owner, revoke = true) {
  const stored = new Map(owner ? [['amanah-push-device-owner', owner]] : []), calls = [];
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: k => stored.delete(k) };
  const old = { unsubscribe: async () => { calls.push('revoke'); return revoke; } }, fresh = {};
  const registration = { pushManager: { getSubscription: async () => old, subscribe: async () => { calls.push('subscribe'); return fresh; } } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { getRegistration: async () => registration } } });
  return { calls, stored, registration, old, fresh };
}
test('same account can reuse its registered device without rotation', async () => {
  const f = fixture('own'); assert.equal(await accountPushSubscription(f.registration, 'own', new Uint8Array()), f.old); assert.deepEqual(f.calls, []);
});
for (const owner of ['another', undefined]) {
  test('different or unknown owner must revoke old subscription before registration: ' + owner, async () => {
    const f = fixture(owner); assert.equal(await accountPushSubscription(f.registration, 'own', new Uint8Array()), f.fresh);
    assert.deepEqual(f.calls, ['revoke', 'subscribe']); recordPushOwner('own'); assert.equal(f.stored.get('amanah-push-device-owner'), 'own');
  });
}
test('failed rotation never associates another account device with the new actor', async () => {
  const f = fixture('another', false); await assert.rejects(accountPushSubscription(f.registration, 'own', new Uint8Array()));
  assert.deepEqual(f.calls, ['revoke']); assert.equal(f.stored.get('amanah-push-device-owner'), 'another');
});
test('logout revokes local push delivery without waiting for serviceWorker.ready', async () => {
  const f = fixture('own'); await releaseDevicePush(); assert.deepEqual(f.calls, ['revoke']); assert.equal(f.stored.size, 0);
});
test('logout revocation refusal remains visible and preserves rotation evidence', async () => {
  const f = fixture('own', false); await assert.rejects(releaseDevicePush(), /Disable notifications in browser settings/);
  assert.equal(f.stored.get('amanah-push-device-owner'), 'own');
});
test('account registration waits for an outstanding revocation operation', async () => {
  const f = fixture('other'); let unblock;
  f.old.unsubscribe = () => new Promise(resolve => { unblock = () => { f.calls.push('released'); resolve(true); }; });
  const release = releaseDevicePush();
  await new Promise(resolve => setImmediate(resolve));
  const subscribe = accountPushSubscription(f.registration, 'own', new Uint8Array());
  assert.equal(f.calls.includes('subscribe'), false);
  unblock(); await release;
  await new Promise(resolve => setImmediate(resolve));
  // The fake keeps returning its old subscription, so the second ownership
  // check must revoke it again before creating the new account's endpoint.
  unblock(); await subscribe;
  assert.equal(f.calls.at(-1), 'subscribe');
});
