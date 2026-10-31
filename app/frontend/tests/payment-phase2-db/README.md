# Offline payment SQL regressions

```sh
npm ci --ignore-scripts --prefix app/frontend/tests/payment-phase2-db
npm --prefix app/frontend run test:payments:sql
```

Use Node24.19. This runs PostgreSQL17.5 WASM (`@electric-sql/pglite@0.3.14`)
in fresh memory with synthetic users and no TCP service, provider API, GoTrue,
customer data, production credential or external database URL. The deny-network
preload is mandatory. `after` closes and checks the database handle.

The six original subscription/family/payment/AI SQL regression files execute at
their matching migration stages. Every SQL assertion remains unchanged. The
runner implements statement boundaries, psql `gset` and quoted variable expansion;
it removes only the client `ON_ERROR_STOP` directive and fails immediately on SQL
errors. It never ignores a failing assertion. Subsequent tests cover default-off
billing, reservation ambiguity, queued duplicate requests/trials, cross-account
intent/customer ownership, RLS/ACL, mode mismatch and Migration009 readiness.

Queued Promises on one WASM connection do **not** prove multi-connection lock
behavior or native Supabase Auth rollback. These tests are separate from the
unchanged 21-group native package. No native result is attributed to this source.
