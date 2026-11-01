# Payment Phase 3 — prepared native acceptance, NOT EXECUTED

Application source: `7e7ee889c4f356ba1da1856a668ca6e32fc791dd`, descended from
remediation `b8ebc32946e2941761bd65ee69d3d8695a468c82`.
Historical package reference: `9baaa89718e51638d97dfd3f8030e50424c5f28c`.
The historical 21/21 run does not validate this source or package.

## Execution boundary

Preparation authorizes offline review and publishing, NOT native execution.
Only a separately approved manual workflow on a fresh GitHub-hosted
ubuntu-24.04 amd64 runner may start the disposable stack. No self-hosted runner,
hosted Supabase project, provider calls, production credentials, deployment,
Checkout endpoint, promotion or scheduler is configured here.

The registered historical workflow path is a branch-only dispatch shim. It calls
the dedicated Phase3 workflow at this same immutable GitHub workflow commit.
Both application and package use separate full-SHA checkouts with credentials
removed. The package manifest is itself compared to its pinned Git blob.
Source files have independent SHA256/Git blob verification; all eleven migrations
are ordered explicitly. Manifest refresh is not an exception to an assertion.

## Exact runtime and preserved controls

- Node24.19.0; SDK2.110.0, acorn8.15.0 and offline PostgreSQL-WASM0.3.14
  dependency/SRI pins in package-lock.json. `npm ci --ignore-scripts --audit=false
  --fund=false`; never resolve floating dependencies during the test.
- Official Supabase CLI2.121.0 linux amd64 archive, SHA256
  `4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f`.
- All 21 original group IDs, Auth/JWT operations, assertions, fault witnesses,
  race PID/blocking observations, timeouts, failure latch and real deletion
  adapter are preserved. Acorn compares every original `assert` call, including
  duplicates, against the extended integration script. Missing/changed calls fail.
- `fixture.sql`, `metadata.sql`, and `isolation.mjs` remain byte-identical to the
  historical package. `phase3-schema.sql` extends ONLY the owned fixture's two
  notification tables to meet007; no Auth roles/tables are replaced.
- Execute001..011 in schema_dependencies, then the original009-twice metadata
  group. The old seven-entry migration list remains solely to preserve the
  original ordinal and009-path assertions; it is NOT the execution order.
- New checks cover006/007 permissions,010 default-off state,011 customer-owner
  ACL/RLS/FK, extra retained owner snapshots and final default-off state.

The original approved isolation architecture remains mandatory: owned namespace
handles, UID/GID identity, no-new-privileges, dropped capabilities, no host OUTPUT
rule, scoped IPv4/IPv6 firewall rules, blocked embedded Docker DNS, owned hosts
append/readback and one checked Kong reload. Worker credentials travel only on
private stdin. No sudo -E, external DNS allowance, proxy substitution, Auth mock,
security skip or arbitrary request retry is introduced.

The controller retains its network for dependency acquisition/Actions; application
code runs only after namespace verification. The worker retains Docker socket
access for reviewed SQL plumbing, so this is isolation of hash-pinned reviewed
code, not protection against malicious code controlling the daemon. Container
image tags come from the checksum-pinned CLI; image bytes are not independently
approved digests. This supply-chain limitation remains explicit.

## Synthetic SQL reservations without enabling HTTP Checkout

Runtime `CHECKOUT_APPROVED` and discount approval are absent. No checkout function
is deployed/imported, and the worker cannot contact any payment provider.
The environment row is inserted with `checkouts_enabled=false`.

The three original reservation scenarios need the actual guarded reservation RPC.
Their callers already use explicit BEGIN transactions. The fixture helper asserts
owned local-test context/postgres/test-only/default-off, temporarily changes the
DB flag within THAT uncommitted transaction, executes the unchanged reservation
call once, and restores false before commit. Other connections never observe a
true committed flag. Any error/cancellation rolls the transaction back through
the original finalizers/session termination/timeouts. Full final verification
requires false. This is private SQL fixture instrumentation, not activation of
Checkout or a provider call; the next execution approval must include this scope.

