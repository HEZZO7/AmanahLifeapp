// Exercise the real SDK adapter's column and identity filters without HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const entry = new URL('../src/lib/backupClient.ts', import.meta.url).href;
const previous = globalThis.__backupSDK;
const calls = [];
const query = Object.fromEntries(['select', 'eq', 'order', 'range', 'update', 'insert', 'delete'].map(name =>
  [name, (...args) => { calls.push([name, ...args]); return query; }]));
query.then = (resolve, reject) => Promise.resolve({ data: [{ user_id: 'own' }], error: null }).then(resolve, reject);
globalThis.__backupSDK = { from: table => { calls.push(['from', table]); return query; } };
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === entry && specifier === './supabase') return {
    url: 'data:text/javascript,' + encodeURIComponent('export const supabase=globalThis.__backupSDK;'), shortCircuit: true,
  };
  return next(specifier, context);
} });
let client;
try { client = (await import(entry)).backupClient; } finally {
  hook.deregister(); if (previous === undefined) delete globalThis.__backupSDK; else globalThis.__backupSDK = previous;
}
test('actual reader selects explicit columns, filters ownership, orders and paginates', async () => {
  calls.length = 0;
  await client.read('app_11941c8fec_notification_preferences', ['bill_reminders', 'language'], 'own', 1000);
  assert.deepEqual(calls, [['from', 'app_11941c8fec_notification_preferences'], ['select', 'bill_reminders,language'],
    ['eq', 'user_id', 'own'], ['order', 'user_id'], ['range', 1000, 1999]]);
});
test('actual updater sends portable patch only and returns allowed ownership column', async () => {
  calls.length = 0;
  const patch = { bill_reminders: false };
  await client.update('app_11941c8fec_notification_preferences', patch, 'own');
  assert.deepEqual(calls, [['from', 'app_11941c8fec_notification_preferences'], ['update', patch], ['eq', 'user_id', 'own'], ['select', 'user_id']]);
});
test('actual delete scopes a search replacement to the authenticated account', async () => {
  calls.length = 0;
  await client.remove('app_11941c8fec_search_history', 'own');
  assert.deepEqual(calls, [['from', 'app_11941c8fec_search_history'], ['delete'], ['eq', 'user_id', 'own']]);
});
