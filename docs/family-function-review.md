# Family authorization review (draft #2)

Reviewed four owner-supplied function definitions on 2026-10-14. No production
function was invoked or changed. Source scan: 180 TS/TSX/SQL files under
app/frontend/src and supabase at e6b99c101a07dbce287b40587ad0873d9f040309, without
fetch errors. Raw CSV is not committed.

## Verified code findings

- is_family_member(uuid) tests family membership against auth.uid().
- is_family_owner(uuid) tests owner_user_id against auth.uid().
- Neither tests payment; these are identity helpers, not complete entitlement
  checks. That alone is NOT a vulnerability if callers combine a paid/trial check
  or permit legitimate read/export access after expiry.
- add_owner_as_member() is a trigger-returning definer function inserting NEW's
  owner into family_members. Caller authorization depends on the parent INSERT,
  its RLS and the actual trigger definition. It is not a normal callable RPC.
- set_join_code() is also a trigger function. It preserves a nonempty supplied
  code or invokes the qualified generator and checks the candidate's absence.
- All four qualify their auth/public table and generator references. The supplied
  schema evidence shows anon/authenticated cannot CREATE in public. No proven
  search_path injection is claimed.
- Metadata previously listed join_family_with_code(text), but the new export has
  no such body. Absence from this export does NOT establish removal from production.

## Known repository caller boundaries

No direct application RPC call to any of the four helpers or join_family_with_code
was found in the scan. Indirect database-policy/trigger callers still need evidence.
The start_trial RPC is unrelated and the only source .rpc call in that scan.

FamilySharedDashboard reads family/membership directly, removes members through
DELETE, and calls family_invite for send/accept. It starts data reads before the
visual subscription gate. Its comment describing RLS is not database evidence.

familyBudgetSync.ensureFamily creates a parent family directly if no existing
ownership/membership is found; mirrorToServer writes settings/categories/income/
expenses directly. Their ultimate boundary is RLS, not a client gate.

family_invite uses service_role after authenticating a user. Before this patch:
send selected tier only, so family/expired or family/paused rows passed that check.
accept checked a reusable join code but never the family's owner's entitlement.
Those are verified missing server checks in repository code; live reproduction
and actual deployment versions are unverified.

Potential, not proven: post-expiry direct family data access, forged parent-owner
inserts, duplicate trigger/server owner insertion, join-code collision or guessing,
and bypass through the unreviewed join RPC. Confirm RLS, triggers, constraints,
generator body, and missing RPC before concluding exploitability.

## Narrow fixes prepared

- Use a shared server entitlement predicate for invitation sending and accepting.
- Fetch sender's row from verified user.id; fetch the owner's row from the family
  selected by the code. Never take entitlement/user_id from the request body.
- Reject expired/unpaid/paused/unknown states, preserving active family, valid
  existing seven-day trials, current past_due behavior, and canceled paid periods
  strictly until their recorded end. Refund/new grace policy is still unresolved.
- Keep membership/ownership functions as identity helpers rather than mixing
  entitlement into them and potentially blocking legitimate record retention/export.
- Migration 002 fixes search_path to empty and removes PUBLIC/anon execution on
  exactly the four reviewed helpers. Keep explicit authenticated/service grants
  and every body, account, family record and join code unchanged.
- Do not modify missing join RPC, generator or family RLS yet.

Historical subscription provenance remains a blocker even after closing direct
writes. Migration 001 and this server predicate do not retroactively certify old
rows as provider-paid. Resolve test/legitimate state without deletion or guessing.

## Tests and limits

Six Node tests cover paid/trial states, expired/unpaid denial, cancellation end,
future/invalid trial dates and missing records. CI loads the actual four reviewed
bodies into a representative family fixture, hardens them and verifies identity
isolation, absent identity denial, anonymous EXECUTE removal, preserved owner
trigger behavior and existing/generated join codes.

Fixture table/RLS/trigger bindings are explicitly synthetic; generator is a stub.
These tests do not establish production RLS, real generator entropy, live auth or
whole invite-handler E2E behavior. Native/mobile and other-repository callers,
database dependencies, and deployed Edge Function versions remain unverified.

## Remaining evidence and deployment boundary

Run docs/family-remaining-evidence-readonly.sql once. It returns four numbered
sections: family schemas/constraints/indexes, RLS, actual triggers and missing
join/generator bodies (without assuming their parameter names).

Before rollout confirm whether owner subscription/trial covers all invited
members; preserve that intended model rather than requiring each member to pay.
Confirm post-expiry read/export vs write restrictions and past_due/refund policy.
Do not disable membership records or delete shared finance data on expiry.

Test in isolated/staging first; compare production function versions/bodies and
policy dependencies before removing execution grants. Migration 002 is transactional.
If guest policies intentionally call these helpers, reconcile that dependency
before approval. Keep authenticated execution and data during rollback; use a
reviewed forward correction rather than blanket PUBLIC grants or dropping families.
No merge, migration execution, deployment or production transactions authorized.
