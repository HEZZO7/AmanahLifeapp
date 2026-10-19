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
  now?: () => number;
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
    let state = await rpc(d, 'snapshot', { p_mode: c.mode, p_subscription: null, p_order: null, p_intent_hash: null, p_user: user.id });
    if (state.legacy_provider === true) throw new PaymentError('Legacy subscription requires account review', 409);
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
    if (variant.attributes.test_mode !== (c.mode === 'test') || id(variant.attributes.product_id) !== offer.product) throw new PaymentError('Variant configuration mismatch');
    const product = object((await provider(d, c, `products/${offer.product}`)).data, 'products', offer.product);
    if (product.attributes.test_mode !== (c.mode === 'test') || id(product.attributes.store_id) !== c.store) throw new PaymentError('Product configuration mismatch');
    const priceList=await provider(d,c,`prices?filter[variant_id]=${offer.variant}&page[size]=1`);
    if(!Array.isArray(priceList.data)||priceList.data.length!==1) throw new PaymentError('Current subscription price unavailable');
    const targetPrice=object(priceList.data[0],'prices').attributes;
    if(String(targetPrice.variant_id)!==offer.variant || targetPrice.category!=='subscription' || targetPrice.renewal_interval_unit!==(offer.billing==='monthly'?'month':'year') || targetPrice.renewal_interval_quantity!==1) throw new PaymentError('Price configuration mismatch');
    if (b.discountCode !== undefined && (typeof b.discountCode !== 'string' || !/^[A-Z0-9]{3,256}$/.test(b.discountCode))) throw new PaymentError('Invalid discount', 400);
    if (state.subscription_id) {
      // An authenticated account can refresh only its existing trusted binding.
      await synchronize(c, d, { subscription: id(state.subscription_id), event: 'account_refresh', user: user.id });
      state = await rpc(d, 'snapshot', { p_mode: c.mode, p_subscription: null, p_order: null, p_intent_hash: null, p_user: user.id });
      if (state.provider_status !== 'expired') {
        if (offer.variant === state.variant_id) throw new PaymentError('This offer is already subscribed; use management', 409);
        if (b.discountCode) throw new PaymentError('Discount is only supported for a new checkout', 409);
        return await schedulePlan(c, d, user.id, state, offer, targetPrice, headers);
      }
    }
    // Persist the trusted account and plan BEFORE making an external checkout request.
    const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await sha256(nonce);
    await rpc(d, 'reserve_checkout', { p_mode: c.mode, p_user: user.id, p_hash: hash, p_store: c.store, p_product: offer.product, p_variant: offer.variant, p_tier: offer.tier, p_billing: offer.billing, p_revision: state.revision ?? 0, p_supersedes: state.subscription_id ?? null });
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
    // Durable, minimized verified context survives provider retries. Never persist raw nonce,
    // signature, email, checkout URL or unverified input. Scheduler activation is separate.
    await rpc(d,'receive_delivery',{p_mode:c.mode,p_key:digest,p_event:event,p_object:delivered.id,p_subscription:subscription,p_order:order,p_intent_hash:hash});
    const result=await synchronize(c,d,{subscription,order,intentHash:hash,digest,event,delivered});
    await rpc(d,'complete_delivery',{p_mode:c.mode,p_key:digest});
    return response(result);
  } catch (e) { return response({ error: e instanceof PaymentError ? e.message : 'Webhook retry required' }, e instanceof PaymentError ? e.status : 503); }
}

