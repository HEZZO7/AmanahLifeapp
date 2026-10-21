# Phase 2: atomic account deletion — preparation only

Application base: `e4607cee6817f76d552e38b10ac68396e71d3a6a`.
No production operation, SQL execution, Auth request, payment call, workflow run or
deployment is authorized by this change. Paid subscriptions remain NO-GO.

## Confirmed defect and transaction boundary

The old Edge adapter committed five separate PostgREST DELETE requests before
calling Auth admin deletion. A later failure left a live Auth user without its
subscription/trial row. Migration 001 then correctly treated the missing row as
eligible for an initial trial. HTTP ordering cannot roll back those commits.

Migration 009 moves exactly the same five-table cleanup scope into a BEFORE ROW
DELETE trigger on `auth.users`. The Edge adapter sends one destructive operation:
Auth admin **hard** deletion (`deleteUser(user, false)`). It never pre-cleans data.
PostgreSQL executes the cleanup in the parent DELETE statement/transaction. A
child-table error, an immediate/deferred FK failure or any later trigger error
rolls back the child deletions and the Auth deletion together, including the
complete original trial row. No trial timestamp or `trial_used` flag is reset.

The reviewed public Supabase Auth implementation wraps its hard-delete path in
`db.Transaction` and uses `tx.Destroy(user)` (`internal/api/admin.go`, public blob
`0827e8ed45801308b88115f278b1be0444e6de77`). This source observation is NOT proof
of the deployed Auth build. The next local test must call the real Auth endpoint.
Even a single PostgreSQL DELETE statement rolls back all its trigger work if it
fails; this fix does not implement a fake cross-request transaction.

The unchanged Migration 008 billing trigger runs first by trigger-name ordering.
The cleanup trigger independently repeats the unchanged 008 permission check
before any child deletion. Its identity comes only from `OLD.id`; it has no caller
argument and no PUBLIC/anon/authenticated/service_role EXECUTE grant. Both new
functions are owned by postgres with an empty search_path. The readiness RPC is
service-only, read-only and verifies the enabled triggers, effective ACLs and five
validated, nondeferrable Auth foreign keys with their reviewed delete actions.

Existing FKs and the UNIQUE(user_id) trial serialization remain unchanged. Parent
Auth-row DELETE locking still serializes with new checkout FK checks: a committed
reservation blocks deletion through 008; a completed deletion makes a new
reservation fail its FK. Concurrent trial requests must be tested in PostgreSQL:
if the deletion rolls back, committed trial history survives; if it commits,
the deleted Auth identity cannot create an orphan subscription.

## Mixed-version safety and retention

009 revokes only `service_role` table DELETE on subscriptions. It preserves other
subscription grants and all RLS policies. BYPASSRLS does not bypass table ACLs.
The postgres-owned cleanup trigger does not need that grant. This also stops the
old Edge adapter at its FIRST deletion, before it can erase trial history during
a staged upgrade. Inherited DELETE privilege makes the migration fail atomically.
Any other service writer relying on direct subscription DELETE must be inventoried
before rollout; it must not be allowed to erase entitlement/trial evidence.
Source review confirms the legacy Paddle webhook uses subscription UPSERT
(INSERT/UPDATE remain unchanged), BackupRestore's allowlist excludes subscriptions,
and push-notification DELETE operations target push_subscriptions, whose grants
are unchanged. Lemon Squeezy storage uses the existing payment RPCs. This source
inventory is not proof of deployed functions, mobile builds or out-of-repo writers.

The server checks the service-only readiness RPC before allowing Auth deletion.
Missing 009, an invalid readiness result or a billing/database error fails closed.
No provider cancellation is attempted. Existing paid access is unchanged, and ANY
billing history still blocks deletion under 008, including expired history. The
separate billing-record retention/erasure resolution remains outstanding.

009 rewrites no existing rows and creates no new trial ledger/PII retention table.
Successfully deleting a never-billed account removes the existing cleanup scope,
as before; failed deletion keeps it. Historical trial evidence already lost BEFORE
this fix cannot be reconstructed automatically. Do not infer prior payment/trial
use, backfill arbitrary dates or silently grant a replacement trial.

An HTTP response can be lost AFTER commit. The new `account_deletion_unconfirmed`
response therefore claims neither successful deletion nor that the account still
exists. It requests support before retrying and never retries automatically.
The current Settings fallback already displays this safe error and keeps local
state on failure. No client privilege, price, refund or checkout behavior changes.

## Offline verification and limits

Run only the two deletion Node suites with the existing network-deny preload:

