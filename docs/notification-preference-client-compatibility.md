# Notification preference client compatibility — review only

No deployment, migration, production access, real notification, payment, secret,
Cron or webhook change is authorized by this patch. App subscriptions remain No-Go.

## Contract and changed behavior
The authoritative allowlist is AmanahLifeapp
`app/frontend/supabase/functions/_shared/notificationPreferences.ts` at
`7f2e821ca384627a2e63a06f0b24d7ad03ffe4c7`:
prayer_reminders, bill_reminders, habit_reminders, fasting_reminders,
savings_reminders, general_activity. Each is boolean.

Both repositories mirror `src/lib/notificationPreferenceClient.ts` and
`src/lib/usePreferenceState.ts` verbatim. Compare these files when changing
the contract; web tests also compare the client allowlist against server source.
No server validation is relaxed.

GET: authenticated POST `{action:"get_preferences"}`; successful response
`{preferences:{...}}`. Old row-shaped responses remain readable, but only own
boolean allowlisted values are retained. Valid false values are preserved;
missing/invalid fields use the existing true defaults.
UPDATE: authenticated POST `{action:"update_preferences",preferences:{changedFlag:boolean}}`.
No target ID, metadata, timestamps, role or cached extra field is sent.
HTTP success AND literal `success:true` are required. A partial patch avoids
overwriting unrelated preferences from an old cache. Confirm hosted PostgREST
upsert preservation of omitted columns during later isolated integration testing.

Clients obtain the current Supabase SDK session and match its user to the
account owning the state/cache, before sending and after receiving a response.
This is a client race guard, not proof of JWT validity: server verification
remains authoritative. No token is logged. Non-2xx, malformed responses and
network/auth failures leave the previous values unchanged and display a generic
retryable failure. Offline reads show last-known preferences with a refresh
warning; they are not claimed as newly confirmed server saves.

RN storage remains account-scoped. Legacy data is sanitized before use and
rewritten by serialized client loading; every request is sanitized independently.
Only confirmed saves update cache/UI and then the existing category scheduling.
Cache failure after acknowledgement is distinct from server failure; reminder
failure warns that the preference was saved but device reminders need retry.
Neither failure pretends the confirmed server update was rolled back.

Web notification settings and both RN consumers (Settings and Savings
Challenges) use the same state helper. Stale loads/saves cannot replace a
different account's visible state. Rapid duplicate taps are locked. Switching
accounts does not migrate guest/unscoped cache into a different user's cache.

## Isolated checks
- 30 transport/cache/identity tests per repository, network denied.
- 5 actual React state tests per repository using matching React renderer:
  failed/successful saves, pending state, double taps, late loads/saves after
  account switch/unmount, and explicitly unconfirmed cached reads.
- RN additionally has 7 adapter tests with fake SDK/storage/Expo APIs: no real
  notification is sent or scheduled. Dependency installation occurs separately;
  test execution denies network sockets.
- Web retains the existing strict server tests and lint/build CI.
- RN CI checks TypeScript without invoking EAS, Expo deployment or native builds.

Commands are in the PR workflows. CI links/results belong in the PR report.
Mocked dependencies and React renderer do not prove hosted JWT/RLS/GRANT,
browser/device UI, actual network failures on devices, or Expo integration.
No hosted checks or production SQL were run. No database migration is required.

## Coordinated rollout — future separate approval required
1. Keep PR #2 and the RN compatibility PR as drafts for review; deploy nothing now.
2. In an isolated hosted environment, verify legacy cache reads, saving each
   flag independently without resetting the other five, 401/403/503/offline
   behavior, retry, and switching two test accounts on web and a device.
   Test the previous and hardened preference endpoints against new clients.
3. Prepare a client-only web release from this compatibility commit (do not
   release the unrelated subscription/server changes in PR #2). Release the
   compatible RN client separately. Both clients work with old row-shaped GET
   responses and the strict six-field endpoint.
4. Verify compatible web assets have replaced old cached assets and check mobile
   adoption. Installed old mobile versions may persist indefinitely. The owner
   must approve a minimum-version/adoption gate before releasing the hardened
   endpoint. If incompatible versions remain, HOLD server rollout; do not allow
   forbidden fields to bypass validation.
5. Only after client compatibility evidence and separate approval may the
   authoritative hardened server be deployed. Do not assume PR merge performs
   this sequence automatically. Subscription launch stays independently No-Go.

Rollback: before server rollout, stop the client release if needed while keeping
sanitized existing caches. After strict server rollout, retain a compatible
client build; rolling clients back to the metadata-sending version is unsafe.
If a client defect appears, pause rollout and deliver a compatible client fix;
never restore insecure server identity handling. No customer data rollback or
database operation is needed for this patch. Hosting/app-store release cost and
device verification remain unverified; local tests add no paid API costs.

