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

### Narrow real Auth assertion diagnostics

The supplied artifact for run `40379165351` reports `schema_dependencies` passed,
`real_auth_jwt` failed with `assertion_failed`, and the other 19 groups untested;
independent cleanup passed. This does not identify the failing assertion or prove
an application, JWT-signing, Auth-service or harness defect. No historical private
logs or response payloads are available to this package investigation.

Failed `real_auth_jwt` checks now optionally include one fixed `authStage` code:

| Stage | Original operation/assertion |
|---|---|
| `a_create_user`, `b_create_user` | Real admin createUser, require error=null |
| `a_password_signin`, `b_password_signin` | Real password grant, require error=null |
| `a_created_identity`, `b_created_identity` | Read and validate created UUID |
| `a_session_token`, `b_session_token` | Read the issued session access_token |
| `a_verify_token`, `b_verify_token` | Real GoTrue getUser(token), require error=null |
| `a_verified_identity`, `b_verified_identity` | Verified identity equals created identity |
| `a_seed_subscription` | Seed A's non-trial subscription using owned local SQL |
| `a_seed_personal_data`, `b_seed_personal_data` | Seed the four personal fixture rows |
| `b_trial_rpc` | Real authenticated start_trial RPC, require error=null |
| `b_trial_result` | Require RPC payload error=null |
| `distinct_identities` | Require A and B to differ |
| `reject_invalid_token` | Real GoTrue must reject the synthetic invalid token |
| `read_trial_snapshot`, `trial_row_count`, `trial_used` | Read B's trial snapshot; require one row and trial_used=true |

A/B are fixed fixture positions, not user identifiers. Codes come from a closed
22-value list: no error text, status payload, token, credential, email, user ID,
URL, path or private log is emitted. Wrappers execute each original operation
once and retain its original ordinary-failure/infrastructure-failure classification
and exit status. All native Auth requests, JWT verification and trial assertions
remain unchanged. Later groups use the original helper without JWT diagnostics.
The controller accepts codes only on failed/infrastructure-failed real_auth_jwt
entries and rejects unknown codes, codes on another group or codes on a passing
entry. Diagnostics cannot satisfy a missing group or produce a passing result.

Run `40437402291` narrows the failure to `a_create_user`, which originally wrapped
both awaiting `admin.createUser` and asserting `response.error===null`. UUID
validation was a later `a_created_identity` stage, so this artifact does not prove
an identity-assertion failure. The pinned SDK converts recognized Auth errors,
including HTTP and transport errors, into resolved `{data,error}` responses; a
stage alone cannot distinguish them from a thrown SDK exception or bad shape.

Admin-create diagnostics now add fixed `authCreateOutcome` and, for error outcomes,
fixed `authCreateReason` hints. `request_rejected` means the original SDK operation
threw/rejected (not proof of HTTP rejection); `response_error` means the SDK
resolved with a non-null error; `malformed_response` means the result lacks the
required error/data/user shape; `identity_assertion` means the original UUID
assertion failed at a_created_identity/b_created_identity. The error=null assertion
and UUID validation remain mandatory, with additional fail-closed shape checks.
The request is executed once, without new retries or Auth substitutions.

Reasons map only selected SDK error codes/names and HTTP status classes to a
closed 18-value list, e.g. admin_authorization, token_rejected, input_validation,
no_http_status, response_decode, server_error or unclassified. No raw code,
status, message, response, identity, credential, address or URL is retained in
diagnostics. Hints classify observed control flow and do not establish root cause.
The controller and summary reject unknown fields' values, inconsistent stage/
outcome pairs, missing required reasons and diagnostics on successful/other groups.
An additional fixed `authCreateHttp` bucket is derived from the existing guarded
fetch observation for this exact POST: no_request, no_response, http_2xx, http_4xx,
http_5xx, http_other, unexpected_requests or unavailable. It records only whether
an HTTP response arrived and its class, without reading its body or exposing the
route/status. For example response_error plus http_2xx points to SDK/result
handling after HTTP success; response_error plus http_4xx records an API/gateway
refusal. no_http_status is an SDK hint and alone does NOT prove a transport error.
An unavailable diagnostic never replaces or suppresses the original failure.
Old authStage-only reports remain accepted with all original failure gates.

For run `40469026749`, response_error/server_error/http_5xx proves an HTTP server
failure on this route, not whether GoTrue, a database dependency or the gateway
caused it. Schema DDL passing under postgres does not prove the Auth service's
database operations work. The fixture and reviewed 001/002/003/004/005/008 do not
install an Auth INSERT/UPDATE trigger; 008 adds a BEFORE DELETE guard only. Actual
native bootstrap triggers and service initialization in that run remain unknown.

Only after a failed A/B create request with observed http_5xx, a read-only probe
may add `authCreateServer`. It rechecks the canonical workdir, owned source/project
marker, isolation journal, exact Auth container name/project/full ID/nonprivileged
status, captured PID and pinned namespace. It inspects no container environment.
A stopped/restarted owned Auth container gets a fixed liveness code without
reading logs or entering a stale namespace. Unverified ownership prevents reads.

