// Actual Edge entry, offline SDK/Web Push doubles. No hosted requests or delivery.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const fixtureEndpoint = 'https://fcm.googleapis.com/fcm/send/fixture';
const fixtureKeys = { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') };
const entry = new URL('../supabase/functions/app_11941c8fec_push_notify/index.ts', import.meta.url).href;
const previous = { Deno: globalThis.Deno, client: globalThis.__pushFixtureClient };
let handler, active;
globalThis.__pushFixtureClient = () => active.client;
globalThis.Deno = {
  env: { get: key => ({ SUPABASE_URL: 'https://offline.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', INTERNAL_PUSH_SECRET: active?.internalSecret })[key] },
  serve: fn => { handler = fn; },
};
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === entry && specifier === 'npm:@supabase/supabase-js@2') {
    return { url: 'data:text/javascript,' + encodeURIComponent('export const createClient=()=>globalThis.__pushFixtureClient();'), shortCircuit: true };
  }
  if (context.parentURL === entry && specifier === 'npm:web-push@3') {
    return { url: 'data:text/javascript,' + encodeURIComponent('export default {setVapidDetails(){throw Error("Unexpected Web Push");},sendNotification(){throw Error("Unexpected delivery");}};'), shortCircuit: true };
  }
  if (/^(https?:|npm:)/.test(specifier)) throw Error('External module download prohibited');
  return next(specifier, context);
} });
try { await import(entry); } finally { hook.deregister(); }
after(() => {
  if (previous.Deno === undefined) delete globalThis.Deno; else globalThis.Deno = previous.Deno;
  if (previous.client === undefined) delete globalThis.__pushFixtureClient; else globalThis.__pushFixtureClient = previous.client;
});

function fixture(options = {}) {
  const calls = [], stored = { user_id: 'own-user', bill_reminders: false, last_suhoor_sent_date: '2026-01-01' };
  active = { calls, stored, internalSecret: options.internalSecret, client: {
    auth: { getUser: async token => { calls.push(['auth']); return { data: { user: token === 'own-token' ? { id: 'own-user' } : null }, error: null }; } },
    from: table => {
      const query = {
        select: columns => { calls.push(['select', table, columns]); return query; },
        eq: (column, value) => { calls.push(['eq', column, value]); return query; },
        delete: () => { calls.push(['delete', table]); return query; },
        then: (resolve, reject) => Promise.resolve({ data: [], error: options.deleteError ? { message: 'PRIVATE_DATABASE_DETAIL' } : null }).then(resolve, reject),
        single: async () => ({ data: stored, error: options.readError ?? null }),
        upsert: async (row, config) => {
          calls.push(['upsert', table, row, config]);
          if (table.endsWith('_notification_preferences') && !options.writeError && !config?.ignoreDuplicates) Object.assign(stored, row);
          return { error: options.writeError ? { message: 'PRIVATE_DATABASE_DETAIL' } : null };
        },
      };
      return query;
    },
  } };
  return active;
}
const request = (body, authorization = 'Bearer own-token') => new Request('https://offline.invalid/push', {
  method: 'POST', headers: { Authorization: authorization }, body: JSON.stringify(body),
});

