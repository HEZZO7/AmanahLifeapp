// Actual Edge adapter with a fake SDK; no Auth, PostgreSQL or provider calls.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const entry = new URL('../supabase/functions/app_11941c8fec_delete_account/index.ts', import.meta.url).href;
const original = { Deno: globalThis.Deno, sdk: globalThis.__cancellationSDK };
let handler, options, calls;
const user = '10000000-0000-4000-8000-000000000009';
globalThis.Deno = {
  env: { get: key => ({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: 'offline-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'offline-service', ...(options?.legacy ? { PADDLE_API_KEY: 'offline-legacy' } : {}) })[key] },
  serve: fn => { handler = fn; },
};
globalThis.__cancellationSDK = (_url, key) => ({
  from() { assert.fail('No pre-deletion cleanup permitted'); },
  rpc: async name => {
    calls.push(name);
    return { data: name.endsWith('_ready') ? options.ready : options.allowed, error: null };
  },
  auth: {
    getUser: async () => ({ data: { user: { id: user } }, error: null }),
    admin: {
      deleteUser: async (id, soft) => {
        assert.equal(key, 'offline-service'); assert.equal(id, user); assert.equal(soft, false);
        calls.push('delete'); return { error: options.deleteError ?? null };
      },
      getUserById: async id => {
        assert.equal(id, user); calls.push('confirm');
        if (options.confirm instanceof Error) throw options.confirm;
        return options.confirm;
      },
    },
  },
});
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === entry && specifier === 'https://esm.sh/@supabase/supabase-js@2')
    return { url: 'data:text/javascript,' + encodeURIComponent('export const createClient=(...args)=>globalThis.__cancellationSDK(...args);'), shortCircuit: true };
  if (/^https?:/.test(specifier)) throw Error('Offline imports only');
  return next(specifier, context);
} });
try { await import(entry); } finally { hook.deregister(); }
after(() => {
  for (const [key, value] of [['Deno', original.Deno], ['__cancellationSDK', original.sdk]])
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
});
async function invoke(overrides = {}) {
  options = { ready: true, allowed: true,
    confirm: { data: { user: null }, error: { status: 404, code: 'user_not_found' } }, ...overrides };
  calls = [];
  return handler(new Request('http://127.0.0.1:54321/delete', { method: 'POST',
    headers: { Authorization: 'Bearer synthetic-token' },
    body: JSON.stringify({ user_id: 'foreign-user', cancelled: true }) }));
}
test('only explicit Auth absence confirms deletion; client cancellation claims are ignored', async () => {
  const r = await invoke(); assert.equal(r.status, 200); assert.equal((await r.json()).success, true);
  assert.deepEqual(calls.slice(-2), ['delete', 'confirm']);
});
for (const [name, confirm] of [
  ['BEFORE veto keeps Auth user', { data: { user: { id: user } }, error: null }],
  ['empty success', { data: { user: null }, error: null }],
  ['generic 404', { data: { user: null }, error: { status: 404 } }],
  ['wrong status', { data: { user: null }, error: { status: 403, code: 'user_not_found' } }],
  ['contradictory user', { data: { user: { id: user } }, error: { status: 404, code: 'user_not_found' } }],
  ['transport failure', Error('SIMULATED_PRIVATE_DETAIL')],
]) test('never claims deletion or cancellation on ' + name, async () => {
  const r = await invoke({ confirm }); const body = await r.json();
  assert.equal(r.status, 503); assert.equal(body.code, 'account_deletion_unconfirmed');
  assert.match(body.error, /No subscription cancellation was requested/);
  assert.doesNotMatch(body.error, /SIMULATED_PRIVATE_DETAIL/);
  assert.equal(calls.filter(x => x === 'delete').length, 1);
});
for (const [name, overrides, status] of [
  ['unreviewed trigger readiness', { ready: false }, 503],
  ['billing history', { allowed: false }, 409],
  ['unreviewed legacy billing', { legacy: true }, 503],
]) test(name + ' prevents deletion and performs no cancellation', async () => {
  const r = await invoke(overrides); assert.equal(r.status, status);
  assert.equal(calls.includes('delete'), false); assert.equal(calls.includes('confirm'), false);
  assert.match((await r.json()).error, /No cancellation has been performed/);
});
test('failed Auth deletion never retries or attempts confirmation', async () => {
  const r = await invoke({ deleteError: { message: 'SIMULATED_PRIVATE_DETAIL' } });
  assert.equal(r.status, 503); assert.equal(calls.includes('confirm'), false);
  assert.equal(calls.filter(x => x === 'delete').length, 1);
});
