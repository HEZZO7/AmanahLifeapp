import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { exportPortableData, restorePortableData, prepareBackup, isPortableLocalKey,
  PREFERENCES_TABLE as PREFS, PORTABLE_TABLES } from '../src/lib/notificationBackup.ts';

const EMAIL = 'app_11941c8fec_email_digest', SEARCH = 'app_11941c8fec_search_history';
const input = (supabaseData = {}, localData = {}) => ({ metadata: { version: '2.0.0', userId: 'old-account' }, supabaseData, localData });
function fixture(options = {}) {
  const events = [], local = {};
  const db = {
    [PREFS]: [{ user_id: 'own', bill_reminders: true, prayer_reminders: false, last_suhoor_sent_date: '2026-01-01', id: 'original' },
      { user_id: 'other', bill_reminders: true, last_suhoor_sent_date: '2026-01-02' }],
    [EMAIL]: [{ user_id: 'own', enabled: true, last_sent_at: '2026-01-01' }],
    [SEARCH]: [{ user_id: 'own', query: 'original', search_type: 'classic' }, { user_id: 'other', query: 'untouched', search_type: 'ai' }],
  };
  if (options.missing) db[PREFS] = db[PREFS].filter(r => r.user_id !== 'own');
  const error = { message: 'PRIVATE_DATABASE_DETAIL', code: '42501' };
  const client = {
    read: async (table, columns, userId, offset) => {
      events.push(['read', table, columns, userId, offset]);
      assert.ok(Object.hasOwn(PORTABLE_TABLES, table)); assert.equal(userId, 'own');
      return { data: db[table].filter(r => r.user_id === userId).slice(offset, offset + 1000), error: options.fail === 'read' ? error : null };
    },
    update: async (table, row, userId) => {
      events.push(['update', table, row, userId]); assert.equal(userId, 'own');
      assert.equal('user_id' in row, false); assert.equal('id' in row, false);
      for (const key of Object.keys(row)) assert.ok(PORTABLE_TABLES[table].includes(key), 'only column-granted fields can be updated');
      if (options.fail === 'update') return { data: null, error };
      const found = db[table].filter(r => r.user_id === userId);
      found.forEach(r => Object.assign(r, row)); return { data: found.map(r => ({ user_id: r.user_id })), error: null };
    },
    insert: async (table, rows) => {
      events.push(['insert', table, rows]);
      if (options.fail === 'insert') return { error };
      if (options.race && table === PREFS) {
        db[PREFS].push({ user_id: 'own', prayer_reminders: false, last_suhoor_sent_date: 'race-marker' });
        return { error: { code: '23505' } };
      }
      for (const row of Array.isArray(rows) ? rows : [rows]) { assert.equal(row.user_id, 'own'); db[table].push({ ...row }); }
      return { error: null };
    },
    remove: async (table, userId) => {
      events.push(['delete', table, userId]); assert.equal(table, SEARCH); assert.equal(userId, 'own');
      if (options.fail === 'delete') return { error };
      db[table] = db[table].filter(r => r.user_id !== userId); return { error: null };
    },
  };
  return { db, events, client, local, storage: { setItem: (k, v) => { events.push(['local', k]); local[k] = v; } } };
}

