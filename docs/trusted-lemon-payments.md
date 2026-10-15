> Update: [subscription-lifecycle-review.md](subscription-lifecycle-review.md) documents migration 005, conservative observed payment bounds, deferred plan changes, resubscription history and recovery preparation. Existing-store isolation restrictions remain in force.

# Trusted Lemon Squeezy flow — draft preparation, not a deployment authorization

Continues PR #2 from `a71070e`. No production configuration was accessed or changed. Refund policy is approved; production operations remain prohibited. No real checkout, payment, refund, deployment or production SQL was executed. Automated provider responses are fixtures, not evidence that production works.

## Current owner restriction: production store remains untouched

The owner prohibits switching the existing AmanahLife store between Test and Live, and prohibits modifying its products, images, prices, checkout or webhook settings. [subscription-safe-isolation.md](subscription-safe-isolation.md) supersedes any earlier suggestion to use the existing store for sandbox tests. Only disconnected tests are currently authorized. A distinct test store/project remains a conditional option requiring account-specific evidence and separate setup approval; no new resource, key, deployment or financial transaction has been authorized. Production sequence sections below remain proposals for a later explicit decision, not current execution instructions.

## What changes

- Both app Upgrade and promotional checkout use an authenticated server endpoint. Browser inputs are an allowlisted offer key and optional existing discount code. Supplying user ID, tier, variant, status, mode, redirect or trial flags is rejected. Supabase `getUser(token)` and confirmed email establish identity.
- Server configuration maps an offer to a store/product/variant. Read-only provider requests verify product ownership, test mode and recurring interval before checkout. Deprecated variant recurrence fields are checked conservatively; missing fields disable checkout, rather than accepting a digital product. Migrate this validation to verified Price objects if provider responses omit those fields.
- Before the provider request, a service-only RPC creates an intent with authenticated account, offer and a SHA-256 hash of a 256-bit random opaque nonce. The nonce is sent in server-created custom data; user ID is not. The intent is marked ready only after receiving a valid checkout. Only signed webhooks with a matching ready intent can establish a new subscription binding. Later events use the immutable provider subscription/customer/order binding, not custom user ID or email.
- Checkout URLs expire in one hour. One pending intent per account prevents concurrent duplicate checkouts. A provider outage/ambiguous checkout creation can leave an intent pending until expiry; no retry creates another chargeable checkout during that interval. Existing bound accounts use their provider portal instead of another subscription. Replacing an expired bound subscription is intentionally blocked pending a reviewed replacement flow.
- Webhook validates raw-body HMAC-SHA256 with endpoint-specific secret before parsing, reading storage or calling provider APIs. Payload resource type, mode, store, account and catalog are checked. Invoice events use `attributes.subscription_id`; their object ID is an invoice ID. Known subscription, invoice and order events trigger read-only canonical reconciliation.
- Each reconciliation loads a private ledger of previously verified invoice/access windows and reads the current subscription, triggering invoice/order, complete paginated invoice history, and original order. No email/name/card/payload is stored in the event journal. The journal stores environment, body digest, event name, object ID, outcome and received time.
- PostgreSQL locks the account row, deduplicates the digest, checks a revision captured **before** provider reads, validates immutable bindings, and atomically changes subscription, binding and journal. Slower concurrent snapshots retry, never overwrite a newer revision. Canonical subscription timestamps and invoice-history lower bounds reject stale API results. Refund revocation remains sticky for the same proof. Re-encoded duplicate notifications can cause a harmless reconciliation; they cannot create another subscription or extend the same invoice period.
- Independent digital orders have no trusted app binding and never grant app access. No Netlify files, standalone product links, prices, or live Lemon Squeezy settings are changed.

## Paid access evidence and its limits

The documented Subscription Invoice object does **not** contain `billing_period_start` / `billing_period_end`. Do not manufacture those fields or add 30/365 days. This implementation records a conservative **verified access window**, not a claim of provider-supplied exact service-period dates:

| Field | Source / rule |
|---|---|
| `paid_access_from` | The newest initial/renewal paid invoice's `created_at`; initial order fallback uses the canonical subscription's `created_at`. This is an access-start bound, not an exact billing-period-start attestation. |
| `paid_access_until` | Current canonical `renews_at` only while active with a new, paid, positive-value, non-refunded billing proof; cancelled subscriptions use `ends_at`. Same proof never extends an existing end. |
| `invoice_id` in private account ledger | Provider invoice ID, or `order:<id>` for initial-order evidence before an invoice exists. Original order must belong to the same canonical bound subscription. |
| `entitlement_revoked_at` | Current-period full refund, expiration or an explicitly configured refund policy. New independent paid proof can restore access. |
| `current_period_start/end` | Display mirrors the access-window start / cancellation cap; these are not separately verified provider billing-period fields. |

An active/past_due legacy row or provider ID alone proves nothing. Migration does not backfill payment evidence. Existing records/trials/data are retained. Initial order proof requires the new trusted binding; events cannot certify old rows through email or a metadata user ID.

`past_due` / provider `unpaid` map to local `past_due` but never extend an already-paid period. `renews_at` during retries is not used. Cancellation keeps access only through the verified end/cancellation cap. Expired or revoked access is restricted by the existing family DB/server policy. An independent unexpired app trial remains available unless explicit immediate revocation applies. No data is deleted on expiry.

The owner approved invoice-scoped refund handling on 2026-10-15. Each proof has a private `payment_periods` row with immutable start, an end that can only shorten, sticky revocation, and a review flag. A current-period full refund revokes that period immediately; projection falls back to another independently verified, unrefunded and currently valid period if one exists. An older refund never invalidates a newer paid period. Initial order and initial invoice are evidence of the same initial cycle, so refunding either invalidates all aliases of that initial period. Partial refunds flag the affected period for review without changing or extending its bounds; an unrelated older partial refund cannot block an independently paid new renewal. Replayed/delayed success cannot clear a period's revocation in JavaScript or PostgreSQL. Zero-value invoices, proration (`billing_reason=updated`), free pauses and native provider trials do not automatically create paid entitlements.

Plan changes are deliberately **not** inferred from mutable subscription tier/variant metadata. An existing binding preserves the previously paid offer, does not extend its period on a changed variant, and flags review; refunds/expiration still apply. Fully automated prorated upgrades/downgrades and re-subscription need separate approved evidence and tests. Confirm/limit portal plan-change settings before launch; do not silently change them during this PR.

Exact provider service-period boundaries, native-trial policy, zero-price coupons and plan-change billing behavior need sanitized test-mode evidence/owner decisions before certifying launch readiness.

## Required configuration — never put values/secrets into the repository

Use **separate Supabase projects** for test and live. Each has one `payment_environment` row, set only during separately approved setup. Migration intentionally leaves it empty, so both checkout and webhook storage operations fail closed.

For each `MODE` (`TEST` or `LIVE`) set these secrets/configuration in its corresponding Supabase project:

```
AMANAHLIFE_LS_MODE_API_KEY
AMANAHLIFE_LS_MODE_WEBHOOK_SECRET
AMANAHLIFE_LS_MODE_STORE_ID
AMANAHLIFE_LS_MODE_APP_ORIGIN
AMANAHLIFE_LS_MODE_BALANCED_PRODUCT_ID
AMANAHLIFE_LS_MODE_FAMILY_PRODUCT_ID
AMANAHLIFE_LS_MODE_BALANCED_MONTHLY_VARIANT_ID
AMANAHLIFE_LS_MODE_BALANCED_YEARLY_VARIANT_ID
AMANAHLIFE_LS_MODE_FAMILY_MONTHLY_VARIANT_ID
AMANAHLIFE_LS_MODE_FAMILY_YEARLY_VARIANT_ID
```

