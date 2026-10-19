import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { preferenceKeys, sanitizePreferences, sanitizePatch, createPreferenceClient, DEFAULT_NOTIFICATION_PREFERENCES as defaults } from '../src/lib/notificationPreferenceClient.ts';

function fixture(account = 'A') {
  let session = { access_token: 'isolated-token-' + account, user: { id: account } };
  let status = 200, payload = { success: true }, networkError = false, cacheError = false;
  let handler;
  const storage = new Map(), calls = [];
  const make = id => createPreferenceClient(id, {
    url: 'https://isolated.invalid/preferences',
    getSession: async () => session,
    readCache: async () => storage.get(id) ?? null,
    writeCache: async value => { if (cacheError) throw Error('storage'); storage.set(id, value); },
    request: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ body, authorization: init.headers.Authorization });
      if (networkError) throw Error('network');
      if (handler) return handler(body);
      return Response.json(body.action === 'get_preferences' ? { preferences: defaults } : payload, { status });
    },
  });
  return { make, storage, calls,
    session: value => { session = value; },
    response: (code, body = { success: true }) => { status = code; payload = body; },
    network: value => { networkError = value; },
    cacheError: value => { cacheError = value; },
    handler: value => { handler = value; },
  };
}

test('server contract: exactly the six boolean fields, preserving false', () => {
  assert.deepEqual(preferenceKeys, ['prayer_reminders', 'bill_reminders', 'habit_reminders', 'fasting_reminders', 'savings_reminders', 'general_activity']);
  const legacy = { ...Object.fromEntries(preferenceKeys.map(key => [key, false])), user_id: 'other', updated_at: 'old', role: 'admin', __internal: true };
  assert.deepEqual(sanitizePreferences(legacy), Object.fromEntries(preferenceKeys.map(key => [key, false])));
  assert.deepEqual(sanitizePatch(legacy), Object.fromEntries(preferenceKeys.map(key => [key, false])));
  assert.deepEqual(sanitizePatch({ bill_reminders: false, user_id: 'B' }), { bill_reminders: false });
});
for (const invalid of [null, [], false, 'bad', 1]) test('invalid legacy cache shape: ' + JSON.stringify(invalid), () => {
  assert.deepEqual(sanitizePreferences(invalid), defaults);
  assert.throws(() => sanitizePatch(invalid));
});
test('inherited/nonboolean values cannot change defaults or enter a patch', () => {
  const raw = Object.assign(Object.create({ bill_reminders: false }), { prayer_reminders: 'false', general_activity: false });
  assert.deepEqual(sanitizePreferences(raw), { ...defaults, general_activity: false });
  assert.deepEqual(sanitizePatch(raw), { general_activity: false });
  assert.throws(() => sanitizePatch({ user_id: 'B', updated_at: 'x' }));
});

