// Synthetic documents only. These tests are not SQL/GoTrue/schema validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHECKS, MIGRATIONS as LEGACY_MIGRATIONS } from './subscription-009-local/safety.mjs';
import { statements } from './payment-phase2-db/sql-statements.mjs';
import { BASE, TABLES, MIGRATIONS, analyzeCatalog, assessReadiness } from './phase4c-readiness/readiness.mjs';

function syntheticCatalog() {
  return { formatVersion: 1, evidenceKind: 'catalog-metadata-only', serverVersion: 170005, collectedAt: '2026-11-01T00:00:00Z',
    dependentViews: [], authDeleteTriggers: [], functionMetadata: [],
    tables: TABLES.map(name => ({ name, present: true, kind: 'r', owner: 'postgres', rls: true, forceRls: false,
      columns: [{ name: 'user_id', type: 'uuid', notNull: true }], directAcl: [], columnAcl: [], constraints: [], incomingForeignKeys: [], triggers: [], dependencies: [],
      effective: ['anon', 'authenticated', 'service_role'].map(role => ({ role, present: true, schemaUsage: true, ownerMembership: false, superuser: false, bypassRls: false, policyRoles: [role], columns: [],
        table: Object.fromEntries(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].map(p => [p, { allowed: role === 'authenticated' && p === 'SELECT', grantable: false }])) })),
      policies: [{ name: 'own', command: 'r', roles: ['authenticated'], permissive: true, usingKind: 'REVIEW_REQUIRED', checkKind: 'ABSENT' }],
    })),
  };
}
test('missing catalog evidence cannot become a clean schema assessment', () => {
  for (const input of [undefined, null, {}, [], { formatVersion: 1, tables: [] }]) {
    const r = analyzeCatalog(input); assert.equal(r.status, 'BLOCKED'); assert.ok(r.gaps.length); assert.equal(r.productionReady, false);
  }
});
test('application expectations and unknown policies never imply verified RLS', () => {
  const r = analyzeCatalog(syntheticCatalog()); assert.equal(r.status, 'BLOCKED'); assert.equal(r.findings.length, 0);
  assert.ok(r.gaps.some(g => g.includes('definition_review'))); assert.equal(r.restExposureVerified, false);
});
test('PUBLIC permissive TRUE plus effective SELECT identifies unrestricted SQL capability', () => {
  const catalog = syntheticCatalog(); catalog.tables[0].policies[0] = { name: 'misnamed_service', command: '*', roles: ['PUBLIC'], permissive: true, usingKind: 'TRUE', checkKind: 'TRUE' };
  const r = analyzeCatalog(catalog); assert.ok(r.findings.some(f => f.actor === 'authenticated' && f.risk === 'UNRESTRICTED_ROW_SELECT'));
  assert.equal(r.restExposureVerified, false); assert.equal(r.status, 'BLOCKED');
});
test('restrictive FALSE prevents falsely reporting a permissive TRUE as an effective bypass', () => {
  const catalog = syntheticCatalog(); catalog.tables[0].policies = [
    { command: 'r', roles: ['PUBLIC'], permissive: true, usingKind: 'TRUE', checkKind: 'ABSENT' },
    { command: 'r', roles: ['PUBLIC'], permissive: false, usingKind: 'FALSE', checkKind: 'ABSENT' },
  ];
  assert.equal(analyzeCatalog(catalog).findings.some(f => f.table === TABLES[0] && f.risk === 'UNRESTRICTED_ROW_SELECT'), false);
});
test('TRUNCATE remains a SQL risk independent of row policies and REST availability', () => {
  const catalog = syntheticCatalog(); catalog.tables[0].effective[0].table.TRUNCATE.allowed = true;
  const r = analyzeCatalog(catalog); assert.ok(r.findings.some(f => f.actor === 'anon' && f.risk === 'SQL_TRUNCATE_BYPASSES_RLS')); assert.equal(r.restExposureVerified, false);
});
test('inherited policy roles and column-only grants are included in the analysis', () => {
  const catalog = syntheticCatalog(), table = catalog.tables[0], actor = table.effective[1];
  actor.table.SELECT.allowed = false; actor.columns.push({ column: 'name', privilege: 'SELECT', allowed: true }); actor.policyRoles.push('custom_reader');
  table.policies = [{ command: 'r', roles: ['custom_reader'], permissive: true, usingKind: 'TRUE', checkKind: 'ABSENT' }];
  assert.ok(analyzeCatalog(catalog).findings.some(f => f.table === TABLES[0] && f.risk === 'UNRESTRICTED_ROW_SELECT'));
});
test('missing, duplicate or malformed table/role evidence stays BLOCKED', () => {
  for (const mutate of [c => c.tables.pop(), c => { c.tables[1] = c.tables[0]; }, c => { c.tables[0].present = false; },
    c => { c.tables[0].effective[0].table.SELECT.allowed = 'false'; }]) {
    const c = syntheticCatalog(); mutate(c); assert.equal(analyzeCatalog(c).status, 'BLOCKED'); assert.ok(analyzeCatalog(c).gaps.length);
  }
});
function syntheticPrerequisites() {
  const pass = { status: 'PASS', sourceCommit: BASE, tests: 1, pass: 1, fail: 0, skipped: 0 };
  return { sourceCommit: BASE,
    ...Object.fromEntries(['schemaEvidence', 'lockedDependencies', 'sourceRegressions', 'sqlRegressions', 'nativePackageReview', 'packageIntegrity'].map(k => [k, { ...pass }])),
    nativeFixture: { status: 'PASS', migrations: [...MIGRATIONS], repeat009: 2, originalGroups: [...CHECKS], relatedReminderDeletion: 'PASS', notificationAuthorization: 'PASS',
      guards: Object.fromEntries(['immutableSource', 'ownership', 'cleanup', 'namespaceIsolation', 'noEgress', 'noProviderCalls'].map(k => [k, true])) },
  };
}
test('no hosted-run recommendation is made from missing or version-only prerequisites', () => {
  for (const input of [{}, { sourceCommit: BASE }, { sourceCommit: BASE, lockedDependencies: { version: '0.3.14' } }]) {
    const r = assessReadiness(input); assert.equal(r.status, 'BLOCKED'); assert.equal(r.recommendHostedNativeValidation, false); assert.equal(r.dispatchAuthorized, false);
  }
});
test('the shortened 4B migration order cannot pass the full-fixture gate', () => {
  const p = syntheticPrerequisites(); p.nativeFixture.migrations = MIGRATIONS.filter((_, n) => ![5, 6, 9, 10].includes(n));
  assert.equal(assessReadiness(p).status, 'BLOCKED');
});
test('the preserved native runner pins009 at index6 and is not an all-migration runner', () => {
  const source = readFileSync(new URL('./subscription-009-local/integration.mjs', import.meta.url), 'utf8');
  assert.equal(LEGACY_MIGRATIONS.length, 7); assert.ok(LEGACY_MIGRATIONS[6].endsWith('202610210009_atomic_account_deletion.sql'));
  assert.match(source, /migrationFiles\[6\]/); assert.match(source, /migrationFiles\.slice\(0,6\)/);
  const fixture = readFileSync(new URL('./subscription-009-local/fixture.sql', import.meta.url), 'utf8');
  assert.match(fixture, /Synthetic cleanup dependencies ONLY/); assert.match(fixture, /marker text not null/);
  assert.equal(assessReadiness({ ...syntheticPrerequisites(), nativeFixture: { migrations: LEGACY_MIGRATIONS } }).status, 'BLOCKED');
});
test('missing original group, altered group order, or disabled isolation must block', () => {
  for (const mutate of [p => p.nativeFixture.originalGroups.pop(), p => p.nativeFixture.originalGroups.reverse(), p => { p.nativeFixture.guards.noEgress = false; }]) {
    const p = syntheticPrerequisites(); mutate(p); assert.equal(assessReadiness(p).recommendHostedNativeValidation, false);
  }
});
test('skipped SQL assertions and a missing reminder-deletion result cannot be relabeled PASS', () => {
  const p = syntheticPrerequisites(); p.sqlRegressions.skipped = 1; p.nativeFixture.relatedReminderDeletion = 'BLOCKED';
  assert.equal(assessReadiness(p).status, 'BLOCKED');
});
test('an outdated source cannot replace the exact base at the readiness gate', () => {
  const p = syntheticPrerequisites(); p.sourceCommit = '3ebe497e0fdd4c9c081422b92c48d4bef03518ec'; assert.equal(assessReadiness(p).status, 'BLOCKED');
});
test('even synthetic complete prerequisites authorize review only, never dispatch or production', () => {
  const r = assessReadiness(syntheticPrerequisites()); assert.equal(r.status, 'READY_FOR_HOSTED_REVIEW'); assert.equal(r.dispatchAuthorized, false); assert.equal(r.productionReady, false); assert.equal(r.liveBillingReady, false);
});
test('catalog collector is limited to a read-only transaction and one catalog SELECT', () => {
  const sql = readFileSync(new URL('../../../docs/security/phase4c-catalog-readonly.sql', import.meta.url), 'utf8');
  const chunks = [...statements(sql)].map(s => s.replace(/--[^\n]*/g, '').trim()).filter(Boolean);
  assert.equal(chunks.length, 4); assert.match(chunks[0], /^begin transaction read only;$/i); assert.match(chunks[1], /^set local search_path = pg_catalog;$/i); assert.match(chunks[2], /^with targets/i); assert.match(chunks[3], /^rollback;$/i);
  const code = sql.replace(/--[^\n]*/g, '').replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(code, /\b(insert|update|delete|truncate|grant|revoke|create|alter|drop|execute|set\s+role)\b/i);
  assert.doesNotMatch(code, /\bfrom\s+(?:public|auth)\./i);
  assert.doesNotMatch(code, /\b(pg_authid|rolpassword|vault|cron\.job)\b/i);
});
