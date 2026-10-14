# Subscription security preparation (draft; integration blocked)

This PR is stacked on PR #1, targeting fix/auth-subscription. Do not merge or deploy.

## Updated evidence

The full seven-check CSV has now been reviewed. See
[subscription-security-csv-review.md](subscription-security-csv-review.md) for findings,
the staged migration, tests and remaining blockers. The sections below describe
the earlier preparation and must not be mistaken for the current evidence status.

## Verified and missing evidence

GitHub source was reviewed at d60e5ae. Source variant mappings are balanced
monthly 1959952, balanced yearly 1959859, family monthly 1959970, family yearly
1959954. These are NOT independently verified production settings.

No Supabase or Lemon Squeezy read-only connector or credential binding is
available. No schema migrations, RLS definitions, or deployment configuration
were found in the application repository. Runtime outbound HTTP could not
connect to its proxy; GitHub connector access works.

Required non-secret evidence before checkout/webhook changes:
- Subscription table columns/defaults, constraints, indexes, triggers, grants,
  RLS policies, relevant RPCs, and the repository owning web/mobile shared schema.
- Existing checkout-binding/event tables and older legitimate subscription records'
  migration policy. Never claim accounts by email or customer-supplied user_id.
- Deployed Edge Function versions and JWT verification configuration: webhook
  provider requests must be allowed through the gateway, then signature-checked.
- Store/product/variant mapping, billing intervals, explicit test/live separation,
  selected webhook events, endpoint and redacted delivery outcomes.
- Auth flow type, email confirmation setting, allowed redirects, email templates
  and cross-tab/device verification behavior.
- Deployment triggers: no production deployment is authorized.

Do not provide API keys, service role keys, JWTs, webhook secrets, SMTP credentials,
or customer/payment records.

## Independent changes included

- Safe fixed allowlist for authentication return navigation.
- Persist direct login-to-subscription intent before Google OAuth/signup.
- Preserve that intent on authentication callback retry.
- Eight automated auth-return tests, without external service access.
- CI for these tests, lint and build.

OAuth and email provider redirect configuration is preserved. Email verification
in a new tab/device remains incomplete: the helper supports a known callback
next parameter, but provider redirect URLs are not changed until configuration
is verified. Unit tests do not establish end-to-end authentication success.

## Pending policy questions

Confirm refund entitlement policy for current-period full refunds, partial refunds,
older-period refunds and chargebacks. Proposed policy awaiting approval: current
period full refund revokes access; partial/older-period refunds do not automatically
revoke it. Confirm past_due grace duration and unpaid access policy.

Cancellation must preserve legitimately already-paid access until its end.
Do not infer payment confirmation or paid-through dates from return URLs or trial
dates. Test/live bindings must never cross environments.

## Integration after evidence and policy answers

Reuse authenticated server-side checkout for subscription and promotion CTAs.
Record a server-generated opaque intent bound to verified account, actual variant,
store and mode; validate provider events against that trusted binding.

Separate subscription and invoice payload handling. Deduplicate, order and update
events atomically. Reject mismatched accounts, variants, stores and modes. Protect
a newer subscription from stale events for an older subscription. Never default
unknown or unpaid status to active. Preserve paid access on cancellation, and
display pending payment until trusted server state confirms activation.

Keep standalone digital-product purchase and delivery flows independent.

Required payment integration tests (not yet implemented/run): successful payment,
concurrent duplicate events, failed/recovered/unpaid payment, cancellation and
expiry, full/partial/older refunds, unauthorized or modified account binding, stale
events, wrong mode/store/variant, standalone products, and fake success URL.

No checkout/webhook/schema changes, migrations, production setting changes or
financial transactions are included in this draft. No new paid service is proposed.
Quota impact is unknown without plan and usage evidence.
