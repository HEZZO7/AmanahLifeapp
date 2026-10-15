// Isolated request -> real handler -> fake provider/storage. Never sends network traffic.
// PostgreSQL RPC integration is exercised separately against a fresh CI PostgreSQL service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkout, webhook, reconcile, configuration, sha256 } from '../supabase/functions/_shared/lemonPayments.ts';

const now = Date.now();
const start = new Date(now - 86400000).toISOString();
const end = new Date(now + 28 * 86400000).toISOString();
const later = new Date(now + 58 * 86400000).toISOString();
const c = { mode: 'test', apiKey: 'isolated-test-key', secret: 'isolated-test-secret', store: '1', origin: 'https://test.example', refundPolicy: 'review_keep_current', offers: { family_monthly: { tier: 'family', billing: 'monthly', variant: '2', product: '3' }, balanced_monthly: { tier: 'balanced', billing: 'monthly', variant: '4', product: '5' } } };
const sub = (attrs = {}) => ({ type: 'subscriptions', id: '10', attributes: { test_mode: true, store_id: 1, customer_id: 6, product_id: 3, variant_id: 2, order_id: 20, status: 'active', created_at: start, updated_at: start, renews_at: end, ends_at: null, ...attrs } });
const invoice = (attrs = {}, invoiceId = '30') => ({ type: 'subscription-invoices', id: invoiceId, attributes: { test_mode: true, store_id: 1, customer_id: 6, subscription_id: 10, billing_reason: 'initial', status: 'paid', total: 1299, created_at: start, updated_at: start, refunded: false, ...attrs } });
const order = (attrs = {}) => ({ type: 'orders', id: '20', attributes: { test_mode: true, store_id: 1, customer_id: 6, status: 'paid', total: 1299, refunded: false, ...attrs } });
const previous = { user_id: 'account-A', revision: 0, subscription_id: '10', customer_id: '6', variant_id: '2', product_id: '3', tier: 'family', billing: 'monthly', paid_access_from: start, paid_access_until: end, invoice_id: '30', entitlement_revoked_at: null };
function fixture() {
  const calls = []; let state = { ...previous }; let apiSub = sub(); let invoices = [invoice()]; let apiOrder = order();
  const seen = new Set(); let revision = 0; let checkoutPayload;
  const d = {
    user: async token => token === 'valid-token' ? { id: 'account-A', email: 'fixture@example.invalid', email_confirmed_at: start } : null,
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name.endsWith('_snapshot')) return { data: state, error: null };
      if (name.endsWith('_apply')) {
        if (seen.has(args.p_key)) return { data: { duplicate: true }, error: null };
        if (args.p_revision !== revision) { state.revision = revision; return { data: { retry: true }, error: null }; }
        seen.add(args.p_key); revision++; state = { ...state, ...args.p_state, revision };
        return { data: { applied: true }, error: null };
      }
      return { data: { ok: true }, error: null };
    },
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      let data;
      if (path.endsWith('/checkouts')) { checkoutPayload = JSON.parse(init.body); data = { type: 'checkouts', id: '100', attributes: { test_mode: true, url: 'https://fixture.lemonsqueezy.com/checkout/opaque' } }; }
      else if (path.includes('/variants/')) data = { type: 'variants', id: '2', attributes: { product_id: 3, test_mode: true, is_subscription: true, interval: 'month', interval_count: 1 } };
      else if (path.includes('/products/')) data = { type: 'products', id: '3', attributes: { store_id: 1, test_mode: true } };
      else if (path.endsWith('/subscription-invoices')) return Response.json({ data: invoices, meta: { page: { lastPage: 1 } } });
      else if (path.includes('/subscription-invoices/')) data = invoices.find(i => path.endsWith('/' + i.id));
      else if (path.includes('/subscriptions/')) data = apiSub;
      else if (path.includes('/orders/')) data = apiOrder;
      else throw new Error('Unexpected API path ' + path);
      return Response.json({ data });
    },
  };
  return { d, calls, state: () => state, payload: () => checkoutPayload, setState: value => { state = value; }, setSub: value => { apiSub = value; }, setInvoices: value => { invoices = value; }, conflict: () => { revision++; } };
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
  const f = fixture();
  assert.equal((await checkout(checkoutRequest({ offer: 'family_monthly' }), c, f.d)).status, 200);
  const intent = f.calls.find(x => x.name.endsWith('_create_intent')).args;
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
  assert.equal(f.calls.filter(x => x.name.endsWith('_apply')).every(x => x.args.p_subscription === '10'), true);
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
  assert.equal(r.status, 503); assert.equal(f.calls.some(x => x.name.endsWith('_apply')), false);
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
  assert.equal(f.calls.find(x => x.name.endsWith('_apply')).args.p_user, 'account-A');
  const wrong = fixture(); wrong.setState({ user_id: 'account-A', revision: 0, store_id: '1', product_id: '3', variant_id: '999', intent_created_at: start });
  assert.equal((await webhook(await signed('subscription_created', sub(), meta), c, wrong.d)).status, 409);
  assert.equal(wrong.calls.some(x => x.name.endsWith('_apply')), false);
  const old = fixture(); old.setState({ user_id: 'account-A', revision: 0, store_id: '1', product_id: '3', variant_id: '2', intent_created_at: new Date(now).toISOString() });
  assert.equal((await webhook(await signed('subscription_created', sub(), meta), c, old.d)).status, 409);
});
test('stale invoice history cannot reset the current paid period or clear a refund', () => {
  assert.throws(() => reconcile(c, sub(), [invoice({ created_at: new Date(now - 3 * 86400000).toISOString() })], order(), { ...previous, entitlement_revoked_at: start }));
});
