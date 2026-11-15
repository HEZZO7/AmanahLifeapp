# Commercial Readiness & Growth Sprint 01 — 2026-11-15

Review only; no production deployment, migration, payment, or price changes.

## Evidence
- Base main: d1d035717004f3a98222463268f19d418646ce8e.
- Subscription 009 native run 41200953611 and Phase 3 dispatcher 41282660777 succeeded. Do not rerun the entire suite without a relevant change.
- Migration 007 run 41775996702: both security execution steps succeeded; both artifact upload steps failed because upload-artifact rejects paths containing ../. This does not establish detailed SQL assertions or live schema readiness. Keep the repair branch separate; recover sanitized evidence using an absolute normalized path under a separately approved disposable run if necessary.
- Current live Supabase schema remains unverified. Owner confirmed annual prices: Balanced $59.88, Family $119.88; public checkout retrieval failed.

## Changes
- Landing free CTAs open signup; paid CTAs route to authenticated subscription journey instead of anonymous checkout.
- Allowlisted same-tab subscription intent carries selected plan and billing; Google callback and password sign-in consume it. Email confirmation in another tab/device may lose intent; customer must select plan again. No automatic payment.
- Subscription return message is pending verification, not proof of activation.
- Focused Node tests added; local copied source passed 2/2 with Node 22.16.0. Full build/browser integration not run (local clone DNS unavailable).
- No changes to payment backend, entitlement logic or database. Added branch-only frontend validation workflow; execution not yet confirmed.

## Additional review changes
- Annual billing totals disclosed in both React pages; Arabic sticky price and CTA corrected.
- Removed unsupported thousands-of-users claim and corrected Family savings.
- Full build and browser verification remain pending.

## Release gates
1. Owner-confirmed annual prices aligned in landing, PricingPage and Subscription: $4.99/$9.99 monthly equivalents, $59.88/$119.88 annually. Static review found no old annual prices in these three files. Savings $24/$36. External store remains separate.
2. Verify production schema against approved migration evidence; no production migration authorized.
3. Build/typecheck and focused browser regression: free signup, existing account, Google OAuth same tab, email confirmation same/new tab, both plans and billing cycles, cancellation and return pending state. Confirm no anonymous checkout from landing.
4. External planner store subscription CTAs must route through app; store is outside this repository.
5. Confirm webhook attribution and entitlements using existing test evidence plus targeted sandbox checks only where missing.
6. Owner approval before merge or deployment.

## Test command
From app/frontend: `node --experimental-strip-types --test tests/commercial-readiness/subscription-intent.test.mjs`

## Browser validation — 2026-11-15
- Run 43679664952 failed: language link rewriting removed signup query parameters.
- Fixed query preservation and added language to paid navigation. Run 43680064599 at 1d45bc83d62f57ef9b27b0633dde9eb80049a9dd passed all steps, including build, two intent tests and twelve isolated browser scenarios (desktop/mobile, four paid choices and free signup in both languages).
- Browser test intercepts login; does not validate real authentication, payment, entitlement or live schema.
- External Netlify store remains unchanged per owner; coordinate store subscription links with approved app release. No merge or deployment authorized.

## Sprint 01-B — subscription security (review only)
Owner supplied live metadata: RLS enabled, unique user_id, unrestricted own-row INSERT policy, broad anon/authenticated grants including TRUNCATE, no custom triggers. No exploitation established.
Review migration: app/frontend/supabase/review-migrations/20261115_subscription_security.sql. Removes direct client writes, retains own-row reads and service role, adds atomic server-clock trial RPC. Frontend uses RPC and no optimistic local trial read. SQL fixture tests are isolated and simplified, not live Supabase or full payment tests.
Release blockers: verify all web/native clients and server functions using direct writes; reconcile existing anomalous trial/paid records with provider without automatic deletion; verify inherited grants, function owner, server-side entitlements and real webhook behavior. Coordinate rollout: old clients use direct upsert, new clients require RPC. Stage RPC first, deploy compatible clients, then revoke writes promptly under approved maintenance plan; review separate staged scripts and rollback before any production action. Current combined SQL is review-only, not approved for execution. No merge/deploy/live SQL.

## Security validation evidence
Run 43720741315 at 5c6be0a2c6881fb655a8d41f8516619080b460e3 completed successfully: intent tests, build, isolated browser and PostgreSQL fixture. Previous failures were fixture file access, not SQL assertions. Production remains unchanged.
Before release: inventory web/native and backend writers; verify effective column grants and inherited roles; test full production-shaped schema and server-side entitlement checks; prepare separate RPC installation and privilege lockdown scripts with rollback and maintenance window. Do not treat the simplified fixture as production certification.
