// Static preparation checks only. No SQL engine/Auth/provider is exercised here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { statements } from './payment-phase2-db/sql-statements.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('007 evidence collector is one catalog-only SELECT without data reads or secret catalogs', () => {
  const raw = read('../../../docs/security/migration007-evidence-readonly.sql');
  const chunks = statements(raw).filter(s => s.trim()); assert.equal(chunks.length, 1);
  const code = raw.replace(/--[^\n]*/g, '').replace(/'(?:''|[^'])*'/g, "''");
  assert.match(code.trim(), /^with targets/i);
  assert.doesNotMatch(code, /\b(insert|update|delete|truncate|grant|revoke|create|alter|drop|execute|set)\b/i);
  assert.doesNotMatch(code, /\b(?:from|join)\s+(?:public|auth)\./i);
  assert.doesNotMatch(code, /\b(pg_authid|rolpassword|pg_get_functiondef|prosrc|tgargs)\b/i);
});
test('the repair profile pins the unchanged007 SQL and uses only an in-memory engine', () => {
  const migration = read('../supabase/migrations/202610180007_notification_table_authority.sql');
  const hash = createHash('sha256').update(migration).digest('hex');
  assert.equal(hash, 'd82c9ec53d32ccdc1a5edff927671aaccd34925626934992f762f066d46cb3db');
  const profile = read('./payment-phase2-db/migration007-repair.test.mjs');
  assert.ok(profile.includes(hash)); assert.match(profile, /new PGlite\(\)/);
  assert.doesNotMatch(profile, /process\.env|\.skip\(|\.todo\(|fetch\(|createClient\(/);
  assert.match(profile, /rollback; reset role/);
});
test('catalog routine and type resolution does not depend on the application search_path', () => {
  const raw = read('../../../docs/security/migration007-evidence-readonly.sql');
  const code = raw.replace(/--[^\n]*/g, '').replace(/'(?:''|[^'])*'/g, "''");
  assert.equal([...code.matchAll(/pg_catalog\.unnest\s*\(/g)].length, 3);
  assert.doesNotMatch(code, /(?<![a-zA-Z0-9_.])unnest\s*\(/i);
  assert.doesNotMatch(code, /::(?!pg_catalog\.)[a-zA-Z_]/);
  assert.match(code, /pg_catalog\.current_setting\(''\)::pg_catalog\.int4>=170000/);
  assert.match(raw, /'number',a\.attnum/);
});
test('current consumers match the supplied composite Push index and use the007-compatible location writer', () => {
  const edge = read('../supabase/functions/app_11941c8fec_push_notify/index.ts');
  assert.match(edge, /onConflict: 'user_id,endpoint'/); assert.doesNotMatch(edge, /onConflict: 'endpoint'/);
  const prayer = read('../src/pages/PrayerTimes.tsx'); assert.match(prayer, /syncNotificationLocation\(userId/);
  assert.doesNotMatch(prayer, /\.upsert\(/);
  const writer = read('../src/lib/notificationPreferenceClient.ts');
  assert.match(writer, /session\.user\.id !== expectedUserId/); assert.match(writer, /saveNotificationPreferences\(backupClient, session\.user\.id/);
});
test('original native package and all79 immutable inputs remain unchanged', () => {
  const manifest = JSON.parse(read('./phase4b-native/source-manifest.json'));
  assert.equal(manifest.sourceCommit, 'fece36e90b1f9eb79e1be36a39043ff5b697c427');
  assert.equal(manifest.mode, 'preparation-only'); assert.equal(manifest.productionReady, false);
  assert.equal(Object.keys(manifest.files).length, 79);
  for (const [path, expected] of Object.entries(manifest.files)) {
    const bytes = readFileSync(new URL('../../../' + path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, path);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex'), expected.gitBlob, path);
  }
});
test('owner PG17.6 evidence upgrades ACL/FK facts without inventing missing DDL or hosted repair', () => {
  const evidence = JSON.parse(read('../../../docs/security/migration007-hosted-evidence.json'));
  assert.equal(evidence.serverVersion, 170006); assert.equal(evidence.queryExecutedByOwner, true);
  assert.equal(evidence.independentlyQueriedByAssistant, false); assert.equal(evidence.rawCatalogAttached, false);
  assert.equal(evidence.tableFacts.userId.deleteAction, 'NO ACTION'); assert.equal(evidence.tableFacts.userId.notNull, true);
  assert.equal(evidence.tableFacts.independentColumnAclEntries, 0); assert.equal(evidence.tableFacts.forceRls, false);
  assert.deepEqual(evidence.tables.map(t => t.columnCount), [17, 7]);
  for (const role of ['anon', 'authenticated']) assert.deepEqual(evidence.effectiveTablePrivileges[role],
    ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']);
  assert.ok(evidence.remainingUnknowns.length); assert.equal(evidence.hostedRepairExecuted, false);
  assert.equal(evidence.productionReady, false); assert.equal(evidence.liveBillingReady, false);
});