The probe captures at most 64 Auth log lines in the request's bounded time window,
with a five-second cutoff and 512 KiB limit. Both stdout/stderr stay private in
memory and are discarded; no raw log is written to disk, console or artifacts.
Only one structured error-level api POST /admin/users completion with HTTP 5xx
may be classified. Zero/multiple matching events report no_matching_auth_log or
ambiguous_auth_log. This is time/operation matching, not independent request-ID
correlation; logging delay, changed formats and ambiguity never justify a cause.

Only a fixed PostgreSQL driver `(SQLSTATE <5 characters>)` marker from that
event's error field yields database_dependency/privilege/constraint/raised_exception/
connection/resource/timeout/transaction/data_error/other. Multiple distinct states
give ambiguous_database_error. A structured panic gets gotrue_panic; other matched
errors stay gotrue_server_unclassified. These 19 allowlisted codes are categories,
not proof of a particular table, trigger, migration or root cause. No error text,
SQLSTATE, identity, request ID, address, timestamp, SQL, connection string or log
field is emitted. Diagnostic failure never replaces the original failed assertion,
retries Auth, changes a group result or bypasses cleanup or source verification.
The controller rejects unknown/misplaced server codes, including codes without
an observed http_5xx or on a successful check. All existing gates remain mandatory.

### Gateway/collector audit and Kong hosts refresh

Run `40485609190` reports no_matching_auth_log, not evidence that Auth never received
the request. Container selection checks the owned name/project/full ID, PID and
pinned namespace, but the snapshot could precede GoTrue's completion log. A future
Docker --until bound does not itself wait for a future record. Strict JSON format,
64-line tail, buffering and image-format differences also limit negative evidence.

The collector now follows only the SAME bounded window, still limited to 5 seconds
and 512 KiB. If Docker keeps the stream open beyond --until, an expected SIGTERM
timeout may supply evidence only after the window closed and only if all captured
streams end at complete JSON lines. Buffer overflow, other exits/signals, partial
JSON and open windows remain unavailable. Missing/ambiguous logs still prove no
origin. No Auth retry or wider log scan is added.

Kong 2.8.1 documents that /etc/hosts is snapshotted in memory and changes require
reload. The old sequence started Kong, blocked DNS, then appended aliases without
refreshing this snapshot. A network-none micro-test of Kong 2.8.1 reproduced HTTP
500 before AND after an alias append, then HTTP 200 after kong reload with the same
container PID. This establishes a harness initialization defect, not the historical
run's root cause. The test uses Kong's own loopback Admin API as a DNS-only upstream;
it runs no Auth/database service and does not replace any native group.

After all owned aliases/readbacks are verified, preparation now reloads the SAME
owned Kong master exactly once, checks kong health, and re-verifies all isolation
rules before the worker. Marker, source, journal identity, full container ID/name/
project/nonprivileged state, UID, PID and pinned namespace must agree before AND
after reload. Any drift or reload/health failure aborts; no restart, rediscovery,
DNS allowance, config change, sleep or retry is used in the harness.

Failed admin HTTP 5xx checks may also include authCreateOrigin, based only on three
allowlisted response headers: gateway_generated, proxy_attempted, gotrue_error_signal,
conflicting_headers or unavailable. Numeric Kong response-latency indicates a
Kong-produced response. Upstream-latency alone means proxy was attempted, NOT that
GoTrue replied: Kong sets its proxy-intent flag before balancing may fail. A known
GoTrue error header is a signal, not cryptographic provenance. Server/Via, raw
header values, bodies, addresses and request IDs are never retained by this probe.
Unknown/missing/contradictory evidence cannot establish a root cause. The controller
allows these codes only on failed create checks with observed http_5xx.

The standalone reproducible component test is
`python3 ci/subscription009/reproduce-gateway-hosts.py`; it requires the two images
already available on local Docker. It is NOT the native 21-group suite, does not
alter CLI defaults, and verifies cleanup of its labelled disposable resources.

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
The verified aliases are then loaded into Kong's in-memory hosts snapshot through
the ownership-checked reload described above; kernel isolation remains installed.

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

### Worker preflight diagnostics (no relaxed checks)

The report from run `40315180426` identifies only `isolated_worker` and
`assertion_failed` with zero groups accepted by the controller. That label includes controller isolation and
identity checks, sudo/nsenter/setpriv launch, worker initialization, SDK setup and
validation of `worker-report.json`; it does not identify a root cause by itself.
The controller copies group results only after report validation, so zero accepted
groups alone cannot prove that the child never attempted a group.