```sh
node --experimental-strip-types --test --test-isolation=none \
  --import ./tests/deny-network.mjs \
  tests/account-deletion-safety.test.mjs tests/account-deletion-atomic.test.mjs
```

The actual Edge adapter and handler execute against a fake SDK. Contract models
exercise failures before cleanup, after each child deletion, after Auth deletion,
a competing checkout, success, readiness failure and a lost post-commit response.
They assert no HTTP pre-cleanup, preservation of all modeled trial fields, no
modeled second trial, correct identity and unchanged other-account/billing data.
Models and SQL text assertions do NOT prove native PostgreSQL rollback, locks,
GoTrue, SDK transport or JWT behavior. No services start in these tests.

Executed offline on Node 24.19.0: 44 deletion/adapter/UI/static checks passed and
72 unchanged checkout/webhook/refund checks passed (116 total, zero skips/failures).
Four JavaScript/TypeScript syntax checks and git diff --check passed. An offline
negative control using the original e4607ce adapter/handler failed 10 of the new
15 adapter/static checks, including preservation paths: the suite rejects the old
HTTP pre-cleanup implementation. This is test-contract evidence, not a database
result. No SQL parser/execution, Deno external-SDK typecheck or frontend build ran.

`tests/account-deletion-atomic-regression.sql` is a prepared, UNEXECUTED database
regression. A unique AFTER DELETE failure (`ZX009`) can only occur after all real
cleanup rows are gone. The caught subtransaction must restore Auth and all five
tables exactly. It then invokes the real `start_trial` RPC under the authenticated
database role and requires `trial_already_used` without any row change. SQL-role
impersonation is not a substitute for the additional real Auth/JWT HTTP test.

## New isolated verification — separate approval required

Keep the completed 008 run, its two failures and all pinned source/manifest files
unchanged. Never rerun its one-time workflow or convert its expected failures.
Prepare a NEW reviewed test package pinned to this correction commit, reusing
the proven official disposable local Supabase startup and two synthetic users.
No new hosted project, paid service, provider account or payment is needed.

1. Apply the native fixture and 001--005, then 008 unchanged. Seed all five cleanup
   tables for the used-trial account. Apply 009 twice and compare rows/metadata.
   Do not auto-apply 006/007. A schema/role mismatch is a failed prerequisite.
2. Verify owner, SECURITY DEFINER, empty search_path, exact enabled triggers,
   service-only readiness and effective table/function privileges. Attempt the
   former service-role PostgREST subscription DELETE; require 42501 and no change.
3. Call the real new Edge adapter against local Auth/PostgREST with real local
   JWTs. Inject failures after subscriptions and after each later cleanup table,
   plus AFTER Auth DELETE. Require preserved Auth, full trial row and all child
   data, then a real JWT `start_trial` request denied with `trial_already_used`.
4. Execute the prepared SQL regression too; its unique injected SQLSTATE proves
   it reached actual cleanup. No generic API failure can stand in for that proof.
5. Repeat both independent-session checkout/deletion races, two deletion requests,
   and trial-start/deletion races. Prove observed lock waits, expected SQLSTATEs,
   no orphan rows, preserved billing history and no second trial after rollback.
6. Verify successful never-billed hard deletion cleans exactly its account, while
   active, expired, refunded and pending billing histories still block deletion.
   Check invalid JWTs, foreign body identity and direct unauthorized RPC attempts.
7. Require all checks, sanitized reporting and independently verified cleanup.
   New regression assertions must PASS; the historical 008 evidence stays red.

Expected cost: $0 on a standard public-repository hosted runner. Estimate 10--25
minutes cold startup/testing, subject to public dependency availability. Actual
integration execution and any workflow installation need separate authorization.

## Later rollout/rollback plan — NOT an instruction to execute

After successful isolated review and separate production approval only:
verify actual schema/privileges/other DELETE writers; install dependencies in order
001--005 then 008 then 009, preserving any independently approved 006/007 changes.
Apply 009 first: old deletion endpoints temporarily fail closed. Verify its ACLs,
triggers and readiness, then deploy the new delete-account function. Use only
explicitly approved synthetic checks; do not erase real users or billing records.

Safe operational rollback is to stop account-deletion requests and retain 009's
protective trigger/ACLs while investigating. Do NOT restore the old server with
subscription DELETE privileges: that restores the proven vulnerability. Removing
009 or regranting DELETE requires a separately reviewed replacement transaction
boundary and explicit approval. No automatic rollback SQL or production task is
included. Main, PR #2 and historical integration evidence remain untouched.
