// Isolated request -> real handler -> fake provider/storage. Never sends network traffic.
// PostgreSQL RPC integration is exercised separately against a fresh CI PostgreSQL service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkout, webhook, reconcile, configuration, sha256, synchronize, recoverDeliveries, reconcileBindings } from '../supabase/functions/_shared/lemonPayments.ts';

const now = Date.now();
const start = new Date(now - 86400000).toISOString();
const end = new Date(now + 28 * 86400000).toISOString();
const later = new Date(now + 58 * 86400000).toISOString();
const c = { mode: 'test', apiKey: 'isolated-test-key', secret: 'isolated-test-secret', store: '1', origin: 'https://test.example', refundPolicy: 'review_keep_current', offers: { family_monthly: { tier: 'family', billing: 'monthly', variant: '2', product: '3' }, balanced_monthly: { tier:'balanced',billing:'monthly',variant:'4',product:'5' }, family_yearly:{tier:'family',billing:'yearly',variant:'6',product:'3'} } };
const sub = (attrs = {}) => ({ type: 'subscriptions', id: '10', attributes: { test_mode: true, store_id: 1, customer_id: 6, product_id: 3, variant_id: 2, order_id: 20, status: 'active', created_at: start, updated_at: start, payment_processor:'stripe',first_subscription_item:{price_id:200},renews_at: end, ends_at: null, ...attrs } });
const invoice = (attrs = {}, invoiceId = '30') => ({ type: 'subscription-invoices', id: invoiceId, attributes: { test_mode: true, store_id: 1, customer_id: 6, subscription_id: 10, billing_reason: 'initial', status: 'paid', total: 1299, created_at: start, updated_at: start, refunded: false, ...attrs } });
const order = (attrs = {}) => ({ type: 'orders', id: '20', attributes: { test_mode: true, store_id: 1, customer_id: 6, status: 'paid', total: 1299, created_at: start, updated_at:start, refunded: false, ...attrs } });
const previous = { user_id: 'account-A', revision: 0, subscription_id: '10', customer_id: '6', variant_id: '2', product_id: '3', tier: 'family', billing: 'monthly', paid_access_from: start, paid_access_until: end, invoice_id: '30', entitlement_revoked_at: null, periods: [{ proof_id: '30', kind: 'initial', start, confirmed_at:start,source_created_at:start,tier:'family',billing:'monthly',product:'3',variant:'2',end, revoked_at: null, review: false }] };
function fixture() {
  const calls = []; let state = { ...previous }; let apiSub = sub(); let invoices = [invoice()]; let apiOrder = order();
  const seen = new Set(); let revision = 0; let checkoutPayload; const apiCalls=[];
  const d = {
    now:()=>now,
    user: async token => token === 'valid-token' ? { id: 'account-A', email: 'fixture@example.invalid', email_confirmed_at: start } : null,
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'app_11941c8fec_payment_snapshot') return { data: state, error: null };
      if (name.endsWith('_commit_snapshot')) {
        if (seen.has(args.p_key)) return { data: { duplicate: true }, error: null };
        if (args.p_revision !== revision) { state.revision = revision; return { data: { retry: true }, error: null }; }
        seen.add(args.p_key); revision++; state = { ...state, ...args.p_state, subscription_id:args.p_subscription,customer_id:args.p_customer,variant_id:args.p_variant,product_id:args.p_product,tier:args.p_tier,billing:args.p_billing,revision };
        return { data: { applied: true }, error: null };
      }
      if (name.endsWith('_request_plan')) return {data:{created:true,id:'plan-fixture',status:args.p_review?'review':'requested'},error:null};
      if (name.endsWith('_confirm_plan')) { state.plan_change={id:args.p_id,variant_id:String(apiSub.attributes.variant_id),status:'confirmed',baseline_invoice:state.latest_invoice_id,confirmed_after:new Date(now).toISOString()}; return {data:{confirmed:true},error:null}; }
      return { data: { ok: true }, error: null };
    },
    fetch: async (url, init) => {
      const path = new URL(url).pathname; apiCalls.push({path,method:init?.method||'GET',body:init?.body?JSON.parse(init.body):null});
      let data;
      if (path.endsWith('/checkouts')) { checkoutPayload = JSON.parse(init.body); data = { type: 'checkouts', id: '100', attributes: { test_mode: true, url: 'https://fixture.lemonsqueezy.com/checkout/opaque' } }; }
      else if(path.endsWith('/prices')||path.includes('/prices/')) {
        const v=path.endsWith('/prices')?new URL(url).searchParams.get('filter[variant_id]'):String(apiSub.attributes.variant_id);
        const o=Object.values(c.offers).find(o=>o.variant===v);
        const price={type:'prices',id:'200',attributes:{variant_id:Number(v),category:'subscription',scheme:'standard',unit_price:1299,usage_aggregation:null,setup_fee_enabled:false,trial_interval_unit:null,trial_interval_quantity:null,renewal_interval_unit:o.billing==='monthly'?'month':'year',renewal_interval_quantity:1}};
        if(path.endsWith('/prices'))return Response.json({data:[price]});data=price;
      }
      else if (path.includes('/variants/')) { const o=Object.values(c.offers).find(o=>path.endsWith('/'+o.variant)); data={type:'variants',id:o.variant,attributes:{product_id:Number(o.product),test_mode:true,is_subscription:true,interval:o.billing==='monthly'?'month':'year',interval_count:1}}; }
      else if (path.includes('/products/')) data={type:'products',id:path.split('/').pop(),attributes:{store_id:1,test_mode:true}};
      else if (path.endsWith('/subscription-invoices')) return Response.json({ data: invoices, meta: { page: { lastPage: 1 } } });
      else if (path.includes('/subscription-invoices/')) data = invoices.find(i => path.endsWith('/' + i.id));
      else if (path.includes('/subscriptions/')) { if(init?.method==='PATCH') {const target=Object.values(c.offers).find(o=>Number(o.variant)===JSON.parse(init.body).data.attributes.variant_id);apiSub=sub({...apiSub.attributes,variant_id:Number(target.variant),product_id:Number(target.product),updated_at:new Date(now).toISOString()});} data=apiSub; }
      else if (path.includes('/orders/')) data = apiOrder;
      else throw new Error('Unexpected API path ' + path);
      return Response.json({ data });
    },
  };
  return { d,calls,apiCalls,state: () => state, payload: () => checkoutPayload, setState: value => { state = value; }, setSub: value => { apiSub = value; }, setInvoices: value => { invoices = value; }, conflict: () => { revision++; } };
}
function checkoutRequest(body, token = 'valid-token') {
  return new Request('https://endpoint.invalid', { method: 'POST', headers: { Origin: c.origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function signed(event, data, meta = {}, secret = c.secret) {
  const raw = JSON.stringify({ meta: { event_name: event, ...meta }, data });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))].map(b => b.toString(16).padStart(2, '0')).join('');
  return new Request('https://endpoint.invalid', { method: 'POST', headers: { 'X-Signature': sig, 'X-Event-Name': event }, body: raw });
}
test('checkout binds verified identity, server catalog and opaque nonce; no user ID in metadata', async () => {
  const f = fixture(); f.setState({revision:0});
  assert.equal((await checkout(checkoutRequest({ offer: 'family_monthly' }), c, f.d)).status, 200);
  const intent = f.calls.find(x => x.name.endsWith('_reserve_checkout')).args;
  assert.equal(intent.p_user, 'account-A'); assert.equal(intent.p_variant, '2'); assert.equal(intent.p_tier, 'family');
  const custom = f.payload().data.attributes.checkout_data.custom;
  assert.deepEqual(Object.keys(custom).sort(), ['app_id', 'intent']);
  assert.equal(await sha256(custom.intent), intent.p_hash);
});
test('checkout rejects identity/tier/status/variant/mode manipulation before any writes', async () => {
  for (const extra of [{ user_id: 'victim' }, { tier: 'family' }, { status: 'active' }, { variant_id: 99 }, { mode: 'live' }, { skip_trial: false }, { successUrl: 'https://attacker.invalid' }]) {
    const f = fixture(); assert.equal((await checkout(checkoutRequest({ offer: 'family_monthly', ...extra }), c, f.d)).status, 400);
    assert.equal(f.calls.length, 0);
  }
});
test('forged authentication and unverified accounts cannot create checkout', async () => {
  const f = fixture(); assert.equal((await checkout(checkoutRequest({ offer: 'family_monthly' }, 'forged'), c, f.d)).status, 401);
  f.d.user = async () => ({ id: 'account-A', email: 'fixture@example.invalid' });
  assert.equal((await checkout(checkoutRequest({ offer: 'family_monthly' }), c, f.d)).status, 401); assert.equal(f.calls.length, 0);
});
test('forged or cross-environment signature has no API/storage side effects', async () => {
  const f = fixture(); f.d.fetch = async () => { throw new Error('must not fetch'); };
  assert.equal((await webhook(await signed('subscription_created', sub(), {}, 'wrong-secret'), c, f.d)).status, 401);
  assert.equal(f.calls.length, 0);
});
test('signed live payload on test endpoint rejected before storage', async () => {
  const f = fixture(); assert.equal((await webhook(await signed('subscription_created', sub({ test_mode: false })), c, f.d)).status, 400); assert.equal(f.calls.length, 0);
});
test('successful invoice object uses subscription_id, not invoice ID; duplicates apply once', async () => {
  const f = fixture();
  assert.equal((await webhook(await signed('subscription_payment_success', invoice()), c, f.d)).status, 200);
  const r = await webhook(await signed('subscription_payment_success', invoice()), c, f.d);
  assert.equal((await r.json()).duplicate, true);
  assert.equal(f.calls.filter(x => x.name.endsWith('_commit_snapshot')).every(x => x.args.p_subscription === '10'), true);
  assert.equal(f.state().revision, 1);
});
test('payment failure never extends paid access to a future retry', async () => {
  const result = reconcile(c, sub({ status: 'past_due', renews_at: later }), [invoice({ status: 'pending', billing_reason: 'renewal' }, '31')], order(), previous);
  assert.equal(result.status, 'past_due'); assert.equal(result.paid_access_until, end);
});
test('renewal/recovery needs a new paid invoice; no extension from status update alone', () => {
  const paid = invoice({ billing_reason: 'renewal', created_at: new Date(now).toISOString() }, '31');
  assert.equal(reconcile(c, sub({ renews_at: later }), [paid, invoice()], order(), previous).paid_access_until, later);
  assert.equal(reconcile(c, sub({ renews_at: later }), [invoice()], order(), previous).paid_access_until, end);
});
test('cancellation keeps only the independently verified paid period; expiration revokes', () => {
  assert.equal(reconcile(c, sub({ status: 'cancelled', ends_at: end }), [invoice()], order(), previous).paid_access_until, end);
  assert.ok(reconcile(c, sub({ status: 'expired', ends_at: start }), [invoice()], order(), previous).entitlement_revoked_at);
});
test('current full refund revokes; delayed success cannot resurrect refunded invoice', async () => {
  const f = fixture(); f.setInvoices([invoice({ status: 'refunded', refunded: true, refunded_at: start })]);
  assert.equal((await webhook(await signed('subscription_payment_success', invoice()), c, f.d)).status, 200);
  assert.ok(f.state().entitlement_revoked_at);
});
test('older refunded invoice/order does not erase a later paid renewal; partial blocks extension and flags review', () => {
  const renewal = invoice({ billing_reason: 'renewal', created_at: new Date(now).toISOString() }, '31');
  assert.equal(reconcile(c, sub({ renews_at: later }), [renewal, invoice({ status: 'refunded' })], order({ refunded: true }), previous).entitlement_revoked_at, null);
  const partial = reconcile(c, sub({ renews_at: later }), [invoice({ status: 'partial_refund' })], order(), previous);
  assert.equal(partial.paid_access_until, end); assert.equal(partial.review_required, true);
});
test('legacy active row, native trial, zero invoice and unpaid proration do not prove payment', () => {
  for (const invoices of [[invoice({ total: 0 })], [invoice({ status: 'pending', billing_reason: 'updated' })]]) {
    assert.equal(reconcile(c, sub(), invoices, order(), {}).paid_access_until, null);
  }
  assert.equal(reconcile(c, sub(), [], order({ status: 'pending' }), {}).paid_access_until, null);
  assert.equal(reconcile(c, sub({ status: 'on_trial' }), [invoice()], order(), {}).paid_access_until, null);
});
test('out-of-order signed events fetch current state; CAS conflict retries against a fresh revision', async () => {
  const f = fixture(); f.setSub(sub({ status: 'cancelled', ends_at: end })); f.conflict();
  assert.equal((await webhook(await signed('subscription_created', sub()), c, f.d)).status, 200);
  assert.equal(f.state().status, 'canceled'); assert.equal(f.state().revision, 2);
});
test('unknown binding never falls back to metadata user_id/email; independent order cannot activate', async () => {
  const f = fixture(); f.setState({});
  const r = await webhook(await signed('subscription_created', sub(), { custom_data: { app_id: '11941c8fec', user_id: 'victim' } }), c, f.d);
  assert.equal(r.status, 503); assert.equal(f.calls.some(x => x.name.endsWith('_commit_snapshot')), false);
  assert.equal((await webhook(await signed('order_created', order()), c, f.d)).status, 200);
});
test('unpaid plan changes cannot promote an existing paid tier or extend its paid bounds', () => {
  const result = reconcile(c, sub({ renews_at: later }), [invoice({ billing_reason: 'renewal' }, '31')], order(), previous, true);
  assert.equal(result.paid_access_until, end); assert.equal(result.review_required, true);
});
test('environment configuration fails closed rather than falling back to generic credentials', () => {
  assert.throws(() => configuration(key => key === 'LEMONSQUEEZY_API_KEY' ? 'generic' : undefined, 'live'));
});

test('verified initial order can activate before initial invoice becomes available', () => {
  const state = reconcile(c, sub(), [], order(), {});
  assert.equal(state.paid_access_until, end); assert.equal(state.invoice_id, 'order:20');
});
test('first subscription binds only a ready, matching server intent; old subscriptions cannot consume it', async () => {
  const f = fixture();
  f.setState({ user_id: 'account-A', revision: 0, store_id: '1', product_id: '3', variant_id: '2', intent_created_at: new Date(now - 2 * 86400000).toISOString() });
  const meta = { custom_data: { app_id: '11941c8fec', intent: 'a'.repeat(64), user_id: 'attacker' } };
  assert.equal((await webhook(await signed('subscription_created', sub(), meta), c, f.d)).status, 200);
  assert.equal(f.calls.find(x => x.name.endsWith('_commit_snapshot')).args.p_user, 'account-A');
  const wrong = fixture(); wrong.setState({ user_id: 'account-A', revision: 0, store_id: '1', product_id: '3', variant_id: '999', intent_created_at: start });
  assert.equal((await webhook(await signed('subscription_created', sub(), meta), c, wrong.d)).status, 409);
  assert.equal(wrong.calls.some(x => x.name.endsWith('_commit_snapshot')), false);
  const old = fixture(); old.setState({ user_id: 'account-A', revision: 0, store_id: '1', product_id: '3', variant_id: '2', intent_created_at: new Date(now).toISOString() });
  assert.equal((await webhook(await signed('subscription_created', sub(), meta), c, old.d)).status, 409);
});
test('stale invoice history cannot reset the current paid period or clear a refund', () => {
  assert.throws(() => reconcile(c, sub(), [invoice({ created_at: new Date(now - 3 * 86400000).toISOString() })], order(), { ...previous, entitlement_revoked_at: start }));
});
test('full refund of latest period retains another independently verified live period', () => {
  const otherStart = new Date(now - 2 * 86400000).toISOString();
  const periods = [
    { proof_id: '29', kind:'renewal',start:otherStart,confirmed_at:otherStart,source_created_at:otherStart,tier:'family',billing:'monthly',end, revoked_at: null, review: false },
    { proof_id: '30', kind:'renewal',start,confirmed_at:start,source_created_at:start,tier:'family',billing:'monthly',end:later, revoked_at: null, review: false },
  ];
  const state = reconcile(c, sub(), [invoice({ billing_reason: 'renewal', status: 'refunded', refunded: true, refunded_at: start }), invoice({ billing_reason: 'renewal', created_at: otherStart }, '29')], order(), { ...previous, periods });
  assert.equal(state.invoice_id, '29'); assert.equal(state.paid_access_until, end); assert.equal(state.entitlement_revoked_at, null);
  assert.ok(state.periods.find(p => p.proof_id === '30').revoked_at);
});
test('old partial refund flags only that period and cannot block a later paid renewal', () => {
  const renewal = invoice({ billing_reason: 'renewal', created_at: new Date(now).toISOString() }, '31');
  const state = reconcile(c, sub({ renews_at: later }), [renewal, invoice({ status: 'partial_refund' })], order(), previous);
  assert.equal(state.invoice_id, '31'); assert.equal(state.paid_access_until, later); assert.equal(state.entitlement_revoked_at, null); assert.equal(state.review_required, true);
});
test('partial refund does not change or extend its already verified window', () => {
  const state = reconcile(c, sub({ renews_at: later }), [invoice({ status: 'partial_refund' })], order(), previous);
  assert.equal(state.paid_access_from, start); assert.equal(state.paid_access_until, end); assert.equal(state.entitlement_revoked_at, null);
});
test('payment observation is not a manufactured service-period start', () => {
  const oldCreated=new Date(now-40*86400000).toISOString();
  const result=reconcile(c,sub(),[invoice({created_at:oldCreated})],order(),{},false,now);
  assert.equal(result.paid_access_from,new Date(now).toISOString());
  assert.equal(result.periods[0].source_created_at,oldCreated);
  assert.equal(result.service_period_start,null); assert.equal(result.service_period_end,null);
  assert.notEqual(result.paid_access_from,oldCreated);
});
test('legacy derived dates are not certified until canonical positive payment is observed', () => {
  const legacy={...previous,periods:[{...previous.periods[0],confirmed_at:null}]};
  assert.equal(reconcile(c,sub({status:'past_due'}),[invoice({status:'pending'})],order(),legacy,false,now).paid_access_until,null);
  const confirmed=reconcile(c,sub(),[invoice()],order(),legacy,false,now);
  assert.equal(confirmed.paid_access_from,new Date(now).toISOString());
});
test('an expired verified binding can reserve a replacement without overwriting its history', async () => {
  const f=fixture();f.setSub(sub({status:'expired',ends_at:start}));
  const r=await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d);
  assert.equal(r.status,200);
  const reserve=f.calls.find(x=>x.name.endsWith('_reserve_checkout'));
  assert.equal(reserve.args.p_supersedes,'10'); assert.equal(reserve.args.p_user,'account-A');
});
test('active same offer cannot create a second checkout; legacy accounts need review', async () => {
  const f=fixture();assert.equal((await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d)).status,409);
  assert.equal(f.apiCalls.some(x=>x.path.endsWith('/checkouts')),false);
  const legacy=fixture();legacy.setState({legacy_provider:true});
  assert.equal((await checkout(checkoutRequest({offer:'family_monthly'}),c,legacy.d)).status,409);
  assert.equal(legacy.apiCalls.length,0);
});
function balancedFixture() {
  const f=fixture();f.setSub(sub({variant_id:4,product_id:5}));
  f.setState({...previous,variant_id:'4',product_id:'5',tier:'balanced',periods:[{...previous.periods[0],tier:'balanced',variant:'4',product:'5'}]});
  return f;
}
test('same-cycle plan request disables proration and immediate invoice; it never grants the requested tier', async () => {
  const f=balancedFixture();const r=await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d);
  assert.equal(r.status,200); assert.equal((await r.json()).scheduled,true);
  const patch=f.apiCalls.find(x=>x.method==='PATCH');
  assert.deepEqual(patch.body.data.attributes,{variant_id:2,invoice_immediately:false,disable_prorations:true});
  assert.equal(f.state().effective_tier,'balanced'); assert.equal(f.state().paid_access_until,end);
  assert.equal(f.apiCalls.some(x=>x.path.endsWith('/checkouts')),false);
});
test('requested or confirmed change alone does not activate; only a later paid renewal does', async () => {
  const f=balancedFixture();await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d);
  await webhook(await signed('subscription_updated',sub()),c,f.d);
  assert.equal(f.state().effective_tier,'balanced');
  f.setInvoices([invoice({billing_reason:'renewal',created_at:new Date(now+1000).toISOString()},'31'),invoice()]);
  f.d.now=()=>now+2000; f.setSub(sub({updated_at:new Date(now+2000).toISOString(),renews_at:later}));
  assert.equal((await webhook(await signed('subscription_payment_success',invoice({billing_reason:'renewal',created_at:new Date(now+1000).toISOString()},'31')),c,f.d)).status,200);
  assert.equal(f.state().effective_tier,'family'); assert.equal(f.state().paid_access_until,later);
  const commit=f.calls.filter(x=>x.name.endsWith('_commit_snapshot')).at(-1);
  assert.equal(commit.args.p_state.plan_change_id,'plan-fixture');
});
test('failed renewal and pre-confirmation invoices never activate a pending change', async () => {
  for(const attributes of [{status:'pending',created_at:new Date(now+1000).toISOString()},{status:'paid',created_at:start}]) {
    const f=balancedFixture();await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d);
    f.setInvoices([invoice({billing_reason:'renewal',...attributes},'31'),invoice()]);
    await webhook(await signed('subscription_payment_failed',invoice({billing_reason:'renewal',...attributes},'31')),c,f.d);
    assert.equal(f.state().effective_tier,'balanced'); assert.equal(f.state().paid_access_until,end);
  }
});
test('interval switches and PayPal are reviewed without any provider mutation', async () => {
  for(const scenario of ['interval','paypal']) {
    const f=balancedFixture();if(scenario==='paypal')f.setSub(sub({variant_id:4,product_id:5,payment_processor:'paypal'}));
    const r=await checkout(checkoutRequest({offer:scenario==='interval'?'family_yearly':'family_monthly'}),c,f.d);
    assert.equal(r.status,200);assert.equal((await r.json()).reviewRequired,true);
    assert.equal(f.apiCalls.some(x=>x.method!=='GET'),false);
  }
});
test('downgrade preserves higher paid benefits, then selects the independent lower paid period', () => {
  const newer=invoice({billing_reason:'renewal',created_at:new Date(now).toISOString()},'31');
  const result=reconcile(c,sub({variant_id:4,product_id:5,renews_at:later}),[newer,invoice()],order(),previous,false,now,c.offers.balanced_monthly);
  assert.equal(result.effective_tier,'family');assert.equal(result.paid_access_until,end);
  const next=reconcile(c,sub({variant_id:4,product_id:5,renews_at:later}),[newer,invoice()],order(),{...previous,periods:result.periods},false,Date.parse(end)+1,c.offers.balanced_monthly);
  assert.equal(next.effective_tier,'balanced');assert.equal(next.paid_access_until,later);
});
test('canonical reconciliation repairs a missed renewal after an already-applied delivery', async () => {
  const f=fixture();await webhook(await signed('subscription_created',sub()),c,f.d);
  f.setSub(sub({renews_at:later,updated_at:new Date(now).toISOString()}));
  f.setInvoices([invoice({billing_reason:'renewal',created_at:new Date(now).toISOString()},'31'),invoice()]);
  assert.equal((await synchronize(c,f.d,{subscription:'10',event:'scheduled_reconciliation'})).applied,true);
  assert.equal(f.state().paid_access_until,later);
  assert.equal((await synchronize(c,f.d,{subscription:'10',event:'scheduled_reconciliation'})).duplicate,true);
});
test('an ambiguous failed provider plan call is not repeated automatically', async () => {
  const f=balancedFixture();const original=f.d.fetch;
  f.d.fetch=async(url,init)=>init?.method==='PATCH'?new Response('',{status:503}):original(url,init);
  assert.equal((await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d)).status,503);
  const oldRpc=f.d.rpc;
  f.d.rpc=async(name,args)=>name.endsWith('_request_plan')?{data:{created:false,id:'plan-fixture',status:'requested'},error:null}:oldRpc(name,args);
  const again=await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d);
  assert.equal((await again.json()).reviewRequired,true);
});
test('native-trial/setup-fee/zero or metered plan prices never trigger automatic mutations', async () => {
  for(const override of [{trial_interval_unit:'day',trial_interval_quantity:7},{setup_fee_enabled:true},{unit_price:0},{usage_aggregation:'sum'}]) {
    const f=balancedFixture();const original=f.d.fetch;
    f.d.fetch=async(url,init)=>{const r=await original(url,init);if(new URL(url).pathname.endsWith('/prices')){const b=await r.json();Object.assign(b.data[0].attributes,override);return Response.json(b);}return r;};
    const r=await checkout(checkoutRequest({offer:'family_monthly'}),c,f.d);
    assert.equal((await r.json()).reviewRequired,true);assert.equal(f.apiCalls.some(x=>x.method==='PATCH'),false);
  }
});
test('verified delivery context survives API failure without storing raw identity or secret material', async () => {
  const f=fixture();f.d.fetch=async()=>new Response('',{status:503});
  const result=await webhook(await signed('subscription_created',sub(),{custom_data:{app_id:'11941c8fec',intent:'a'.repeat(64),user_id:'attacker'}}),c,f.d);
  assert.equal(result.status,503);
  const receipt=f.calls.find(x=>x.name.endsWith('_receive_delivery')).args;
  assert.equal(receipt.p_intent_hash,await sha256('a'.repeat(64))); assert.equal(receipt.p_subscription,'10');
  assert.equal(JSON.stringify(receipt).includes('attacker'),false);assert.equal(JSON.stringify(receipt).includes('a'.repeat(64)),false);
  assert.equal(f.calls.some(x=>x.name.endsWith('_complete_delivery')),false);
});
test('recovery uses a canonical key and acknowledges only its claimed lease', async () => {
  const f=fixture();const original=f.d.rpc;
  f.d.rpc=async(name,args)=>name.endsWith('_claim_deliveries')?{data:{items:[{event_key:'delivery-key',subscription_id:'10',lease:'lease-1'}]},error:null}:original(name,args);
  assert.deepEqual(await recoverDeliveries(c,f.d),{completed:1,failed:0});
  const finish=f.calls.find(x=>x.name.endsWith('_finish_delivery')).args;
  assert.equal(finish.p_lease,'lease-1');assert.equal(finish.p_ok,true);
  assert.notEqual(f.calls.find(x=>x.name.endsWith('_commit_snapshot')).args.p_key,'delivery-key');
});
test('failed recovery remains retryable; periodic sweep carries its pagination cursor', async () => {
  const f=fixture();const original=f.d.rpc;
  f.d.fetch=async()=>new Response('',{status:503});
  f.d.rpc=async(name,args)=>name.endsWith('_claim_deliveries')?{data:{items:[{event_key:'delivery-key',subscription_id:'10',lease:'lease-2'}]},error:null}
    :name.endsWith('_reconcile_targets')?{data:{items:[{subscription_id:'10'}],next_cursor:'10'},error:null}:original(name,args);
  assert.deepEqual(await recoverDeliveries(c,f.d),{completed:0,failed:1});
  assert.equal(f.calls.find(x=>x.name.endsWith('_finish_delivery')).args.p_ok,false);
  assert.deepEqual(await reconcileBindings(c,f.d),{completed:0,failed:1,nextCursor:'10'});
});
