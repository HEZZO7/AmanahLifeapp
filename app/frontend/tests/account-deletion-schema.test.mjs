// Source contracts + the actual Edge adapter with a fake SDK. No database,
// Auth deletion, provider calls or evidence of hosted rollback/authorization.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const evidence = JSON.parse(readFileSync(new URL('../../../docs/security/phase4c-evidence-index.json', import.meta.url), 'utf8'));
const sql = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
const migration009 = sql('202610210009_atomic_account_deletion.sql');
function functionBody(source, name) {
  const at = source.indexOf('function public.app_11941c8fec_' + name + '(');
  assert.ok(at >= 0);
  const start = source.indexOf('as $$', at), end = source.indexOf('$$;', start + 5);
  assert.ok(start > at && end > start);
  return source.slice(start + 5, end);
}

test('supplied hosted facts retain their provenance and immediate FK actions', () => {
  const update = evidence.assessmentRevision;
  assert.equal(update.baseCommit, '3d1bbfdb8aeaa0a1a6da92fb661850690d3cf9cf');
  assert.equal(update.evidenceKind, 'user_supplied_verified_Supabase_findings');
  assert.equal(update.independentlyQueriedHostedDatabase, false);
  assert.equal(update.policyCountAcrossThreeTables, 5);
  assert.equal(evidence.knownSchemaFacts.length, 3);
  for (const [table, action] of [['bill_reminders_sync', 'CASCADE'], ['goal_reminders_sync', 'CASCADE'], ['email_digest', 'NO ACTION']]) {
    const fact = evidence.knownSchemaFacts.find(f => f.table === 'public.app_11941c8fec_' + table);
    assert.equal(fact.schema, 'public'); assert.equal(fact.present, true); assert.equal(fact.rlsEnabled, true);
    assert.equal(fact.authForeignKey.referencedTable, 'auth.users'); assert.equal(fact.authForeignKey.deleteAction, action);
    assert.equal(fact.authForeignKey.validated, true); assert.equal(fact.authForeignKey.deferrable, false);
    assert.equal(fact.authForeignKey.initiallyDeferred, false);
  }
});
test('RLS enabled and policy count never relabel missing authorization/deletion evidence as verified', () => {
  const update = evidence.assessmentRevision;
  assert.equal(update.hostedAuthorizationFullyVerified, false); assert.equal(update.rawCatalogAttached, false);
  assert.equal(update.policyDefinitions, null); assert.equal(update.policyDistribution, null);
  for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(update.effectivePrivileges[role], 'REVIEW_REQUIRED');
  for (const fact of evidence.knownSchemaFacts) {
    assert.equal(fact.authForeignKey.columns, null); assert.equal(fact.authForeignKey.referencedColumns, null);
  }
  assert.equal(update.deletionAssessment.hostedDeletionReliable, 'NOT_PROVEN');
  assert.equal(update.status, 'BLOCKED'); assert.equal(update.recommendHostedNativeValidation, false);
  assert.equal(update.productionReady, false); assert.equal(update.liveBillingReady, false);
});
test('009 removes matching email rows inside the guarded BEFORE ROW Auth deletion trigger', () => {
  const cleanup = functionBody(migration009, 'cleanup_account_on_delete');
  assert.match(migration009, /create trigger app_11941c8fec_transactional_account_cleanup before delete on auth\.users\s+for each row execute function public\.app_11941c8fec_cleanup_account_on_delete\(\)/);
  for (const context of ["tg_table_schema<>'auth'", "tg_table_name<>'users'", "tg_op<>'DELETE'", "tg_when<>'BEFORE'", "tg_level<>'ROW'"]) assert.ok(cleanup.includes(context));
  const childDelete = cleanup.indexOf('delete from public.app_11941c8fec_email_digest where user_id=old.id;');
  assert.ok(childDelete >= 0 && childDelete < cleanup.indexOf('return old;'));
  for (const check of ['account_deletion_ready()', 'account_deletion_allowed(old.id)']) {
    const at = cleanup.indexOf(check); assert.ok(at >= 0 && at < cleanup.indexOf('delete from'));
  }
  // FK/child trigger failures must escape the cleanup function and abort the
  // database statement. This source check does not execute that SQL behavior.
  assert.doesNotMatch(cleanup, /exception\s+when|set_config|disable\s+trigger/i);
  assert.match(migration009, /security definer set search_path=''/);
  assert.match(migration009, /alter function public\.app_11941c8fec_cleanup_account_on_delete\(\) owner to postgres/);
});
test('customer-owner history keeps its Auth reference and is outside the child cleanup scope', () => {
  const migration011 = sql('202610310011_payment_customer_ownership.sql');
  const ownerDefinition = migration011.split('create table public.app_11941c8fec_payment_customer_owners (')[1].split(');')[0];
  // Omitting ON DELETE means NO ACTION, not CASCADE. Do not erase this retained
  // history to turn a failed Auth deletion into a success.
  assert.match(ownerDefinition, /user_id uuid not null references auth\.users\(id\)/);
  assert.doesNotMatch(ownerDefinition, /on delete\s+(cascade|set null)/i);
  const cleanup = functionBody(migration009, 'cleanup_account_on_delete');
  const deletedTables = [...cleanup.matchAll(/delete from public\.app_11941c8fec_(\w+) where user_id=old\.id;/g)].map(m => m[1]);
  assert.deepEqual(deletedTables, ['subscriptions', 'search_history', 'email_digest', 'notification_preferences', 'push_subscriptions']);
  assert.doesNotMatch(cleanup, /payment_(accounts|intents|bindings|periods|customer_owners)/);
});

