# Migration007 isolated repair profile

Approved source base: `a1325ab1d2340c35eb05c888d1b549616ccb2d20`.
Branch: `repair/migration007-notification-security-20261102`.
The SQL repair already exists in `202610180007_notification_table_authority.sql`.
It is deliberately unchanged; do not rename it, rewrite hosted history or expand
client grants to accommodate a legacy writer.

Run from `app/frontend/tests/payment-phase2-db` once the **existing exact**
PGlite0.3.14 lockfile has been installed through approved networking:

```sh
node --experimental-strip-types --import ../deny-network.mjs --test --test-isolation=none --test-reporter=tap migration007-repair.test.mjs
```

The test imports the actual007 bytes and portable preference writer, verifies
the SQL SHA-256, creates a fresh in-memory PostgreSQL17 WASM instance per case,
and always closes it. It never accepts a database URL or reads environment
credentials. This is SQL/RLS coverage, **not** native PostgreSQL/PostgREST,
GoTrue/JWT or a deployed Edge test. The controlled23505 interleaving is not
independent-connection concurrency. SQL service-role statements validate emitted
operation contracts, not native execution of the Edge runtime. Existing source
tests separately exercise the actual Edge and UI with doubles.

The owner successfully executed the collector on PostgreSQL17.6 on2026-11-03;
`docs/security/migration007-hosted-evidence.json` records the summary/provenance,
not a fabricated raw snapshot or a hosted repair. Provided owner evidence
establishes ordinary postgres-owned tables with RLS and FORCE RLS false,
no custom triggers/inheritance, UUID user identity, required preference fields,
the preference unique identity and composite `(user_id,endpoint)` Push index,
all eight effective anon/authenticated table privileges including MAINTAIN,
17/7 columns, NOT NULL UUID identity and NO ACTION Auth FKs, no independent
column ACLs, the two PUBLIC TRUE policies, and unprivileged API roles.
It does not provide full remaining nullability/default/constraint definitions or exact
definitions of the remaining six policies and grants.

The fixture uses eight policies with the two exact vulnerable policy names and
six explicitly synthetic own-user PERMISSIVE policies. The owner confirms that
the other six policies do not override the open policies, but their exact DDL
is not provided. Defaults, other NOT NULL details, FK deferrability/ON UPDATE,
UUID/timestamp generation and exact six policy bodies remain representative
test assumptions. No claim of complete hosted-schema parity is made. The API
roles now receive GRANT ALL at baseline, matching the verified PostgreSQL17
eight-privilege facts, while service DML is a stated contract assumption. Inherited and
grant-option mutations are additional adversarial fixture cases.

The profile prepares19 cases: verified baseline shape/ACL; baseline exposure;
data/index preservation and
idempotence; metadata collector and an application-first search_path collision;
authenticated isolation and protected columns;
anon denial and grant options; own/foreign INSERT; actual portable/legacy restore;
malformed backup rejection; permission failure/local-state preservation;
controlled singleton retry; composite Push registration/unregister and scheduler
markers; real TRUNCATE/TRIGGER/REFERENCES operations; plus five full-transaction
rollback cases for inherited table/column, grant-option, PG17 MAINTAIN and the
predefined pg_maintain role. They compare original ACLs, constraints, FK triggers,
policies, indexes and row hashes after failed migration rollback. They never
export the unsafe baseline as a production rollback script.

Current execution is BLOCKED: the pinned engine is unavailable and normal npm
access fails with connect EPERM to the required proxy. The additional-network
request was cancelled without a verified installation result. Docker's local
socket is also denied to this task. No SQL assertion or native service has run.
Static syntax/lexical checks cannot be relabelled SQL PASS. PostgreSQL15/native
compatibility remains unverified; the PG17-only profile makes no broader claim.

`docs/security/migration007-evidence-readonly.sql` is the **single catalog-only
query** for missing metadata. It does not read rows or execute application RPCs.
It returns column types/nullability, safe defaults or hashes, FK actions, indexes,
RLS, policy roles/commands, safe policy expressions or hashes, direct column/table
ACLs and effective inherited privileges/grant options. Complex/redacted defaults
or policies still require protected owner review; hashes cannot reconstruct DDL.
The collector was successfully run by the owner on hosted PostgreSQL17.6; that
does not execute007 or its SQL/native tests. The assistant did not query hosted SQL.
All catalog routines and cast types are explicitly qualified with pg_catalog.
Column metadata includes the real attribute number so index attributeNumbers
remain interpretable even if old dropped columns leave numbering gaps.
The collision fixture adds application unnest(oid[])/unnest(int2[]) overloads,
witnesses their failure on an unqualified call and expects the collector to avoid
them. This SQL regression remains unexecuted while the local engine is unavailable.

Exact hosted rollback cannot be generated from missing definitions. Before any
hosted change, obtain a verified original catalog/ACL snapshot and test recovery
in a disposable DB. Reinstalling PUBLIC TRUE with client DML would reopen the
confirmed exposure and is not an acceptable production rollback. A production
incident fallback must keep the corrected data boundary and disable affected
features or use a separately reviewed safe release. Hosted SQL, deployment,
merge, Actions dispatch and live billing require separate approval.
