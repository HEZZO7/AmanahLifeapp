# Migration 009 — isolated local integration package (native Auth run pending)

Application: `e6dd3fc5e014ea0539df8da12a6ee84582b302b9`.
Recovery baseline: `880faf9053b7e21c06ae10542c47ab446a04d493`.
Preparation only. This directory installs no workflow and grants no execution,
installation, deployment, production, provider or billing authorization.
Every report has `productionReady=false`, including a fully passing report.

## Exact inputs and scope

- Node **24.19.0**, official Supabase CLI **2.121.0**, Linux amd64.
- CLI archive: `supabase_2.121.0_linux_amd64.tar.gz` from
  `https://github.com/supabase/cli/releases/download/v2.121.0/supabase_2.121.0_linux_amd64.tar.gz`.
- Required archive SHA256:
  `4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f`.
- `@supabase/supabase-js` **2.110.0**; nine resolved packages, SRI SHA512
  values in `package-lock.json`. Install using `npm ci --ignore-scripts
  --audit=false --fund=false`, never `npm install` or a floating SDK URL.
- `source-manifest.json` records Git blob SHA1 AND SHA256 for all twelve
  application/reference inputs, the explicit migration order, and SHA256 for
  the other ten package files. Package checksums exclude the manifest itself;
  its trust anchor is the separately approved package commit.
- Apply only the native fixture, **001 → 002 → 003 → 004 → 005 → 008 → 009**;
  apply 009 twice. Never copy application migrations to the disposable CLI's
  migrations directory. Never apply 006/007 or execute the historical 008 package.

`fixture.sql` adapts the pinned subscription/family evidence fixtures without
replacing native Auth tables or roles. The four personal cleanup tables deliberately
model only `id`, `user_id`, marker data and restrictive Auth FKs. They are NOT a
complete notification, reminder, storage or production-schema reproduction.
Their live defaults, extra triggers and other personal tables remain unverified.
Fixture grants reproduce the pre-hardening baseline; the actual application
migrations must remove them. Test-only fault objects have all API grants revoked.

## Mandatory coverage (21 groups, no skip/xfail conversion)

| Group | Required assertion |
|---|---|
| schema_dependencies | Native Auth untouched; exact migration dependencies applied |
| real_auth_jwt | Synthetic A/B created and signed in through real local Auth; verified JWT identities |
| migration_idempotency_metadata | 009 twice preserves data, constraints, function definitions, effective ACLs, RLS and triggers |
| untrusted_denials | Missing/invalid/forged JWT, foreign identity, paid/trial writes and privileged RPC calls denied |
| service_role_history_denial | Actual REST and SQL DELETE on subscription history denied |
| successful_auth_deletion | Actual adapter → real Auth hard deletion; five cleanup tables gone, other users unchanged |
| rollback_each_cleanup_phase | Real HTTP deletion fails after each of five cleanup stages and after Auth deletion; sequence witness proves reachability; full snapshots restored |
| failed_delete_preserves_trial | Original complete trial/account snapshot survives the witnessed failures |
| failed_delete_cannot_restart_trial | Actual trial RPC using surviving real JWT returns trial_already_used without mutation |
| checkout_wins_race | Independent PIDs, observed blocking, committed checkout retained and concurrent paid-projection update protected; DELETE denied with 42501 |
| deletion_wins_race | Two backend PIDs, observed blocking, committed deletion, checkout rejected with 23503 |
| trial_races_deletion | Real JWT RPC blocks behind DELETE; rollback preserves used trial, commit rejects orphan trial with 23503 |
| simultaneous_auth_deletions | Two actual Auth DELETE requests overlap; both DB wait chains observed before release; final account absent |
| billing_history_retention | Active, expired and refunded synthetic evidence blocks Edge AND direct Auth deletion; evidence unchanged |
| family_member_privacy | Member deletion SET NULL preserves surviving family; retained display_name is explicitly observed |
| family_owner_deletion | Never-billed trial owner deletion cascades shared family rows; member's personal account unchanged |
| after_delete_null_control | Real Auth deletion succeeds despite additional AFTER DELETE RETURN NULL; readiness detection recorded |
| unreviewed_trigger_readiness | Readiness MUST reject an unreviewed BEFORE DELETE RETURN NULL veto |
| before_delete_null_preserves_trial | Vetoed Auth deletion must preserve trial/account and must not claim success |
| before_delete_null_cannot_restart_trial | Vetoed deletion must not permit a second trial through the real JWT RPC |
| isolation_and_billing_preservation | Control A's billing and A/B account data unchanged; no rejected outbound request hidden by SDK |