const A = '10000000-0000-4000-8000-000000000021', B = '10000000-0000-4000-8000-000000000022';
const entry = new URL('../supabase/functions/app_11941c8fec_delete_account/index.ts', import.meta.url).href;
const previous = { Deno: globalThis.Deno, sdk: globalThis.__schemaDeletionSDK };
let handler, options, calls;
globalThis.Deno = {
  env: { get: name => ({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: 'offline-anon', SUPABASE_SERVICE_ROLE_KEY: 'offline-service' })[name] },
  serve: callback => { handler = callback; },
};
globalThis.__schemaDeletionSDK = (_url, key) => ({
  from() { assert.fail('No separate REST cleanup or entitlement mutations'); },
  rpc: async (name, args) => {
    assert.equal(key, 'offline-service');
    if (name === 'app_11941c8fec_account_deletion_ready') { calls.push('ready'); return { data: options.ready, error: null }; }
    assert.equal(name, 'app_11941c8fec_account_deletion_allowed'); assert.equal(args.p_user, A);
    calls.push('allowed'); return { data: options.allowed, error: null };
  },
  auth: {
    getUser: async token => {
      assert.equal(key, 'offline-anon'); assert.equal(token, 'synthetic-token'); calls.push('authenticate');
      return { data: { user: { id: A } }, error: null };
    },
    admin: {
      deleteUser: async (id, soft) => {
        assert.equal(key, 'offline-service'); assert.equal(id, A); assert.equal(soft, false);
        calls.push('delete'); return { error: options.deleteError };
      },
      getUserById() { assert.fail('A failed Auth DELETE cannot be confirmed as success'); },
    },
  },
});
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === entry && specifier === 'https://esm.sh/@supabase/supabase-js@2')
    return { url: 'data:text/javascript,' + encodeURIComponent('export const createClient=(...args)=>globalThis.__schemaDeletionSDK(...args);'), shortCircuit: true };
  if (/^https?:/.test(specifier)) throw Error('Offline imports only');
  return next(specifier, context);
} });
try { await import(entry); } finally { hook.deregister(); }
after(() => {
  for (const [key, value] of [['Deno', previous.Deno], ['__schemaDeletionSDK', previous.sdk]])
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
});
function invoke(overrides = {}) {
  options = { ready: true, allowed: true, deleteError: { code: '23503', message: 'SYNTHETIC_PRIVATE_CONSTRAINT' }, ...overrides };
  calls = [];
  return handler(new Request('http://127.0.0.1:54321/delete', { method: 'POST', headers: { Authorization: 'Bearer synthetic-token' },
    body: JSON.stringify({ user_id: B, cancelled: true, skip_email_cleanup: true, delete_billing_history: true }) }));
}
for (const [name, code] of [['email NO ACTION reference', '23503'], ['retained customer-owner reference', '23503'], ['cleanup permission failure', '42501']]) {
  test('actual adapter reports unconfirmed deletion without retry or leakage on modeled ' + name, async () => {
    const r = await invoke({ deleteError: { code, message: 'SYNTHETIC_PRIVATE_CONSTRAINT:' + name } });
    const body = await r.json(); assert.equal(r.status, 503); assert.equal(body.code, 'account_deletion_unconfirmed');
    assert.equal(body.success, undefined); assert.match(body.error, /No subscription cancellation was requested/);
    assert.doesNotMatch(JSON.stringify(body), /SYNTHETIC_PRIVATE_CONSTRAINT|23503|42501/);
    assert.deepEqual(calls, ['authenticate', 'ready', 'allowed', 'delete']);
  });
}
test('unverified deployment readiness prevents Auth deletion despite client cleanup claims', async () => {
  const r = await invoke({ ready: false }); assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'billing_verification_unavailable'); assert.deepEqual(calls, ['authenticate', 'ready']);
});
test('billing retention denial preserves legitimate access without cancellation or destructive calls', async () => {
  const r = await invoke({ allowed: false }); const body = await r.json(); assert.equal(r.status, 409);
  assert.equal(body.code, 'billing_review_required'); assert.match(body.error, /paid access is unchanged/);
  assert.match(body.error, /No cancellation has been performed/); assert.deepEqual(calls, ['authenticate', 'ready', 'allowed']);
});