for (const injected of [
  { user_id: 'victim' }, { id: 'victim-row' }, { last_suhoor_sent_date: '2099-01-01' },
  { updated_at: '2099-01-01' }, { role: 'admin' }, { '__proto__': null, constructor: 'override' },
]) {
  test('preference writer rejects protected/unknown fields: ' + Object.keys(injected), async () => {
    const f = fixture();
    const r = await handler(request({ action: 'update_preferences', preferences: { bill_reminders: false, ...injected } }));
    assert.equal(r.status, 400);
    assert.equal(f.calls.some(c => c[0] === 'upsert'), false);
  });
}
for (const preferences of [null, [], 'bad', true, 5, {}, { bill_reminders: 'false' }, { prayer_reminders: null }]) {
  test('preference writer rejects malformed values: ' + JSON.stringify(preferences), async () => {
    const f = fixture(); const r = await handler(request({ action: 'update_preferences', preferences }));
    assert.equal(r.status, 400); assert.equal(f.calls.some(c => c[0] === 'upsert'), false);
  });
}
test('valid false toggle writes only authenticated ownership and explicitly allowed fields', async () => {
  const f = fixture();
  const r = await handler(request({ action: 'update_preferences', user_id: 'victim', preferences: { bill_reminders: false } }));
  assert.equal(r.status, 200);
  const call = f.calls.find(c => c[0] === 'upsert');
  assert.equal(call[2].user_id, 'own-user'); assert.equal(call[2].bill_reminders, false);
  assert.deepEqual(Object.keys(call[2]).sort(), ['bill_reminders', 'updated_at', 'user_id']);
});
for (const authorization of ['', 'Basic own-token', 'Bearer forged', 'Bearer own-token extra']) {
  test('preference update requires a valid Bearer identity: ' + authorization, async () => {
    const f = fixture(); const r = await handler(request({ action: 'update_preferences', preferences: { bill_reminders: false } }, authorization));
    assert.equal(r.status, 401); assert.equal(f.calls.some(c => c[0] === 'upsert'), false);
  });
}
test('re-registering a device does not re-enable disabled preferences or reset scheduler markers', async () => {
  const f = fixture(), before = structuredClone(f.stored);
  const r = await handler(request({ action: 'subscribe', subscription: { endpoint: fixtureEndpoint, keys: fixtureKeys } }));
  assert.equal(r.status, 200); assert.deepEqual(f.stored, before);
  assert.equal(f.calls.filter(c => c[0] === 'upsert')[1][3].ignoreDuplicates, true);
});
test('get_preferences never selects or exposes identity or scheduler markers', async () => {
  const f = fixture(); const r = await handler(request({ action: 'get_preferences' }));
  assert.equal(r.status, 200); const body = await r.json();
  assert.equal(body.preferences.bill_reminders, false);
  assert.equal('user_id' in body.preferences, false); assert.equal('last_suhoor_sent_date' in body.preferences, false);
  assert.notEqual(f.calls.find(c => c[0] === 'select')[2], '*');
});
test('preference write errors never report success or leak database details', async () => {
  fixture({ writeError: true }); const r = await handler(request({ action: 'update_preferences', preferences: { bill_reminders: true } }));
  assert.equal(r.status, 500); assert.equal((await r.text()).includes('PRIVATE_DATABASE_DETAIL'), false);
});
test('a client cannot send a notification to another account', async () => {
  const f = fixture(); const r = await handler(request({ action: 'send_notification', user_id: 'victim', notification_type: 'bill_reminders', title: 'Fixture', body: 'Fixture' }));
  assert.equal(r.status, 401); assert.equal(f.calls.some(c => c[0] === 'select'), false);
});
test('subscribe cannot replace authenticated ownership with nested or top-level user_id', async () => {
  const f = fixture(); const r = await handler(request({ action: 'subscribe', user_id: 'victim', subscription: {
    user_id: 'victim', endpoint: fixtureEndpoint, keys: fixtureKeys,
  } }));
  assert.equal(r.status, 200);
  for (const c of f.calls.filter(c => c[0] === 'upsert')) assert.equal(c[2].user_id, 'own-user');
});
for (const endpoint of [undefined, fixtureEndpoint]) {
  test('unsubscribe scopes removal to authenticated ownership, endpoint=' + endpoint, async () => {
    const f = fixture(); const r = await handler(request({ action: 'unsubscribe', user_id: 'victim', endpoint }));
    assert.equal(r.status, 200); assert.ok(f.calls.some(c => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'own-user'));
    assert.equal(f.calls.some(c => c.includes('victim')), false);
  });
}
test('unsubscribe does not report success after a database refusal', async () => {
  fixture({ deleteError: true }); const r = await handler(request({ action: 'unsubscribe' }));
  assert.equal(r.status, 500); assert.equal((await r.text()).includes('PRIVATE_DATABASE_DETAIL'), false);
});
for (const notification_type of ['bill', 'bill_reminders']) {
  test('sending respects disabled preferences using supported category aliases: ' + notification_type, async () => {
    const f = fixture(); const r = await handler(request({ action: 'send_notification', user_id: 'own-user', notification_type, title: 'Fixture', body: 'Fixture' }));
    assert.equal(r.status, 200); assert.equal((await r.json()).skipped, true);
    assert.equal(f.calls.find(c => c[0] === 'select')[2], 'bill_reminders');
    assert.equal(f.calls.some(c => c[1] === 'app_11941c8fec_push_subscriptions'), false);
  });
}
test('trusted scheduler keeps cross-account sending only behind the configured secret', async () => {
  const f = fixture({ internalSecret: 'fixture-internal-secret' });
  const req = request({ action: 'send_notification', user_id: 'victim', notification_type: 'bill', title: 'Fixture', body: 'Fixture' }, '');
  req.headers.set('X-Internal-Push-Secret', 'fixture-internal-secret');
  const r = await handler(req); assert.equal(r.status, 200); assert.equal((await r.json()).skipped, true);
  assert.ok(f.calls.some(c => c[0] === 'eq' && c[2] === 'victim')); assert.equal(f.calls.some(c => c[0] === 'auth'), false);
});
test('a forged internal header never grants cross-account sending', async () => {
  const f = fixture({ internalSecret: 'fixture-internal-secret' });
  const req = request({ action: 'send_notification', user_id: 'victim', notification_type: 'bill', title: 'Fixture', body: 'Fixture' });
  req.headers.set('X-Internal-Push-Secret', 'forged');
  assert.equal((await handler(req)).status, 401); assert.equal(f.calls.some(c => c[0] === 'select'), false);
});
test('preference read failures stop sending before any registration or delivery lookup', async () => {
  const f = fixture({ readError: { code: '42501', message: 'PRIVATE_DATABASE_DETAIL' } });
  const r = await handler(request({ action: 'send_notification', user_id: 'own-user', notification_type: 'bill', title: 'Fixture', body: 'Fixture' }));
  assert.equal(r.status, 503); assert.equal(f.calls.filter(c => c[0] === 'select').length, 1);
  assert.equal((await r.text()).includes('PRIVATE_DATABASE_DETAIL'), false);
});
test('unknown notification columns never reach a privileged SELECT', async () => {
  const f = fixture(); const r = await handler(request({ action: 'send_notification', user_id: 'own-user', notification_type: '*,user_id', title: 'Fixture', body: 'Fixture' }));
  assert.equal(r.status, 400); assert.equal(f.calls.some(c => c[0] === 'select'), false);
});
for (const body of [null, [], 'invalid']) {
  test('malformed request root fails without a database write: ' + JSON.stringify(body), async () => {
    const f = fixture(); assert.equal((await handler(request(body))).status, 400);
    assert.equal(f.calls.some(c => c[0] === 'upsert'), false);
  });
}
for (const endpoint of ['http://127.0.0.1/private', 'https://127.0.0.1/private', 'https://fcm.googleapis.com.attacker.invalid/token',
  'https://user:password@fcm.googleapis.com/token', 'https://fcm.googleapis.com:8443/token', 'https://unreviewed.invalid/token']) {
  test('privileged subscription writer rejects untrusted endpoint: ' + endpoint.replace(/user:password@/, '[redacted]@'), async () => {
    const f = fixture(); const r = await handler(request({ action: 'subscribe', subscription: { endpoint, keys: fixtureKeys } }));
    assert.equal(r.status, 400); assert.equal(f.calls.some(c => c[0] === 'upsert'), false);
  });
}
for (const keys of [null, [], {}, { p256dh: 'invalid', auth: 'invalid' }, { ...fixtureKeys, auth: 123 }]) {
  test('malformed push keys are rejected without storage: ' + JSON.stringify(keys), async () => {
    const f = fixture(); const r = await handler(request({ action: 'subscribe', subscription: { endpoint: fixtureEndpoint, keys } }));
    assert.equal(r.status, 400); assert.equal(f.calls.some(c => c[0] === 'upsert'), false);
  });
}
for (const extra of [{ title: {} }, { body: [] }, { url: 'https://phishing.invalid' }, { url: '//phishing.invalid' }, { icon: 'https://tracking.invalid/pixel' }]) {
  test('malformed content and external navigation cannot enter push delivery: ' + JSON.stringify(extra), async () => {
    const f = fixture(); const r = await handler(request({ action: 'send_notification', user_id: 'own-user', notification_type: 'bill', title: 'Fixture', body: 'Fixture', ...extra }));
    assert.equal(r.status, 400); assert.equal(f.calls.some(c => c[0] === 'select'), false);
  });
}
