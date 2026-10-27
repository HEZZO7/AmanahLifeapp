"""SQL component probe only: no native Auth/JWT and no production connection.

Fresh PostgreSQL 17, network none, no published ports, tmpfs data, dropped
capabilities and no-new-privileges. A minimal synthetic Auth schema is confined
to this component probe; it never replaces Auth in the mandatory native suite.
Only fixed codes/counts/booleans leave private subprocess buffers.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time

REPO = Path(__file__).resolve().parents[2]
PACKAGE = REPO / 'app/frontend/tests/subscription-009-local'
SOURCE = 'e6dd3fc5e014ea0539df8da12a6ee84582b302b9'
STAGES = ['subscriptions', 'search_history', 'email_digest', 'notification_preferences', 'push_subscriptions', 'auth']


def main():
    manifest = json.loads((PACKAGE / 'source-manifest.json').read_text())
    assert manifest['sourceCommit'] == SOURCE
    for file, hashes in manifest['files'].items():
        raw = (REPO / file).read_bytes()
        assert raw == subprocess.check_output(['git', '-C', str(REPO), 'show', SOURCE + ':' + file])
        assert hashlib.sha256(raw).hexdigest() == hashes['sha256']
        assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == hashes['gitBlob']
    for file, expected in manifest['packageFiles'].items():
        assert hashlib.sha256((PACKAGE / file).read_bytes()).hexdigest() == expected
    env = dict(os.environ)
    for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
        env.pop(key, None)
    base = ['docker', '--host=unix:///var/run/docker.sock']
    label = 'amanah009.rollback-repro=' + secrets.token_hex(12)

    def run(args, text=None):
        return subprocess.run(base + args, env=env, input=text, capture_output=True, text=True, timeout=30)

    def checked(args):
        result = run(args)
        assert result.returncode == 0, 'Owned component command failed'
        return result.stdout.strip()

    proof = {'nativeAuthExecuted': False, 'network': 'none', 'sourceVerified': True}
    cid = None
    try:
        cid = checked(['run', '-d', '--label', label, '--network', 'none', '--cap-drop', 'ALL',
                       '--security-opt', 'no-new-privileges', '--user', 'postgres',
                       '--tmpfs', '/var/lib/postgresql/data:rw,uid=999,gid=999,mode=0700',
                       '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17',
                       '-c', 'listen_addresses=', '-c', 'log_statement=none'])
        assert re.fullmatch('[a-f0-9]{64}', cid)
        deadline = time.monotonic() + 15
        while run(['exec', cid, 'pg_isready', '-U', 'postgres']).returncode:
            assert time.monotonic() < deadline, 'Owned component readiness failed'
            time.sleep(0.2)

        def sql(text, required=True):
            result = run(['exec', '-i', '-e', 'PGOPTIONS=-c amanahlife.local_test=approved -c amanahlife.security_fixture=isolated',
                          cid, 'psql', '-XqAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], text)
            if required:
                assert result.returncode == 0, 'Owned component SQL failed'
            return result

        def snapshot(user):
            pairs = ["'auth',(select to_jsonb(u) from auth.users u where id='" + user + "')"]
            pairs += ["'" + t + "',coalesce((select jsonb_agg(to_jsonb(t) order by id) from public.app_11941c8fec_" + t + " t where user_id='" + user + "'),'[]'::jsonb)" for t in STAGES[:-1]]
            return json.loads(sql('select jsonb_build_object(' + ','.join(pairs) + ');').stdout)

        sql("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;"
            "create schema auth;create table auth.users(id uuid primary key,email text);"
            "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;"
            "create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;"
            "grant usage on schema auth,public to anon,authenticated,service_role;")
        sql((PACKAGE / 'fixture.sql').read_text())
        for file in manifest['migrationOrder']:
            sql((REPO / file).read_text())
        sql("insert into public.app_11941c8fec_payment_environment(singleton,mode) values(true,'test');")
        user = '10000000-0000-4000-8000-000000000001'
        sql(f"insert into auth.users(id) values('{user}');insert into public.app_11941c8fec_subscriptions(user_id,trial_used) values('{user}',true);" +
            ''.join(f"insert into public.app_11941c8fec_{t}(user_id,marker) values('{user}','synthetic-private');" for t in STAGES[1:-1]))
        before = snapshot(user)
        for stage in STAGES:
            table = 'auth.users' if stage == 'auth' else 'public.app_11941c8fec_' + stage
            sql(f'create trigger zz_fixture_009_failure after delete on {table} for each row execute function public.fixture_009_after_cleanup_failure();')
        proof['faults'] = []
        for index, stage in enumerate(STAGES, 1):
            sql(f"insert into public.fixture_009_faults values('{user}','{stage}') on conflict(target) do update set phase=excluded.phase;")
            result = sql(f"delete from auth.users where id='{user}';", False)
            state = re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5})', result.stderr)
            count = int(sql('select case when is_called then last_value else 0 end from public.fixture_009_witness;').stdout.strip())
            assert result.returncode != 0 and state and state[1] == 'ZX009'
            assert count == index and snapshot(user) == before
            proof['faults'].append({'phase': stage, 'expectedFault': True, 'witnessIncrementedOnce': True, 'completeAccountPreserved': True})
        sql(f"delete from public.fixture_009_faults where target='{user}';")
        assert sql('select count(*) from public.fixture_009_faults;').stdout.strip() == '0'
        proof['faultConfigurationCleared'] = True
        # A fresh control connection succeeds after all six aborted statements.
        assert sql('select 1;').stdout.strip() == '1'
        assert sql('select count(*) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid();').stdout.strip() == '0'
        proof['freshConnectionPassed'] = True
        proof['noOtherDatabaseSessions'] = True
    finally:
        owned = checked(['ps', '-aq', '--no-trunc', '--filter', 'label=' + label]).split()
        for owned_id in owned:
            assert re.fullmatch('[a-f0-9]{64}', owned_id)
            inspected = json.loads(checked(['inspect', '--format', '{{json .}}', owned_id]))
            assert inspected['Id'] == owned_id and inspected['Config']['Labels'].get(label.split('=')[0]) == label.split('=')[1]
            assert inspected['HostConfig']['NetworkMode'] == 'none' and not inspected['HostConfig']['PortBindings']
            assert inspected['HostConfig']['CapDrop'] == ['ALL']
            assert any(option.startswith('no-new-privileges') for option in inspected['HostConfig']['SecurityOpt'])
            volumes = [m['Name'] for m in inspected['Mounts'] if m['Type'] == 'volume']
            checked(['rm', '-f', '-v', owned_id])
            assert all(run(['volume', 'inspect', volume]).returncode != 0 for volume in volumes)
        assert not checked(['ps', '-aq', '--filter', 'label=' + label])
        proof['ownedResourcesRemoved'] = True
    print(json.dumps(proof))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Never print captured PostgreSQL output or exception values.
        print(json.dumps({'componentProbe': 'failed', 'nativeAuthExecuted': False}))
        raise SystemExit(1)
