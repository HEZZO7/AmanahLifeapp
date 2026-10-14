# Supabase CSV review and staged security preparation

## Evidence

Reviewed seven metadata checks supplied by the owner on 2026-10-14. The raw CSV is
kept out of GitHub. No production queries, migrations or provider transactions
were executed. Repository base: 99c26de6f61f4b5dd72a609e26ca4a10f9fae735.

The table belongs to postgres, RLS is enabled (not forced), user_id is unique and
references auth.users. Paid provider IDs and dates are nullable. Tier/status
checks allow family/active without a provider ID. No non-internal trigger on
subscriptions or auth.users prevents that insertion. A newly authenticated user
can satisfy the INSERT policy with their own ID and paid-tier values. The isolated
fixture reproduces this exact escalation path; production exploitation is not tested.

The service policy applies to PUBLIC but checks auth.role()='service_role';
this does NOT make it unconditionally allow all users. Public API roles are not
superusers or BYPASSRLS and have no memberships in this snapshot. service_role
does bypass RLS. Ordinary UPDATE/DELETE still require applicable RLS; TRUNCATE
does not. Direct ACLs include MAINTAIN in addition to the seven older privileges.
No column ACL entries or table PUBLIC grants were reported.

Five postgres-owned SECURITY DEFINER functions have broad execution grants:
- app_11941c8fec_set_join_code() -> trigger
- app_11941c8fec_add_owner_as_member() -> trigger
- app_11941c8fec_is_family_member(p_family_id uuid) -> boolean
- app_11941c8fec_is_family_owner(p_family_id uuid) -> boolean
- app_11941c8fec_join_family_with_code(p_code text) -> uuid

The first two are trigger-returning functions, not ordinary directly callable RPCs.
The prior absence of triggers was scoped to subscriptions/auth.users, not family
tables. Their bodies and family trigger/policy callers remain unavailable.
All five use search_path=public, pg_temp; whether public is writable and whether
their unqualified references are safe requires further evidence. Do not rewrite
them or strip authenticated execution before reviewing bodies and dependencies.

Broad public-schema defaults exist for postgres and managed supabase_admin:
API roles receive table/sequence rights and function EXECUTE. auth defaults also
exist for managed auth ownership and are outside this app's migration scope.

## Changes prepared

The migration is staged and NOT production-authorized:
- Preserve every user, subscription and existing trial value.
- Revoke ALL table/column privileges from PUBLIC, anon, authenticated and service_role.
- Grant authenticated SELECT with own-row RLS.
- Grant service_role SELECT/INSERT/UPDATE/DELETE (DELETE preserves account cleanup).
- Remove the own-row INSERT policy and narrow the service policy to service_role.
- Add a fixed-identity, server-time start_trial RPC with an atomic conditional upsert.
- Restrict RPC EXECUTE to authenticated and use an empty, fixed search_path.
- Abort if unexpected policies/triggers or an existing trial RPC are detected.

Frontend trial creation now calls the RPC; no caller-supplied user/tier/time is
accepted. Backup export excludes subscriptions; import uses the same allowlist
and ignores legacy/modified payment records. HMAC verification uses Web Crypto
verification and is tested against an independent signer, without changing
payment-event handling or provider configuration.

## Model and remaining blockers

Paid fields can be written directly only by the trusted backend. Trial initiation
is separately authenticated and cannot set paid fields. UI cached/offline state
is presentation, never sufficient to authorize a paid server operation.

This is NOT the completed subscription-flow fix. Existing rows created under the
insecure policy lack trustworthy provenance. The owner reports no paying customers,
but do not delete or rewrite rows based on that statement alone. Before deployment
review aggregate integrity indicators (paid rows, missing provider IDs, future trial
dates) and legitimate test/existing-user state. Preserve verified access; do not
silently certify historical rows as provider-paid.

Outstanding:
- Five function bodies, family table policies/triggers/grants, writable-schema
  privileges, web/mobile callers and deployment triggers.
- Trusted checkout intent binding, store/variant/test-live verification and atomic
  webhook deduplication/ordering. Existing payment-state bugs remain.
- Family authorization shared with valid trial/paid/cancelled-until-paid-end logic.
- Refund/past_due/unpaid policy, provider native-trial interaction.
- Auth verification redirects and cross-tab/device journey settings.
- Managed default privileges: default review template is outside migrations and
  ends with ROLLBACK; it must not be treated as an applied security fix.

Read-only next evidence: docs/family-function-bodies-readonly.sql. Send definitions
privately after redacting embedded secrets. This also reads family policy/trigger
metadata. Do not invoke the five functions to gather evidence.

## Automated verification

CI uses a fresh localhost PostgreSQL 17 service only, with an explicit isolated
fixture marker. Fixture matches audited table columns, constraints, roles and
policies; it does not claim to reproduce missing family or provider configuration.
It proves the baseline INSERT escalation before migration, then tests denied
paid/trial writes, cross-account reading, TRUNCATE, anonymous RPC, repeated trials,
server timestamps and preserved users/paid/trial fields. Trusted server writes and
account cleanup remain available. Four signature tests cover valid, modified,
malformed, missing and wrong-secret signatures and changed account data.

Family-function authorization, provider activation, refund/renewal, event ordering
and real auth E2E tests cannot be claimed until their implementations/configuration
are available. Local PostgreSQL is unavailable; SQL results must come from CI.

## Safe sequence — all production actions require approval

1. Obtain missing evidence and policies; inventory existing state and all writers.
2. Review schema migration and fixture tests, then test in an isolated/staging copy.
3. In staging, install the RPC with restricted EXECUTE before switching clients.
   Use a reviewed split of the migration for any real deployment; do not copy the
   atomic CI migration as a zero-downtime production rollout.
4. Update web/mobile trials and restore callers; verify signup, reads, trials and cleanup.
5. Apply privilege restrictions only after callers are compatible. No new signup
   trigger is needed; no subscription row is a valid free-user state.
6. Complete checkout/webhook/family authorization and configuration tests.
7. Seek explicit approval for production migration/deployment and commercial launch.

## Rollback

Capture exact pre-change DDL, policies/ACLs, relevant function definitions and a
secure data backup. The migration is transactional and rolls back on error.
After commit, retain restrictive grants and the trial RPC while rolling back UI
code only to an RPC-compatible release. If needed disable trial/checkout initiation
temporarily rather than restoring the insecure INSERT/TRUNCATE grants.
Use a forward corrective migration after review; do not drop users, subscription
rows or paid/trial fields. Keep provider events for safe replay after reconciliation.
Do not blindly restore an old database over newer users/events.