The **AFTER** trigger is a negative control: PostgreSQL ignores its return value,
so RETURN NULL cannot veto deletion. The reviewed concern requires **BEFORE**.
The recovery source rejects unreviewed BEFORE DELETE row/statement triggers
in readiness and again inside the transactional cleanup. This also rejects a
late trigger installed between HTTP preflight and direct Auth deletion. The
adapter requires an explicit user_not_found confirmation before success, so
an early silent veto cannot produce a false success. All 21 groups remain
mandatory ordinary failures on any regression; none is skipped or expected-pass.
The complete native Auth run has NOT been executed. Separate PostgreSQL 17 SQL
fixtures and offline adapter tests are recorded in
`docs/subscription-009-recovery-validation-ar.md`; they do not replace this run.

## Runtime architecture and safety

Use a fresh standard **GitHub-hosted ubuntu-24.04** runner, not a persistent or
self-hosted machine. No workflow is supplied or activated by this package.
Use two separate immutable checkouts: the approved application commit (`source`)
and the separately approved package commit (`package`). The CLI workdir is a
third, fresh direct child of RUNNER_TEMP, named `amanah-009-<digits>-<8 hex>`.

The harness verifies source/package hashes, archive checksum, CLI version, native
container ownership, local-only API/DB status, no linked project and no preexisting
Supabase stack. It rejects hosted connection settings and passed-in Supabase or
provider credentials. CLI subprocesses receive an allowlisted environment and
private HOME. No Supabase login, project linking, provider SDK/API or deployment.

Only official CLI defaults are used for init/start. No mirror, custom network,
startup config, Auth replacements or weakened health checks. Container tags come
from the pinned official CLI; Docker image bytes are NOT independently locked
here. Supply-chain/image compatibility remains a runtime/review limitation.

### Scoped network isolation (no runner-wide OUTPUT deny)

The controller and GitHub runner agent retain their original network namespace.
The controller only prepares/stops the pinned official stack and captures output;
it never imports the SDK or the account-deletion adapter. Before startup, narrowly
scoped IPv4/IPv6 INPUT/FORWARD guards protect only the unused local service ports
54321–54329 and 8083. There is **no host OUTPUT rule**, default-policy change,
global firewall flush, custom Docker network, proxy, mirror or extra service.

After startup, the harness verifies every container's project label, bridge,
ports and nonprivileged status. It bind-pins each container network namespace to
an owned file and verifies NSFS/inode identity against the captured namespace,
which must differ from the host. The rule plan is journalled **before** any bind
or rule is created. Failed or partial preparation retains recoverable ownership.
IPv4/IPv6 bridge guards block container-to-host initiation and off-bridge egress.
Container-namespace OUTPUT rules allow only loopback and the owned IPv4 subnet;
IPv6 permits only ::1. Embedded Docker DNS (127.0.0.11) is blocked to prevent
resolver forwarding; verified local service aliases are added only to these
owned disposable containers' /etc/hosts. This preserves internal resolution
without permitting external DNS. No existing containers are reused or changed.

Aliases are appended **in place** to each owned container's Docker-managed hosts
backing file. Docker rejects replacement of its `/etc/hosts` bind mount with
`docker cp` (`resource busy`, reproduced separately). The local daemon's
`DockerRootDir` and the inspected container's `HostsPath` must agree exactly on
`<DockerRootDir>/containers/<full-container-id>/hosts`. Labels, running state,
PID, nonprivileged status, private IP and pinned namespace are checked again.
The already-required host sudo runs a fixed `python3 -I` writer with private
stdin; no shell or utility inside a service image is assumed. Directory-FD walks
reject symlinks, and the existing single-link regular file is opened with
`O_APPEND|O_NOFOLLOW`, never create/truncate/rename. Only validated aliases for
discovered private peer addresses are added; conflicting existing aliases fail
closed. Existing bytes, inode, owner and mode must survive unchanged. A read-only
`docker cp` from the container independently verifies the result's SHA256; its
private temporary snapshot is deleted. Unsupported daemon layout, unavailable
sudo/storage access or a readback mismatch aborts setup before any worker.
No DNS/firewall rule is changed by this correction. Docker removes the backing
file with its owned container during normal ownership-scoped cleanup.

