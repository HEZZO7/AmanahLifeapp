import { verifySignature } from './verifyWebhookSignature.ts';

export type Mode = 'test' | 'live';
type ObjectData = { type: string; id: string; attributes: Record<string, unknown> };
type Offer = { tier: 'balanced' | 'family'; billing: 'monthly' | 'yearly'; variant: string; product: string };
export type Config = {
  mode: Mode; apiKey: string; secret: string; store: string; origin: string;
  offers: Record<string, Offer>; refundPolicy: string;
};
type Result = { data: unknown; error: unknown };
export type Dependencies = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<Result>;
  user: (token: string) => Promise<{ id: string; email?: string; email_confirmed_at?: string } | null>;
  fetch: typeof fetch;
};
export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}
const prefix = 'app_11941c8fec_payment_';
const api = 'https://api.lemonsqueezy.com/v1/';
const invoiceEvents = new Set(['subscription_payment_success', 'subscription_payment_failed', 'subscription_payment_recovered', 'subscription_payment_refunded']);
const subscriptionEvents = new Set(['subscription_created', 'subscription_updated', 'subscription_cancelled', 'subscription_resumed', 'subscription_expired', 'subscription_paused', 'subscription_unpaused']);
export const supportedEvents = [...subscriptionEvents, ...invoiceEvents, 'order_created', 'order_refunded'];
const id = (v: unknown): string => {
  const value = String(v ?? '');
  if (!/^\d+$/.test(value)) throw new PaymentError('Invalid provider identifier', 400);
  return value;
};
function date(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v))) {
    throw new PaymentError('Missing provider timestamp');
  }
  return new Date(v).toISOString();
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new PaymentError('Malformed provider object', 400);
  return v as Record<string, unknown>;
};
export async function sha256(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function configuration(get: (key: string) => string | undefined, mode: Mode): Config {
  // No fallback to generic/other-environment credentials or the legacy buy-links.
  const need = (name: string) => {
    const value = get(`AMANAHLIFE_LS_${mode.toUpperCase()}_${name}`);
    if (!value) throw new PaymentError('Payments not configured');
    return value;
  };
  const offers: Record<string, Offer> = {};
  for (const tier of ['balanced', 'family'] as const) for (const billing of ['monthly', 'yearly'] as const) {
    const key = `${tier}_${billing}`;
    offers[key] = { tier, billing, variant: id(need(`${key.toUpperCase()}_VARIANT_ID`)), product: id(need(`${tier.toUpperCase()}_PRODUCT_ID`)) };
  }
  if (new Set(Object.values(offers).map(o => o.variant)).size !== 4) throw new PaymentError('Variant mapping overlaps');
  const origin = new URL(need('APP_ORIGIN')).origin;
  if (!origin.startsWith('https://')) throw new PaymentError('HTTPS application origin required');
  return { mode, offers, origin, store: id(need('STORE_ID')), apiKey: need('API_KEY'), secret: need('WEBHOOK_SECRET'), refundPolicy: 'review_keep_current' };
}
async function rpc(d: Dependencies, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await d.rpc(prefix + name, args);
  if (error) throw new PaymentError('Payment storage unavailable');
  return record(data);
}
async function provider(d: Dependencies, c: Config, path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await d.fetch(api + path, {
    ...init, redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${c.apiKey}` },
  });
  if (!response.ok) throw new PaymentError('Provider temporarily unavailable');
  return record(await response.json());
}
function object(value: unknown, type: string, expected?: string): ObjectData {
  const o = record(value);
  if (o.type !== type || typeof o.id !== 'string' || (expected && o.id !== expected)) throw new PaymentError('Provider object mismatch');
  return { type, id: o.id, attributes: record(o.attributes) };
}
function scope(o: ObjectData, c: Config, customer?: string): void {
  if (o.attributes.test_mode !== (c.mode === 'test') || id(o.attributes.store_id) !== c.store || (customer && id(o.attributes.customer_id) !== customer)) {
    throw new PaymentError('Provider environment/account mismatch', 400);
  }
}
function offerFor(c: Config, s: ObjectData): Offer {
  const offer = Object.values(c.offers).find(o => o.variant === String(s.attributes.variant_id) && o.product === String(s.attributes.product_id));
  if (!offer) throw new PaymentError('Unapproved app variant', 400);
  return offer;
}
function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
export async function checkout(req: Request, c: Config, d: Dependencies): Promise<Response> {
  const headers = { 'Access-Control-Allow-Origin': c.origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  if (req.headers.get('Origin') && req.headers.get('Origin') !== c.origin) return response({ error: 'Origin denied' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    if (req.method !== 'POST') throw new PaymentError('Method not allowed', 405);
    const match = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || '');
    const user = match && await d.user(match[1]);
    if (!user?.id || !user.email || !user.email_confirmed_at) throw new PaymentError('Verified login required', 401);
    const b = record(await req.json());
    // The browser selects an offer; it never supplies authoritative plan/payment/identity fields.
    if (Object.keys(b).some(k => !['offer', 'discountCode', 'action', 'returnUrl'].includes(k))) throw new PaymentError('Unsupported checkout fields', 400);
    const state = await rpc(d, 'snapshot', { p_mode: c.mode, p_subscription: null, p_order: null, p_intent_hash: null, p_user: user.id });
    if (b.action === 'manage') {
      if (!state.subscription_id) throw new PaymentError('no_subscription', 409);
      const s = object((await provider(d, c, `subscriptions/${id(state.subscription_id)}`)).data, 'subscriptions', String(state.subscription_id));
      scope(s, c, String(state.customer_id));
      const url = record(s.attributes.urls).customer_portal;
      return response({ url: safeProviderUrl(url) }, 200, headers);
    }
    if (b.action !== undefined) throw new PaymentError('Unsupported action', 400);
    const offer = typeof b.offer === 'string' && c.offers[b.offer];
    if (!offer) throw new PaymentError('Invalid offer', 400);
    const variant = object((await provider(d, c, `variants/${offer.variant}`)).data, 'variants', offer.variant);
    if (variant.attributes.test_mode !== (c.mode === 'test') || id(variant.attributes.product_id) !== offer.product
      || variant.attributes.is_subscription !== true || variant.attributes.interval !== (offer.billing === 'monthly' ? 'month' : 'year') || variant.attributes.interval_count !== 1) throw new PaymentError('Variant configuration mismatch');
    const product = object((await provider(d, c, `products/${offer.product}`)).data, 'products', offer.product);
    if (product.attributes.test_mode !== (c.mode === 'test') || id(product.attributes.store_id) !== c.store) throw new PaymentError('Product configuration mismatch');
    if (b.discountCode !== undefined && (typeof b.discountCode !== 'string' || !/^[A-Z0-9]{3,256}$/.test(b.discountCode))) throw new PaymentError('Invalid discount', 400);
    // Persist the trusted account and plan BEFORE making an external checkout request.
    const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await sha256(nonce);
    await rpc(d, 'create_intent', { p_mode: c.mode, p_user: user.id, p_hash: hash, p_store: c.store, p_product: offer.product, p_variant: offer.variant, p_tier: offer.tier, p_billing: offer.billing });
    const payload = { data: { type: 'checkouts', attributes: {
      test_mode: c.mode === 'test',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      checkout_data: { email: user.email, custom: { app_id: '11941c8fec', intent: nonce }, ...(b.discountCode ? { discount_code: b.discountCode } : {}) },
      checkout_options: { embed: false, skip_trial: state.trial_used === true },
      product_options: { enabled_variants: [Number(offer.variant)], redirect_url: `${c.origin}/subscription?checkout=returned` },
    }, relationships: { store: { data: { type: 'stores', id: c.store } }, variant: { data: { type: 'variants', id: offer.variant } } } } };
    const created = object((await provider(d, c, 'checkouts', { method: 'POST', body: JSON.stringify(payload) })).data, 'checkouts');
    if (created.attributes.test_mode !== (c.mode === 'test')) throw new PaymentError('Checkout mode mismatch');
    const url = safeProviderUrl(created.attributes.url);
    await rpc(d, 'ready_intent', { p_mode: c.mode, p_hash: hash, p_checkout: created.id });
    return response({ url }, 200, headers);
  } catch (e) { return response({ error: e instanceof PaymentError ? e.message : 'Checkout unavailable' }, e instanceof PaymentError ? e.status : 503, headers); }
}
function safeProviderUrl(value: unknown): string {
  if (typeof value !== 'string') throw new PaymentError('Missing provider URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !(url.hostname === 'lemonsqueezy.com' || url.hostname.endsWith('.lemonsqueezy.com')) || url.username || url.password) throw new PaymentError('Invalid provider URL');
  return url.href;
}
export async function webhook(req: Request, c: Config, d: Dependencies): Promise<Response> {
  try {
    if (req.method !== 'POST') throw new PaymentError('Method not allowed', 405);
    const raw = await req.text();
    if (raw.length > 262144) throw new PaymentError('Payload too large', 413);
    if (!await verifySignature(raw, req.headers.get('X-Signature') || '', c.secret)) throw new PaymentError('Invalid signature', 401);
    const b = record(JSON.parse(raw));
    const meta = record(b.meta);
    const event = String(meta.event_name);
    if (!supportedEvents.includes(event)) return response({ ignored: true });
    if (req.headers.has('X-Event-Name') && req.headers.get('X-Event-Name') !== event) throw new PaymentError('Event name mismatch', 400);
    const type = invoiceEvents.has(event) ? 'subscription-invoices' : subscriptionEvents.has(event) ? 'subscriptions' : 'orders';
    const delivered = object(b.data, type);
    scope(delivered, c);
    const custom = meta.custom_data == null ? null : record(meta.custom_data);
    const nonce = custom?.app_id === '11941c8fec' && typeof custom.intent === 'string' && /^[a-f0-9]{64}$/.test(custom.intent) ? custom.intent : null;
    const hash = nonce ? await sha256(nonce) : null;
    const subscription = type === 'subscriptions' ? id(delivered.id) : type === 'subscription-invoices' ? id(delivered.attributes.subscription_id) : null;
    const order = type === 'orders' ? id(delivered.id) : null;
    const digest = await sha256(raw);
    // Snapshot revision is captured BEFORE API reads; database CAS rejects a slower/stale concurrent reconciliation.
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = await rpc(d, 'snapshot', { p_mode: c.mode, p_subscription: subscription, p_order: order, p_intent_hash: hash, p_user: null });
      if (!state.user_id) {
        // Independent digital orders never activate app accounts. Unknown app events are retained as metadata-only blockers.
        await rpc(d, 'unbound', { p_mode: c.mode, p_key: digest, p_event: event, p_object: delivered.id, p_reason: type === 'orders' ? 'independent_or_unbound_order' : 'missing_trusted_checkout_binding' });
        return response({ unbound: true }, type === 'orders' ? 200 : 503);
      }
      if (type === 'orders' && !state.subscription_id) {
        await rpc(d, 'unbound', { p_mode: c.mode, p_key: digest, p_event: event, p_object: delivered.id, p_reason: 'awaiting_subscription_event' });
        return response({ awaiting_subscription: true });
      }
      const sid = subscription || id(state.subscription_id);
      const s = object((await provider(d, c, `subscriptions/${sid}`)).data, 'subscriptions', sid);
      scope(s, c);
      const currentOffer = state.subscription_id
        ? Object.values(c.offers).find(o => o.variant === String(s.attributes.variant_id) && o.product === String(s.attributes.product_id))
        : offerFor(c, s);
      const changedOffer = !!state.subscription_id && (!currentOffer || String(state.variant_id) !== currentOffer.variant);
      const offer = changedOffer ? Object.values(c.offers).find(o => o.variant === String(state.variant_id)) : currentOffer;
      if (!offer) throw new PaymentError('Original paid offer missing from approved catalog');
      const customer = id(s.attributes.customer_id);
      if (state.subscription_id && String(state.subscription_id) !== sid) throw new PaymentError('Account already bound', 409);
      if (!state.subscription_id && (String(state.variant_id) !== offer.variant || String(state.product_id) !== offer.product || String(state.store_id) !== c.store)) throw new PaymentError('Checkout binding mismatch', 409);
      if (!state.subscription_id && (!state.intent_created_at || Date.parse(date(s.attributes.created_at)) < Date.parse(date(state.intent_created_at)) - 60000)) throw new PaymentError('Subscription predates checkout intent', 409);
      // Refetch the triggering invoice/order; never let an old signed payload undo a newer refund/recovery.
      if (type !== 'subscriptions') {
        const canonical = object((await provider(d, c, `${type}/${id(delivered.id)}`)).data, type, delivered.id);
        scope(canonical, c, customer);
        if (type === 'subscription-invoices' && id(canonical.attributes.subscription_id) !== sid) throw new PaymentError('Invoice subscription mismatch', 409);
        if (type === 'orders' && id(s.attributes.order_id) !== canonical.id) throw new PaymentError('Order subscription mismatch', 409);
      }
      const invoices: ObjectData[] = [];
      // Complete pagination: missing invoices must never be mistaken for the current paid invoice.
      for (let page = 1; ; page++) {
        if (page > 100) throw new PaymentError('Invoice history needs reconciliation');
        const batch = await provider(d, c, `subscription-invoices?filter[subscription_id]=${sid}&page[size]=100&page[number]=${page}`);
        if (!Array.isArray(batch.data)) throw new PaymentError('Invalid invoice list');
        for (const value of batch.data) {
          const invoice = object(value, 'subscription-invoices'); scope(invoice, c, customer);
          if (id(invoice.attributes.subscription_id) !== sid) throw new PaymentError('Invoice list mismatch');
          invoices.push(invoice);
        }
        const pages = record(record(batch.meta).page);
        if (!Number.isInteger(pages.lastPage) || Number(pages.lastPage) < page) throw new PaymentError('Invalid invoice pagination');
        if (page === pages.lastPage) break;
      }
      const originalOrder = object((await provider(d, c, `orders/${id(s.attributes.order_id)}`)).data, 'orders', id(s.attributes.order_id));
      scope(originalOrder, c, customer);
      const transition = reconcile(c, s, invoices, originalOrder, state, changedOffer);
      const applied = await rpc(d, 'apply', { p_mode: c.mode, p_key: digest, p_event: event, p_object: delivered.id, p_user: state.user_id, p_revision: state.revision, p_intent_hash: hash, p_subscription: sid, p_customer: customer, p_order: id(s.attributes.order_id), p_store: c.store, p_product: offer.product, p_variant: offer.variant, p_tier: offer.tier, p_billing: offer.billing, p_state: transition });
      if (applied.retry !== true) return response(applied);
    }
    throw new PaymentError('Concurrent subscription update; retry');
  } catch (e) { return response({ error: e instanceof PaymentError ? e.message : 'Webhook retry required' }, e instanceof PaymentError ? e.status : 503); }
}

export function reconcile(c: Config, s: ObjectData, invoices: ObjectData[], order: ObjectData, previous: Record<string, unknown>, changedOffer = false): Record<string, unknown> {
  const a = s.attributes;
  const statuses: Record<string, string> = { active: 'active', on_trial: 'trialing', past_due: 'past_due', unpaid: 'past_due', cancelled: 'canceled', expired: 'expired', paused: 'paused' };
  const status = statuses[String(a.status)];
  if (!status) throw new PaymentError('Unknown subscription status');
  const version = date(a.updated_at);
  if (previous.provider_updated_at && Date.parse(version) < Date.parse(String(previous.provider_updated_at))) throw new PaymentError('Provider returned stale subscription');
  const billable = invoices.filter(i => ['initial', 'renewal'].includes(String(i.attributes.billing_reason))).sort((x, y) => Date.parse(date(y.attributes.created_at)) - Date.parse(date(x.attributes.created_at)) || Number(y.id) - Number(x.id));
  // The initial payment can be represented by a paid order before an initial invoice exists.
  // It is accepted only after the same trusted checkout/subscription/order binding above.
  const initialOrderProof: ObjectData | undefined = invoices.length === 0 ? {
    type: 'initial-order-proof', id: `order:${order.id}`, attributes: { ...order.attributes, billing_reason: 'initial', created_at: a.created_at },
  } : undefined;
  const latest = billable[0] || initialOrderProof;
  const invoice = latest?.attributes;
  if (latest && previous.paid_access_from && Date.parse(date(invoice!.created_at)) < Date.parse(String(previous.paid_access_from))) {
    throw new PaymentError('Provider returned an older invoice history');
  }
  type Period = { proof_id: string; kind: string; start: string; end: string; revoked_at: string | null; review: boolean };
  const periods: Period[] = Array.isArray(previous.periods) ? previous.periods.map(value => {
    const p = record(value);
    return { proof_id: String(p.proof_id), kind: String(p.kind), start: date(p.start), end: date(p.end), revoked_at: p.revoked_at ? date(p.revoked_at) : null, review: p.review === true };
  }) : [];
  // Compatibility for an in-process snapshot fixture; real DB snapshots always supply the period ledger.
  if (!Array.isArray(previous.periods) && previous.invoice_id && previous.paid_access_from && previous.paid_access_until) {
    periods.push({ proof_id: String(previous.invoice_id), kind: String(previous.invoice_id).startsWith('order:') ? 'initial' : billable.find(i => i.id === previous.invoice_id)?.attributes.billing_reason === 'initial' ? 'initial' : 'renewal', start: date(previous.paid_access_from), end: date(previous.paid_access_until), revoked_at: previous.entitlement_revoked_at ? date(previous.entitlement_revoked_at) : null, review: false });
  }
  const initialInvoices = invoices.filter(i => i.attributes.billing_reason === 'initial');
  const initialFullRefund = order.attributes.refunded === true || ['refunded', 'fraudulent'].includes(String(order.attributes.status))
    || initialInvoices.some(i => i.attributes.refunded === true || i.attributes.status === 'refunded');
  let review = changedOffer || invoices.some(i => i.attributes.status === 'partial_refund') || order.attributes.status === 'partial_refund';
  for (const p of periods) {
    const source = invoices.find(i => i.id === p.proof_id)?.attributes;
    const fullyRefunded = source?.refunded === true || source?.status === 'refunded' || (p.kind === 'initial' && initialFullRefund);
    if (fullyRefunded && !p.revoked_at) p.revoked_at = source?.refunded_at ? date(source.refunded_at) : order.attributes.refunded_at && p.kind === 'initial' ? date(order.attributes.refunded_at) : version;
    if (source?.status === 'partial_refund' || (p.kind === 'initial' && order.attributes.status === 'partial_refund')) p.review = true;
    if (a.status === 'cancelled' && a.ends_at && Date.parse(date(a.ends_at)) < Date.parse(p.end)) p.end = date(a.ends_at);
    if (a.status === 'expired') p.revoked_at ||= a.ends_at ? date(a.ends_at) : version;
  }
  const end = a.status === 'cancelled' ? a.ends_at : a.status === 'active' ? a.renews_at : null;
  const currentPartial = invoice?.status === 'partial_refund' || (invoice?.billing_reason === 'initial' && order.attributes.status === 'partial_refund');
  const currentRefund = invoice?.status === 'refunded' || invoice?.refunded === true || (invoice?.billing_reason === 'initial' && initialFullRefund);
  // An unrelated old partial refund cannot block a later independently paid renewal.
  if (!currentRefund && !currentPartial && !changedOffer && invoice?.status === 'paid' && Number(invoice.total) > 0 && end) {
    const start = date(invoice.created_at); const finish = date(end);
    if (Date.parse(start) >= Date.parse(finish) || Date.parse(start) > Date.now() + 60000) throw new PaymentError('Ambiguous paid access window');
    const known = periods.find(p => p.proof_id === latest!.id);
    if (known) {
      if (Date.parse(finish) < Date.parse(known.end)) known.end = finish;
      // Never clear a refund or extend the same proof on a delayed/replayed success.
    } else {
      const sameInitial = invoice.billing_reason === 'initial' && periods.find(p => p.kind === 'initial');
      periods.push({ proof_id: latest!.id, kind: String(invoice.billing_reason), start,
        end: sameInitial && Date.parse(sameInitial.end) < Date.parse(finish) ? sameInitial.end : finish,
        revoked_at: sameInitial ? sameInitial.revoked_at : null, review: false });
    }
  }
  const live = periods.filter(p => !p.revoked_at && Date.parse(p.start) <= Date.now() && Date.parse(p.end) > Date.now())
    .sort((x,y) => Date.parse(y.end)-Date.parse(x.end));
  const chosen = live[0] || [...periods].sort((x,y) => Date.parse(y.start)-Date.parse(x.start))[0];
  const expired = a.status === 'expired';
  const revoked = expired ? (a.ends_at ? date(a.ends_at) : version) : live.length ? null : chosen?.revoked_at || (currentRefund ? version : previous.entitlement_revoked_at || null);
  review ||= periods.some(p => p.review);
  return { status, provider_status: a.status, provider_updated_at: version,
    paid_access_from: chosen?.start || null, paid_access_until: chosen?.end || null,
    invoice_id: chosen?.proof_id || null, entitlement_revoked_at: revoked,
    ends_at: a.ends_at ? date(a.ends_at) : null, review_required: review, periods };
}