test('export uses column allowlists and own identity, never device push or billing tables', async () => {
  const f = fixture(); const data = await exportPortableData(f.client, 'own');
  assert.deepEqual(Object.keys(data), Object.keys(PORTABLE_TABLES));
  assert.deepEqual(data[PREFS], [{ prayer_reminders: false, bill_reminders: true }]);
  for (const forbidden of ['other', 'last_suhoor', 'last_sent_at', 'original', 'user_id', 'p256dh', 'auth_key']) {
    if (forbidden !== 'original') assert.equal(JSON.stringify(data).includes(forbidden), false);
  }
  for (const e of f.events) { assert.notEqual(e[2], '*'); assert.equal(e[2].includes('id'), false); }
});
test('failed export rejects the entire operation instead of silently omitting a table', async () => {
  const f = fixture({ fail: 'read' }); await assert.rejects(exportPortableData(f.client, 'own'), /Backup read failed/);
});
test('export paginates instead of silently truncating at the API row limit', async () => {
  const f = fixture(); f.db[SEARCH] = Array.from({ length: 1001 }, (_, n) => ({ user_id: 'own', query: String(n), search_type: 'ai' }));
  assert.equal((await exportPortableData(f.client, 'own'))[SEARCH].length, 1001);
  assert.deepEqual(f.events.filter(e => e[1] === SEARCH).map(e => e[4]), [0, 1000]);
});
test('legacy backups cannot transfer push secrets, paid state, scheduler markers or ownership', async () => {
  const f = fixture(), other = structuredClone(f.db[PREFS][1]);
  const result = await restorePortableData(f.client, 'own', input({
    [PREFS]: [{ user_id: 'other', id: 'forged', bill_reminders: false, last_suhoor_sent_date: '2099-01-01', updated_at: '2099-01-01' }],
    app_11941c8fec_push_subscriptions: [{ endpoint: 'https://secret.invalid', p256dh: 'private-device-key', auth_key: 'secret' }],
    app_11941c8fec_subscriptions: [{ tier: 'family', status: 'active', trial_used: false }],
  }), f.storage);
  assert.equal(result.ignored, true); assert.equal(f.db[PREFS][0].bill_reminders, false);
  assert.equal(f.db[PREFS][0].id, 'original'); assert.equal(f.db[PREFS][0].last_suhoor_sent_date, '2026-01-01');
  assert.deepEqual(f.db[PREFS][1], other);
  assert.equal(f.events.some(e => e[0] === 'delete' || e[1]?.includes('push_subscriptions') || e[1]?.endsWith('_subscriptions')), false);
});
test('missing singleton inserts authenticated ownership without DELETE or user_id UPDATE', async () => {
  const f = fixture({ missing: true }); await restorePortableData(f.client, 'own', input({ [PREFS]: [{ bill_reminders: false }] }), f.storage);
  assert.deepEqual(f.events.map(e => e[0]), ['update', 'insert']);
  assert.deepEqual(f.events[1][2], { bill_reminders: false, user_id: 'own' });
});
test('concurrent singleton insertion retries once without resetting existing markers or flags', async () => {
  const f = fixture({ missing: true, race: true });
  await restorePortableData(f.client, 'own', input({ [PREFS]: [{ bill_reminders: false }] }), f.storage);
  assert.deepEqual(f.events.map(e => e[0]), ['update', 'insert', 'update']);
  const row = f.db[PREFS].find(r => r.user_id === 'own');
  assert.equal(row.prayer_reminders, false); assert.equal(row.last_suhoor_sent_date, 'race-marker');
});
test('unsupported table is rejected before any remote or local mutation', async () => {
  const f = fixture(); await assert.rejects(restorePortableData(f.client, 'own', input({
    [PREFS]: [{ bill_reminders: false }], app_11941c8fec_payment_accounts: [{}],
  }, { 'amanah-goals': [] }), f.storage)); assert.deepEqual(f.events, []);
});
for (const row of [{ bill_reminders: 'false' }, { prayer_reminders: null }, { timezone: 'Not/AZone' },
  { language: 'script' }, { prayer_location_mode: 'remote' }, { prayer_calc_method: 'bogus' },
  { prayer_manual_city: { lat: 500, lon: 0 } }]) {
  test('invalid portable preference fails preflight: ' + JSON.stringify(row), async () => {
    const f = fixture(); await assert.rejects(restorePortableData(f.client, 'own', input({ [PREFS]: [row] }), f.storage));
    assert.deepEqual(f.events, []);
  });
}
test('valid location fields remain portable while nested unrecognized city fields are stripped', () => {
  const city = { name: 'Mecca', nameAr: 'مكة', country: 'Saudi Arabia', countryCode: 'SA', lat: 21, lon: 39 };
  const value = { timezone: 'Asia/Riyadh', language: 'ar', prayer_calc_method: 'UmmAlQura', prayer_location_mode: 'manual', prayer_manual_city: city };
  const result = prepareBackup(input({ [PREFS]: [{ ...value, prayer_manual_city: { ...city, auth_key: 'hidden' } }] }));
  assert.deepEqual(result.supabaseData[PREFS][0], value);
});
test('empty preferences do not delete an existing singleton or its scheduler markers', async () => {
  const f = fixture(), before = structuredClone(f.db); await restorePortableData(f.client, 'own', input({ [PREFS]: [] }), f.storage);
  assert.deepEqual(f.db, before); assert.deepEqual(f.events, []);
});
test('local restore accepts portable keys only and never replays excused data, auth or entitlement cache', async () => {
  const f = fixture(); const result = await restorePortableData(f.client, 'own', input({}, {
    'amanah-goals': [{ title: 'Fixture' }], prayer_completed_2026_01_01: true, dhikr_count: 2,
    excused_periods: ['private'], 'sb-project-auth-token': 'secret', 'amanah-subscription': { tier: 'family' },
  }), f.storage);
  assert.equal(result.ignored, true); assert.deepEqual(Object.keys(f.local), ['amanah-goals', 'prayer_completed_2026_01_01', 'dhikr_count']);
  assert.equal(isPortableLocalKey('excused_periods'), false);
});
for (const mode of ['update', 'insert', 'delete']) {
  test('remote ' + mode + ' error propagates before local writes', async () => {
    const f = fixture({ fail: mode, missing: mode === 'insert' });
    const tables = mode === 'delete' ? { [SEARCH]: [] } : { [PREFS]: [{ bill_reminders: false }] };
    await assert.rejects(restorePortableData(f.client, 'own', input(tables, { 'amanah-goals': [] }), f.storage));
    assert.equal(f.events.some(e => e[0] === 'local'), false);
  });
}
test('search history replacement preserves other users and checks the INSERT result after DELETE', async () => {
  const f = fixture(), other = structuredClone(f.db[SEARCH][1]);
  await restorePortableData(f.client, 'own', input({ [SEARCH]: [{ query: 'restored', search_type: 'ai', user_id: 'other' }] }), f.storage);
  assert.deepEqual(f.db[SEARCH][0], other); assert.equal(f.db[SEARCH][1].user_id, 'own');
  const failed = fixture({ fail: 'insert' });
  await assert.rejects(restorePortableData(failed.client, 'own', input({ [SEARCH]: [{ query: 'restored', search_type: 'ai' }] }), failed.storage));
  assert.deepEqual(failed.events.map(e => e[0]), ['delete', 'insert']);
});
test('malformed backup or duplicate singleton fails before mutations', async () => {
  for (const value of [null, [], {}, { metadata: {} }, input({ [PREFS]: [null] }), input({ [PREFS]: [{}, {}] }), input({ [SEARCH]: [{ query: 'missing type' }] })]) {
    const f = fixture(); await assert.rejects(restorePortableData(f.client, 'own', value, f.storage)); assert.deepEqual(f.events, []);
  }
});