type SyncInput = { subscription?: string | null; order?: string | null; intentHash?: string | null; digest?: string; event: string; delivered?: ObjectData; user?: string };
// Service-side library entry for webhook, authenticated account refresh and a future cron worker.
// It is not an anonymously callable reconciliation HTTP endpoint.
export async function synchronize(c: Config, d: Dependencies, input: SyncInput): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await rpc(d, 'snapshot', { p_mode: c.mode, p_subscription: input.subscription ?? null, p_order: input.order ?? null, p_intent_hash: input.intentHash ?? null, p_user: null });
    if (input.user && state.user_id !== input.user) throw new PaymentError('Account binding mismatch', 403);
    if (!state.user_id || (!input.subscription && !state.subscription_id)) {
      await rpc(d, 'unbound', { p_mode: c.mode, p_key: input.digest || await sha256(JSON.stringify(input)), p_event: input.event, p_object: input.delivered?.id || input.order || input.subscription || 'unknown', p_reason: 'missing_trusted_checkout_binding' });
      if (input.order) return { unbound: true };
      throw new PaymentError('Missing trusted checkout binding');
    }
    const sid = input.subscription || id(state.subscription_id);
    const s = object((await provider(d, c, `subscriptions/${sid}`)).data, 'subscriptions', sid);
    scope(s, c);
    const customer = id(s.attributes.customer_id);
    if (state.customer_id && String(state.customer_id) !== customer) throw new PaymentError('Immutable customer mismatch', 409);
    const currentOffer = Object.values(c.offers).find(o => o.variant === String(s.attributes.variant_id) && o.product === String(s.attributes.product_id));
    let offer = state.subscription_id ? Object.values(c.offers).find(o => o.variant === state.variant_id && o.product === state.product_id) : offerFor(c, s);
    if (!offer) throw new PaymentError('Original paid catalog entry unavailable');
    if (!state.subscription_id && (String(state.variant_id) !== offer.variant || String(state.product_id) !== offer.product || String(state.store_id) !== c.store)) throw new PaymentError('Checkout binding mismatch', 409);
    if (!state.subscription_id && (!state.intent_created_at || Date.parse(date(s.attributes.created_at)) < Date.parse(date(state.intent_created_at)) - 60000)) throw new PaymentError('Subscription predates checkout intent', 409);
    if (input.delivered && input.delivered.type !== 'subscriptions') {
      const canonical = object((await provider(d, c, `${input.delivered.type}/${id(input.delivered.id)}`)).data, input.delivered.type, input.delivered.id);
      scope(canonical, c, customer);
      if (canonical.type === 'subscription-invoices' && id(canonical.attributes.subscription_id) !== sid) throw new PaymentError('Invoice subscription mismatch', 409);
      if (canonical.type === 'orders' && id(s.attributes.order_id) !== canonical.id) throw new PaymentError('Order subscription mismatch', 409);
    }
    const invoices: ObjectData[] = [];
    for (let page = 1; ; page++) {
      if (page > 100) throw new PaymentError('Invoice history requires review');
      const batch = await provider(d, c, `subscription-invoices?filter[subscription_id]=${sid}&page[size]=100&page[number]=${page}`);
      if (!Array.isArray(batch.data)) throw new PaymentError('Invalid invoice history');
      for (const item of batch.data) {
        const invoice = object(item, 'subscription-invoices'); scope(invoice, c, customer);
        if (id(invoice.attributes.subscription_id) !== sid) throw new PaymentError('Invoice history mismatch');
        invoices.push(invoice);
      }
      const pages = record(record(batch.meta).page);
      if (!Number.isInteger(pages.lastPage) || Number(pages.lastPage) < page) throw new PaymentError('Invalid invoice pagination');
      if (page === pages.lastPage) break;
    }
    const order = object((await provider(d, c, `orders/${id(s.attributes.order_id)}`)).data, 'orders', id(s.attributes.order_id)); scope(order, c, customer);
    // A provider-side change during API reads must be retried, not attached to an older invoice snapshot.
    const after = object((await provider(d, c, `subscriptions/${sid}`)).data, 'subscriptions', sid); scope(after, c, customer);
    if (JSON.stringify(subscriptionVersion(s)) !== JSON.stringify(subscriptionVersion(after))) continue;
    const changed = !currentOffer || currentOffer.variant !== offer.variant;
    const plan = state.plan_change ? record(state.plan_change) : null;
    const newest = [...invoices].filter(i => ['initial','renewal'].includes(String(i.attributes.billing_reason)))
      .sort((x,y) => Date.parse(date(y.attributes.created_at))-Date.parse(date(x.attributes.created_at)) || Number(y.id)-Number(x.id))[0];
    const planConfirmed = changed && currentOffer && plan?.status === 'confirmed' && plan.variant_id === currentOffer.variant
      && plan.confirmed_after && newest?.attributes.billing_reason === 'renewal' && newest.attributes.status === 'paid'
      && newest.attributes.refunded !== true && Number(newest.attributes.total)>0
      && newest.id !== plan.baseline_invoice && Date.parse(date(newest.attributes.created_at)) > Date.parse(date(plan.confirmed_after));
    if (planConfirmed && currentOffer) offer = currentOffer;
    const transition = reconcile(c, s, invoices, order, state, changed && !planConfirmed, d.now?.() ?? Date.now(), offer);
    transition.plan_change_id = planConfirmed ? plan?.id : null;
    // Canonical snapshot keys differ from delivery hashes. A missed later renewal can be repaired
    // even when an older webhook delivery has already been deduplicated.
    const key = input.digest || await sha256(JSON.stringify(['canonical-v2', c.mode, sid, subscriptionVersion(s), invoices.map(i => [i.id,i.attributes.status,i.attributes.refunded,i.attributes.refunded_at,i.attributes.updated_at]).sort(), order.attributes.status, order.attributes.refunded_at, state.plan_change]));
    const result = await rpc(d, 'commit_snapshot', { p_mode: c.mode, p_key: key, p_event: input.event, p_object: input.delivered?.id || sid,
      p_user: state.user_id, p_revision: state.revision, p_intent_hash: input.intentHash ?? null,
      p_subscription: sid, p_customer: customer, p_order: id(s.attributes.order_id), p_store: c.store,
      p_product: offer.product, p_variant: offer.variant, p_tier: offer.tier, p_billing: offer.billing, p_state: transition });
    if (result.retry !== true) return result;
  }
  throw new PaymentError('Concurrent subscription update; retry');
}
function subscriptionVersion(s: ObjectData) {
  const a=s.attributes;
  return [a.store_id,a.customer_id,a.order_id,a.product_id,a.variant_id,a.updated_at,a.status,a.renews_at,a.ends_at];
}
// Library-only workers. No anonymous endpoint, cron schedule or live credentials are installed.
export async function recoverDeliveries(c:Config,d:Dependencies,limit=25):Promise<{completed:number;failed:number}> {
  const batch=await rpc(d,'claim_deliveries',{p_mode:c.mode,p_limit:limit});
  if(!Array.isArray(batch.items)) throw new PaymentError('Invalid recovery batch');
  let completed=0,failed=0;
  for(const value of batch.items) {
    const job=record(value);
    try {
      await synchronize(c,d,{subscription:job.subscription_id?String(job.subscription_id):null,order:job.order_id?String(job.order_id):null,intentHash:job.intent_hash?String(job.intent_hash):null,event:'delivery_reconciliation'});
      await rpc(d,'finish_delivery',{p_mode:c.mode,p_key:job.event_key,p_lease:job.lease,p_ok:true});completed++;
    } catch {
      await rpc(d,'finish_delivery',{p_mode:c.mode,p_key:job.event_key,p_lease:job.lease,p_ok:false});failed++;
    }
  }
  return {completed,failed};
}
export async function reconcileBindings(c:Config,d:Dependencies,after:string|null=null,limit=25):Promise<{nextCursor:string|null;completed:number;failed:number}> {
  const batch=await rpc(d,'reconcile_targets',{p_mode:c.mode,p_after:after,p_limit:limit});
  if(!Array.isArray(batch.items)) throw new PaymentError('Invalid binding batch');
  let completed=0,failed=0;
  for(const value of batch.items) {
    const target=record(value);
    try {await synchronize(c,d,{subscription:id(target.subscription_id),event:'periodic_reconciliation'});completed++;} catch {failed++;}
  }
  return {completed,failed,nextCursor:typeof batch.next_cursor==='string'?batch.next_cursor:null};
}
async function schedulePlan(c: Config, d: Dependencies, user: string, state: Record<string, unknown>, offer: Offer, targetPrice:Record<string,unknown>, headers: Record<string,string>): Promise<Response> {
  // Interval switches/trials/PayPal may charge immediately or need a different portal flow.
  // Never call PATCH for those cases under the approved no-proration policy.
  const simple=(p:Record<string,unknown>)=>p.category==='subscription' && p.scheme==='standard' && Number(p.unit_price)>0 && p.usage_aggregation===null && p.setup_fee_enabled===false && p.trial_interval_unit===null && p.trial_interval_quantity===null;
  const oldPrice=state.price_id ? object((await provider(d,c,`prices/${id(state.price_id)}`)).data,'prices',String(state.price_id)).attributes : null;
  const eligible = state.provider_status === 'active' && state.billing === offer.billing && state.payment_processor === 'stripe'
    && !!state.invoice_id && !!state.paid_access_until && Date.parse(String(state.paid_access_until))>(d.now?.()??Date.now())
    && simple(targetPrice) && !!oldPrice && simple(oldPrice) && String(oldPrice.variant_id)===String(state.variant_id)
    && oldPrice.renewal_interval_unit===targetPrice.renewal_interval_unit && oldPrice.renewal_interval_quantity===targetPrice.renewal_interval_quantity;
  const change = await rpc(d, 'request_plan', { p_mode:c.mode,p_user:user,p_revision:state.revision,p_subscription:state.subscription_id,
    p_product:offer.product,p_variant:offer.variant,p_tier:offer.tier,p_billing:offer.billing,p_review:!eligible });
  if (!eligible || change.status === 'confirmed') return response({ scheduled:true, reviewRequired:!eligible },200,headers);
  // An ambiguous previous provider call is reviewed; it is never blindly repeated.
  if (change.created !== true) return response({ scheduled:true, reviewRequired:true },200,headers);
  const s=object((await provider(d,c,`subscriptions/${id(state.subscription_id)}`, { method:'PATCH',body:JSON.stringify({data:{type:'subscriptions',id:state.subscription_id,attributes:{variant_id:Number(offer.variant),invoice_immediately:false,disable_prorations:true}}}) })).data,'subscriptions',String(state.subscription_id));
  scope(s,c,String(state.customer_id));
  if (String(s.attributes.variant_id)!==offer.variant || String(s.attributes.product_id)!==offer.product) throw new PaymentError('Provider plan change requires review');
  await rpc(d,'confirm_plan',{p_mode:c.mode,p_user:user,p_id:change.id,p_provider_changed_at:date(s.attributes.updated_at)});
  return response({scheduled:true},200,headers);
}