`MODE` is a placeholder in this list, not a literal environment variable. No generic key/secret fallback. Four variant IDs must be distinct. Confirm actual test/live product and variant mappings and existing public prices; the old source's numeric IDs are not dashboard verification. Configure only the corresponding mode's credentials in each project. Supabase platform supplies `SUPABASE_URL` and its server-only service role key.

Frontend build: `VITE_AMANAHLIFE_PAYMENT_MODE=test|live`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public anon key only). Test builds reject the existing live project URL and require their own URL/public key. Without an explicit payment mode checkout is disabled. Verify auth/OAuth callbacks and email-verification redirects on the test project's application origin. Existing auth return-to-subscription code from earlier commits is retained; Google/email E2E remains unverified.

Dashboard checklist, to inspect first and change only after approval:

1. Verify recurring monthly/yearly app-only products/variants, their store, price, currency, current Price objects and native-trial settings in each mode. Standalone digital products stay separate. Check the existing `AMANAH30` coupon without creating/changing discounts.
2. Test endpoint: `https://<test-project>.supabase.co/functions/v1/app_11941c8fec_lemonsqueezy_webhook_test`. Live: `https://<live-project>.supabase.co/functions/v1/app_11941c8fec_lemonsqueezy_webhook`. Each must use its **own** webhook signing secret and mode. Do not register the live endpoint in test mode.
3. Webhook endpoints must be reachable without a Supabase JWT gateway check; HMAC remains mandatory in the handler. Checkout endpoints keep authenticated access; the handler additionally verifies `getUser`. This deployment setting has **not** been changed or verified.
4. Subscribe to `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`, `subscription_payment_success`, `subscription_payment_failed`, `subscription_payment_recovered`, `subscription_payment_refunded`, `order_created`, `order_refunded`.
5. Verify receipt redirects/buttons and API-created checkout response, opaque custom-data propagation to subscription/invoice events, initial order/invoice ordering, renewal/recovery timestamps, refunded statuses, cancellation caps, API pagination and dashboard delivery/retry behavior in **test mode**. Supply redacted examples; no API keys, signed URLs, raw nonce, emails, customer records or real card data in Git.
6. Confirm Customer Portal behavior for cancellation/payment-method recovery and restrict unsupported plan changes only with owner approval. Verify webhook delivery logs, API rate limits, failed/unbound events and `review_required` monitoring. There is no automatic reconciliation worker/replacement-subscription tool yet; finite provider retries require an operator runbook before launch.

## Migration and deployment sequence — proposal only

1. Owner approves unresolved business/configuration decisions and a separate test environment. Record schema/ACL backups privately and compare actual Supabase objects against the audited fixtures. Re-check default privileges and any other subscription writers (including legacy Paddle endpoints); disable untrusted writers before exposing billing, after approval. New tables/functions explicitly revoke inherited PUBLIC/anon/auth grants.
2. In a fresh isolated/test database apply in order `202610140001_subscription_authority.sql`, `202610140002_family_helper_execution.sql`, `202610150003_family_authority.sql`, **then** `202610150004_trusted_lemon_payments.sql`. Do not skip dependencies. Migration #4 creates private RLS-enabled account/intent/event/period tables, service-only RPCs and nullable `paid_access_from`; leaves the mode gate empty; preserves all existing subscription/trial fields.
3. Separately approved test setup pins the test database mode and sets test secrets/mappings/origin. Deploy only test endpoints and test frontend after that separate authorization. Configure a test webhook with the checklist above. No such actions were performed in this task.
4. Execute provider sandbox and Supabase JWT/RLS E2E, including account tampering, replay, invoice-vs-subscription IDs, renewal failure/recovery, cancellation/end of access, current vs historical refunds and family read/export/leave after expiry. Verify actual paid-date semantics. Export only redacted evidence.
5. Resolve all failures/blockers and review PR #1 dependency as well as #2. A successful mocked test run or PostgreSQL fixture is **not** permission to merge, deploy or launch. Obtain explicit approval before each production operation.
6. Only after approval, back up actual production configuration/data, stop new checkout entry, remove/disable legacy writers, apply reviewed migrations in order, configure the live mode and secrets, deploy trusted server code, configure/verify the live webhook, then enable the matching frontend. Never enable new checkout against the old webhook, or run two entitlement writers. No real financial transaction without separate explicit permission.

