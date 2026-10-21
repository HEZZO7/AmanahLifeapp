// Offline real-handler tests. No database/Auth/provider integration is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleDeleteAccount } from '../supabase/functions/app_11941c8fec_delete_account/handler.ts';

function fixture(overrides = {}) {
  const calls = [];
  const d = {
    legacyBillingConfigured: false,
    authenticate: async token => { calls.push(['authenticate']); return token === 'synthetic-token' ? 'synthetic-A' : null; },
    deletionReady: async () => { calls.push(['ready']); return { data: true, error: null }; },
    billingAllowed: async user => { calls.push(['billing', user]); return { data: true, error: null }; },
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
test('missing or invalid JWT cannot reach readiness, billing or deletion', async () => {
  for (const token of [null, 'invalid-synthetic-token']) {
    const f = fixture();
    assert.equal((await handleDeleteAccount(request({}, token), f.d)).status, 401);
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
test('verified free/trial deletion uses a single destructive Auth operation without HTTP pre-cleanup', async () => {
  const f = fixture();
  const r = await handleDeleteAccount(request(), f.d);
  assert.equal(r.status, 200);
  assert.deepEqual(f.calls, [['authenticate'], ['ready'], ['billing', 'synthetic-A'], ['auth-delete', 'synthetic-A']]);
  assert.equal((await r.json()).success, true);
});
test('body identity, cancellation and payment claims cannot select another account', async () => {
  const f = fixture();
  assert.equal((await handleDeleteAccount(request({ user_id: 'synthetic-B', cancelled: true, status: 'expired', billingAllowed: true }), f.d)).status, 200);
  assert.equal(f.calls.filter(c => ['billing','auth-delete'].includes(c[0])).every(c => c[1] === 'synthetic-A'), true);
});
for (const value of [false,null,'true',{ready:true}]) {
  test('unverified Migration 009 readiness stops before billing or deletion: '+JSON.stringify(value), async () => {
    const f=fixture({deletionReady:async()=>({data:value,error:null})});
    const r=await handleDeleteAccount(request(),f.d);
    assert.equal(r.status,503);assert.deepEqual(f.calls,[['authenticate']]);
  });
}
test('missing readiness RPC or thrown storage error fails closed', async () => {
  for(const deletionReady of [async()=>({data:null,error:{code:'PGRST202'}}),async()=>{throw Error('SIMULATED_PRIVATE_DETAIL');}]){
    const f=fixture({deletionReady});const r=await handleDeleteAccount(request(),f.d);
    assert.equal(r.status,503);assert.deepEqual(f.calls,[['authenticate']]);
    assert.equal((await r.text()).includes('SIMULATED_PRIVATE_DETAIL'),false);
  }
});
test('billing history denial stops deletion and provides honest management guidance', async () => {
  const f = fixture({ billingAllowed: async () => ({ data: false, error: null }) });
  const r = await handleDeleteAccount(request({ cancelled: true }), f.d);
  assert.equal(r.status, 409);
  const body = await r.json();
  assert.equal(body.code, 'billing_review_required');assert.equal(body.manage_path, '/subscription');
  assert.match(body.error, /No cancellation has been performed/);assert.match(body.error, /paid access is unchanged/);
  assert.deepEqual(f.calls, [['authenticate'],['ready']]);assert.equal(r.headers.get('Cache-Control'), 'no-store');
});
for (const result of [{data:null,error:{code:'PGRST202'}},{data:true,error:{code:'42501'}},
  {data:null,error:null},{data:'true',error:null},{data:{allowed:true},error:null}]) {
  test('unverified billing permission fails closed: '+JSON.stringify(result), async () => {
    const f=fixture({billingAllowed:async()=>result});const r=await handleDeleteAccount(request(),f.d);
    assert.equal(r.status,503);assert.deepEqual(f.calls,[['authenticate'],['ready']]);
  });
}
test('thrown billing check fails before deletion', async () => {
  const f=fixture({billingAllowed:async()=>{throw Error('SIMULATED_PRIVATE_DETAIL');}});
  const r=await handleDeleteAccount(request(),f.d);
  assert.equal(r.status,503);assert.deepEqual(f.calls,[['authenticate'],['ready']]);
  assert.equal((await r.text()).includes('SIMULATED_PRIVATE_DETAIL'),false);
});
test('configured legacy Paddle prevents unverified deletion without a provider call', async () => {
  const f=fixture({legacyBillingConfigured:true});const r=await handleDeleteAccount(request(),f.d);
  assert.equal(r.status,503);assert.deepEqual(f.calls,[['authenticate']]);
});
for(const result of [false,null,undefined,'true']){
  test('unconfirmed Auth deletion never claims success: '+String(result),async()=>{
    const f=fixture({deleteUser:async()=>result});const r=await handleDeleteAccount(request(),f.d);
    const body=await r.json();assert.equal(r.status,503);assert.equal(body.code,'account_deletion_unconfirmed');
    assert.equal(body.success,undefined);assert.doesNotMatch(body.error,/Account not deleted/);
  });
}
test('lost Auth response is sanitized and does not assert whether commit occurred',async()=>{
  const f=fixture({deleteUser:async()=>{throw Error('SIMULATED_PRIVATE_DETAIL');}});
  const r=await handleDeleteAccount(request(),f.d);const body=await r.json();
  assert.equal(r.status,503);assert.equal(body.code,'account_deletion_unconfirmed');
  assert.equal(body.error.includes('SIMULATED_PRIVATE_DETAIL'),false);assert.match(body.error,/before retrying/);
});
test('unchanged Migration 008 retains every billing history and both deletion guards',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610210008_account_deletion_safety.sql',import.meta.url),'utf8');
  const permission=sql.split('create or replace function public.app_11941c8fec_account_deletion_allowed')[1].split('end $$;')[0];
  for(const table of ['accounts','intents','bindings','periods'])assert.ok(permission.includes('exists(select 1 from public.app_11941c8fec_payment_'+table+' where user_id=p_user)'));
  assert.equal(/expires_at|mode\s*=|status\s*=|delete\s+from/i.test(permission),false);
  assert.match(sql,/before delete on auth\.users/);assert.match(sql,/before delete on public\.app_11941c8fec_subscriptions/);
});
test('runtime adapter authenticates, requires 009 and performs hard Auth delete only',()=>{
  const source=readFileSync(new URL('../supabase/functions/app_11941c8fec_delete_account/index.ts',import.meta.url),'utf8');
  assert.match(source,/client\.auth\.getUser\(token\)/);
  assert.ok(source.includes("rpc('app_11941c8fec_account_deletion_ready')"));
  assert.ok(source.includes("rpc('app_11941c8fec_account_deletion_allowed', { p_user: user })"));
  assert.ok(source.includes('auth.admin.deleteUser(user, false)'));
  assert.equal(/\.from\(|\.delete\(|console\.|fetch\(|req\.json/.test(source),false);
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
    fetch: async () => { events.push(['request']); return Response.json({ code,
      ...(code === 'account_deletion_unconfirmed' ? { error: 'Account deletion could not be confirmed. Contact support before retrying.' } : {}),
    }, { status }); },
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
test('actual Settings unconfirmed deletion preserves local state without claiming deletion failed atomically', async () => {
  const f=settingsDeletionFixture(503,'account_deletion_unconfirmed');await f.run();
  assert.equal(f.events.some(e=>['success','clear','signout'].includes(e[0])),false);
  assert.match(f.events.find(e=>e[0]==='error')[1],/could not be confirmed/);
  assert.doesNotMatch(f.events.find(e=>e[0]==='error')[1],/Account not deleted/);
});
