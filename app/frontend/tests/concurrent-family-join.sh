#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == "localhost" && "${PGDATABASE:-}" == "postgres" ]]
[[ "${PGOPTIONS:-}" == "-c amanahlife.security_fixture=isolated" ]]
# Only localhost fixture records: establish verified paid time for a test owner.
psql -v ON_ERROR_STOP=1 -c "update public.app_11941c8fec_subscriptions
set paid_access_until=now()+interval '1 day',current_period_end=now()+interval '1 day',
status='active',entitlement_revoked_at=null
where user_id='22222222-2222-4222-8222-222222222222';"
result_dir=$(mktemp -d)
trap 'rm -rf "$result_dir"' EXIT
join_sql="begin; set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select public.app_11941c8fec_join_family_with_code('LEGACY88'); commit;"
psql -v ON_ERROR_STOP=1 -tAX -c "$join_sql" > "$result_dir/first" &
first_pid=$!
psql -v ON_ERROR_STOP=1 -tAX -c "$join_sql" > "$result_dir/second" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
psql -v ON_ERROR_STOP=1 -c "select public.fixture_assert(
(select count(*)=1 from public.app_11941c8fec_family_members
where family_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
and user_id='77777777-7777-4777-8777-777777777777'),
'Concurrent joins duplicated a member');"
