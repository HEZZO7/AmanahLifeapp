#!/usr/bin/env bash
# Local GitHub Actions PostgreSQL fixture ONLY. No provider/network calls.
set -euo pipefail
[[ "${PGHOST:-}" == localhost && "${PGDATABASE:-}" == postgres ]] || exit 1
[[ "$(psql -Atqc "select current_setting('amanahlife.security_fixture',true)='isolated' and to_regprocedure('public.fixture_assert(boolean,text)') is not null")" == t ]] || exit 1
payment_tmp=$(mktemp -d)
trap 'rm -rf "$payment_tmp"' EXIT
psql -v ON_ERROR_STOP=1 <<'SQL'
insert into public.app_11941c8fec_payment_environment(mode) values('test');
insert into auth.users(id,email) values('99999999-9999-4999-8999-999999999999','concurrency-fixture@example.invalid');
set role service_role;
select public.app_11941c8fec_payment_create_intent('test','99999999-9999-4999-8999-999999999999',repeat('c',64),'1','3','2','family','monthly');
select public.app_11941c8fec_payment_ready_intent('test',repeat('c',64),'concurrent-checkout-fixture');
SQL
cat > "$payment_tmp/event.sql" <<'SQL'
set role service_role;
select public.app_11941c8fec_payment_apply('test',repeat('9',64),'subscription_payment_success','90',
 '99999999-9999-4999-8999-999999999999',0,repeat('c',64),'90','91','92','1','3','2','family','monthly',
 jsonb_build_object('status','active','provider_updated_at',statement_timestamp(),'invoice_id','93',
 'paid_access_from',statement_timestamp()-interval '1 day','paid_access_until',statement_timestamp()+interval '29 days',
 'entitlement_revoked_at',null,'ends_at',null,'review_required',false,
 'periods',jsonb_build_array(jsonb_build_object('proof_id','93','kind','initial',
 'start',statement_timestamp()-interval '1 day','end',statement_timestamp()+interval '29 days','revoked_at',null,'review',false))));
SQL
psql -v ON_ERROR_STOP=1 -At -f "$payment_tmp/event.sql" > "$payment_tmp/one" &
payment_one=$!
psql -v ON_ERROR_STOP=1 -At -f "$payment_tmp/event.sql" > "$payment_tmp/two" &
payment_two=$!
wait "$payment_one"
wait "$payment_two"
python3 - "$payment_tmp/one" "$payment_tmp/two" <<'PY'
import json,sys
results=[json.loads(line) for path in sys.argv[1:] for line in open(path) if line.startswith('{')]
assert sorted(results,key=lambda x:next(iter(x))) == [{'applied':True},{'duplicate':True}],results
PY
psql -v ON_ERROR_STOP=1 <<'SQL'
select public.fixture_assert((select revision=1 from public.app_11941c8fec_payment_accounts where subscription_id='90'),'Concurrent duplicate advanced revision twice');
select public.fixture_assert((select count(*)=1 from public.app_11941c8fec_payment_events where event_key=repeat('9',64)),'Concurrent duplicate journal rows');
-- Cleanup only synthetic fixture data; no production credentials/hosts are accepted above.
delete from public.app_11941c8fec_subscriptions where user_id='99999999-9999-4999-8999-999999999999';
delete from auth.users where id='99999999-9999-4999-8999-999999999999';
delete from public.app_11941c8fec_payment_events where event_key=repeat('9',64);
delete from public.app_11941c8fec_payment_environment;
SQL
