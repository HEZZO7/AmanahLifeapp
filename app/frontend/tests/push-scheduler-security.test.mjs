import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const entry = new URL('../supabase/functions/app_11941c8fec_push_scheduler/index.ts', import.meta.url).href;
const before = { Deno: globalThis.Deno, sdk: globalThis.__schedulerSDK, fetch: globalThis.fetch, Date: globalThis.Date };
let active, handler;
globalThis.__schedulerSDK = () => active.sdk;
globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://offline.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture', INTERNAL_PUSH_SECRET: 'fixture-internal' })[key] }, serve: fn => { handler = fn; } };
const code = source => 'data:text/javascript,' + encodeURIComponent(source);
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === entry && specifier.startsWith('npm:@supabase')) return { url: code('export const createClient=()=>globalThis.__schedulerSDK();'), shortCircuit: true };
  if (context.parentURL === entry && specifier === 'npm:adhan@4') return { url: code('export class Coordinates{};export class PrayerTimes{};export const CalculationMethod={};'), shortCircuit: true };
  return next(specifier, context);
} });
try { await import(entry); } finally { hook.deregister(); }
after(() => {
  for (const [key, value] of [['Deno', before.Deno], ['__schedulerSDK', before.sdk], ['fetch', before.fetch], ['Date', before.Date]]) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
function fixture(options = {}) {
  const calls = [];
  globalThis.Date = class extends before.Date { constructor(...args) { if (args.length) super(...args); else super('2026-11-01T09:00:00Z'); } };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://offline.invalid/functions/v1/app_11941c8fec_push_notify');
    calls.push(['send', JSON.parse(init.body)]);
    return Response.json(options.reply ?? { success: true, sent: 1 }, { status: options.status ?? 200 });
  };
  active = { calls, sdk: { from: table => {
    let write = false;
    const q = {
      select: columns => { calls.push(['read', table, columns]); return q; },
      eq: (...args) => { calls.push(['eq', ...args]); return q; },
      update: row => { write = true; calls.push(['write', table, row]); return q; },
      then: (resolve, reject) => {
        const data = table.endsWith('_notification_preferences') ? [{ user_id: 'own', bill_reminders: true, habit_reminders: false, fasting_reminders: false, timezone: 'UTC', language: 'en' }]
          : table.endsWith('_bill_reminders_sync') ? [{ id: 'bill-one', user_id: 'own', name: 'Fixture', due_date: '2026-11-01' }] : [];
        const error = options.failRead && !write || options.failWrite && write ? { message: 'PRIVATE_DATABASE_DETAIL' } : null;
        return Promise.resolve({ data, error }).then(resolve, reject);
      },
    }; return q;
  } } };
  return active;
}
const request = (secret = 'fixture-internal', method = 'POST') => new Request('https://offline.invalid/scheduler', {
  method, headers: { 'X-Internal-Push-Secret': secret }, ...(method === 'POST' ? { body: JSON.stringify({ user_id: 'victim' }) } : {}),
});
test('scheduler rejects a forged internal secret before any storage or delivery', async () => {
  const f = fixture(); assert.equal((await handler(request('forged'))).status, 401); assert.deepEqual(f.calls, []);
});
test('scheduler rejects non-POST methods before any storage', async () => {
  const f = fixture(); assert.equal((await handler(request('fixture-internal', 'GET'))).status, 405); assert.deepEqual(f.calls, []);
});
test('scheduler storage read failure fails closed without sending or marking', async () => {
  const f = fixture({ failRead: true }); const r = await handler(request()); assert.equal(r.status, 503);
  assert.equal(f.calls.some(c => ['send', 'write'].includes(c[0])), false); assert.doesNotMatch(await r.text(), /PRIVATE_DATABASE_DETAIL/);
});
for (const options of [{ status: 503, reply: { error: 'offline' } }, { status: 200, reply: { success: false, sent: 0 } }]) {
  test('scheduler never marks a refused/unconfirmed delivery: ' + JSON.stringify(options), async () => {
    const f = fixture(options); assert.equal((await handler(request())).status, 503); assert.equal(f.calls.some(c => c[0] === 'write'), false);
  });
}
for (const reply of [{ success: true, sent: 0 }, { success: true, skipped: true }]) {
  test('skipped/no-device sends do not count as deliveries: ' + JSON.stringify(reply), async () => {
    const f = fixture({ reply }); const r = await handler(request()); assert.equal(r.status, 200); assert.equal((await r.json()).billsSent, 0);
    assert.equal(f.calls.some(c => c[0] === 'write'), false);
  });
}
test('scheduler markers are scoped to the stored user, never a request body identity', async () => {
  const f = fixture(); const r = await handler(request()); assert.equal(r.status, 200); assert.equal((await r.json()).billsSent, 1);
  assert.equal(f.calls.find(c => c[0] === 'send')[1].user_id, 'own');
  assert.ok(f.calls.some(c => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'own'));
  assert.equal(JSON.stringify(f.calls).includes('victim'), false);
});
test('marker write failure is reported as partial delivery, without false success', async () => {
  fixture({ failWrite: true }); const r = await handler(request()); assert.equal(r.status, 503); assert.match((await r.json()).error, /may be partial/);
});
