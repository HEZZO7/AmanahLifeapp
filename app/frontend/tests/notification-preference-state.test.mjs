import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { usePreferenceState } from '../src/lib/usePreferenceState.ts';
import { DEFAULT_NOTIFICATION_PREFERENCES as defaults } from '../src/lib/notificationPreferenceClient.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
function fakeClient() {
  let save = async patch => ({ preferences: { ...defaults, ...patch }, synced: true, cacheSaved: true });
  let load = async () => ({ preferences: { ...defaults }, synced: true, cacheSaved: true });
  let calls = 0;
  return { client: { load: () => load(), save: patch => { calls++; return save(patch); } },
    load: fn => { load = fn; }, save: fn => { save = fn; }, calls: () => calls };
}
async function mount(client) {
  let state, root;
  function Panel({ client }) { state = usePreferenceState(client); return null; }
  await act(async () => { root = create(React.createElement(Panel, { client })); });
  return { state: () => state,
    update: async client => { await act(async () => root.update(React.createElement(Panel, { client }))); },
    close: async () => { await act(async () => root.unmount()); },
  };
}
test('real React: save failure retains previous state, shows failure, then retries successfully', async () => {
  const f = fakeClient(), ui = await mount(f.client);
  f.save(async () => { throw Error('401'); });
  await act(async () => { assert.equal(await ui.state().updatePreferences({ bill_reminders: false }), false); });
  assert.equal(ui.state().preferences.bill_reminders, true);
  assert.equal(ui.state().preferenceError, 'save');
  f.save(async patch => ({ preferences: { ...defaults, ...patch }, synced: true, cacheSaved: true }));
  await act(async () => { assert.equal(await ui.state().updatePreferences({ bill_reminders: false }), true); });
  assert.equal(ui.state().preferences.bill_reminders, false);
  assert.equal(ui.state().preferenceError, '');
  await ui.close();
});
test('real React: pending save is not optimistic; double taps are blocked', async () => {
  const f = fakeClient(), ui = await mount(f.client), d = deferred();
  f.save(() => d.promise);
  let pending;
  await act(async () => {
    pending = ui.state().updatePreferences({ bill_reminders: false });
    assert.equal(await ui.state().updatePreferences({ bill_reminders: false }), false);
  });
  assert.equal(f.calls(), 1);
  assert.equal(ui.state().savingPreferences, true);
  assert.equal(ui.state().preferences.bill_reminders, true);
  await act(async () => {
    d.resolve({ preferences: { ...defaults, bill_reminders: false }, synced: true, cacheSaved: true });
    await pending;
  });
  assert.equal(ui.state().preferences.bill_reminders, false);
  await ui.close();
});
test('real React: late account-A save cannot replace account-B state', async () => {
  const a = fakeClient(), b = fakeClient(), d = deferred(), ui = await mount(a.client);
  a.save(() => d.promise); let pending;
  await act(async () => { pending = ui.state().updatePreferences({ bill_reminders: false }); });
  await ui.update(b.client);
  await act(async () => {
    d.resolve({ preferences: { ...defaults, bill_reminders: false }, synced: true, cacheSaved: true });
    assert.equal(await pending, false);
  });
  assert.deepEqual(ui.state().preferences, defaults);
  assert.equal(ui.state().savingPreferences, false);
  await ui.close();
});
test('real React: late load and unmounted saves cannot alter another account', async () => {
  const a = fakeClient(), b = fakeClient(), d = deferred();
  a.load(() => d.promise);
  const ui = await mount(a.client);
  assert.equal(ui.state().preferencesLoading, true);
  await ui.update(b.client);
  await act(async () => d.resolve({ preferences: { ...defaults, bill_reminders: false }, synced: true, cacheSaved: true }));
  assert.equal(ui.state().preferences.bill_reminders, true);
  await ui.close();
  assert.equal(await ui.state().updatePreferences({ bill_reminders: false }), false);
  assert.equal(b.calls(), 0);
});
test('real React: cache-only load is visibly unconfirmed but retains valid false flags', async () => {
  const f = fakeClient();
  f.load(async () => ({ preferences: { ...defaults, savings_reminders: false }, synced: false, cacheSaved: true }));
  const ui = await mount(f.client);
  assert.equal(ui.state().preferences.savings_reminders, false);
  assert.equal(ui.state().preferenceError, 'load');
  await ui.close();
});

