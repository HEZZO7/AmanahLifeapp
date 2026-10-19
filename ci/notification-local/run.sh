#!/usr/bin/env bash
# PROPOSAL ONLY; never called by this Codex session.
set -euo pipefail
umask 077
: "${SOURCE_DIR:?}" "${HARNESS_DIR:?}" "${LOCAL_RUN_DIR:?}" "${SUBJECT_SHA:?}" "${CLI_VERSION:?}"
test "${LOCAL_ONLY_APPROVAL:-}" = two-synthetic-users-no-egress
test "$SUBJECT_SHA" = f29d8df16e434e8cd064968e4b832e9c8f84e2fb
test "$CLI_VERSION" = 2.121.0
test "$(git -C "$SOURCE_DIR" rev-parse HEAD)" = "$SUBJECT_SHA"
test ! -e "$LOCAL_RUN_DIR"
mkdir -p "$LOCAL_RUN_DIR" "$LOCAL_RUN_DIR/results" "$LOCAL_RUN_DIR/bin" "$LOCAL_RUN_DIR/stack"
mkdir -p "$HOME"
python3 "$HARNESS_DIR/stage.py" "$SOURCE_DIR" "$LOCAL_RUN_DIR/subject" "$HARNESS_DIR/source-manifest.json"
SOURCE_DIR="$LOCAL_RUN_DIR/subject"
project="amanah-local-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
private="${project}-private"
node_image="$(python3 "$HARNESS_DIR/repro-cli.py" image node)"
python_image="$(python3 "$HARNESS_DIR/repro-cli.py" image python)"
printf '%s\n' "$project" > "$LOCAL_RUN_DIR/project"
printf '%s\n' "$private" > "$LOCAL_RUN_DIR/network"
unset SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF SUPABASE_DB_PASSWORD SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export DO_NOT_TRACK=1
export SUPABASE_USE_SLIM_IMAGES=true SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io
# Do not redirect Docker to any remote daemon.
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
docker info --format '{{.ServerVersion}}' > "$LOCAL_RUN_DIR/docker-version.txt"
python3 - "$LOCAL_RUN_DIR" <<'PY'
from pathlib import Path
import shutil,sys
assert shutil.disk_usage(sys.argv[1]).free>=8*1024**3, 'Insufficient disposable runner disk'
memory=int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:')))*1024
assert memory>=8*1024**3, 'Insufficient standard runner memory'
PY
# The expected SHA256 is committed from the publisher release API, not fetched
# dynamically alongside the binary. No package manager installs the CLI.
curl --fail --silent --show-error --location "https://github.com/supabase/cli/releases/download/v${CLI_VERSION}/supabase_${CLI_VERSION}_linux_amd64.tar.gz" -o "$LOCAL_RUN_DIR/cli.tar.gz"
python3 "$HARNESS_DIR/repro-cli.py" cli "$LOCAL_RUN_DIR/cli.tar.gz"
tar -xzf "$LOCAL_RUN_DIR/cli.tar.gz" -C "$LOCAL_RUN_DIR/bin" supabase
cli="$LOCAL_RUN_DIR/bin/supabase"
"$cli" --version > "$LOCAL_RUN_DIR/cli-version.txt"
grep -qx "$CLI_VERSION" "$LOCAL_RUN_DIR/cli-version.txt"
python3 "$HARNESS_DIR/repro-cli.py" images "$LOCAL_RUN_DIR/pulled-images.json"
test "$(docker run --rm --network none "$node_image" node --version)" = v22.23.3
test "$(docker run --rm --network none "$node_image" npm --version)" = 10.9.9
test "$(docker run --rm --network none "$python_image" python --version)" = 'Python 3.12.15'
# Dependency installation cannot access user/project credentials: none mounted.
docker run --rm --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm --tmpfs /tmp \
 -v "$HARNESS_DIR:/harness" -w /harness "$node_image" \
 npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org > "$LOCAL_RUN_DIR/npm.log" 2>&1
