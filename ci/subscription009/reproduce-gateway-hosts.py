"""Standalone Kong DNS-cache micro-test; no Supabase/Auth/database service.

Requires local Docker and kong:2.8.1/postgres:17 images. The latter supplies only
Bash for loopback HTTP; its PostgreSQL entrypoint is never run. This is not one
of the 21 native groups. No host ports, external network, secrets or live data.
"""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import time


def main():
    env = dict(os.environ)
    for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
        env.pop(key, None)
    base = ['docker', '--host=unix:///var/run/docker.sock']
    label = 'amanah009.gateway-repro=' + secrets.token_hex(12)

    def run(args, timeout=30):
        return subprocess.run(base + args, env=env, capture_output=True, text=True, timeout=timeout)

    def checked(args):
        result = run(args)
        assert result.returncode == 0
        return result.stdout.strip()

    proof = dict(nativeAuthExecuted=False, databaseStarted=False, networkMode='none',
                 capabilitiesDropped=True, noNewPrivileges=True)
    cid = None
    volumes = []
    with tempfile.TemporaryDirectory(prefix='amanah009-gateway-repro-') as temporary:
        config = Path(temporary, 'gateway.yml')
        config.write_text('_format_version: "2.1"\nservices:\n- name: owned-dns-probe\n'
                          '  url: http://owned-dns-probe.invalid:8001/\n  routes:\n'
                          '  - name: owned-dns-probe\n    paths: ["/probe"]\n    strip_path: true\n')
        config.chmod(0o444)  # Read-only synthetic config readable by Kong's UID.

        def http():
            command = ("exec 3<>/dev/tcp/127.0.0.1/8000; "
                       "printf 'GET /probe HTTP/1.1\\r\\nHost: owned-probe\\r\\nConnection: close\\r\\n\\r\\n' >&3; "
                       "head -c 8192 <&3")
            response = checked(['run', '--rm', '--label', label, '--network', 'container:' + cid,
                                '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                                '--entrypoint', '/bin/bash', 'postgres:17', '-c', command])
            lines = response.splitlines()
            headers = {}
            for line in lines[1:]:
                if not line.strip():
                    break
                if ':' in line:
                    key, value = line.split(':', 1)
                    headers[key.lower()] = value.strip()
            # Discard the response body and all raw header values.
            return dict(status=int(lines[0].split()[1]),
                        kongResponseLatency=bool(re.fullmatch('[0-9]+', headers.get('x-kong-response-latency', ''))),
                        kongUpstreamLatency=bool(re.fullmatch('[0-9]+', headers.get('x-kong-upstream-latency', ''))))

        try:
            args = ['create', '--label', label, '--network', 'none', '--cap-drop', 'ALL',
                    '--security-opt', 'no-new-privileges', '--mount',
                    'type=bind,src=' + str(config) + ',dst=/tmp/owned-gateway.yml,readonly']
            settings = dict(KONG_DATABASE='off', KONG_DECLARATIVE_CONFIG='/tmp/owned-gateway.yml',
                            KONG_PREFIX='/tmp/owned-kong', KONG_PROXY_LISTEN='127.0.0.1:8000',
                            KONG_ADMIN_LISTEN='127.0.0.1:8001', KONG_ANONYMOUS_REPORTS='off',
                            KONG_DNS_RESOLVER='127.0.0.1:9', KONG_DNS_RETRANS='1',
                            KONG_DNS_TIMEOUT='1000', KONG_DNS_ORDER='LAST,A')
            for key, value in settings.items():
                args += ['-e', key + '=' + value]
            cid = checked(args + ['kong:2.8.1'])
            assert re.fullmatch('[a-f0-9]{64}', cid)
            checked(['start', cid])
            deadline = time.monotonic() + 30
            while run(['exec', cid, 'kong', 'health']).returncode != 0:
                assert checked(['inspect', '--format', '{{.State.Running}}', cid]) == 'true'
                assert time.monotonic() < deadline
                time.sleep(.2)
            before = checked(['inspect', '--format', '{{.State.Pid}}', cid])
            proof['beforeAppend'] = http()
            checked(['exec', '--user', '0', cid, 'sh', '-c',
                     "printf '\\n127.0.0.1 owned-dns-probe.invalid\\n' >> /etc/hosts"])
            proof['afterAppendWithoutReload'] = http()
            checked(['exec', cid, 'kong', 'reload'])
            time.sleep(.5)  # Micro-test only: wait for asynchronous Nginx reload.
            proof['afterReload'] = http()
            proof['containerPidUnchanged'] = before == checked(['inspect', '--format', '{{.State.Pid}}', cid])
            assert proof['beforeAppend']['status'] >= 500
            assert proof['afterAppendWithoutReload']['status'] >= 500
            assert proof['afterReload']['status'] == 200 and proof['containerPidUnchanged']
            proof['hostsSnapshotDefectReproduced'] = True
        finally:
            # Every removable resource must carry this invocation's private label.
            owned = checked(['ps', '-aq', '--filter', 'label=' + label]).split()
            for container in owned:
                assert re.fullmatch('[a-f0-9]{64}', checked(['inspect', '--format', '{{.Id}}', container]))
                mounts = json.loads(checked(['inspect', '--format', '{{json .Mounts}}', container]))
                volumes += [mount['Name'] for mount in mounts if mount['Type'] == 'volume']
                checked(['rm', '-f', '-v', container])
            assert not checked(['ps', '-aq', '--filter', 'label=' + label])
            for volume in volumes:
                assert run(['volume', 'inspect', volume]).returncode != 0
            proof['ownedContainerAndAnonymousVolumesRemoved'] = True
    print(json.dumps(proof))


if __name__ == '__main__':
    main()
