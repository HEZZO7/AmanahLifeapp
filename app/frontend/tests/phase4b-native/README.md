# Phase 4B — immutable native validation review package

**Preparation only. Production and billing remain NO-GO. No Actions dispatch.**

The adjacent source manifest pins the application snapshot, fixtures, migrations
001–011, all notification writers and helpers, and the unchanged original native
package using both Git blob SHA1 and SHA256. Its trust anchor is the published
Phase 4B package commit; compare that commit before accepting a manifest. The
application source commit is the immediately preceding immutable patch commit;
the final package commit changes documentation/pins only.

From an exact checkout of the published package commit, prepare a fresh bundle:

```sh
node app/frontend/tests/phase4b-native/prepare.mjs <approved-application-SHA> /tmp/amanahlife-phase4b-native-review
```

The supplied SHA must equal `source-manifest.json.sourceCommit`. Preparation
verifies every input before copying files. It never starts Docker/Supabase,
installs dependencies, runs SQL/Auth/HTTP, reads credentials or dispatches CI.
`PREPARED_NOT_EXECUTED` is the only successful preparation status.

The generated `app/frontend/tests/subscription-009-local` directory preserves the original fixture,
metadata, isolation, cleanup and all 21 assertions. Only `SOURCE_COMMIT`, its
exact equality assertion in the offline review, and source/package checksums
are rebased. The assertion still requires the complete approved SHA. This fixes the source mismatch caused by
Phase 4A's deletion-handler text change. The old native fixture/order remains
001–005,008,009, with 009 repeated: **it does not cover 006/007/010/011**, the full
notification schema, frontend, Deno adapters, browser revocation or real push.
The repository's historical package and workflow pins are untouched.

The generated `notifications` directory freezes the SQL notification fixture,
unchanged migration007 and new ACL/RLS assertions. These are supplemental SQL
inputs, not a replacement for native Auth or an executable all-migration harness.
The existing PGlite runner executes those assertions when its pinned dependency
becomes available; its synthetic Auth schema does not prove GoTrue behavior.

The generated `validation-plan.json` specifies the remaining required profiles:

1. Re-run all original 21 native Auth/rollback/trial groups on the rebased source.
2. Extend the disposable native fixture to its reviewed full notification schema,
   apply all 001–011 in order, repeat009, preserve original assertions and add
   real PostgREST cross-account/column/credential tests from the SQL supplement.
3. Exercise Deno notification adapters with fake push/SMTP destinations behind
   enforced no-egress isolation. Test browser account switching, failed sync and
   unsubscribing in Arabic/English separately; no real SMTP/Web Push calls.

Profile2's full-schema fixture/HTTP harness and metadata delta need review before
execution; this package does **not** claim that extension is implemented or that
its schema matches production. Source lacks reviewed live ACL/FK/trigger evidence
for bill/goal mirrors and email_digest; do not invent those grants or weaken007
to make a fixture pass. Verify deletion behavior with related reminder rows too.

Another separately approved isolated hosted validation is required: the prior
native evidence pins a different source and excludes notification007 and these
writers. No previous result transfers to this package. A future workflow must
pin this package commit and its application commit, preserve the original safety
guards, and obtain separate user approval before dispatch. SQL dependency failure
or any missing profile remains BLOCKED; never turn it into PASS or a skipped group.