Infrastructure reports now retain a fixed `workerStage` code for each boundary:
controller isolation/identity/launch and report file/JSON/source/checks/observations/
result/exit checks, or worker workspace/marker/journal/namespace/UID/GID/NoNewPrivs/
cancel/source/package/stdin/credential/SDK/migration-order checks. No actual UID,
path, environment value, argument, credential or error message is published.
Before each worker preflight operation, the worker emits a two-field stage marker
on its captured private stdout. The controller accepts only exact allowlisted
markers and discards all other output. A `workerPreflightStage` hint can therefore
identify the last attempted preflight check even if report publication itself
fails. The hint is cleared before the first native group; it is never a pass.
Valid failed worker reports preserve these codes when forwarded by the controller.
If the child fails before producing a report, bounded `workerExit` and an optional
fixed `workerLaunchStage` hint distinguish stderr origins `sudo`, `nsenter`,
`setpriv` and `node`. No stderr text or arguments are retained or emitted.

Run `40361669068` identified `worker_runtime_temp` before report creation.
The old launcher supplied `RUNNER_TEMP` to sudo's environment, but did not ensure
sudo preserved it. A disposable, network-disabled reproduction with sudo's default
`env_reset` drops this variable; setpriv alone retains it. The historical artifact
does not expose the actual variable or distinguish an absent path from an invalid
one. The verified defect is reliance on environment propagation across sudo.

The controller now passes its canonical, already-verified temporary directory as
`runtimeTemp` alongside approval and credentials on private stdin. Both controller
and worker require a bounded absolute canonical existing directory that is the
expected workspace's direct parent; symlinks, missing paths, files, traversal and
foreign parents fail closed. Worker initialization, source separation and report
publication use this validated context, independent of inherited `RUNNER_TEMP`.
The controller's own environment and independent cleanup are unchanged. No sudo
`-E`, environment-preservation exception or credential in argv/environment is added.
Namespace, UID/GID, ownership marker, capability drops, NoNewPrivs, immutable source,
report integrity and cleanup requirements all remain mandatory.

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


### Rollback, shared fixture and billing-stage diagnostics

For supplied run `40492736650`, the user-verified sanitized summary reports six
native passes, ten assertions, one `billing_history_retention` infrastructure
failure and four missing groups. Artifact `12729675366` could not be downloaded
in this investigation (GitHub artifact route returned HTTP 404). The detailed
failed assertion and the historical package/source provenance were therefore
not independently read; the locally available pinned workflow still selects
source `e6dd3fc5e014ea0539df8da12a6ee84582b302b9` and the preceding package
`772f0a77f6ae1f59b360e190783939b880223cb2`.

Failed checks can now include one fixed `nativeStage`, validated for that group
in `NATIVE_CHECK_STAGES`. Rollback has ten stages distinguishing fault installation,
snapshot acquisition, adapter status, witness increment, account/control/Auth-link
rollback, JWT validity/identity and fault clearing. `cleanupPhase` is restricted
to the five original cleanup table labels or `auth`. The two dependent trial
checks distinguish the original `faultProof` prerequisite from their own snapshot
and RPC assertions. A failed prerequisite still fails; no assertion is bypassed.

Billing stages distinguish committed fixture seeding, each active/expired/refunded
state, evidence expiry, the expired-fixture assertion, policy RPC, evidence counts,
Edge/direct Auth denials, unchanged account/ledger snapshots, and the separate
paid-projection control. Optional `billingState` contains only those three fixed
states. Later groups share ten fixed fixture stages, including admin creation,
password grant, token verification, trial RPC and personal-row seeding. Races
retain the five awaited `withSessions` calls and original finalizers; diagnostics
separate session work from expected SQLSTATE validation. The unguarded adversarial
setup between groups 17 and 18 also identifies fixture snapshot/trigger setup
failures without inventing results for the final four unexecuted groups.

`database_connection_failed` remains fail-closed and keeps its prior classification.
Optional `databaseEvidence` distinguishes `missing_error_code`, `missing_sqlstate`,
`connection_sqlstate`, `server_shutdown`, `connection_limit`, or
`postgrest_connection`. Missing SDK/SQLSTATE evidence is **not** proof that the
server is down. No SQLSTATE, SDK message, response body, query, identity, path,
URL, actual/expected assertion data, token or credential is published. The worker
controller and summary reject unknown stages, wrong groups, passing-result
metadata and incoherent infrastructure evidence. Original failures and exit
classes are retained; operations are performed once, without retries added here.

`ci/subscription009/reproduce-rollback-fixture.py` is a separate SQL component
probe, never a substitute for any native group. It verifies source/package bytes,
starts a fresh PostgreSQL 17 with network none/no ports/tmpfs data/dropped
capabilities/no-new-privileges, creates an explicitly synthetic minimal Auth
schema, applies the unchanged fixture and pinned migrations, and verifies all six
fault witnesses and complete account snapshots. It also verifies fault clearing,
a fresh subsequent connection and absence of leftover database sessions, then
removes only its labelled owned container and anonymous volumes. It runs no
GoTrue, JWT, provider or native Auth test. A full reproduction still requires the
documented GitHub-hosted runner and isolation; none of those requirements changes.
