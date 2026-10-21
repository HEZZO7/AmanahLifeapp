# Migration 008 account-deletion integration package — NOT EXECUTED

Preparation only. No workflow, source/business-logic change, production operation,
provider request or database execution is included in this review. Execution needs
separate explicit authorization. Main and PR #2 remain unchanged.

**The reviewed application is defective. A correctly reproduced run must FAIL.**
The two security assertions below are ordinary mandatory failures, not xfails,
skips, TODOs or acceptance exceptions. Successful cleanup cannot make them green.

## Fixed inputs and minimal environment

Application checkout: e4607cee6817f76d552e38b10ac68396e71d3a6a, separate from this
package checkout and a new disposable workdir. Ten source Git blobs are verified
before starting anything (source-manifest.json); no app .env or hosted config is read.

Use the successful official local approach from Migration 007 run 39536069051 and
official smoke run 39419076572; neither existing workflow/run is reused or rerun.
The startup, ownership-marker and label-checked cleanup primitives are adapted from
the approved native 007 package at 497add8ef047ac6770c6d728febf15e7ee61680f.
This package has no dependency on that checkout and no custom network/mirror.

- Standard disposable ubuntu-24.04 GitHub-hosted Linux x64 runner with Docker/sudo.
- Official Supabase CLI 2.121.0, official Linux amd64 archive SHA256
  4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f.
  Its bytes are checked before extraction/execution. No CLI download ran here.
- Node >=22.18 with native TypeScript stripping and synchronous registerHooks.
  Offline validation host: Node 24.19.0. The previous workflow used Node 22.23.3.
- @supabase/supabase-js exactly 2.110.0, nine locked packages plus the root.
  Module URLs/integrities are unchanged from the passed 007 dependency graph.
  A later authorized run must use npm ci --ignore-scripts --no-audit --no-fund.
  No dependency installation was executed during this preparation.
- Native local Auth, PostgreSQL, PostgREST and gateway; no hosted login/link/deploy,
  production credentials, Edge deployment, real payments or Web Push.

Only official init/start/status/stop are used. Supabase config is generated in the
fresh workdir and not customized. App migrations are NOT placed in its migrations
directory: each approved SQL file is sent explicitly to the owned local container.

## Fixture and migration order

1. fixture.sql creates the PUBLIC subscription baseline and the six family tables/
   helper functions/policies/triggers required by the actual preflights.
   Its DDL is adapted from the two pinned original fixtures, excluding their fake
   auth schema/roles, auth.users alteration and synthetic seed identities.
   Native Supabase auth.users, auth.uid(), auth.role() and roles are preserved.
2. Apply exactly 202610140001_subscription_authority.sql.
3. Apply exactly 202610140002_family_helper_execution.sql.
4. Apply exactly 202610150003_family_authority.sql.
5. Apply exactly 202610150004_trusted_lemon_payments.sql.
6. Apply exactly 202610150005_subscription_lifecycle.sql.
7. Create only synthetic local test-mode configuration and real Auth accounts A/B.
   Seed the used trial through the actual start_trial RPC; do not forge a trial flag
   as a replacement for testing issuance.
8. Apply 202610210008_account_deletion_safety.sql twice; compare trial data and
   semantic metadata. No migration 006 or 007 is executed.

Four cleanup dependency tables use minimal id/user_id/marker schemas with RLS and
service-only CRUD. These model the delete adapter's user_id predicate ONLY; they
do not reproduce the notification schemas/defaults and do not revalidate 007.
Legacy subscription columns/constraints come from the reviewed baseline fixture;
they are not asserted as a new observation of production.

Trusted synthetic ledger rows are seeded by local postgres to test the deletion
guard. This is NOT evidence of real provider payments, webhook validation or paid
activation. No provider API credentials are present or read.

## Actual application path and failure reproduction

The exact pinned index.ts and handler.ts are loaded in Node. A narrowly scoped
synchronous module resolver maps ONLY that index's existing esm.sh SDK import to
the locked local SDK. No remote module is fetched. A small Deno.serve/env shim
captures the real handler and supplies only local status credentials. It does NOT
execute Deno, deploy an Edge Function or prove hosted Edge gateway behavior.

Calls then traverse the actual adapter/handler -> real local Auth.getUser ->
real PostgREST service RPC/DELETE -> actual local Auth admin-delete endpoint.
Every HTTP request is guarded to 127.0.0.1:54321/auth/v1/ or /rest/v1/; redirects
are forbidden. Rejected attempts are counted outside SDK error handling and make
the final check fail. No production URL from a frontend page is used.

A test-only BEFORE DELETE trigger on auth.users raises a fixed error for B.
The real adapter first deletes B's data, then Auth deletion fails. The setup
requires actual successful cleanup HTTP responses, failed Auth DELETE and B still
existing. It then performs BOTH required security checks, even when the first fails:

- failed_delete_preserves_trial: the original subscription row, trial_used and
  trial_started_at must survive. At e4607ce the row is deleted: ASSERTION FAILURE.
- failed_delete_cannot_restart_trial: log in again and call the actual trial RPC;
  it must return trial_already_used. At e4607ce a second trial is granted:
  ASSERTION FAILURE.

No output or result adapter converts these failures to success. The expected
completed run is 12 observed groups, 10 passed and 2 failed, overall exit 1,
IF all infrastructure/other checks work. This is a prediction, not execution
evidence. Extra/missing failures must be investigated, not mislabeled expected.

## Required coverage

