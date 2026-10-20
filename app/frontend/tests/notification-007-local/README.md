# Migration 007 — isolated local integration package (NOT EXECUTED)

Preparation/review only. No workflow is added or modified. Installation and one
manual execution require separate explicit authorization. PR #2 remains draft;
paid subscriptions remain No-Go. Standalone digital products are independent.

Infrastructure evidence: official smoke run
[39419076572](https://github.com/HEZZO7/AmanahLifeapp/actions/runs/39419076572)
passed init/start/cleanup. This package has **not** run integration tests.

## Fixed scope and dependencies

- Application checkout: `3968fa6795bab794e72596d23d87c6b388659098`, separate
  from both this package checkout and the disposable Supabase workdir.
- Official CLI `2.121.0`, Linux amd64 release archive SHA256:
  `4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f`.
- SDK `@supabase/supabase-js 2.110.0`, matching the application lockfile.
  The minimal lock contains this dependency and eight transitive packages.
  Registry URLs/SHA512 entries come from PR #2's reviewed
  `ci/notification-local/package-lock.json`; they are checked statically here.
  Actual downloaded bytes are verified by `npm ci` at a future approved run.
- Node 22.23.3 or a compatible Node 24 runtime, Linux x64, standard ephemeral
  GitHub-hosted Ubuntu 24.04 with local Docker and sudo firewall tools.
- Only six pinned source files are read (see `source-manifest.json`): native
  notification fixture, Migration 007, actual preference writer and its two
  helpers, and the existing TypeScript import resolver.
- No application `.env`, hosted configuration, production credentials, login,
  project linking, migrations 001–006, Edge deployment or payment calls.

The runner uses official `init`, `start`, `status -o json` and `stop --no-backup`.
CLI HOME/config/cache paths stay inside the disposable workdir.
It does not modify generated Supabase configuration or create a custom network,
registry mirror or custom Auth roles. The successful smoke's inbound firewall
guards are reused; ordinary image/package downloads still need the Internet.
Every test HTTP request is restricted to `http://127.0.0.1:54321/auth/v1/` or
`/rest/v1/`, with redirects rejected. No Web Push requests are made.

## Files

`integration.mjs`: one integration entrypoint plus an independent cleanup mode.
`local-safety.mjs`: pure target/path/version/coverage/diagnostic guards.
`review.test.mjs`: offline guards, lock and fake-cleanup tests; imports do not
execute the integration entrypoint or load the SDK.
`source-manifest.json`: immutable application source/blob identities.
`package.json`, `package-lock.json`: minimal SDK dependency graph.
This README: operation, acceptance, coverage and limits.

## Future approved execution — NOT instructions to execute during preparation

Use a newly authorized manual job on a disposable public-repository
GitHub-hosted runner, no production environments/secrets, read-only repository
permissions and checkout credentials not persisted. Pin this reviewed package
commit and the application commit separately. Do not reuse or rerun smoke #2.
The package independently requires workflow_dispatch, run_attempt=1 and a public
repository event; the future workflow must additionally enforce one exact run number.
No runnable workflow is supplied here; its future review must include the exact
one-run/attempt guard and expression-aware validation before installation.

Example step-local paths (the source and workdir must not overlap):

```bash
SOURCE_DIR="$GITHUB_WORKSPACE/subject"
TEST_DIR="$GITHUB_WORKSPACE/package/app/frontend/tests/notification-007-local"
SMOKE_ROOT="$RUNNER_TEMP/amanah-007-${GITHUB_RUN_ID}-$(openssl rand -hex 4)"
CLI_ARCHIVE="$RUNNER_TEMP/supabase_2.121.0_linux_amd64.tar.gz"
```

Download only the official archive into `CLI_ARCHIVE` before execution:

```bash
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --connect-timeout 20 --max-time 180 \
  https://github.com/supabase/cli/releases/download/v2.121.0/supabase_2.121.0_linux_amd64.tar.gz \
  -o "$CLI_ARCHIVE"
npm ci --prefix "$TEST_DIR" --ignore-scripts --no-audit --no-fund \
  --registry=https://registry.npmjs.org
```

The entrypoint independently checks the archive checksum **before extracting or
executing it**. It requires a new direct-child workdir under `RUNNER_TEMP`,
rejects source/workdir overlap and any existing Supabase container or matching
project volume/network. It verifies source HEAD and blob hashes before startup.
There is no automatic source fetching or dependency installation inside it.

```bash
AMANAHLIFE_LOCAL_007_APPROVAL=two-synthetic-users-only \
node --experimental-strip-types \
  --loader "$SOURCE_DIR/app/frontend/tests/preference-test-loader.mjs" \
  "$TEST_DIR/integration.mjs" --source "$SOURCE_DIR" \
  --workdir "$SMOKE_ROOT" --cli-archive "$CLI_ARCHIVE"
```

Sequence: guard/checksum → official init/start → prove db/auth/rest/kong belong
to this project → private local status → native fixture SQL → create confirmed
synthetic users A/B using only the local admin key → real password logins and
Auth.getUser → seed A and fake Push records → migration/snapshots → assertions.
B initially has no preference row, enabling a two-writer race without user C.

All SQL uses this local container only, with `ON_ERROR_STOP=1`, e.g.:

```text
docker exec -i -e 'PGOPTIONS=-c amanahlife.local_test=approved' \
  supabase_db_<owned-project> psql -X -U postgres -d postgres -At -v ON_ERROR_STOP=1
```

No arbitrary SQL input, host database URL, or migration directory is accepted.
The SDK clients performing user tests receive only the local anon key and real
local Auth sessions. The admin key is used to create the two synthetic accounts;
SQL-only service-role assertions are explicitly trusted server tests, not proof
of RLS isolation. Actual JWT/PostgREST requests prove user isolation separately.

## Mandatory cleanup

The integration entrypoint has a `finally` cleanup. A future workflow must also
have a separate `always()` step (five-minute budget) running:

```bash
AMANAHLIFE_LOCAL_007_APPROVAL=two-synthetic-users-only \
node "$TEST_DIR/integration.mjs" --cleanup --workdir "$SMOKE_ROOT"
```

This cleanup mode does not need the SDK installed or the application checkout.
It requires the private ownership marker, runs official `stop --no-backup`,
checks project-labelled containers/volumes/networks, then deletes the workdir.
Partial preparation before `start` needs neither CLI nor Docker for cleanup.
If stop/inspection fails or resources remain, it fails and retains ownership,
config and CLI for the external cleanup step; status/private logs are removed.
It never uses global prune, `--all`, or removes unrelated resources. There are
no backups or artifacts/caches uploaded by this package. The runner VM must be
discarded after the job; SIGKILL/runner loss cannot be handled by JavaScript.

Do not print raw CLI output/status JSON, SDK errors, SQL/assertion bodies,
headers, tokens, user IDs or passwords. Private files are 0600 in a 0700 workdir.
Native subprocess output is captured; third-party console diagnostics are muted
during explicit execution. Only fixed check IDs, phase/category/exit code and
the safe final report reach stdout. A failed cleanup or missing check fails the
run; the cleanup-only report cannot substitute for an integration result.

## Mandatory acceptance / coverage matrix

| Check ID | Required observed result |
| --- | --- |
| `auth` | Exactly A/B, locally confirmed synthetic accounts; actual password login and Auth.getUser agree on distinct identities. Public email verification/OAuth are not claimed. |
| `migration_first` | Only fixture + 007; all seeded data, PK/FK/UNIQUE definitions, indexes, column types/nullability/defaults preserved. |
| `migration_repeat` | Applying 007 again preserves the entire semantic snapshot, including data, constraints, effective table/column rights, grant options, RLS and policy definitions. Policy OIDs are intentionally not compared. |
| `effective_acl` | RLS enabled, no PUBLIC policy; anon has no rights; authenticated has only allowed own preference columns, no identity UPDATE; service_role has required CRUD only; effective MAINTAIN (PG17+) and grant options absent. |
| `forged_auth` | Real Auth and PostgREST reject missing/malformed JWTs and payload tampering of sub/role with unchanged signature. No unsigned decoding is used as authentication proof. |
| `foreign_insert` | A cannot insert B's row while B has none: HTTP403/42501, not a misleading UNIQUE failure. |
| `first_insert_race` | Independent SDK clients/writers for B both observe zero-row PATCH; actual INSERTs yield 201 and 409/23505, one bounded PATCH retry, one row, both location and false flags preserved. |
| `cross_account` | Both directions: foreign read empty; PATCH count=exact zero and row unchanged; own PATCH count one. |
| `column_denials` | Forbidden identity/internal columns, wildcard reads, DELETE, Push reads/inserts denied; anonymous Push access denied. |
| `client_compatibility` | Actual PrayerTimes/BackupRestore writer saves five location fields without flag reset, restores all six false values, drops legacy foreign identity/internal fields, preserves the other account; request audit forbids identity UPDATE, select/representation/merge-duplicates. |
| `session_switch` | Actual SDK logout/account switch prevents stale-account writes before storage requests. |
| `server_crud` | SET ROLE service_role can read/insert/update/delete required notification data; effects asserted and transaction rolled back. |
| `sql_denials` | Real TRUNCATE denied for anon/authenticated/service_role on both tables; tests roll back. |
| `preservation` | Push records, original A server-owned fields and all schema/permission metadata unchanged after HTTP tests; B has one valid default-generated identity/timestamps and untouched reminder markers. |

Pass requires all 14 unique check IDs, the `mode: integration/result: passed`
report, exit zero, and successful independent cleanup. A timeout, missing SDK,
schema-cache mismatch, skipped assertion, race not actually observed, or failed
cleanup is failure. Only PGRST205 missing-table cache readiness is polled for a
bounded five seconds; authorization failures are never treated as readiness.

## Allowed offline review and evidence limits

```bash
node --check "$TEST_DIR/integration.mjs"
node --check "$TEST_DIR/local-safety.mjs"
node --check "$TEST_DIR/review.test.mjs"
node "$TEST_DIR/review.test.mjs"
```

These checks never execute the integration entrypoint or call Docker/SQL/Auth.
Cleanup tests inject fake commands and use synthetic temporary directories.
They do not prove the assertions in the acceptance matrix passed.
Preparation verification on Node 24.19.0: 13 offline tests passed, including
fake-command cleanup failures; all three JavaScript syntax checks passed.

Unverified until an approved run: real CLI status fields API_URL/ANON_KEY/
SERVICE_ROLE_KEY, native Auth/REST/cache behavior, SDK/loader runtime integration,
concurrent request outcomes, SQL execution and cleanup against Docker. SQL has
not been executed or validated by a PostgreSQL parser in this preparation.
Dependency tarballs have not been downloaded here; a future npm ci enforces SRI.

The fixture reproduces audited table structure/constraints, but UTC/en/now()/
gen_random_uuid() defaults are **representative**, not production evidence.
Custom inherited production roles, default privileges on future objects,
migration rejection/rollback for every unreviewed topology, hosted gateway/JWKS,
hosted load/locks, mobile UI, Edge get/update_preferences, actual Web Push,
subscription/family/AI/payment flows are outside this first test. No third
synthetic account, new cloud project, Cron, Vault or hosted service is needed.

Estimated future execution: 3–8 minutes with ordinary downloads; allow 30
minutes overall, 18 for startup and five for cleanup. Standard public-repository
GitHub-hosted runner use needs no additional paid service. No execution is
authorized by this README.