python3 "$HARNESS_DIR/record-deps.py" "$HARNESS_DIR" "$LOCAL_RUN_DIR/dependencies.json"
# A second, independent SRI/manifest check creates a frozen artifact mirror for
# Deno. Downloads occur before local keys/users exist; no runtime proxy exists.
python3 "$HARNESS_DIR/repro-cli.py" tarballs "$LOCAL_RUN_DIR/npm-artifacts"
"$cli" --workdir "$LOCAL_RUN_DIR/stack" init > "$LOCAL_RUN_DIR/init.log" 2>&1
python3 "$HARNESS_DIR/configure.py" "$LOCAL_RUN_DIR/stack" "$project"
functions="$LOCAL_RUN_DIR/stack/supabase/functions"
mkdir -p "$functions/_shared" "$functions/app_11941c8fec_push_notify"
for file in notificationPreferences.ts notificationPreferencesStore.ts; do
 cp "$SOURCE_DIR/app/frontend/supabase/functions/_shared/$file" "$functions/_shared/$file"
done
cp "$SOURCE_DIR/app/frontend/supabase/functions/app_11941c8fec_push_notify/index.ts" "$functions/app_11941c8fec_push_notify/index.ts"
cp "$HARNESS_DIR/deno.lock" "$HARNESS_DIR/deno.json" "$HARNESS_DIR/import_map.json" "$functions/"
mkdir -p "$functions/ci_runtime_probe"
cp "$HARNESS_DIR/runtime-probe.ts" "$functions/ci_runtime_probe/index.ts"
# Internal network only, including during module loading. This HTTP mirror
# serves verified artifacts; it has no outbound connections or bridge route.
docker network create --internal --driver bridge \
 --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 "$private" >/dev/null
docker run -d --name "${project}-cache" --network "$private" --network-alias dependency-cache --user "$(id -u):$(id -g)" \
 --cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp \
 -v "$HARNESS_DIR:/harness:ro" -v "$LOCAL_RUN_DIR/npm-artifacts:/cache:ro" \
 "$python_image" python /harness/locked-registry.py /cache >/dev/null
"$cli" --workdir "$LOCAL_RUN_DIR/stack" --network-id "$private" start \
 --exclude studio,realtime,storage-api,imgproxy,mailpit,postgres-meta,logflare,vector,supavisor,edge-runtime \
 > "$LOCAL_RUN_DIR/start.log" 2>&1
"$cli" --workdir "$LOCAL_RUN_DIR/stack" status -o json > "$LOCAL_RUN_DIR/status.json" 2> "$LOCAL_RUN_DIR/status.log"
cat > "$LOCAL_RUN_DIR/functions.env" <<'ENV'
NPM_CONFIG_REGISTRY=http://dependency-cache:4873/
ENV
"$cli" --workdir "$LOCAL_RUN_DIR/stack" --network-id "$private" functions serve \
 --env-file "$LOCAL_RUN_DIR/functions.env" --import-map "$functions/import_map.json" --no-verify-jwt \
 > "$LOCAL_RUN_DIR/edge.log" 2>&1 &
printf '%s\n' "$!" > "$LOCAL_RUN_DIR/serve.pid"
node_run() {
 local phase="$1"; shift
 docker run --rm --user "$(id -u):$(id -g)" --network "$private" --cap-drop ALL \
  --security-opt no-new-privileges --read-only --tmpfs /tmp \
  -e HTTP_PROXY= -e HTTPS_PROXY= -e ALL_PROXY= -e NO_PROXY=kong,auth,rest,db \
  -v "$HARNESS_DIR:/harness:ro" -v "$SOURCE_DIR:/source:ro" \
  -v "$LOCAL_RUN_DIR/results:/results" "$@" "$node_image" \
  node --experimental-strip-types --import /harness/test-register.mjs /harness/suite.mjs "$phase"
}
# Require the ORIGINAL handler's no-store 401, not a gateway OPTIONS response.
# No Auth user exists and no application JWT is passed during cache warmup.
warmed=false
for attempt in 1 2 3; do
 if node_run warm -v "$LOCAL_RUN_DIR/status.json:/status.json:ro"; then warmed=true; break; fi
 sleep 2
done
test "$warmed" = true
# Already sealed from the start. Keep the read-only, internal artifact mirror
# for worker restarts; it cannot access the Internet or serve unknown packages.
python3 "$HARNESS_DIR/assert-network.py" "$project" "$private" "$LOCAL_RUN_DIR"
node_run users -v "$LOCAL_RUN_DIR/status.json:/status.json:ro"
cp "$LOCAL_RUN_DIR/results/accounts.local.json" "$LOCAL_RUN_DIR/users.json"
read -r actor_a actor_b < <(python3 - "$LOCAL_RUN_DIR/users.json" <<'PY'
import json,re,sys
accounts=json.load(open(sys.argv[1]))['accounts']
assert len(accounts)==2
ids=[a['id'] for a in accounts]
assert all(re.fullmatch(r'[a-f0-9-]{36}',v) for v in ids) and ids[0]!=ids[1]
print(*ids)
PY
)
db="supabase_db_${project}"
sql() { docker exec -i -e PGOPTIONS='-c amanahlife.local_test=approved' "$db" psql -X -U postgres -d postgres -At -v ON_ERROR_STOP=1 "$@"; }
sql -f - < "$HARNESS_DIR/setup.sql" > "$LOCAL_RUN_DIR/schema.log"
sql -v actor_a="$actor_a" -v actor_b="$actor_b" -f - > "$LOCAL_RUN_DIR/seed.log" <<'SQL'
insert into public.app_11941c8fec_notification_preferences(user_id,bill_reminders,last_suhoor_sent_date)
 values(:'actor_a',false,date '2026-01-01');