## Rollback and incident handling

- Stop **new checkout** entry first; keep verified webhook processing for purchases already in flight. Never roll back to browser-supplied account metadata, permissive INSERT policies or an old webhook that overwrites paid state.
- Prefer a forward fix while retaining nullable columns, private ledgers, bindings, event digests, per-invoice paid periods and revocations, and trial state. No destructive down migration or automatic deletion is provided. Restoring an old frontend must keep its old buy-link checkout disabled.
- If the new webhook cannot run safely, stop automatic entitlement mutations, retain provider delivery/audit evidence and reconcile verified purchases after the fix. Changing production endpoints/settings/replaying provider events requires explicit approval. A successful duplicate's journal entry must not be deleted casually to force reprocessing.
- A database restore must use a tested private snapshot plus provider reconciliation for payments occurring after the snapshot; never overwrite current customer records using an old backup without reconciliation. Payment ledgers are not part of user-controlled backup/restore. Explicit account deletion cascades the new account/intent/period records; event metadata remains. Expiry/cancellation/refund never deletes customer data.

## Tests and remaining evidence

- `tests/lemon-payments.test.mjs`: real Request/Response handlers with generated HMAC, isolated provider/storage adapters; no network or financial calls.
- `tests/lemon-payments-security.sql`: real service/authenticated/anon roles in the reconstructed PostgreSQL fixture; private ACLs/RPC denial, mode mismatch, cross-account intent rejection, trusted binding, duplicate/revision protection, trial preservation, cancelled paid access, failed payment, recovery, sticky refund revocation, delayed historical refunds preserving newer payment, and refund enforcement through the family entitlement function. Paid family access additionally requires the private invoice/account binding and a valid access-start bound; a legacy tier/period alone cannot qualify.
- `tests/concurrent-payment-events.sh`: two independent PostgreSQL sessions deliver the same synthetic event simultaneously; exactly one application, one journal row and one account revision are required. Runs only against the marked localhost CI fixture.
- Existing auth-return, signature, family, trial concurrency tests, lint and build remain in CI. All four payment Edge endpoints are type-checked using Deno. Family invitation authorization now calls the same database entitlement function as RLS; it no longer trusts a separate tier/status shortcut. PostgreSQL fixtures are not a production schema diff or an actual Supabase gateway test.

Blockers: dashboard/environment/secret verification; sandbox webhook payload evidence and exact paid-period semantics; native-trial/zero-value/proration/re-subscription decisions; OAuth/email/provider E2E; webhook delivery monitoring and missed-event reconciliation; unrelated paid API enforcement (AI endpoints currently authenticate but show no subscription checks); and legacy Paddle webhook writes. This PR does not claim those unrelated APIs enforce paid access. No new paid service/subscription is introduced; test infrastructure can remain free-tier, subject to the owner's actual hosting quotas.

Official payload references inspected 2026-10-15:

- https://docs.lemonsqueezy.com/help/webhooks/event-types
- https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
- https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object
- https://docs.lemonsqueezy.com/api/subscription-invoices/list-all-subscription-invoices
- https://docs.lemonsqueezy.com/api/orders/the-order-object
- https://docs.lemonsqueezy.com/api/checkouts/create-checkout
- https://docs.lemonsqueezy.com/api/variants/the-variant-object
- https://docs.lemonsqueezy.com/api/prices/the-price-object