| Group | Required evidence |
| --- | --- |
| schema_migrations | Native fixture, 001–005 only, explicit local test mode. |
| auth | Two distinct real local confirmed Auth users, password sessions and getUser verification. |
| migration_metadata | 008 repeat/data preservation; owner postgres, SECURITY DEFINER, empty search_path; effective/inherited EXECUTE/grant options; five user FKs, RLS/table/column ACLs, enabled BEFORE ROW DELETE triggers. |
| untrusted_denials | Missing/invalid JWT, foreign RPC targets, authenticated tier/trial/identity edits and direct DELETE/private-ledger reads denied; SQL role denial also observed. |
| checkout_wins_race | Two live backend PIDs, real lock wait verified by pg_blocking_pids; committed checkout reservation makes auth DELETE fail specifically 42501; intent/user remain. |
| active_billing_denial | Synthetic active ledger/paid period stops real handler and direct subscription/auth DELETE; no ledger/data/access changes. |
| history_retention | Expired status still retains history under 008; records unchanged. This deliberately documents the unresolved deletion-resolution policy. |
| failed_delete_setup | Controlled Auth failure after real adapter cleanup; verified user remains. |
| failed_delete_preserves_trial | Mandatory preservation assertion, expected FAIL at reviewed source. |
| failed_delete_cannot_restart_trial | Mandatory second-trial denial assertion, expected FAIL at reviewed source. |
| delete_wins_race | Reverse interleaving: real parent DELETE lock, blocked checkout reservation, committed user deletion; reservation fails 23503, leaves no account/intent. |
| billing_preservation | A's complete billing evidence survives B's failed cleanup/retrial/reverse race; unexpected outbound attempts zero. |

The sessions are separate interactive docker-exec psql processes. The coordinator
polls actual lock state with a bounded deadline. Promise.all alone is not accepted
as a race. SQLSTATE must match the intended denial; a timeout/other FK error cannot
stand in for an observed guard rejection. No payment checkout API is called.

## Future operation — requires separate approval, not a request to execute now

No runnable workflow is added. A future workflow must be reviewed separately,
pin this package commit plus the exact app commit, require manual explicit approval
and one exact authorized run/attempt, read-only contents permissions, no persisted
checkout token, secrets, production environment, deployment or paid runner.

Download the official archive and prepare only the locked npm graph before running.
Its fixed archive basename is supabase_2.121.0_linux_amd64.tar.gz.
Choose a NEW direct child of RUNNER_TEMP matching amanah-008-<run-id>-<8 hex chars>.
Never reuse a workdir or another project's containers. Example future invocation:

    AMANAHLIFE_LOCAL_008_APPROVAL=synthetic-deletion-tests-only \
    node --experimental-strip-types "$PACKAGE_DIR/integration.mjs" \
      --source "$SOURCE_DIR" --workdir "$LOCAL_WORKDIR" \
      --cli-archive "$CLI_ARCHIVE"

No arbitrary SQL path, hosted database URL, ref, remote Docker daemon or dotenv
input is accepted. The source must have the exact HEAD and blob hashes.

## Mandatory cleanup and results

The entrypoint finally closes its own SQL sessions, runs official stop --no-backup
and verifies absence of project-labelled containers, volumes and networks.
Cleanup failure is failure; the owned workdir/config/CLI remains for fallback.
A separate always() cleanup step in any future workflow is REQUIRED:

    AMANAHLIFE_LOCAL_008_APPROVAL=synthetic-deletion-tests-only \
    node "$PACKAGE_DIR/integration.mjs" --cleanup --workdir "$LOCAL_WORKDIR"

Fallback needs no app checkout or installed SDK. If no workdir was created it is
safe; an unknown/symlink/replaced path is rejected, not recursively deleted.
The creation/marker failure window uses inode checks and nonrecursive recovery.
Never use global prune, --all, or delete unrelated resources. Test data/evidence
is disposed of by removing the ENTIRE owned stack, not by bypassing 008 to purge
retained billing rows. The ephemeral runner must be discarded after the job.

Only fixed phases/check IDs/categories, counts and final JSON are emitted.
Raw CLI logs, status JSON, keys, JWTs, passwords, SQL bodies, user IDs and SDK errors
remain private or in 0600 files in the 0700 workdir, removed during cleanup.
No artifacts or caches are uploaded by this package.
The integration report cannot be replaced by the cleanup-only report. Missing
checks, unsupported metadata, unobserved lock waits, startup/SDK failures, skipped
assertions and failed cleanup all fail closed. Known security failures also fail.

## Allowed preparation validation and limits

    node --check integration.mjs
    node --check safety.mjs
    node --check review.test.mjs
    node --test --test-isolation=none review.test.mjs

The review tests import guards/cleanup only; commands are fake and temporary
directories synthetic. They never call execute(), SDK, Docker, SQL, Auth or the
integration assertions. A green OFFLINE review is not a green integration result.

Prepared offline: 17 named guard/static/fake-cleanup tests passed, no skips/failures;
three module syntax checks passed. The npm graph/manifests and dependency order
were inspected. SQL syntax/runtime, native Auth behavior, actual SDK import,
RLS/EXECUTE, locks, startup and integration assertions have NOT executed.
No full frontend build or Deno check was attempted.

Estimated cold-run duration: 10–25 minutes, chiefly official image pulls/startup;
assertions normally add less than two minutes, cleanup up to three minutes.
Use a sufficient later workflow timeout plus an independent cleanup budget.
Expected additional cost: $0 on a standard public-repository GitHub-hosted runner;
no hosted projects/services are needed or created. Availability/usage policy still
applies. Nothing is installed on main and no execution is authorized here.

Remaining blockers: the known trial-evidence loss must be corrected separately
before acceptance; a billing retention/account-erasure resolution is unresolved;
real provider and hosted Edge behavior remain outside this database test.
Paid subscriptions remain NO-GO. This package is for review only.