The SDK and real adapter run in a child process inside the owned Kong namespace,
with the original nonroot runner UID, no-new-privileges, and all process
capabilities dropped. Its UID must differ from Kong's. UID-scoped rules allow
only 127.0.0.1:54321 (redirected locally to Kong:8000); other IPv4 and all IPv6
worker egress are denied. The same namespace remains pinned across container
PID reuse. Before loading the SDK, the child checks its namespace, UID, no-new-
privileges, marker, hashes, and cancellation flag. Credentials travel via private
stdin, never argv/environment/logs. Child stdout/stderr are captured and discarded;
only structurally validated, fixed-field reports are accepted by the controller.

Fetch additionally permits only fixed local Auth/PostgREST routes, refuses
redirects and records attempts before validation, including SDK-caught failures.
This URL guard supplements kernel isolation and is not its replacement.

The child retains access to the local Docker Unix socket for the existing SQL
plumbing. This is isolation of the **reviewed, hash-pinned test code**, not a
sandbox against malicious code capable of abusing Docker's privileged socket.
All subprocesses and downloads must remain reviewed and immutable. Startup and
dependency acquisition occur before application isolation; no adapter runs then.
Ubuntu availability of nsenter, setpriv, mount, iptables/ip6tables, namespace
binding, container hosts-file writes and these rule interactions still requires
an authorized isolated run. Missing support fails closed, never silently skips.

### PostgreSQL session lifecycle and asynchronous failures

Every psql connection sets server statement_timeout=15s, lock_timeout=12s and
idle_in_transaction_session_timeout=20s, with a 22s Docker-client cutoff. The
six-second lock-observation bound precedes the intentional lock timeout.
All psql sessions, including one-shot control queries, are tagged. Each race uses independent sessions inside try/finally, including partial
construction and failing assertions. Sessions have a project-hashed, random
PGAPPNAME. Closing terminates only matching postgres backends, then closes/kills
the Docker client and polls pg_stat_activity until the owned session is absent.
Final worker cleanup and independent controller cleanup repeat the ownership-
scoped backend termination/count check; container removal is separately verified.
No transport error, missing SQLSTATE, connection failure, lock timeout or statement
timeout is accepted as a successful authorization/constraint denial. Genuine
unexpected security SQLSTATEs remain mandatory assertion failures.

An unhandled promise rejection immediately sets exitCode=1. A latched failure
invalidates and rewrites an already-published nominal success report, using only
a fixed asynchronous_failure category. Report-write failure also stays nonzero.
The controller checks the child's exit status against a recomputed report and
performs cleanup regardless of security failures. No raw exception is emitted.

The actual TypeScript adapter is loaded through Node's built-in strip-types and
module hook, mapping ONLY its existing remote SDK import to the locked SDK.
This tests the real handler, real Auth, real JWTs and real PostgREST/database.
It does NOT prove Deno runtime, hosted Edge gateway or deployed function parity.

A/B are persistent synthetic controls. Destructive/race/family cases create fresh
synthetic accounts to avoid resetting trial history or erasing billing evidence.
All use `@example.invalid`; no real emails, payments, notifications or customer data.
Committed fault configuration is visible to independent Auth DB connections.
Only the fault sequence survives rollback, proving the intended cleanup stage;
it is local test instrumentation, never part of an application migration.

## Offline review now (no services)

From this directory:

```sh
npm run review:offline
npm ci --offline --ignore-scripts --audit=false --fund=false --dry-run
node --check integration.mjs
node --check local-runtime.mjs
node --check safety.mjs
node --check isolation.mjs
node --check review.test.mjs
git diff --check
```

Preparation evidence is the offline regression run reported with the correction
commit: child-process APIs are disabled during tests, and all isolation commands
are pure plans or injected fakes. No integration test, SQL, Docker or Supabase is
permitted during preparation. JavaScript syntax and source/package hashes are
checked independently.
The dry run verifies lock consistency; it does NOT download/verify tarball bytes
or establish that the SDK can load. No SQL parser or database executes offline.

## Later execution — separate explicit authorization required

For Android use, a future separately reviewed manual workflow should perform the
following on its runner; the owner must not paste credentials into chat or create
hosted projects. Approval of this package does not authorize that workflow.