export function reconcile(c: Config, s: ObjectData, invoices: ObjectData[], order: ObjectData, previous: Record<string, unknown>, changedOffer = false, observedMs = Date.now(), billedOffer?: Offer): Record<string, unknown> {
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
    type: 'initial-order-proof', id: `order:${order.id}`, attributes: { ...order.attributes, billing_reason: 'initial', created_at: order.attributes.created_at },
  } : undefined;
  const latest = billable[0] || initialOrderProof;
  const invoice = latest?.attributes;
  const watermark = Array.isArray(previous.periods) ? Math.max(0,...previous.periods.map(p => Date.parse(String(record(p).source_created_at || '')) || 0)) : 0;
  if (latest && Date.parse(date(invoice!.created_at)) < watermark) {
    throw new PaymentError('Provider returned an older invoice history');
  }
  type Period = { proof_id: string; kind: string; start: string; confirmed_at: string | null; source_created_at: string | null; end: string; end_source: string; tier: string; billing: string; product: string; variant: string; revoked_at: string | null; review: boolean };
  const periods: Period[] = Array.isArray(previous.periods) ? previous.periods.map(value => {
    const p = record(value);
    return { proof_id: String(p.proof_id), kind: String(p.kind), start: date(p.start), confirmed_at:p.confirmed_at ? date(p.confirmed_at):null, source_created_at:p.source_created_at ? date(p.source_created_at):null, end:date(p.end), end_source:String(p.end_source || 'legacy_unverified'), tier:String(p.tier || previous.tier || 'free'), billing:String(p.billing || previous.billing || 'monthly'), product:String(p.product || previous.product_id || ''), variant:String(p.variant || previous.variant_id || ''), revoked_at:p.revoked_at ? date(p.revoked_at):null,review:p.review===true };
  }) : [];
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
    const start = new Date(observedMs).toISOString(); const finish = date(end);
    if(Date.parse(date(invoice.created_at))>observedMs+60000) throw new PaymentError('Payment source timestamp is in the future');
    const paidOffer = billedOffer || Object.values(c.offers).find(o=>o.variant===String(a.variant_id) && o.product===String(a.product_id));
    if (!paidOffer) throw new PaymentError('Payment offer cannot be verified');
    if (Date.parse(start) >= Date.parse(finish)) {
      review = true; // A historic payment cannot establish a live access window retrospectively.
    } else {
    const known = periods.find(p => p.proof_id === latest!.id);
    if (known) {
      if (Date.parse(finish) < Date.parse(known.end)) known.end = finish;
      if (!known.confirmed_at && !known.revoked_at) { known.confirmed_at=start; known.start=start; known.end_source=a.status==='cancelled'?'cancelled.ends_at':'active.renews_at'; known.source_created_at=date(invoice.created_at); known.tier=paidOffer.tier; known.billing=paidOffer.billing; known.product=paidOffer.product; known.variant=paidOffer.variant; }
      // Never clear a refund or extend the same proof on a delayed/replayed success.
    } else {
      const sameInitial = invoice.billing_reason === 'initial' && periods.find(p => p.kind === 'initial');
      periods.push({ proof_id:latest!.id,kind:String(invoice.billing_reason),start,confirmed_at:start,source_created_at:date(invoice.created_at),end_source:a.status==='cancelled'?'cancelled.ends_at':'active.renews_at',tier:paidOffer.tier,billing:paidOffer.billing,product:paidOffer.product,variant:paidOffer.variant,
        end: sameInitial && Date.parse(sameInitial.end) < Date.parse(finish) ? sameInitial.end : finish,
        revoked_at: sameInitial ? sameInitial.revoked_at : null, review: false });
    }
  }
  }
  const rank:Record<string,number>={free:0,balanced:1,family:2};
  const live = periods.filter(p => !p.revoked_at && p.confirmed_at && Date.parse(p.confirmed_at)<=observedMs && Date.parse(p.end)>observedMs)
    .sort((x,y)=>(rank[y.tier]||0)-(rank[x.tier]||0)||Date.parse(y.end)-Date.parse(x.end));
  const chosen = live[0] || periods.filter(p=>p.confirmed_at).sort((x,y) => Date.parse(y.start)-Date.parse(x.start))[0];
  const expired = a.status === 'expired';
  const revoked = expired ? (a.ends_at ? date(a.ends_at) : version) : live.length ? null : chosen?.revoked_at || (currentRefund ? version : previous.entitlement_revoked_at || null);
  review ||= periods.some(p => p.review);
  return { status, provider_status: a.status, provider_updated_at: version,
    paid_access_from: chosen?.confirmed_at || null, paid_access_until: chosen?.end || null,
    invoice_id: chosen?.proof_id || null, entitlement_revoked_at: revoked,
    ends_at:a.ends_at?date(a.ends_at):null,review_required:review,periods,effective_tier:chosen?.tier||'free',effective_billing:chosen?.billing||'monthly',service_period_start:null,service_period_end:null,payment_processor:a.payment_processor||null,price_id:a.first_subscription_item?record(a.first_subscription_item).price_id:null,latest_source_created_at:invoice?.created_at||null,latest_invoice_id:latest?.id||null };
}