insert into public.app_11941c8fec_push_subscriptions(user_id,endpoint,p256dh,auth_key) values
 (:'actor_a','https://a.example.invalid/push','synthetic-not-a-key-A','synthetic-not-a-key-A'),
 (:'actor_b','https://b.example.invalid/push','synthetic-not-a-key-B','synthetic-not-a-key-B');
SQL
fingerprint() {
 sql -v actor_a="$actor_a" -f - <<'SQL'
select md5(jsonb_build_object('all',(select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_notification_preferences p),
 'push',(select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_push_subscriptions p))::text);
SQL
}
fingerprint > "$LOCAL_RUN_DIR/before.hash"
sql -f - > "$LOCAL_RUN_DIR/baseline.log" <<'SQL'
begin;
set local role anon;
do $$ begin
 if (select count(*) from public.app_11941c8fec_notification_preferences)<>1
  or not has_table_privilege('anon','public.app_11941c8fec_push_subscriptions','TRUNCATE')
 then raise exception 'Unsafe production baseline was not reproduced'; end if;
end $$;
update public.app_11941c8fec_notification_preferences set general_activity=false;
truncate public.app_11941c8fec_push_subscriptions;
do $$ begin if (select count(*) from public.app_11941c8fec_push_subscriptions)<>0 then raise exception 'Baseline TRUNCATE failed'; end if; end $$;
rollback;
SQL
fingerprint > "$LOCAL_RUN_DIR/after.hash"
cmp "$LOCAL_RUN_DIR/before.hash" "$LOCAL_RUN_DIR/after.hash"
for repeat in 1 2; do
 sql -f - < "$SOURCE_DIR/app/frontend/supabase/migrations/202610180007_notification_table_authority.sql" > "$LOCAL_RUN_DIR/migration-${repeat}.log"
 fingerprint > "$LOCAL_RUN_DIR/after.hash"
 cmp "$LOCAL_RUN_DIR/before.hash" "$LOCAL_RUN_DIR/after.hash"
done
# Sentinel is on a DIFFERENT Docker network, never a production endpoint.
docker run -d --name "${project}-canary" --network bridge --cap-drop ALL --read-only "$node_image" \
 node -e 'const http=require("http");let hits=0;http.createServer((q,s)=>{if(q.url==="/probe")hits++;s.end(String(hits))}).listen(8080,"0.0.0.0")' >/dev/null
canary_ip="$(docker inspect --format '{{(index .NetworkSettings.Networks "bridge").IPAddress}}' "${project}-canary")"
canary_ready=false
for attempt in 1 2 3 4 5; do
 if docker exec "${project}-canary" node -e 'fetch("http://127.0.0.1:8080/count").then(r=>r.text()).then(t=>{if(t!=="0")process.exit(1)}).catch(()=>process.exit(1))'; then canary_ready=true; break; fi
 sleep 1
done
test "$canary_ready" = true
# Positive control: another bridge container must reach this fake server.
docker run --rm --network bridge --cap-drop ALL --read-only "$node_image" \
 node -e 'fetch(process.argv[1]+"/count").then(r=>r.text()).then(t=>{if(t!=="0")process.exit(1)}).catch(()=>process.exit(1))' "http://${canary_ip}:8080"
node_run network -v "$LOCAL_RUN_DIR/users.json:/users.json:ro" -e "EGRESS_CANARY=http://${canary_ip}:8080/probe"
# Probe the actual network namespace of EVERY native service, including Edge.
# No service credentials or Docker socket are mounted in these helper clients.
for service in db auth rest kong edge_runtime; do
 docker run --rm --network "container:supabase_${service}_${project}" --cap-drop ALL --read-only "$node_image" \
  node --input-type=module -e 'let blocked=false;try{await fetch(process.argv[1],{signal:AbortSignal.timeout(2000)})}catch{blocked=true}if(!blocked)process.exit(1)' \
  "http://${canary_ip}:8080/probe"
