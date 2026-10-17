# AI entitlement preparation — PR #2

Scope: only ai_life_coach, ai_search, receipt_scan and savings_tips, their shared authorization/runtime, migration 006 and isolated tests. No production operation, Cron/webhook/secret change, payment, merge or deployment is included. Digital-product purchases remain independent.

## Authorization

All four deployed entry points use `serveAi` and the same `createAiHandler` guard. The guard handles method/preflight first, verifies the bearer token with Supabase Auth, then calls `app_11941c8fec_ai_entitled()` with that same JWT and no identity/plan arguments. Only literal boolean true permits request processing or reading the Anthropic key. False returns 403; invalid auth returns 401; an unavailable/missing/denied/malformed entitlement check returns a generic 503 and makes no provider call. No cached frontend state or claims in the JSON body grant access. Savings fallback tips are also behind this check.

Migration `202610160006_ai_entitlement.sql` depends on migrations 001–005. Its read-only SECURITY DEFINER RPC has an empty search_path, explicit owner and authenticated-only EXECUTE, deriving identity from auth.uid(). PUBLIC, anon and service_role have no EXECUTE. It reuses the private payment projection from 005, without creating or extending paid periods. The RPC permits:

- A server-issued trial (`trial_used=true`) started no later than now and less than seven days ago, without an account revocation.
- Balanced/family access backed by a valid private payment binding and confirmed, unrefunded period covering database time, filtered by the trusted environment/provider status rules in 005.

Cancellation retains its independently paid period only to its end. Past_due/unpaid alone grants no time or grace; an independently proven period still covering now is honored, consistent with the previously approved period-based policy. Expired/paused bindings, refunded/unconfirmed/future/ended proofs and raw legacy tiers do not authorize paid AI. Native provider trial state alone is not the app's server-issued trial.

The runtime uses the project's existing SUPABASE_URL and SUPABASE_ANON_KEY plus the verified user JWT. These four handlers no longer use service_role. ANTHROPIC_API_KEY stays server-only and is accessed after authorization. No new credential type, secret value or frontend configuration is added. Gateway verification settings must still be validated before a future authorized rollout; do not toggle them in this task.

## Logging and behavior

Provider prompts, models, input validation and successful response contracts are retained. Provider failures keep the existing generic errors or savings fallback. Raw provider error bodies, generated search/receipt contents, user IDs, tokens, financial request data and arbitrary exception messages are removed from these handlers' logs. Operational logs contain only a server request ID, static event name and optional HTTP status. Missing provider configuration uses a generic unavailable response, except the existing authorized savings fallback. Responses use no-store. Input remains intentionally supplied to Anthropic for authorized AI processing; this is not a new privacy/data-retention policy.

Handlers are extracted into dependency-injected `handler.ts` modules so tests execute the actual request processing without Deno/Supabase/Anthropic network calls; index.ts files are thin production adapters. No unrelated endpoint or checkout/subscription writer is changed.

## Validation boundary

`tests/ai-access.test.mjs`: the four actual request handlers, fake verified-user/RPC results and a fake Anthropic provider, with the existing fetch/HTTP/TCP deny guard. Covers denied/allowed verdicts, claim manipulation, malformed verdicts, forged/missing auth, database/RPC/auth outages, method/preflight, sanitized provider exceptions/error bodies and malformed generated financial content. State labels in mocked request tests are trusted boolean fixtures; the actual state-to-verdict mapping is tested separately in PostgreSQL.

`tests/ai-entitlement-security.sql`: localhost fresh CI PostgreSQL roles and migrations, identity isolation and ACLs, raw legacy rejection, balanced/family paid proof, paid cancellation versus expiry, past_due with/without a valid proof, refund, expired/paused/future/unconfirmed proofs, disabled billing gate, actual server-issued trial and its exact expiry/revocation, plus unauthorized mutation attempts. Synthetic setup writes and the whole test transaction are rolled back. No production database is targeted.

CI also checks all four AI Deno entry points and retains the prior payment/family/auth suites, migration checks, lint and build. Actual Auth/JWT/gateway/PostgREST behavior in a hosted Supabase environment and real provider integration are **not** proved by these tests. Test results are recorded in the PR report after CI completes.

## Future deployment dependencies and rollback — not executed

After separate approval, first verify schema and grants match the audited migrations in an approved isolated environment. Apply 001–005, then 006 and PostgREST schema reload, before enabling the matching AI handlers. Missing 006 deliberately fails closed, rather than falling back to browser metadata or raw subscription tier. Existing legitimate private payment evidence must be reconciled as documented in 005; legacy raw records are not automatically certified.

Life coach and receipt scanner source comments identify shared project endpoints also copied in `amanahlife-rn`. That repository is outside this authorized branch/task. Coordinate its source and deployment ownership before rollout, including the new handler/shared-file packaging, so an old deployment cannot overwrite this guard. No promise that native clients or hosted functions have been updated.

If validation fails, leave production untouched. For a future incident after an approved rollout, disable paid-AI intake or use a compatible fail-closed protected version; do not restore the old authentication-only handlers or broad SQL privileges. Migration 006 only adds a read-only capability function, so retain it and payment evidence while preparing a reviewed forward fix. Production rollback/changes require explicit approval.

Remaining separate launch blockers: provider period evidence, real checkout/webhook/refund E2E, environment/gateway verification, reconciliation runner/alerts, legacy Paddle, other unrelated endpoint authorization findings and operational backup/continuity. This change does not implement rate limits or per-plan AI usage quotas. No additional paid service subscription is introduced and no real AI request is made. Paid subscription launch remains No-Go; PR stays draft.