## Offline preparation commands

```sh
npm ci --ignore-scripts --audit=false --fund=false
npm run review:offline
node --test --test-isolation=none ../subscription-009-local/review.test.mjs
node --check integration.mjs
node --check local-runtime.mjs
```

The original review suite remains unchanged. New review forbids subprocesses and
uses the network-deny preload. schema.test uses fresh PostgreSQL17 WASM in memory
with an explicitly synthetic Auth schema; it is NOT GoTrue/native/multi-session
evidence. It closes the database without a socket, volume or hosted connection.
PGlite0.3.14 opens template1 rather than postgres. Only this offline model adapts
the exact fixture database-name predicates to template1 and verifies that identity
strictly. Application SQL is unmodified; the native fixture on disk still requires
postgres. No failed native assertion is converted to an expected pass.

## Later approved native invocation

The workflow, not an arbitrary persistent workspace, supplies the prerequisite
checks and private paths. The invocation remains:

```sh
AMANAHLIFE_009_APPROVAL=disposable-001-011-native-no-provider \
node integration.mjs --source /absolute/immutable/source \
  --workdir "$RUNNER_TEMP/amanah-009-123-0123abcd" \
  --cli-archive /absolute/supabase_2.121.0_linux_amd64.tar.gz
```

Independent `always()` cleanup invokes `--cleanup --workdir ...` under the same
approval. It cancels the owned worker, checks/terminates only its PostgreSQL
sessions, runs owned CLI stop --no-backup, verifies labelled/named resources,
and removes only journalled rules/binds. Unknown ownership fails closed, never
prunes. Partial preparation journals remain available until verified fallback.

Only strictly revalidated reports, checksums and public source provenance may be
uploaded. No raw CLI/status/server/install/test logs, credentials, request bodies,
Auth data, emails, IDs or connection strings enter artifacts. Independent verdict
requires21/21, no skipped/missing/infra groups, successful offline suites and
both cleanup proofs; `productionReady=false` is unconditional.

## Compatibility limits

The fixture models required columns/policies, not production schema or notification
client behavior. BackupRestore and the old service-role preference writer have
documented unresolved defects; native validation does not deploy or exercise them.
The customer-owner FK adds retention: standalone orphaned owner history blocks
physical deletion even if008's older preflight does not identify that new table.
The FK abort must roll009 cleanup back; expanding the friendly409 policy needs a
separate reviewed application patch, not a silent rewrite of008 here.

Lemon Test acceptance remains a separate owner-authorized exercise. No credentials
or automated provider script is included. Native success alone never enables it
or changes production/billing NO-GO.

## Diagnostic revision after run41273911129

The pinned db22d73 schema checks sent bare PostgreSQL boolean output (t/f) into
JSON.parse. Seven added scalar query sites (including the final isolation check)
now explicitly select to_json(...); local-runtime's strict JSON parser is unchanged.
verifySchemaDependencies/verifyPhase3Schema are shared with the offline model,
so all32 native metadata/permission queries cross a simulated psql text boundary
using real PostgreSQL boolout and JSON type OIDs instead of JS boolean shortcuts.
The21 groups,168 historical integration assertions, source/migrations, fixture,
isolation and independent cleanup are preserved. Neither API errors nor an
unexpected grant are converted into success.

Initialization and schema checks expose only closed nativeStage codes for the
original/extended fixture, each migration001..011, environment seed, metadata,
customer ACL, trigger-function ACL and notification ACL. No SQL values, raw errors,
filenames or credentials enter reports. Fault injection verifies each boundary;
real unwanted grants, missing privileges and malformed boolean results still fail.

This is a reproduced harness defect, not proof of the exact hosted exception.
GitHub artifact access was denied by this environment; the supplied summary lacks
a stack/stage code before the catch. A failed fatal schema check itself explains
the subsequent prerequisite_failed; it does not establish a namespace/startup
failure. A newly approved native run is needed to establish the hosted outcome.
No workflow was dispatched and no native/GoTrue/provider service was run here.
