# Phase 4C diagnostic evidence

Base: `a8e1321fa7ae60ec2e726853ec881bc8b9139105`. Preparation and local
diagnostics only. No main changes, hosted migrations, provider calls or dispatch.

`docs/security/phase4c-catalog-readonly.sql` collects metadata for the three
related notification tables, incoming/outgoing FKs, table/column privileges,
inherited policy roles, RLS flags, policies, triggers, dependent views and
function metadata. A read-only transaction fixes `search_path=pg_catalog` and
rolls back. It never reads application/Auth rows or executes an application RPC.
Function bodies, default values, policy literals and trigger arguments leave
the database only as hashes. Only exact constant TRUE/FALSE policies are
classified automatically; other expressions require a separate safe review.
The collector has not been executed or compiled on PostgreSQL in this session.

`readiness.mjs` is a conservative diagnostic analyzer and prerequisite gate.
It does not connect to databases, install dependencies or execute migrations.
Its tests use synthetic catalog documents. A finding from such a test is not
evidence that hosted tables have that policy/grant or contain another user's data.
In particular, PUBLIC permissive TRUE may be limited by a restrictive policy;
TRUNCATE bypasses RLS but is not thereby a supported REST endpoint. Missing RLS
definitions, grants, role membership, API exposure or collection provenance
must not be inferred from frontend filtering or an empty metadata list.

The three actual DDL definitions and a verified catalog snapshot remain absent.
Historical GitHub files are preparation scripts/narrative reports, not that
snapshot; their original CSV was explicitly kept outside GitHub. There is no
demonstrated current authorization defect on these three tables from which to
derive a safe, targeted migration. No guessed migration is added.

The 4B immutable package is retained unchanged. Its 21-group native profile still
uses the shortened cleanup-table fixture and excludes 006/007/010/011. Changing
an array of migrations cannot make that fixture complete: the runner requires
exactly 001–005/008/009, applies `slice(0,6)`, parses single-digit migration
numbers and explicitly repeats009 at `migrationFiles[6]`. Merely appending010/011
would fail the guards or target the wrong stage. A full fixture needs
the actual columns/defaults/constraints/policies/trigger topology, native Auth,
the reminder FKs and deletion behavior, and additive metadata/HTTP assertions.
Do not drop an unknown FK, invent CASCADE, weaken original metadata checks,
remove cleanup/ownership/isolation guards, or skip a group to force readiness.

The evidence report records blocked package downloads from the exact lockfiles,
source and package integrity checks, and actual test outcomes. No hosted native
run should be recommended until the prerequisite gate is fully satisfied. Even
`READY_FOR_HOSTED_REVIEW` is a review recommendation, never dispatch approval or
a production/billing GO. Current readiness is BLOCKED.
