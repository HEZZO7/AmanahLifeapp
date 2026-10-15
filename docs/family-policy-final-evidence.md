# Family policy from completed evidence (draft PR #2)

## Evidence and verified findings
The 2026-10-15 private CSV supplies SIX tables, twelve RLS policies, two triggers,
the real eight-character generator and the SECURITY DEFINER join RPC. Prior
reports counting seven tables were inaccurate; this snapshot contains six.
No CSV or customer rows are committed.

Creation previously required only auth.uid()=owner_user_id. Finance ALL policies
required membership alone. Join RPC authenticated the user but did not check
the owner's entitlement. These bypasses are reproduced in isolated PostgreSQL.
The existing UNIQUE(join_code) and UNIQUE(family_id,user_id) prevent duplicate
values, but the check-then-insert join still raced and the generator used random().
The verified AFTER INSERT owner trigger makes the server's manual owner INSERT
redundant (it failed uniqueness and its error was ignored).

## Owner-approved policy
Current members keep read/export and may leave after entitlement ends. No creation,
new joining, invitations or data additions/changes/deletes are permitted then.
Cancellation retains the already-paid time. past_due alone gives no entitlement:
there is zero EXTRA grace beyond independently proved paid_access_until.
Immediate entitlement_revoked_at blocks trial and paid writes alike.
Do not delete or rotate existing user/family rows or join codes.

Membership and ownership identity remain separate from entitlement. Database read
policies remain intact; write policies combine identity with owner entitlement.
Leaving removes only one's membership, not shared finance rows. Leaving an owner
membership does not transfer the canonical families.owner_user_id; ownership
transfer is not implemented or silently performed.

## New migration and integration
Migration 003 adds nullable, trusted-backend-only paid_access_until and
entitlement_revoked_at. No dates or historical entitlements are backfilled from
untrusted legacy rows or provider retry dates. Helpers use server time, qualified
references, fixed empty search_path and explicit least-privilege EXECUTE.
Authenticated API roles cannot call the arbitrary-account internal helper.

Family creation/member INSERT/UPDATE triggers enforce owner entitlement even
when a trusted server bypasses RLS. Canonical owner membership is enforced on
new/updated members; existing rows are not rewritten. Table grants remove anon,
PUBLIC and administrative privileges; selected identity/code columns are immutable
through client updates. Ordinary member/owner read dependencies keep EXECUTE.

The original join RPC name/signature is preserved, derives auth.uid(), holds
family/subscription SHARE locks, checks entitlement and inserts ON CONFLICT DO
NOTHING. A wrapper updates only the joining user's allowed display/age metadata.
The Edge Function forwards the VERIFIED caller JWT to that RPC instead of
inserting with service_role, and relies on the owner trigger for creation.

Codes retain the existing alphabet and length using rejection-sampled crypto
UUID randomness. Generation is serialized through commit with an advisory lock;
bounded retry and the existing UNIQUE constraint protect collisions. Existing
codes are not rotated. Online guessing protection still requires gateway limits.

The dashboard permits existing-member reads and signed-in invite acceptance
without requiring every family member to pay. Write controls use trusted RPC
results. Database/server checks remain authoritative despite UI state changes.

## Tests and their scope
CI reconstructs all six supplied schemas, constraints/indexes, twelve policies,
actual triggers and function bodies, without production records. It proves the
old create/join bypass, then tests migration 003 under real SET ROLE authenticated/
anon/service_role context, not only as the fixture superuser.
Tests cover retained data/codes, cross-family reads/writes, denied free creation,
nonpaying member inheritance from the paid owner, duplicate/concurrent joining,
ownership forgery, cancellation, past_due retry-date rejection, revocation,
read-only finance operations on expiry, self-leave, deterministic code collisions,
bounded exhaustion and trusted-only paid metadata. JS checks the same policy.
Real Supabase gateway/JWT integration, native callers and browser E2E remain untested.

## Checkout/webhook/refund blockers — NOT resolved by this family patch
The existing checkout still has client-built links and lacks trustworthy intent
binding. Lifecycle webhook mapping/order/deduplication and refund handling remain
incomplete. It does NOT yet populate the new paid_access_until from a verified
payment, nor set/clear revocation safely for refunds/re-purchase. Family activation
therefore MUST NOT be deployed before that work is complete and tested.
Never populate paid_access_until from renews_at on a failed invoice or from a
return URL. Confirm store/variant/mode, signature, account binding, successful
invoice/subscription relationship and actual paid-through period first.

No paying customers are reported, but preserve/reconcile all existing users/test
state rather than certifying or deleting old subscription rows. Partial vs full
or older-period refunds need an explicit payment policy. Native checkout trial
settings and live/test configuration remain unverified. Default-grant proposal
remains outside automatic migrations and managed auth/default roles untouched.

## Safe rollout / rollback
No production operation is authorized. After remaining payment/configuration
blockers: snapshot exact DDL/policies/ACLs/functions and data; test all migrations
and web/mobile clients in staging; verify trusted payment writers; then request
approval for a coordinated deployment. Migration 003 requires the new server
fields/RPCs before the UI/Edge switch; do not roll out those clients early.
The migrations are transactional. After commit retain restrictive grants and
read access; disable writes temporarily if rollback is needed, use a reviewed
forward correction and never drop customers/data or restore blanket PUBLIC
grants. Restoring old application code is unsafe if it bypasses the new RPC path.


Latest verification: all twenty Node tests (8 auth-return, 4 signature, 8 family
policy), lint/build and the isolated PostgreSQL policy/concurrency/collision suite
passed at 87bc97587e359d0ee2fe06e5a5cfd19c61ba8511. Subsequent preflight changes
require the final CI run as well. No live Supabase evidence was gathered by writes.

Review readiness: the family changes are reviewable, but PR #2 is NOT ready for
final merge/deployment review until trusted payment activation/refund/recovery,
store/variant/test-live settings, old-row reconciliation, native callers and
gateway attempt limits are resolved. Removed members retaining an old shared
code can rejoin an entitled family; per-person invitation/revocation semantics
require a separate approved policy (no silent code rotation in this patch).
