#!/usr/bin/env bash
set -euo pipefail
# Hardcoded localhost CI fixture only. No production connection is supported.
[[ "${PGHOST:-}" == "localhost" && "${PGDATABASE:-}" == "postgres" ]]
[[ "${PGOPTIONS:-}" == "-c amanahlife.security_fixture=isolated" ]]
result_dir=$(mktemp -d)
trap 'rm -rf "$result_dir"' EXIT
trial_sql="begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.app_11941c8fec_start_trial();
commit;"
psql -v ON_ERROR_STOP=1 -tAX -c "$trial_sql" > "$result_dir/first" &
first_pid=$!
psql -v ON_ERROR_STOP=1 -tAX -c "$trial_sql" > "$result_dir/second" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
python3 - "$result_dir" <<'PY'
import json, pathlib, sys
responses=[]
for name in ['first','second']:
    for line in (pathlib.Path(sys.argv[1])/name).read_text().splitlines():
        if line.startswith('{'):
            responses.append(json.loads(line))
assert len(responses)==2, responses
assert sum(x.get('error')=='trial_already_used' for x in responses)==1, responses
assert sum(x.get('error') is None and bool(x.get('trial_started_at')) for x in responses)==1, responses
print('Concurrent trial attempts: one accepted, one rejected.')
PY
psql -v ON_ERROR_STOP=1 -c "select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_subscriptions
  where user_id='44444444-4444-4444-8444-444444444444' and trial_used and tier='free'),
 'Concurrent trials created duplicate or paid state');"