test('legacy cache cleaned offline; all six valid values retained and never sent', async () => {
  const f = fixture(), client = f.make('A');
  const old = { ...defaults, bill_reminders: false, fasting_reminders: false, user_id: 'A', updated_at: 'old', admin: true };
  f.storage.set('A', JSON.stringify(old));
  f.network(true);
  const loaded = await client.load();
  assert.equal(loaded.synced, false);
  assert.deepEqual(loaded.preferences, { ...defaults, bill_reminders: false, fasting_reminders: false });
  assert.deepEqual(JSON.parse(f.storage.get('A')), loaded.preferences);
  f.network(false);
  await client.save({ savings_reminders: false, user_id: 'B', updated_at: 'forged' });
  assert.deepEqual(f.calls.at(-1).body, { action: 'update_preferences', preferences: { savings_reminders: false } });
  assert.equal(JSON.parse(f.storage.get('A')).fasting_reminders, false);
});
test('old server rows are sanitized before caching; read action has no target identity', async () => {
  const f = fixture(), client = f.make('A');
  f.handler(() => Response.json({ preferences: { ...defaults, habit_reminders: false, user_id: 'A', updated_at: 'old', extra: 1 } }));
  const result = await client.load();
  assert.equal(result.synced, true);
  assert.deepEqual(JSON.parse(f.storage.get('A')), { ...defaults, habit_reminders: false });
  assert.deepEqual(f.calls[0].body, { action: 'get_preferences' });
});
for (const code of [400, 401, 403, 429, 500, 503]) test('HTTP ' + code + ' cannot confirm or persist a save; retry succeeds', async () => {
  const f = fixture(), client = f.make('A');
  await client.load();
  const previous = f.storage.get('A');
  f.response(code);
  await assert.rejects(() => client.save({ bill_reminders: false }));
  assert.equal(f.storage.get('A'), previous);
  f.response(200);
  const saved = await client.save({ bill_reminders: false });
  assert.equal(saved.preferences.bill_reminders, false);
  assert.equal(JSON.parse(f.storage.get('A')).bill_reminders, false);
});
for (const payload of [{}, { success: false }, { success: 'true' }, null]) test('2xx without explicit success is not saved: ' + JSON.stringify(payload), async () => {
  const f = fixture(), client = f.make('A'); await client.load();
  const previous = f.storage.get('A'); f.response(200, payload);
  await assert.rejects(() => client.save({ bill_reminders: false }));
  assert.equal(f.storage.get('A'), previous);
});
test('network and malformed JSON cannot confirm save or overwrite prior values', async () => {
  const f = fixture(), client = f.make('A'); await client.load();
  const old = f.storage.get('A'); f.network(true);
  await assert.rejects(() => client.save({ bill_reminders: false }));
  assert.equal(f.storage.get('A'), old);
  f.network(false); f.handler(() => new Response('invalid-json'));
  await assert.rejects(() => client.save({ bill_reminders: false }));
  assert.equal(f.storage.get('A'), old);
});
test('pending HTTP does not mutate confirmed cache', async () => {
  const f = fixture(), client = f.make('A'); await client.load();
  let finish, started;
  const wait = new Promise(r => { started = r; });
  f.handler(() => { started(); return new Promise(r => { finish = r; }); });
  const save = client.save({ bill_reminders: false });
  await wait;
  assert.equal(JSON.parse(f.storage.get('A')).bill_reminders, true);
  finish(Response.json({ success: true }));
  assert.equal((await save).preferences.bill_reminders, false);
});
test('cache failure after successful server save is reported without false rollback', async () => {
  const f = fixture(), client = f.make('A'); await client.load();
  f.cacheError(true);
  const result = await client.save({ bill_reminders: false });
  assert.equal(result.synced, true);
  assert.equal(result.cacheSaved, false);
  assert.equal(result.preferences.bill_reminders, false);
});
for (const session of [null, {access_token:'',user:{id:'A'}}, {access_token:'tokenB',user:{id:'B'}}]) test('absent/mismatched SDK session prevents sending any request: ' + JSON.stringify(session), async () => {
  const f = fixture(), client = f.make('A'); f.session(session);
  await assert.rejects(() => client.save({ bill_reminders: false }));
  assert.equal(f.calls.length, 0);
  assert.equal(f.storage.size, 0);
});
test('guest cannot save even if an unrelated SDK session exists', async () => {
  const f = fixture(), client = f.make(null);
  await assert.rejects(() => client.save({ bill_reminders: false }));
  assert.equal(f.calls.length, 0);
});
test('two accounts have separate cleaned caches and independent confirmed flags', async () => {
  const f = fixture();
  f.storage.set('A', JSON.stringify({ ...defaults, bill_reminders: false, user_id: 'A' }));
  f.storage.set('B', JSON.stringify({ ...defaults, savings_reminders: false, user_id: 'B' }));
  f.network(true);
  const a = f.make('A'), b = f.make('B');
  assert.equal((await a.load()).preferences.bill_reminders, false);
  assert.equal((await b.load()).preferences.bill_reminders, true);
  f.network(false); f.session({ access_token: 'tokenB', user: { id: 'B' } });
  await b.save({ prayer_reminders: false });
  assert.equal(JSON.parse(f.storage.get('A')).prayer_reminders, true);
  assert.equal(JSON.parse(f.storage.get('B')).prayer_reminders, false);
  await assert.rejects(() => a.save({ savings_reminders: false }));
});
test('account switch while response is delayed cannot confirm/cache old-account result', async () => {
  const f = fixture(), client = f.make('A'); await client.load();
  let finish, started;
  const wait = new Promise(r => { started = r; });
  f.handler(() => { started(); return new Promise(r => { finish = r; }); });
  const pending = client.save({ bill_reminders: false }); await wait;
  f.session({ access_token: 'tokenB', user: { id: 'B' } });
  finish(Response.json({ success: true }));
  await assert.rejects(() => pending);
  assert.equal(JSON.parse(f.storage.get('A')).bill_reminders, true);
  assert.equal(f.storage.has('B'), false);
});
test('serialized saves preserve both flags; failure does not poison retry queue', async () => {
  const f = fixture(), client = f.make('A'); await client.load();
  await Promise.all([client.save({ bill_reminders: false }), client.save({ savings_reminders: false })]);
  assert.deepEqual(JSON.parse(f.storage.get('A')), { ...defaults, bill_reminders: false, savings_reminders: false });
  f.response(503);
  await assert.rejects(() => client.save({ general_activity: false }));
  f.response(200); await client.save({ habit_reminders: false });
  assert.equal(JSON.parse(f.storage.get('A')).general_activity, true);
  assert.equal(JSON.parse(f.storage.get('A')).habit_reminders, false);
});
test('client allowlist matches server source when present (web repo)', async () => {
  let source;
  try { source = await readFile(new URL('../supabase/functions/_shared/notificationPreferences.ts', import.meta.url), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const keys = [...source.match(/const preferenceKeys = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(preferenceKeys, keys);
});

