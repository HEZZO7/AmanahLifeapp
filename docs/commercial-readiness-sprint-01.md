# Commercial Readiness & Growth Sprint 01 — 2026-11-15

Review only; no production deployment, migration, payment, or price changes.

## Evidence
- Base main: d1d035717004f3a98222463268f19d418646ce8e.
- Subscription 009 native run 41200953611 and Phase 3 dispatcher 41282660777 succeeded. Do not rerun the entire suite without a relevant change.
- Migration 007 run 41775996702: both security execution steps succeeded; both artifact upload steps failed because upload-artifact rejects paths containing ../. This does not establish detailed SQL assertions or live schema readiness. Keep the repair branch separate; recover sanitized evidence using an absolute normalized path under a separately approved disposable run if necessary.
- Current live Supabase schema and actual Lemon Squeezy annual prices are not verified. Public checkout retrieval failed.

## Changes
- Landing free CTAs open signup; paid CTAs route to authenticated subscription journey instead of anonymous checkout.
- Allowlisted same-tab subscription intent carries selected plan and billing; Google callback and password sign-in consume it. Email confirmation in another tab/device may lose intent; customer must select plan again. No automatic payment.
- Subscription return message is pending verification, not proof of activation.
- Focused Node tests added; local copied source passed 2/2 with Node 22.16.0. Full build/browser integration not run (local clone DNS unavailable).
- No changes to payment backend, entitlement logic, database, or CI.

## Release gates
1. Owner confirms all four Lemon Squeezy variant prices and billing intervals. Landing and PricingPage currently show annual equivalents 4.89/9.09; Subscription shows 4.99/9.99. Landing totals 58.69/109.09. Do not change until authoritative prices confirmed.
2. Verify production schema against approved migration evidence; no production migration authorized.
3. Build/typecheck and focused browser regression: free signup, existing account, Google OAuth same tab, email confirmation same/new tab, both plans and billing cycles, cancellation and return pending state. Confirm no anonymous checkout from landing.
4. External planner store subscription CTAs must route through app; store is outside this repository.
5. Confirm webhook attribution and entitlements using existing test evidence plus targeted sandbox checks only where missing.
6. Owner approval before merge or deployment.

## Test command
From app/frontend: `node --experimental-strip-types --test tests/commercial-readiness/subscription-intent.test.mjs`