function importUI(restore, isAr = false) {
  const source = readFileSync(new URL('../src/components/BackupRestore.tsx', import.meta.url), 'utf8');
  const a = source.indexOf('  const handleImport = async () => {'), b = source.indexOf('\n  return (', a);
  assert.ok(a > 0 && b > a);
  const body = stripTypeScriptTypes(source.slice(a, b), { mode: 'strip' }).replace('const handleImport =', 'return');
  const events = [], deps = {
    pendingFile: { text: async () => JSON.stringify(input()) }, user: { id: 'own' }, isAr,
    supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'own' } } } }) } },
    restorePortableData: restore, backupClient: {}, localStorage: {},
    setImporting: v => events.push(['loading', v]), setShowConfirm: () => {}, setPendingFile: () => {},
    toast: { success: message => events.push(['success', message]), error: message => events.push(['error', message]), warning: () => events.push(['warning']) },
    setTimeout: () => events.push(['reload']), console: { error: () => {} },
  };
  return { run: new Function(...Object.keys(deps), body)(...Object.values(deps)), events };
}
for (const isAr of [false, true]) {
  test('actual import UI never reports success or reloads after failure, language=' + isAr, async () => {
    const f = importUI(async () => { throw Error('PRIVATE_DATABASE_DETAIL'); }, isAr); await f.run();
    assert.equal(f.events.some(e => ['success', 'reload'].includes(e[0])), false);
    assert.match(f.events.find(e => e[0] === 'error')[1], isAr ? /بعض البيانات/ : /Some data may have changed/);
    assert.equal(JSON.stringify(f.events).includes('PRIVATE_DATABASE_DETAIL'), false);
  });
}
test('actual import UI reports skipped legacy data only after successful supported restore', async () => {
  const f = importUI(async () => ({ ignored: true })); await f.run();
  assert.deepEqual(f.events.map(e => e[0]), ['loading', 'success', 'warning', 'reload', 'loading']);
});
