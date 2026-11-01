// Diagnostic analysis only. No SQL, HTTP, installations, service startup or CI.
import { CHECKS } from '../subscription-009-local/safety.mjs';

export const BASE = 'a8e1321fa7ae60ec2e726853ec881bc8b9139105';
export const TABLES = ['bill_reminders_sync', 'goal_reminders_sync', 'email_digest'].map(name => 'public.app_11941c8fec_' + name);
export const MIGRATIONS = [
  '202610140001_subscription_authority.sql', '202610140002_family_helper_execution.sql',
  '202610150003_family_authority.sql', '202610150004_trusted_lemon_payments.sql',
  '202610150005_subscription_lifecycle.sql', '202610160006_ai_entitlement.sql',
  '202610180007_notification_table_authority.sql', '202610210008_account_deletion_safety.sql',
  '202610210009_atomic_account_deletion.sql', '202610310010_payment_checkout_lock.sql',
  '202610310011_payment_customer_ownership.sql',
];
const COMMANDS = { SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd' };
const trueKind = kind => kind === 'TRUE' || kind === 'ABSENT';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// This is deliberately not a general RLS theorem prover. Nonconstant policies,
// restrictive policies and hidden definitions require separate reviewed evidence.
export function analyzeCatalog(snapshot) {
  const gaps = [], findings = [], facts = [];
  const blocked = () => ({ status: 'BLOCKED', facts, gaps, findings, restExposureVerified: false, productionReady: false });
  if (!object(snapshot) || snapshot.formatVersion !== 1 || snapshot.evidenceKind !== 'catalog-metadata-only' ||
      !Number.isInteger(snapshot.serverVersion) || !Number.isFinite(Date.parse(snapshot.collectedAt)) || !Array.isArray(snapshot.tables)) {
    gaps.push('complete_catalog_snapshot_missing'); return blocked();
  }
  if (snapshot.tables.length !== TABLES.length || new Set(snapshot.tables.map(t => t?.name)).size !== TABLES.length) gaps.push('target_table_set_incomplete_or_duplicate');
  for (const name of TABLES) {
    const table = snapshot.tables.find(t => t?.name === name);
    if (!table || table.present !== true) { gaps.push(name + ':definition_missing'); continue; }
    if (table.kind !== 'r' || typeof table.owner !== 'string' || typeof table.rls !== 'boolean' || typeof table.forceRls !== 'boolean' ||
        !['columns', 'directAcl', 'columnAcl', 'effective', 'policies', 'constraints', 'incomingForeignKeys', 'triggers', 'dependencies'].every(k => Array.isArray(table[k]))) {
      gaps.push(name + ':metadata_incomplete'); continue;
    }
    const identity = table.columns.find(c => c.name === 'user_id');
    if (!identity || identity.type !== 'uuid' || identity.notNull !== true) gaps.push(name + ':identity_schema_review_required');
    facts.push({ table: name, owner: table.owner, rls: table.rls, forceRls: table.forceRls,
      authForeignKeys: table.constraints.filter(k => k.type === 'f' && k.referencedTable === 'auth.users').map(k => ({ name: k.name, deleteAction: k.deleteAction, validated: k.validated })),
      triggerCount: table.triggers.length });
    for (const actor of ['anon', 'authenticated']) {
      const access = table.effective.find(e => e.role === actor);
      if (!access || access.present !== true || !object(access.table) || !Array.isArray(access.columns) || !Array.isArray(access.policyRoles) ||
          !['schemaUsage', 'ownerMembership', 'superuser', 'bypassRls'].every(k => typeof access[k] === 'boolean')) {
        gaps.push(name + ':' + actor + ':effective_privileges_missing'); continue;
      }
      if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].every(k =>
        object(access.table[k]) && typeof access.table[k].allowed === 'boolean' && typeof access.table[k].grantable === 'boolean')) {
        gaps.push(name + ':' + actor + ':privilege_flags_incomplete'); continue;
      }
      if (access.schemaUsage !== true) { gaps.push(name + ':' + actor + ':schema_usage_not_available'); continue; }
      if (access.table.TRUNCATE.allowed) findings.push({ table: name, actor, risk: 'SQL_TRUNCATE_BYPASSES_RLS' });
      const unrestricted = !table.rls || access.superuser || access.bypassRls || access.ownerMembership && !table.forceRls;
      for (const [command, code] of Object.entries(COMMANDS)) {
        const granted = access.table[command].allowed || access.columns.some(c => c.privilege === command && c.allowed === true);
        if (!granted) continue;
        const policies = table.policies.filter(p => (p.command === '*' || p.command === code) && Array.isArray(p.roles) &&
          p.roles.some(r => r === 'PUBLIC' || r === actor || access.policyRoles.includes(r)));
        const permissive = policies.filter(p => p.permissive === true), restrictive = policies.filter(p => p.permissive === false);
        const allowsAll = p => command === 'INSERT' ? trueKind(p.checkKind === 'ABSENT' ? p.usingKind : p.checkKind)
          : trueKind(p.usingKind) && (command !== 'UPDATE' || trueKind(p.checkKind === 'ABSENT' ? p.usingKind : p.checkKind));
        if (unrestricted || permissive.some(allowsAll) && restrictive.every(allowsAll)) findings.push({ table: name, actor, risk: 'UNRESTRICTED_ROW_' + command });
        else gaps.push(name + ':' + actor + ':' + command + ':policy_definition_review_required');
      }
      if (table.policies.some(p => !['TRUE', 'FALSE', 'ABSENT'].includes(p.usingKind) || !['TRUE', 'FALSE', 'ABSENT'].includes(p.checkKind))) gaps.push(name + ':redacted_policy_definitions_require_review');
    }
  }
  for (const name of ['dependentViews', 'authDeleteTriggers', 'functionMetadata']) if (!Array.isArray(snapshot[name])) gaps.push(name + ':missing');
  if (Array.isArray(snapshot.dependentViews) && snapshot.dependentViews.length) gaps.push('dependent_view_definitions_require_review');
  // Presence of metadata never certifies hosted freshness, PostgREST exposure,
  // SECURITY DEFINER bodies, trigger cleanup semantics or matching deployment.
  gaps.push('hosted_provenance_and_definition_review_required');
  return blocked();
}

