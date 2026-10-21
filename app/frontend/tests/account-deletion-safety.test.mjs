// Offline real-handler tests. Run with --import ./tests/deny-network.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleDeleteAccount, BillingDeletionBlocked } from '../supabase/functions/app_11941c8fec_delete_account/handler.ts';

function fixture(overrides = {}) {
  const calls = [];
  const d = {
    legacyBillingConfigured: false,
    authenticate: async token => { calls.push(['authenticate']); return token === 'synthetic-token' ? 'synthetic-A' : null; },
    billingAllowed: async user => { calls.push(['billing', user]); return { data: true, error: null }; },
    deleteData: async user => { calls.push(['data', user]); },
    deleteUser: async user => { calls.push(['auth-delete', user]); return true; },
    ...overrides,
  };
  return { calls, d };
}
function request(body = {}, token = 'synthetic-token', method = 'POST') {
  return new Request('https://example.invalid/delete', {
    method, headers: token ? { Authorization: 'Bearer ' + token } : {},
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}
test('missing or invalid JWT cannot reach billing or deletion', async () => {
  for (const token of [null, 'invalid-synthetic-token']) {
    const f = fixture();
    const r = await handleDeleteAccount(request({}, token), f.d);
    assert.equal(r.status, 401);
    assert.equal(f.calls.some(c => c[0] !== 'authenticate'), false);
  }
});
test('preflight and unsupported methods never call dependencies', async () => {
  for (const [method, status] of [['OPTIONS', 204], ['GET', 405]]) {
    const f = fixture();
    assert.equal((await handleDeleteAccount(request({}, null, method), f.d)).status, status);
    assert.deepEqual(f.calls, []);
  }
});
test('Auth outage cannot permit deletion or expose an exception', async () => {
  const f = fixture({ authenticate: async () => { throw new Error('SIMULATED_PRIVATE_DETAIL'); } });
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 503); assert.deepEqual(f.calls, []);
  assert.equal((await r.text()).includes('SIMULATED_PRIVATE_DETAIL'), false);
});
test('verified never-billed free/trial account follows the existing cleanup order', async () => {
  const f = fixture();
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 200);
  assert.deepEqual(f.calls, [['authenticate'], ['billing', 'synthetic-A'], ['data', 'synthetic-A'], ['auth-delete', 'synthetic-A']]);
  assert.equal((await r.json()).success, true);
});
test('body identity, cancellation and payment claims cannot select another account', async () => {
  const f = fixture();
  assert.equal((await handleDeleteAccount(request({ user_id: 'synthetic-B', cancelled: true, status: 'expired', billingAllowed: true }), f.d)).status, 200);
  assert.equal(f.calls.slice(1).every(c => c[1] === 'synthetic-A'), true);
});
test('billing history denial stops ALL deletion and provides honest management guidance', async () => {
  const f = fixture({ billingAllowed: async () => ({ data: false, error: null }) });
  const r = await handleDeleteAccount(request({ cancelled: true }), f.d);
  assert.equal(r.status, 409);
  const body = await r.json();
  assert.equal(body.code, 'billing_review_required');
  assert.equal(body.manage_path, '/subscription');
  assert.match(body.error, /No cancellation has been performed/);
  assert.match(body.error, /paid access is unchanged/);
  assert.deepEqual(f.calls, [['authenticate']]);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
});
for (const [label, result] of [
  ['missing migration', { data: null, error: { code: 'PGRST202', message: 'SIMULATED_PRIVATE_DETAIL' } }],
  ['database denial', { data: true, error: { code: '42501' } }],
  ['null', { data: null, error: null }],
  ['string true', { data: 'true', error: null }],
  ['object', { data: { allowed: true }, error: null }],
]) {
  test('unverified billing permission fails closed: ' + label, async () => {
    const f = fixture({ billingAllowed: async () => result });
    const r = await handleDeleteAccount(request(), f.d);
    assert.equal(r.status, 503); assert.deepEqual(f.calls, [['authenticate']]);
    assert.equal((await r.text()).includes('SIMULATED_PRIVATE_DETAIL'), false);
  });
}
test('thrown billing check fails before any cleanup', async () => {
  const f = fixture({ billingAllowed: async () => { throw new Error('SIMULATED_PRIVATE_DETAIL'); } });
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 503); assert.deepEqual(f.calls, [['authenticate']]);
  assert.equal((await r.text()).includes('SIMULATED_PRIVATE_DETAIL'), false);
});
test('configured legacy Paddle prevents unverified deletion without a provider call', async () => {
  const f = fixture({ legacyBillingConfigured: true });
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 503); assert.deepEqual(f.calls, [['authenticate']]);
});
test('a database retention guard racing the preflight prevents auth deletion', async () => {
  const f = fixture({ deleteData: async () => { throw new BillingDeletionBlocked(); } });
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 409);
  assert.equal(f.calls.some(c => c[0] === 'auth-delete'), false);
});
test('cleanup failure is not reported as successful deletion', async () => {
  const f = fixture({ deleteData: async () => { throw new Error('SIMULATED_PRIVATE_DETAIL'); } });
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 503);
  assert.equal(f.calls.some(c => c[0] === 'auth-delete'), false);
  assert.equal((await r.text()).includes('SIMULATED_PRIVATE_DETAIL'), false);
});
test('Auth delete rejection cannot claim success after cleanup', async () => {
  const f = fixture({ deleteUser: async () => false });
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 503); assert.equal((await r.json()).success, undefined);
});
test('SQL source retains all billing histories with no mode, expiry or status exemption', () => {
  // Static contract check only: this does NOT execute SQL or prove DB concurrency.
  const sql = readFileSync(new URL('../supabase/migrations/202610210008_account_deletion_safety.sql', import.meta.url), 'utf8');
  const permission = sql.split('create or replace function public.app_11941c8fec_account_deletion_allowed')[1].split('end $$;')[0];
  for (const table of ['accounts', 'intents', 'bindings', 'periods']) {
    assert.match(permission, new RegExp('exists\\(select 1 from public\\.app_11941c8fec_payment_' + table + ' where user_id=p_user\\)'));
  }
  for (const field of ['lemonsqueezy_subscription_id', 'lemonsqueezy_customer_id', 'paddle_subscription_id', 'paddle_customer_id', 'paid_access_from', 'paid_access_until']) {
    assert.match(permission, new RegExp(field + ' is not null'));
  }
  assert.match(permission, /tier in \('balanced','family'\)/);
  assert.equal(/expires_at|mode\s*=|status\s*=|delete\s+from/i.test(permission), false);
});
test('SQL source scopes RPC to service_role and guards subscription plus auth deletion', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610210008_account_deletion_safety.sql', import.meta.url), 'utf8');
  assert.equal((sql.match(/security definer set search_path=''/g) || []).length, 2);
  assert.equal((sql.match(/owner to postgres/g) || []).length, 2);
  assert.equal((sql.match(/from public,anon,authenticated,service_role/g) || []).length, 2);
  assert.deepEqual(sql.match(/grant execute[^;]+;/g), ['grant execute on function public.app_11941c8fec_account_deletion_allowed(uuid) to service_role;']);
  assert.match(sql, /before delete on auth\.users/);
  assert.match(sql, /before delete on public\.app_11941c8fec_subscriptions/);
  assert.match(sql, /is distinct from true/);
});
test('runtime adapter uses verified identity, fixed RPC, existing tables and no payment API', () => {
  const source = readFileSync(new URL('../supabase/functions/app_11941c8fec_delete_account/index.ts', import.meta.url), 'utf8');
  assert.match(source, /client\.auth\.getUser\(token\)/);
  assert.match(source, /rpc\('app_11941c8fec_account_deletion_allowed', \{ p_user: user \}\)/);
  assert.match(source, /\.eq\('user_id', user\)/);
  assert.match(source, /auth\.admin\.deleteUser\(user\)/);
  assert.equal(/console\.|fetch\(|req\.json|payment_.*\.delete/.test(source), false);
});

function settingsDeletionFixture(status, code) {
  const source = readFileSync(new URL('../src/pages/Settings.tsx', import.meta.url), 'utf8');
  const first = source.indexOf('const handleDeleteAccount = async () => {');
  const last = source.indexOf('\n\n  const exportFinanceCSV =', first);
  assert.ok(first >= 0 && last > first, 'actual Settings deletion handler must be found');
  const factoryBody = source.slice(first, last).replace('const handleDeleteAccount = ', 'return ');
  const events = []; let action;
  const deps = {
    deleteConfirmText: 'DELETE', isAr: false,
    toast: {
      error: (message, options) => { events.push(['error', message]); action = options?.action; },
      success: () => events.push(['success']),
    },
    setDeleteLoading: value => events.push(['loading', value]),
    setShowDeleteDialog: value => events.push(['dialog', value]),
    setDeleteConfirmText: value => events.push(['confirm', value]),
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-token' } } }) } },
    // A lexical fake, plus the network-deny preload, prevents the hardcoded
    // production URL in the existing UI from ever producing a real HTTP request.
    fetch: async () => { events.push(['request']); return Response.json({ code }, { status }); },
    localStorage: { clear: () => events.push(['clear']) },
    signOut: async () => events.push(['signout']),
    navigate: path => events.push(['navigate', path]),
  };
  const run = new Function(...Object.keys(deps), factoryBody)(...Object.values(deps));
  return { run, events, action: () => action };
}
for (const [status, code] of [[409, 'billing_review_required'], [503, 'billing_verification_unavailable']]) {
  test('actual Settings refusal preserves local account and offers billing management: ' + status, async () => {
    const f = settingsDeletionFixture(status, code);
    await f.run();
    assert.equal(f.events.some(e => ['success', 'clear', 'signout'].includes(e[0])), false);
    assert.match(f.events.find(e => e[0] === 'error')[1], /not deleted and subscription not cancelled/);
    assert.ok(f.events.some(e => e[0] === 'loading' && e[1] === false));
    assert.equal(f.action().label, 'Manage subscription');
    f.action().onClick();
    assert.deepEqual(f.events.at(-1), ['navigate', '/subscription']);
  });
}
test('actual Settings confirmed free-account deletion retains existing signout behavior', async () => {
  const f = settingsDeletionFixture(200);
  await f.run();
  assert.equal(f.events.some(e => e[0] === 'success'), true);
  assert.equal(f.events.some(e => e[0] === 'clear'), true);
  assert.equal(f.events.some(e => e[0] === 'signout'), true);
});
