import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { saveNotificationPreferences } from '../src/lib/notificationBackup.ts';

const locationEntry = new URL('../src/lib/notificationPreferenceClient.ts', import.meta.url).href;
const mirrorEntry = new URL('../src/lib/reminderSync.ts', import.meta.url).href;
const previous = globalThis.__notificationClient;
let active;
globalThis.__notificationClient = () => active;
const moduleURL = source => 'data:text/javascript,' + encodeURIComponent(source);
const hook = registerHooks({ resolve(specifier, context, next) {
  if ([locationEntry, mirrorEntry].includes(context.parentURL) && specifier === './supabase') return {
    url: moduleURL('export const supabase={auth:{getSession:()=>globalThis.__notificationClient().session()},from:(...a)=>globalThis.__notificationClient().from(...a)};'), shortCircuit: true,
  };
  if (context.parentURL === locationEntry && specifier === './backupClient') return {
    url: moduleURL('export const backupClient={update:(...a)=>globalThis.__notificationClient().update(...a),insert:(...a)=>globalThis.__notificationClient().insert(...a)};'), shortCircuit: true,
  };
  if (context.parentURL === locationEntry && specifier === './notificationBackup') return { url: new URL('../src/lib/notificationBackup.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
let syncNotificationLocation, syncReminderMirror;
try {
  ({ syncNotificationLocation } = await import(locationEntry));
  ({ syncReminderMirror } = await import(mirrorEntry));
} finally { hook.deregister(); }
after(() => { if (previous === undefined) delete globalThis.__notificationClient; else globalThis.__notificationClient = previous; });

function fixture(options = {}) {
  const calls = [];
  const f = { calls, session: async () => ({ data: { session: options.noSession ? null : { user: { id: options.actor ?? 'own' } } }, error: options.authError ?? null }),
    update: async (...args) => { calls.push(['update', ...args]); return { data: options.missing ? [] : [{ user_id: 'own' }], error: options.error ?? null }; },
    insert: async (...args) => { calls.push(['insert', ...args]); return { error: options.error ?? null }; },
    from: table => {
      const q = { delete: () => { calls.push(['delete', table]); return q; }, eq: (...args) => { calls.push(['eq', ...args]); return q; },
        insert: rows => { calls.push(['insert', table, rows]); return q; },
        then: (resolve, reject) => Promise.resolve({ error: options.error ?? null }).then(resolve, reject) };
      return q;
    },
  };
  active = f; return f;
}
const location = { timezone: 'Asia/Riyadh', language: 'ar', prayer_calc_method: 'UmmAlQura', prayer_location_mode: 'auto', prayer_manual_city: null };
for (const options of [{ actor: 'another' }, { noSession: true }, { authError: { message: 'private' } }]) {
  test('live location writer fails before SQL on changed/missing identity: ' + JSON.stringify(options), async () => {
    const f = fixture(options); assert.equal(await syncNotificationLocation('own', location), false); assert.deepEqual(f.calls, []);
  });
}
test('PrayerTimes uses the 007-compatible writer, preserving toggles and markers', async () => {
  const f = fixture(); assert.equal(await syncNotificationLocation('own', location), true);
  assert.deepEqual(f.calls, [['update', 'app_11941c8fec_notification_preferences', location, 'own']]);
  const source = readFileSync(new URL('../src/pages/PrayerTimes.tsx', import.meta.url), 'utf8');
  assert.match(source, /await syncNotificationLocation/); assert.doesNotMatch(source, /\.upsert\(/);
});
test('missing location singleton inserts ownership only on INSERT', async () => {
  const f = fixture({ missing: true }); assert.equal(await syncNotificationLocation('own', location), true);
  assert.equal('user_id' in f.calls[0][2], false); assert.equal(f.calls[1][2].user_id, 'own');
});
for (const patch of [{ user_id: 'victim' }, { last_iftar_sent_date: '2099-01-01' }, { id: 'victim' }, { bill_reminders: 'false' }, { timezone: 'not-a-zone' }]) {
  test('live preference writer rejects untrusted fields before SQL: ' + JSON.stringify(patch), async () => {
    const f = fixture(); await assert.rejects(saveNotificationPreferences(f, 'own', patch)); assert.deepEqual(f.calls, []);
  });
}
test('location permission errors return false without exposing database details', async () => {
  fixture({ error: { message: 'PRIVATE_DETAIL', code: '42501' } }); assert.equal(await syncNotificationLocation('own', location), false);
});
const bill = { id: 'one', name: 'Fixture', dueDate: '2026-11-01', isPaid: false, user_id: 'victim', due_date_sent_at: 'forged' };
const goal = { id: 'one', title: 'Fixture', targetDate: '2026-11-01', status: 'Active', user_id: 'victim', target_date_sent_at: 'forged' };
for (const [kind, row] of [['bill', bill], ['goal', goal]]) {
  test(kind + ' mirror derives identity and omits privileged markers', async () => {
    const f = fixture(); assert.equal(await syncReminderMirror(kind, [row], 'own'), true);
    assert.deepEqual(f.calls[1], ['eq', 'user_id', 'own']);
    const inserted = f.calls.find(c => c[0] === 'insert')[2][0];
    assert.equal(inserted.user_id, 'own'); assert.doesNotMatch(JSON.stringify(inserted), /victim|forged|sent_at/);
  });
  test(kind + ' mirror rejects cross-account sessions before mutation', async () => {
    const f = fixture({ actor: 'other' }); assert.equal(await syncReminderMirror(kind, [row], 'own'), false); assert.deepEqual(f.calls, []);
  });
  test(kind + ' mirror stops after DELETE refusal instead of performing INSERT', async () => {
    const f = fixture({ error: { code: '42501' } }); assert.equal(await syncReminderMirror(kind, [row], 'own'), false);
    assert.equal(f.calls.some(c => c[0] === 'insert'), false);
  });
}
for (const rows of [null, [{}], [{ ...bill, dueDate: '2026-02-31' }], [{ ...bill, isPaid: 'false' }]]) {
  test('malformed mirror rows cannot trigger DELETE: ' + JSON.stringify(rows), async () => {
    const f = fixture(); assert.equal(await syncReminderMirror('bill', rows, 'own'), false); assert.deepEqual(f.calls, []);
  });
}

function preferenceUI(status = 200, options = {}) {
  const source = readFileSync(new URL('../src/hooks/useNotifications.ts', import.meta.url), 'utf8');
  const a = source.indexOf('  const updatePreferences = useCallback('), b = source.indexOf('\n  // Send a local notification', a);
  const body = stripTypeScriptTypes(source.slice(a, b)).replace('const updatePreferences =', 'return');
  let state = { bill_reminders: true, habit_reminders: false }; const calls = [];
  const deps = {
    user: { id: 'own' }, savingRef: { current: false }, actor: { current: options.actor ?? 'own' },
    DEFAULT_PREFERENCES: { bill_reminders: true, habit_reminders: true },
    setSaving: value => calls.push(['saving', value]), setPreferences: update => { state = update(state); },
    useCallback: fn => fn,
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'fixture', user: { id: 'own' } } }, error: null }) } },
    EDGE_FUNCTION_URL: 'https://offline.invalid', fetch: async (url, init) => { calls.push(['request', JSON.parse(init.body)]); return Response.json({ success: options.success ?? true }, { status }); },
  };
  return { run: new Function(...Object.keys(deps), body)(...Object.values(deps)), state: () => state, calls };
}
for (const [status, success] of [[403, false], [503, false], [200, false]]) {
  test('actual preference UI preserves previous state after rejected write: ' + status, async () => {
    const f = preferenceUI(status, { success }); assert.equal(await f.run({ bill_reminders: false }), false);
    assert.equal(f.state().bill_reminders, true);
  });
}
test('actual preference UI submits only changed flags, then commits confirmed state', async () => {
  const f = preferenceUI(); assert.equal(await f.run({ bill_reminders: false }), true);
  assert.deepEqual(f.calls.find(c => c[0] === 'request')[1], { action: 'update_preferences', preferences: { bill_reminders: false } });
  assert.deepEqual(f.state(), { bill_reminders: false, habit_reminders: false });
});
test('stale account callback cannot submit a request or mutate preference state', async () => {
  const f = preferenceUI(200, { actor: 'other' }); assert.equal(await f.run({ bill_reminders: false }), false);
  assert.equal(f.calls.some(c => c[0] === 'request'), false); assert.equal(f.state().bill_reminders, true);
});
for (const input of [null, [], { user_id: 'victim' }, { bill_reminders: 'false' }]) {
  test('actual preference UI rejects malformed patches before requests: ' + JSON.stringify(input), async () => {
    const f = preferenceUI(); assert.equal(await f.run(input), false); assert.equal(f.calls.some(c => c[0] === 'request'), false);
  });
}
function milestoneClient(actor, status) {
  const source = readFileSync(new URL('../src/hooks/useSavingsNotifications.ts', import.meta.url), 'utf8');
  const a = source.indexOf('async function sendRealMilestonePush('), b = source.indexOf('\ninterface NotificationPrefs', a);
  const code = stripTypeScriptTypes(source.slice(a, b)) + '\nreturn sendRealMilestonePush;';
  const calls = [], deps = {
    supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: actor }, access_token: 'fixture' } } }) } },
    PUSH_NOTIFY_URL: 'https://offline.invalid', fetch: async (url, init) => { calls.push(JSON.parse(init.body)); return Response.json({ success: status === 200 }, { status }); },
  };
  return { calls, run: new Function(...Object.keys(deps), code)(...Object.values(deps)) };
}
test('milestone send cannot replay a stale account identity', async () => {
  const f = milestoneClient('other', 200); assert.equal(await f.run('own', 'Fixture', 'Fixture'), false); assert.deepEqual(f.calls, []);
});
test('milestone sender reports an explicit background refusal', async () => {
  const f = milestoneClient('own', 503); assert.equal(await f.run('own', 'Fixture', 'Fixture'), false);
});