export function assessReadiness(input) {
  const blockers = [];
  if (!object(input)) input = {};
  if (input.sourceCommit !== BASE) blockers.push('exact_source_mismatch');
  for (const name of ['schemaEvidence', 'lockedDependencies', 'sourceRegressions', 'sqlRegressions', 'nativePackageReview', 'packageIntegrity']) {
    const check = input[name];
    if (!object(check) || check.status !== 'PASS' || check.sourceCommit !== BASE) blockers.push(name + ':not_verified');
    if (['sourceRegressions', 'sqlRegressions', 'nativePackageReview'].includes(name) &&
        (!Number.isInteger(check?.tests) || check.tests < 1 || check.pass !== check.tests || check.fail !== 0 || check.skipped !== 0)) blockers.push(name + ':incomplete_results');
  }
  const fixture = input.nativeFixture;
  if (!object(fixture) || fixture.status !== 'PASS' || JSON.stringify(fixture.migrations) !== JSON.stringify(MIGRATIONS) || fixture.repeat009 !== 2) blockers.push('native_fixture_all_001_011_not_verified');
  if (!Array.isArray(fixture?.originalGroups) || JSON.stringify(fixture.originalGroups) !== JSON.stringify(CHECKS)) blockers.push('original_21_groups_not_preserved');
  for (const guard of ['immutableSource', 'ownership', 'cleanup', 'namespaceIsolation', 'noEgress', 'noProviderCalls']) {
    if (fixture?.guards?.[guard] !== true) blockers.push('native_guard_not_verified:' + guard);
  }
  if (fixture?.relatedReminderDeletion !== 'PASS' || fixture?.notificationAuthorization !== 'PASS') blockers.push('related_row_deletion_and_authorization_not_verified');
  return { status: blockers.length ? 'BLOCKED' : 'READY_FOR_HOSTED_REVIEW', blockers,
    recommendHostedNativeValidation: blockers.length === 0, dispatchAuthorized: false, productionReady: false, liveBillingReady: false };
}
