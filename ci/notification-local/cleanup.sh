#!/usr/bin/env bash
# Can remove ONLY resources bearing this run's random disposable project ID.
set -euo pipefail
root="${1:?}"
python3 - "$root" "${RUNNER_TEMP:?}" <<'PY'
from pathlib import Path
import re,sys
root=Path(sys.argv[1]); base=Path(sys.argv[2]).resolve()
assert not root.is_symlink() and root.resolve().parent==base
assert re.fullmatch(r'amanahlife-local-[0-9]+-[0-9]+',root.name)
PY
if [ ! -f "$root/project" ]; then exit 0; fi
project="$(cat "$root/project")"
[[ "$project" =~ ^amanah-local-[0-9]+-[0-9]+$ ]]
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
cleanup_failed=0
if [ -f "$root/serve.pid" ]; then
 python3 - "$root" <<'PY'
import os,signal,sys
from pathlib import Path
root=Path(sys.argv[1]); pid=int((root/'serve.pid').read_text())
try:
 args=Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
 if str(root/'bin/supabase').encode() in args:os.kill(pid,signal.SIGTERM)
except (OSError,ValueError):pass
PY
fi
if [ -x "$root/bin/supabase" ] && [ -f "$root/stack/supabase/config.toml" ]; then
 "$root/bin/supabase" --workdir "$root/stack" stop --no-backup > "$root/stop.log" 2>&1 || cleanup_failed=1
fi
# No --all; no unrelated containers, networks, projects, volumes or daemon changes.
for suffix in cache canary; do
 if docker container inspect "${project}-${suffix}" >/dev/null 2>&1; then
  docker rm -f "${project}-${suffix}" >/dev/null 2>&1 || cleanup_failed=1
 fi
done
network="${project}-private"
if docker network inspect "$network" >/dev/null 2>&1; then
 docker network rm "$network" >/dev/null 2>&1 || cleanup_failed=1
fi
remaining="$(docker ps -aq --filter "label=com.supabase.cli.project=${project}")" || cleanup_failed=1
test -z "$remaining" || cleanup_failed=1
volumes="$(docker volume ls -q --filter "name=${project}")" || cleanup_failed=1
test -z "$volumes" || cleanup_failed=1
rm -f "$root/status.json" "$root/users.json" "$root/results/accounts.local.json" "$root/functions.env"
# Native local database/keys disappear with this disposable stack and volumes.
# No artifacts/cache are uploaded; the ephemeral runner removes the other files.
if [ "$cleanup_failed" -ne 0 ]; then
 printf 'FAIL: disposable stack teardown incomplete; raw logs withheld\n' >&2
 exit 1
fi
printf 'disposable-stack-removed\n' > "$root/teardown-completed"
