# Phase 1 subscription safety corrections — review only

Source: PR #2 at 3968fa6795bab794e72596d23d87c6b388659098.
Scope: account deletion and refund classification only. No production operation,
provider API call, SQL execution, integration suite or workflow is authorized here.

## Account deletion

Previously, the endpoint deleted the subscription projection and auth user without
checking recurring billing; auth deletion could cascade through private payment
history. Now verified Auth identity alone selects the target. A service-only,
mode-independent account_deletion_allowed RPC must return literal true before any
cleanup. Missing/malformed/denied RPC results fail closed with 503; history returns
409, a fixed /subscription management path and an honest statement that cancellation
has NOT been performed. Settings displays a localized management action and does
not clear storage or sign out on refusal.

Migration 202610210008_account_deletion_safety.sql is PREPARED, NOT APPLIED. It depends
on 001–005, not notification migration 007. It performs no data deletion or grant of
entitlement and does not widen existing table/RPC/RLS access. New functions have a
fixed empty search_path, owner postgres, explicit revocations and effective privilege
checks. Auth-user and subscription BEFORE DELETE guards protect the destructive
paths even if endpoint preflight raced a committed checkout reservation. Existing
payment FK locks on auth.users are essential to the intended concurrency argument.
This has only been reviewed statically: PostgreSQL/Auth trigger behavior, locks,
privileges, retry/idempotency and dependencies still require separately authorized
isolated verification. Do not treat mocked guard exceptions as concurrency proof.

Conservative retention boundary: ANY private payment account, checkout intent
(including abandoned/expired attempts), binding or paid period prevents automatic
account deletion. Legacy provider/customer IDs, paid tiers or recorded paid bounds
also require review. An expired/refunded/cancelled account is not automatically
purgeable. No retention deadline or evidence anonymization policy is invented.
Never-billed free/trial accounts remain eligible if the database gate and existing
cleanup operations succeed. The cleanup remains a sequence of HTTP transactions:
an unrelated cleanup/Auth failure can leave a free account partially cleaned; this
change stops and reports failure rather than claiming success. Atomic general
account erasure is outside this patch.

Configured legacy Paddle API/webhook credentials also disable automatic deletion:
that older checkout can create an external obligation before local evidence exists.
Do not remove credentials to bypass this guard. Resolve legacy inventory and
retention policy separately. Unrecorded external obligations and other deployed
delete endpoints cannot be certified from this source-only change.

No provider cancellation is requested. No status, paid period, trial, price, catalog,
Cron or webhook configuration is changed. Cancelling renewal does not remove access.
Users with billing history must manage renewal and request a retention-safe manual
account review; the new endpoint intentionally does not promise eventual deletion.

## Refund evidence and scope

The app uses direct Lemon Squeezy REST reads, not the JS SDK at runtime. Contract
cross-check: official lmsqueezy/lemonsqueezy.js commit
b1f66e905ee0614be87c3711d6529f2582e5729f, src/subscriptionInvoices/types.ts and
src/orders/types.ts. Both expose total and refunded_amount in the SAME currency's
integer minor units, plus status/refunded; neither defines partial_refund.

| Canonical evidence | Action |
| --- | --- |
| Valid total, zero refunded_amount, no contradictory refund marker | No refund |
| 0 < refunded_amount < total and status paid | Review; keep existing confirmed period, do not create/extend a period or activate a plan change |
| refunded_amount = positive total, refunded true, status paid/refunded | Revoke only the matching proof; an initial-order refund affects initial proofs only |
| Missing/non-integer/negative/over-total values, contradictory markers/status | Retryable 503 before commit_snapshot; no new grant, extension or speculative revocation |
| Fraudulent initial order | Preserve existing separate fraud-revocation behavior |

Both refunded flag values are accepted for a partial amount: that coarse flag
cannot override the amount and turn a partial refund into full revocation. USD
conversion fields/formatted amounts are never compared with native invoice totals.
Tax/discount/fee variants and actual canonical provider payloads still require
contract integration evidence. Ambiguous data stays pending in the existing verified
delivery journal; no new worker or dashboard setting is installed.

Existing confirmed entitlement stays unchanged when ambiguous input rejects the
snapshot; this is not a new grace period. Partial refunds do not mint access when no
prior confirmed proof exists. Revocation remains sticky on a payment proof, old
refunds do not erase independent newer proofs, and the existing subscription binding/
revision guards are retained. Canonical reconciliation keys now include refund
amounts, totals and order update/flag fields so amount-only changes are not deduped
away. Signed-delivery hashing/HMAC and all existing RPC authorization are unchanged.

## Offline verification

Use Node 24.19.0 (the available validation host) or a compatible Node with native
TypeScript stripping. There is no package installation or service startup required:

    cd app/frontend
    node --import ./tests/deny-network.mjs --test --test-isolation=none \
      ./tests/account-deletion-safety.test.mjs ./tests/lemon-payments.test.mjs

The network-deny preload blocks actual HTTP/TCP/fetch. Provider/Auth/storage adapters
are synthetic. Use isolation=none and inspect actual named-test counts: this host's
default subprocess mode can report a file-level success without individual checks.
Missing named checks, skipped checks or any failure are not acceptable evidence.

Coverage: verified identity/foreign target claims, invalid/missing JWT, database/Auth
failure, missing/malformed billing RPC, denied history, configured legacy provider,
simulated guard race, deletion failure, error redaction; source-level SQL grant/
retention/trigger contracts; actual handler checkout/HMAC/idempotency regressions;
partial/full refunds, ambiguous fields, duplicate/delayed snapshots, independent
newer paid periods, amount-sensitive canonical keys and partial-refund plan changes.
SQL source assertions are NOT SQL execution or real RLS/role/locking tests.

Executed offline on Node 24.19.0: 94 named checks passed, zero failures/skips
(22 deletion/UI/source-contract checks and 72 payment checks, including the 39
existing payment cases). Node syntax checks passed for the three changed server
TypeScript modules; git diff --check passed. The actual Settings deletion callback
was executed with lexical network/storage fakes for 409, 503 and success.
No full frontend build, external-SDK/Deno typecheck or SQL parser/execution is
claimed; those tools/dependencies were unavailable in the local validation snapshot.

## Future rollout gates and rollback

No deployment is authorized. Before a later staged rollout:
1. Separately authorize isolated SQL/Auth tests for migration 008, including two-user
   RPC denial, free/trial deletion, billing/intent retention, concurrent checkout versus
   Auth deletion, rollback on exceptions, and the actual postgres/auth ownership.
2. Verify existing deployed deletion consumers and legacy provider inventory; approve
   a lawful retention/manual-erasure procedure without destroying reconciliation proof.
3. Verify canonical refund amounts/statuses with a separately approved provider test;
   do not toggle or change the current production store.
4. Review coordinated installation of 001–005 and 008 plus the matching delete
   function/client. Missing 008 makes this endpoint fail closed. Do not automatically
   run the migrations directory or include 007 in a billing deployment.
5. Preserve existing paid access and data; monitor only fixed, sanitized error codes.

Rollback is a separately approved operational decision, never an automatic drop of
the retention guards or restoration of unsafe deletion/refund guessing. If the new
endpoint is unavailable, keep self-service deletion disabled and use support/manual
review while preparing a forward fix. No rollback SQL is executed or prescribed for
production in this patch. Paid subscriptions remain NO-GO.