1. Obtain the two pinned checkouts, Node version and official CLI archive above.
2. Run the locked npm ci command in the package directory; do not use secrets,
   hosted environments or production variables. Set a fresh safe workdir path.
3. After explicit execution authorization, invoke the package entrypoint:

```sh
AMANAHLIFE_009_APPROVAL=disposable-local-migration-009-only \
node integration.mjs --source /absolute/source \
  --workdir "$RUNNER_TEMP/amanah-009-123-0123abcd" \
  --cli-archive /absolute/supabase_2.121.0_linux_amd64.tar.gz
```

4. An independent `always()` step must invoke the fallback, including after
   partial preparation, a timeout or failed assertions:

```sh
AMANAHLIFE_009_APPROVAL=disposable-local-migration-009-only \
node integration.mjs --cleanup --workdir "$RUNNER_TEMP/amanah-009-123-0123abcd"
```

Cleanup first cancels/stops only the owned worker and terminates/checks owned
PostgreSQL sessions if the database is running. It uses only the owned CLI
project, stop --no-backup, and verifies containers,
volumes and networks by both label and project name. Failed cleanup retains the
ownership marker/config/CLI/journal for fallback and returns nonzero. After
verified resource removal, only journalled/comment-tagged rules are removed;
valid pinned namespaces are checked before entering them. Partial/wrong binds
are unmounted without entering them. Namespace handles are unmounted/unlinked,
and absence of owned host rules is checked independently. Missing or unknown
ownership never authorizes deleting a resource. It never prunes or
deletes unrelated resources. Marker-creation failure removes only its own new
empty directory. Unknown ownership fails closed.

Final sanitized JSON is printed and retained at
`$RUNNER_TEMP/<project>-report.json` outside the deleted workdir. It lists passed,
failed, missing and infrastructure-failed groups, counts, phase/category/exit and
cleanup status. Retain ONLY this report, never raw logs, status JSON, workdir,
Auth data or tokens. Delete the report after review/retention requirements expire.
The later workflow must independently require exit 0, all 21 groups passed,
no missing/infrastructure failures and both cleanup outcomes verified. No
continue-on-error, retry, rerun or acceptance based solely on cleanup success.

## Limits and acceptance

### Sanitized infrastructure command diagnostics

The historical run `40272569296` exited before all groups with
`phase=status, category=command_failed, exit=1`. That phase covers the four
required-container label inspections, the CLI's
`<workdir>/bin/supabase --workdir <workdir> status -o json`, isolation discovery,
rule installation/verification, and owned-container hosts-file copies. It does
not uniquely identify the CLI status command. The original report alone cannot
establish a root cause, and cleanup success does not establish startup readiness.

Failed controller subprocesses now add only
`infrastructureFailure.diagnostic.operation` and `.reason`, selected from fixed
allowlists. For example `supabase_status_json`, `inspect_auth_labels`,
`bind_namespace`, `namespace_rule_insert`, or `append_owned_hosts` identifies the
operation without publishing its arguments or resource identifiers. Reasons such
as `permission_denied`, `object_missing`, or `resource_busy` are bounded hints
from captured output, not verified root-cause conclusions. Unknown messages stay
`unknown`. Executable paths, arguments, stdout/stderr, Auth status JSON, credentials
and error messages are never included in the diagnostic. Original exit codes and
failure categories remain nonzero; no command is retried or bypassed. The final
integration JSON retained by the workflow carries these fields before independent
cleanup overwrites the harness's working report path.

Estimated cold execution: **15–30 minutes**, dependency availability permitting;
the CLI start has an 18-minute bound and the isolated worker an 8-minute bound. Plan a bounded job with time for independent
cleanup. Expected additional services cost: **$0**, using a standard public-repo
GitHub runner subject to GitHub's applicable usage policy. No paid service needed.

No local result establishes hosted Supabase parity, production prerequisites,
provider cancellation/refund behavior, retained-data policy or payment readiness.
Retained family display names and owner cascades require policy review; this
package records current behavior without deleting additional shared data.
Never-billed successful deletion does not implement an email-level lifetime
trial ledger. Historical data already lost before this fix cannot be recovered.
Before accepting the fix, all security groups must genuinely pass; the original
008 integration evidence remains unchanged. Production subscriptions stay NO-GO.