done
# The host may inspect the fake canary, not production. /probe was unreachable.
hits="$(docker exec "${project}-canary" node -e 'fetch("http://127.0.0.1:8080/count").then(r=>r.text()).then(console.log)')"
test "$hits" = 0
python3 "$HARNESS_DIR/assert-network.py" "$project" "$private" "$LOCAL_RUN_DIR"
internal_hash() {
 sql -v actor_a="$actor_a" -f - <<'SQL'
select md5(jsonb_build_object('a',(select jsonb_build_array(id,user_id,created_at,updated_at,last_suhoor_sent_date,last_iftar_sent_date)
 from public.app_11941c8fec_notification_preferences where user_id=:'actor_a'),
 'push',(select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_push_subscriptions p))::text);
SQL
}
internal_hash > "$LOCAL_RUN_DIR/internal-before.hash"
node_run client -v "$LOCAL_RUN_DIR/users.json:/users.json:ro"
internal_hash > "$LOCAL_RUN_DIR/internal-after.hash"
cmp "$LOCAL_RUN_DIR/internal-before.hash" "$LOCAL_RUN_DIR/internal-after.hash"
# Database-only fields/defaults of B cannot be checked with the user client.
sql -v actor_b="$actor_b" -f - > "$LOCAL_RUN_DIR/defaults.log" <<'SQL'
do $$ begin if (select count(*) from public.app_11941c8fec_notification_preferences)<>2 then raise exception 'Unexpected row count'; end if; end $$;
select case when id is not null and created_at=updated_at and last_suhoor_sent_date is null and last_iftar_sent_date is null
 and prayer_reminders=true and fasting_reminders=true and savings_reminders=true and general_activity=true
 and bill_reminders=false and habit_reminders=false then 'B defaults: PASS' else 'B defaults: FAIL' end
 from public.app_11941c8fec_notification_preferences where user_id=:'actor_b';
SQL
grep -qx 'B defaults: PASS' "$LOCAL_RUN_DIR/defaults.log"
node_run edge -v "$LOCAL_RUN_DIR/users.json:/users.json:ro"
sql -v actor_a="$actor_a" -v actor_b="$actor_b" -f - > "$LOCAL_RUN_DIR/markers.log" <<'SQL'
select case when last_suhoor_sent_date=date '2026-01-01' and last_iftar_sent_date is null and bill_reminders=false and savings_reminders=false
 then 'A markers: PASS' else 'A markers: FAIL' end from public.app_11941c8fec_notification_preferences where user_id=:'actor_a';
SQL
grep -qx 'A markers: PASS' "$LOCAL_RUN_DIR/markers.log"
# Relevant existing regression tests run offline inside the SAME sealed network.
for test_file in notification-preferences.test.mjs notification-preference-client.test.mjs notification-backup.test.mjs notification-preference-write.test.mjs; do
 docker run --rm --user "$(id -u):$(id -g)" --network "$private" --cap-drop ALL --read-only --tmpfs /tmp \
  -v "$SOURCE_DIR:/source:ro" -v "$HARNESS_DIR:/harness:ro" -w /source/app/frontend "$node_image" \
  node --experimental-strip-types --import /harness/test-register.mjs --import ./tests/deny-network.mjs "tests/$test_file" \
  > "$LOCAL_RUN_DIR/regression-${test_file}.log" 2>&1
 python3 "$HARNESS_DIR/verify-test-log.py" "$test_file" "$LOCAL_RUN_DIR/regression-${test_file}.log"
done
sql -v actor_a="$actor_a" -v actor_b="$actor_b" -f - > "$LOCAL_RUN_DIR/delete-fixture.log" <<'SQL'
delete from public.app_11941c8fec_push_subscriptions where user_id in (:'actor_a',:'actor_b');
delete from public.app_11941c8fec_notification_preferences where user_id in (:'actor_a',:'actor_b');
SQL
node_run cleanup -v "$LOCAL_RUN_DIR/users.json:/users.json:ro" -v "$LOCAL_RUN_DIR/status.json:/status.json:ro"
printf 'all-local-steps-completed\n' > "$LOCAL_RUN_DIR/completed"
python3 "$HARNESS_DIR/summarize.py" "$LOCAL_RUN_DIR"
