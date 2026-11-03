// DISPOSABLE IN-MEMORY SQL ONLY. No database URL, HTTP, GoTrue or real Push.
// Owner evidence supplies table shape/ACL/policy facts, not complete DDL.
// Defaults, FK actions, extra marker columns and six ownership policies below
// are explicit representative assumptions; this is not hosted-schema parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { statements } from './sql-statements.mjs';
import { saveNotificationPreferences, restorePortableData } from '../../src/lib/notificationBackup.ts';

const A = '10000000-0000-4000-8000-000000000031';
const B = '10000000-0000-4000-8000-000000000032';
const prefs = 'app_11941c8fec_notification_preferences';
const push = 'app_11941c8fec_push_subscriptions';
const source = await readFile(new URL('../../supabase/migrations/202610180007_notification_table_authority.sql', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'), 'd82c9ec53d32ccdc1a5edff927671aaccd34925626934992f762f066d46cb3db');
const migration = statements(source);
const collector = await readFile(new URL('../../../../docs/security/migration007-evidence-readonly.sql', import.meta.url), 'utf8');
const fixture = `
create role anon nologin nosuperuser nobypassrls nocreaterole;
create role authenticated nologin nosuperuser nobypassrls nocreaterole;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.${prefs}(
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id),
 prayer_reminders boolean default true, bill_reminders boolean default true, habit_reminders boolean default true,
 fasting_reminders boolean default true, savings_reminders boolean default true, general_activity boolean default true,
 timezone text not null default 'UTC', language text not null default 'en', prayer_calc_method text,
 prayer_location_mode text, prayer_manual_city jsonb, last_suhoor_sent_date date, last_iftar_sent_date date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.${push}(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 endpoint text not null,p256dh text not null,auth_key text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint));
alter table public.${prefs} enable row level security;
alter table public.${push} enable row level security;
grant select,insert,update,delete on public.${prefs},public.${push} to anon,authenticated,service_role;
create policy service_role_all_prefs on public.${prefs} for all to public using(true) with check(true);
create policy service_role_all_subscriptions on public.${push} for all to public using(true) with check(true);
create policy fixture_pref_read on public.${prefs} for select to authenticated using(auth.uid()=user_id);
create policy fixture_pref_insert on public.${prefs} for insert to authenticated with check(auth.uid()=user_id);
create policy fixture_pref_update on public.${prefs} for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy fixture_push_read on public.${push} for select to authenticated using(auth.uid()=user_id);
create policy fixture_push_insert on public.${push} for insert to authenticated with check(auth.uid()=user_id);
create policy fixture_push_delete on public.${push} for delete to authenticated using(auth.uid()=user_id);
insert into auth.users values('${A}'),('${B}');
insert into public.${prefs}(user_id,bill_reminders,last_suhoor_sent_date) values('${A}',false,'2026-01-01'),('${B}',true,'2026-01-02');
insert into public.${push}(user_id,endpoint,p256dh,auth_key) values
 ('${A}','https://fixture.invalid/A','synthetic-not-a-key-A','synthetic-not-an-auth-A'),
 ('${B}','https://fixture.invalid/B','synthetic-not-a-key-B','synthetic-not-an-auth-B');`;

async function fresh(run) {
  const db = new PGlite();
  try { await db.exec(fixture); await run(db); }
  finally { await db.close(); assert.equal(db.closed, true); }
}
async function scalar(db, sql, args = []) { return (await db.query(sql, args)).rows[0]?.value; }
async function role(db, actor, user = A) {
  assert.ok(['postgres', 'anon', 'authenticated', 'service_role'].includes(actor));
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role ' + actor);
}
async function apply(db) {
  try { for (const statement of migration) await db.exec(statement); }
  catch (error) { await db.exec('rollback; reset role'); throw error; }
}
async function denied(db, sql, args = []) {
  await assert.rejects(db.query(sql, args), error => error.code === '42501');
}
async function snapshot(db) {
  await role(db, 'postgres');
  const result = [];
  for (const table of [prefs, push]) {
    const rows = (await db.query(`select to_jsonb(t) as value from public.${table} t order by user_id,id`)).rows;
    const policies = (await db.query('select polname,polcmd,polpermissive,polroles::text,pg_get_expr(polqual,polrelid) as qual,pg_get_expr(polwithcheck,polrelid) as check_expr from pg_policy where polrelid=$1::regclass order by polname', ['public.' + table])).rows;
    const acl = (await db.query('select relacl::text from pg_class where oid=$1::regclass', ['public.' + table])).rows;
    const columns = (await db.query('select attname,attacl::text from pg_attribute where attrelid=$1::regclass and attnum>0 order by attnum', ['public.' + table])).rows;
    const indexes = (await db.query('select indexdef from pg_indexes where schemaname=\'public\' and tablename=$1 order by indexname', [table])).rows;
    // Hash rows so failed assertions do not print even synthetic device material.
    result.push({ table, rowsHash: createHash('sha256').update(JSON.stringify(rows)).digest('hex'), policies, acl, columns, indexes });
  }
  return result;
}
function adapter(db, interceptInsert) {
  const identifier = name => { assert.match(name, /^[a-z_]+$/); return '"' + name + '"'; };
  async function query(sql, values) {
    try { return { data: (await db.query(sql, values)).rows, error: null }; }
    catch (error) { return { data: null, error: { code: error.code } }; }
  }
  return {
    read() { assert.fail('This scoped integration exercises preference restore, not complete backup export'); },
    remove() { assert.fail('Singleton restore must not DELETE'); },
    async update(table, row, user) {
      assert.equal(table, prefs); const keys = Object.keys(row), values = Object.values(row);
      return query(`update public.${prefs} set ${keys.map((k, n) => identifier(k) + '=$' + (n + 1)).join(',')} where user_id=$${keys.length + 1} returning user_id`, [...values, user]);
    },
    async insert(table, row) {
      assert.equal(table, prefs); if (interceptInsert) await interceptInsert(row);
      const keys = Object.keys(row);
      return query(`insert into public.${prefs}(${keys.map(identifier).join(',')}) values(${keys.map((_, n) => '$' + (n + 1)).join(',')}) returning user_id`, Object.values(row));
    },
  };
}

test('representative permissive-policy baseline reproduces anon cross-account access despite eight RLS policies', () => fresh(async db => {
  const before = await snapshot(db);
  assert.equal(await scalar(db, 'select count(*)::int as value from pg_policy'), 8);
  await db.exec('begin'); await role(db, 'anon');
  assert.equal(await scalar(db, `select count(*)::int as value from public.${prefs}`), 2);
  assert.equal(await scalar(db, `select count(*)::int as value from public.${push}`), 2);
  await db.query(`update public.${prefs} set bill_reminders=false where user_id=$1`, [B]);
  assert.equal(await scalar(db, `select bill_reminders as value from public.${prefs} where user_id=$1`, [B]), false);
  await db.query(`delete from public.${push} where user_id=$1`, [B]);
  assert.equal(await scalar(db, `select count(*)::int as value from public.${push}`), 1);
  await db.exec('rollback'); assert.deepEqual(await snapshot(db), before);
}));
test('007 preserves rows/indexes and is repeat-run idempotent', () => fresh(async db => {
  const before = await snapshot(db); await apply(db); const first = await snapshot(db);
  assert.deepEqual(first.map(x => [x.rowsHash, x.indexes]), before.map(x => [x.rowsHash, x.indexes]));
  await apply(db); assert.deepEqual(await snapshot(db), first);
}));
test('the metadata-only collector returns both table definitions without any seeded row values', () => fresh(async db => {
  const result = (await db.query(collector)).rows[0].migration007_catalog_evidence;
  assert.equal(result.tables.length, 2);
  assert.equal(result.projectIdentity, 'VERIFY_EXTERNALLY');
  assert.equal(result.deployedVersions, 'NOT_COLLECTED');
  for (const table of result.tables) {
    assert.equal(table.present, true); assert.equal(table.owner, 'postgres'); assert.equal(table.rls, true);
    const identity = table.columns.find(c => c.name === 'user_id' && c.type === 'uuid');
    assert.ok(identity && Number.isInteger(identity.number));
    assert.ok(table.constraints.some(c => c.type === 'f' && c.referencedTable === 'auth.users'));
    assert.ok(table.indexes.some(i => i.unique)); assert.ok(table.effective.some(r => r.role === 'authenticated'));
    if (table.name.endsWith('_notification_preferences')) assert.ok(table.indexes.some(i =>
      i.unique && i.valid && !i.partial && !i.expressionIndex && i.keyAttributes === 1 &&
      i.attributeNumbers.trim().split(/\s+/)[0] === String(identity.number)));
  }
  const encoded = JSON.stringify(result);
  for (const secret of ['synthetic-not-a-key', 'synthetic-not-an-auth', 'https://fixture.invalid/', A, B]) assert.equal(encoded.includes(secret), false);
}));
test('collector avoids application unnest overloads under an explicit application-first search_path', () => fresh(async db => {
  await db.exec(`
    create function public.unnest(pg_catalog.oid[]) returns setof pg_catalog.oid language plpgsql as
    $$begin raise exception 'Synthetic catalog collision' using errcode='ZX007'; end$$;
    create function public.unnest(pg_catalog.int2[]) returns setof pg_catalog.int2 language plpgsql as
    $$begin raise exception 'Synthetic catalog collision' using errcode='ZX007'; end$$;
    set search_path=public,pg_catalog;
  `);
  // Witness the collision first. A collector failure or a harmless overload
  // must not stand in for proving that the fixture exercises the lookup risk.
  for (const type of ['oid', 'int2'])
    await assert.rejects(db.query(`select * from unnest(array[1::pg_catalog.${type}])`), error => error.code === 'ZX007');
  const result = (await db.query(collector)).rows[0].migration007_catalog_evidence;
  assert.equal(result.tables.length, 2);
  assert.ok(result.tables.every(t => t.present && t.constraints.some(c => c.type === 'f')));
}));
test('authenticated A can update allowed fields but cannot select/update B, internal columns, identity or Push rows', () => fresh(async db => {
  await apply(db); await role(db, 'authenticated');
  assert.equal(await scalar(db, `select count(user_id)::int as value from public.${prefs}`), 1);
  assert.equal(await scalar(db, `select count(user_id)::int as value from public.${prefs} where user_id=$1`, [B]), 0);
  assert.equal((await db.query(`update public.${prefs} set language='ar' where user_id=$1 returning user_id`, [B])).rows.length, 0);
  await db.query(`update public.${prefs} set language='ar',timezone='Asia/Riyadh' where user_id=$1`, [A]);
  for (const column of ['user_id', 'updated_at', 'last_suhoor_sent_date', 'last_iftar_sent_date'])
    await denied(db, `update public.${prefs} set ${column}=${column} where user_id=$1`, [A]);
  await denied(db, `select * from public.${prefs}`); await denied(db, `delete from public.${prefs}`);
  for (const command of [`select endpoint from public.${push}`, `insert into public.${push}(user_id,endpoint,p256dh,auth_key) values('${A}','x','x','x')`, `update public.${push} set endpoint=endpoint`, `delete from public.${push}`]) await denied(db, command);
  await role(db, 'postgres'); assert.equal(await scalar(db, `select language as value from public.${prefs} where user_id=$1`, [B]), 'en');
}));
test('anon loses every direct data operation; no API role receives TRUNCATE or grant options', () => fresh(async db => {
  await apply(db); await role(db, 'anon');
  for (const table of [prefs, push]) for (const command of [`select user_id from public.${table}`, `insert into public.${table}(user_id) values('${A}')`, `update public.${table} set user_id=user_id`, `delete from public.${table}`]) await denied(db, command);
  await role(db, 'postgres');
  for (const actor of ['anon', 'authenticated', 'service_role']) for (const table of [prefs, push]) {
    assert.equal(await scalar(db, 'select has_table_privilege($1,$2,\'TRUNCATE\') as value', [actor, 'public.' + table]), false);
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert.equal(await scalar(db, 'select has_table_privilege($1,$2,$3) as value', [actor, 'public.' + table, privilege + ' WITH GRANT OPTION']), false);
  }
}));
test('missing own singleton INSERT succeeds while a foreign INSERT fails RLS', () => fresh(async db => {
  await apply(db); await db.query(`delete from public.${prefs} where user_id=$1`, [B]);
  await role(db, 'authenticated', A); await denied(db, `insert into public.${prefs}(user_id) values($1)`, [B]);
  await role(db, 'authenticated', B); await db.query(`insert into public.${prefs}(user_id,language) values($1,'ar')`, [B]);
  assert.equal(await scalar(db, `select language as value from public.${prefs} where user_id=$1`, [B]), 'ar');
}));
test('actual portable preference restore and PrayerTimes writer contract work under real column ACL/RLS', () => fresh(async db => {
  await apply(db); await role(db, 'authenticated');
  await saveNotificationPreferences(adapter(db), A, { prayer_location_mode: 'manual', timezone: 'Asia/Riyadh', language: 'ar' });
  const restored = await restorePortableData(adapter(db), A, { metadata: { version: 'fixture' }, supabaseData: {
    [prefs]: [{ user_id: B, bill_reminders: false, last_suhoor_sent_date: '2099-01-01' }],
    [push]: [{ endpoint: 'fixture-legacy-device', auth_key: 'synthetic-not-a-real-key' }],
  } }, { setItem() { assert.fail('No local data expected'); } });
  assert.equal(restored.ignored, true);
  await role(db, 'postgres');
  assert.equal(await scalar(db, `select language as value from public.${prefs} where user_id=$1`, [A]), 'ar');
  assert.equal(await scalar(db, `select last_suhoor_sent_date::text as value from public.${prefs} where user_id=$1`, [A]), '2026-01-01');
  assert.equal(await scalar(db, `select bill_reminders as value from public.${prefs} where user_id=$1`, [B]), true);
}));
test('malformed backups fail before SQL or local writes', () => fresh(async db => {
  await apply(db); const before = await snapshot(db);
  for (const supabaseData of [{ [prefs]: [{ bill_reminders: 'true' }] }, { unknown_table: [] }, { [prefs]: [{ language: 'ar' }, { language: 'en' }] }]) {
    await role(db, 'authenticated');
    await assert.rejects(restorePortableData(adapter(db), A, {
      metadata: { version: 'fixture' }, supabaseData, localData: { 'amanah-settings': 'must-not-write' },
    }, { setItem() { assert.fail('Malformed backup must not mutate local state'); } }));
    assert.deepEqual(await snapshot(db), before);
  }
}));
test('a real SQL permission failure is surfaced and prevents local success writes', () => fresh(async db => {
  await apply(db); await db.exec(`revoke update(language) on public.${prefs} from authenticated`);
  const before = await snapshot(db); await role(db, 'authenticated');
  await assert.rejects(restorePortableData(adapter(db), A, {
    metadata: { version: 'fixture' }, supabaseData: { [prefs]: [{ language: 'ar' }] }, localData: { 'amanah-settings': 'must-not-write' },
  }, { setItem() { assert.fail('Remote permission failure must not mutate local state'); } }), /Backup update failed/);
  assert.deepEqual(await snapshot(db), before);
}));
test('controlled singleton insert interleaving exercises the actual bounded23505 retry without identity UPDATE', () => fresh(async db => {
  await apply(db); await db.query(`delete from public.${prefs} where user_id=$1`, [A]); await role(db, 'authenticated');
  let inserted = 0;
  const client = adapter(db, async () => { inserted++; await db.query(`insert into public.${prefs}(user_id) values($1)`, [A]); });
  await saveNotificationPreferences(client, A, { language: 'ar' });
  assert.equal(inserted, 1); assert.equal(await scalar(db, `select language as value from public.${prefs}`), 'ar');
}));
test('service-role SQL operations preserve other registrations, use composite conflict key and write scheduler markers', () => fresh(async db => {
  await apply(db); await role(db, 'service_role');
  await db.query(`insert into public.${push}(user_id,endpoint,p256dh,auth_key) values($1,'https://fixture.invalid/shared','synthetic','synthetic') on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh`, [A]);
  await db.query(`insert into public.${push}(user_id,endpoint,p256dh,auth_key) values($1,'https://fixture.invalid/shared','synthetic-updated','synthetic') on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh`, [A]);
  assert.equal(await scalar(db, `select count(*)::int as value from public.${push} where user_id=$1`, [A]), 2);
  await db.query(`insert into public.${push}(user_id,endpoint,p256dh,auth_key) values($1,'https://fixture.invalid/shared','synthetic','synthetic') on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh`, [B]);
  await db.query(`delete from public.${push} where user_id=$1`, [A]);
  assert.equal(await scalar(db, `select count(*)::int as value from public.${push} where user_id=$1`, [B]), 2);
  await db.query(`update public.${prefs} set last_suhoor_sent_date='2026-02-01',last_iftar_sent_date='2026-02-01' where user_id=$1`, [A]);
  assert.equal(await scalar(db, `select last_suhoor_sent_date::text as value from public.${prefs} where user_id=$1`, [A]), '2026-02-01');
}));
for (const [label, privilege] of [['inherited table SELECT', `grant select on public.${prefs} to fixture_carrier`], ['inherited protected column UPDATE', `grant update(user_id) on public.${prefs} to fixture_carrier`], ['inherited column grant option', `grant select(language) on public.${prefs} to fixture_carrier with grant option`], ['PG17 inherited MAINTAIN', `grant maintain on public.${prefs} to fixture_carrier`]]) {
  test('postcondition failure rolls back the entire policy/ACL replacement on ' + label, () => fresh(async db => {
    assert.equal(Math.floor(Number(await scalar(db, "select current_setting('server_version_num')::int as value")) / 10000), 17);
    await db.exec('create role fixture_carrier nologin; grant fixture_carrier to authenticated; ' + privilege);
    const before = await snapshot(db);
    await assert.rejects(apply(db), error => error.code === 'P0001' && /Inherited\/excess/.test(error.message));
    assert.deepEqual(await snapshot(db), before);
  }));
}
