# Migration 007 isolated execution package — PREPARED, NOT EXECUTED

Scope: only the existing **19** cases in
`app/frontend/tests/payment-phase2-db/migration007-repair.test.mjs` with the
unchanged PGlite **0.3.14** lockfile, plus **15** supplemental PostgreSQL **17.6**
authorization groups. No application installation, Supabase CLI, hosted database,
GoTrue server, Edge deployment, billing test, account deletion or provider call.
The original broader Native package and its acceptance requirements are unchanged.

## GitHub Actions: separate registration and dispatch approvals required

Prepared workflow: `.github/workflows/migration007-isolated-security.yml`.
It is manual-only, on `ubuntu-latest`, with Node **24.19.0**, `contents: read`,
credential persistence off and all official Actions pinned by full commit SHA.
The two independent matrix jobs do not mask each other's failures. PGlite uses
`npm ci --ignore-scripts --no-audit --no-fund` from the existing nested lockfile;
no dependency version changes or lifecycle scripts are permitted.

**This new filename is absent from main.** GitHub requires a manually dispatched
workflow to exist in the default branch. See the official
[manual workflow documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
Do not assume `--ref` removes this requirement. Do not dispatch an older workflow
as proof for this package. No default-branch installation, PR or dispatch is
authorized by preparation. Until registration is separately approved and completed,
use the Windows fallback below on an approved local machine.

After separate registration **and execution** approval, select the repair branch
and enter its separately reviewed full commit SHA in `expected_commit`. The gate
requires it to match the immutable event SHA. Conditional future command:

```bash
gh workflow run migration007-isolated-security.yml \
  --repo HEZZO7/AmanahLifeapp \
  --ref repair/migration007-notification-security-20261102 \
  -f expected_commit=<APPROVED_FULL_COMMIT_SHA>
```

This command has **not** been executed. Repository/organization Actions policies,
runner quota and artifact availability still need verification by the owner;
the connector cannot read the Actions administration endpoints. Historical runs
are evidence of past use, not proof of present availability.

## Windows / PowerShell fallback

Prerequisites: Git; Node **24.19.0** with npm **11.x**; for Native, Docker Desktop
in Linux-container mode on an x64 machine with a local Docker endpoint. Dependency
downloads must use the machine's approved proxy/CA configuration. Do not disable
TLS, proxies, execution policy or other controls. No Supabase credentials are needed.

Use a fresh checkout with LF bytes; an existing checkout converted to CRLF will
correctly fail the input hashes. Verify the complete commit against the published
repair report before running:

```powershell
git -c core.autocrlf=false clone --single-branch --branch repair/migration007-notification-security-20261102 https://github.com/HEZZO7/AmanahLifeapp.git AmanahLife-M007
Set-Location AmanahLife-M007
git rev-parse HEAD
# Compare this SHA with the separately reviewed final commit. Stop on mismatch.
.\ci\migration007\Run-Migration007.ps1
```

Optional `-Profile PGlite` / `-Profile Native` runs one profile; it does not satisfy
the other profile's acceptance gate. Reports go to a new directory under TEMP.
The script checks every native command exit code and propagates failure.

If the local script-signing policy blocks `.ps1`, preserve that policy and execute
the same Node entrypoints individually in PowerShell:

```powershell
$M007Report = Join-Path $env:TEMP ('amanah007-' + [guid]::NewGuid().ToString('N'))
node ci/migration007/run.mjs verify $M007Report
if ($LASTEXITCODE -ne 0) { throw 'Verification failed' }
node ci/migration007/install.mjs $M007Report
if ($LASTEXITCODE -ne 0) { throw 'Locked install failed' }
node ci/migration007/run.mjs pglite $M007Report
if ($LASTEXITCODE -ne 0) { throw 'SQL profile failed' }
node ci/migration007/run.mjs native $M007Report
if ($LASTEXITCODE -ne 0) { throw 'Native profile failed' }
```

## Integrity, isolation and evidence

`inputs.json` records base ancestry, SHA-256 hashes for every executable input and
fixture, the unchanged lockfile SRI, and the pinned official PG17.6 image digest.
The dispatched source is checked out by full SHA. The verifier rejects a wrong
branch/repository, changed tracked inputs, symlinked inputs, Node mismatch or hash
mismatch. Logs record source commit, manifest digest, Node/npm/PGlite versions,
PostgreSQL version, image digest, case outcomes and SQLSTATE/error codes.

The native runner accepts **no database URL**. It verifies a local Unix socket or
Windows named pipe Docker context. The new container has `--network none`, no
published ports, no host mounts, a read-only filesystem, temporary in-memory data,
resource limits and a fresh synthetic password which is never printed. PostgreSQL
TCP listening is disabled; `psql` uses the container's Unix socket. SQL roles are
synthetic and isolated from any hosted system. The exact server version must be
`170006`. Cleanup removes the labeled container and verifies its absence; cleanup
failure prevents PASS. There are no persistent volumes or custom networks.

The Native fixture is extracted as a literal from the unchanged 19-case file;
only its four known constant interpolations are allowed, with no JS evaluation.
It tests the vulnerable baseline, anonymous denials, cross-account isolation,
identity/internal-column and Push-secret denials, own inserts, effective table/
column ACLs and grant options, actual TRUNCATE/TRIGGER/REFERENCES denials, service
registration/scheduler SQL, idempotence, direct column ACL removal, and complete
rollback on five inherited-permission/membership faults including `pg_maintain`.
MAINTAIN is checked through effective PostgreSQL privileges and real membership
faults; do not describe this as an attempted VACUUM, whose permission failures can
be warnings. There is no Auth account deletion.

The fixture preserves owner-confirmed schema facts but some full defaults,
constraints and six policy definitions remain representative. A native PASS
cannot prove complete hosted DDL/ACL parity, real JWT verification, hosted Edge
behavior or the broader original 21 Native groups.

Artifacts retain only allowlisted JSON/JSONL for 14 days, including sanitized
failure codes, not assertion values, SQL parameters, raw npm/Docker/SQL logs,
headers, environment dumps, rows or passwords. Test names are from the reviewed
source. A subprocess spawn error, timeout, nonzero exit, missing summary, fewer
than 19 SQL cases, any skip/todo/cancellation, a failed native group or failed
cleanup prevents PASS. A one-file harness success is explicitly rejected.

Required future evidence: **19/19 SQL cases**, **15/15 supplemental Native groups**,
successful cleanup, correct versions/hashes and no skipped assertions. Preparation
tests alone do not satisfy these conditions. Production and Live Billing: **NO-GO**.
