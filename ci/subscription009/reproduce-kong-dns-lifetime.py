"""Kong-only static-host lifetime A/B probe; no native Auth/DB/provider service.

Requires kong:2.8.1 and node:24.19.0-bookworm-slim. All containers share only
an owned network-none namespace, no host ports, dropped capabilities and NNP.
The generic HTTP-500 upstream is a routing control, not a replacement Auth test.
Only closed status/header/log classifications leave memory; resources are removed.
"""
import pathlib, subprocess, tempfile, secrets, json, time, re, os
PACKAGE = pathlib.Path(__file__).resolve().parents[2] / 'app/frontend/tests/subscription-009-local'
HOST_TTL = int(re.search('export const GATEWAY_HOST_TTL=([0-9]+);', (PACKAGE / 'safety.mjs').read_text())[1])
assert HOST_TTL == 315360000

def main():
    base = ['docker', '--host=unix:///var/run/docker.sock']
    label = 'amanah009.gateway-runtime=' + secrets.token_hex(10)
    cid = None
    phase = 'setup'
    env = dict(os.environ)
    for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
        env.pop(key, None)

    def run(args, text=None, timeout=30):
        return subprocess.run(base + args, input=text, text=True, capture_output=True, env=env, timeout=timeout)

    def checked(args):
        r = run(args)
        assert r.returncode == 0
        return r.stdout.strip()
    proof = {'nativeAuthExecuted': False, 'databaseStarted': False, 'network': 'none'}
    try:
        with tempfile.TemporaryDirectory(prefix='amanah009-kong-runtime-') as d:
            p = pathlib.Path(d) / 'gateway.yml'
            p.write_text('_format_version: "2.1"\nservices:\n- name: stable\n  url: http://owned-probe.invalid:8001/\n  routes:\n  - name: stable\n    paths: ["/probe"]\n- name: missing\n  url: http://unresolved-probe.invalid:8001/\n  routes:\n  - name: missing\n    paths: ["/auth/v1/admin/users", "/auth/v1/user"]\n- name: refused\n  url: http://127.0.0.1:9/\n  routes:\n  - name: refused\n    paths: ["/rest/v1/rpc/app_11941c8fec_account_deletion_allowed"]\n- name: server-error\n  url: http://127.0.0.1:9000/\n  routes:\n  - name: server-error\n    paths: ["/upstream-error"]\n')
            p.chmod(292)
            args = ['create', '--label', label, '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--mount', 'type=bind,src=' + str(p) + ',dst=/tmp/probe.yml,readonly']
            settings = {'KONG_DATABASE': 'off', 'KONG_DECLARATIVE_CONFIG': '/tmp/probe.yml', 'KONG_PREFIX': '/tmp/owned-kong', 'KONG_PROXY_LISTEN': '127.0.0.1:8000', 'KONG_ADMIN_LISTEN': '127.0.0.1:8001', 'KONG_ANONYMOUS_REPORTS': 'off', 'KONG_DNS_RESOLVER': '127.0.0.1:9', 'KONG_DNS_ORDER': 'LAST,A,CNAME', 'KONG_DNS_VALID_TTL': '1', 'KONG_NGINX_WORKER_PROCESSES': '2', 'KONG_PROXY_ERROR_LOG': '/dev/stderr', 'KONG_PROXY_ACCESS_LOG': 'off', 'KONG_ADMIN_ACCESS_LOG': 'off'}
            for key, value in settings.items():
                args += ['-e', key + '=' + value]
            cid = checked(args + ['kong:2.8.1'])
            checked(['start', cid])
            phase = 'health'
            deadline = time.monotonic() + 30
            while run(['exec', cid, 'kong', 'health']).returncode:
                assert time.monotonic() < deadline
                time.sleep(0.2)
            pid = checked(['inspect', '--format', '{{.State.Pid}}', cid])

            def client(script):
                r = run(['run', '--rm', '--label', label, '--network', 'container:' + cid, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', 'node', '--read-only', '-i', 'node:24.19.0-bookworm-slim', 'node', '--input-type=module'], script)
                assert r.returncode == 0
                return json.loads(r.stdout)
            get = "async function request(path,method='GET'){const r=await fetch('http://127.0.0.1:8000'+path,{method,signal:AbortSignal.timeout(20000)});await r.arrayBuffer();const n=k=>/^[0-9]+$/.test(r.headers.get(k)??'');return{status:r.status,responseLatency:n('x-kong-response-latency'),upstreamLatency:n('x-kong-upstream-latency')};} "
            phase = 'before'
            proof['beforeAlias'] = client(get + "console.log(JSON.stringify(await request('/probe')));")
            checked(['exec', '--user', '0', cid, 'sh', '-c', "printf '\\n127.0.0.1 owned-probe.invalid\\n' >> /etc/hosts"])
            checked(['exec', cid, 'kong', 'reload'])
            time.sleep(0.5)
            phase = 'stable'
            proof['persistentResolution'] = client(get + "const out=[];for(let i=0;i<30;i++){out.push(await request('/probe'));await new Promise(r=>setTimeout(r,100));}await new Promise(r=>setTimeout(r,2500));out.push(await request('/probe'));console.log(JSON.stringify({requests:out.length,passed:out.filter(r=>r.status===200).length,failed:out.filter(r=>r.status!==200).length,firstStatus:out[0].status,lastStatus:out.at(-1).status,validTtlSeconds:1,elapsedBeyondTtl:true}));")
            hosts_before = checked(['exec', cid, 'sha256sum', '/etc/hosts']).split()[0]
            phase = 'corrected_reload'
            checked(['exec', '-e', 'KONG_DNS_VALID_TTL=' + str(HOST_TTL), cid, 'kong', 'reload'])
            time.sleep(0.5)
            proof['correctedResolution'] = client(get + "const out=[];for(let i=0;i<30;i++){out.push(await request('/probe'));await new Promise(r=>setTimeout(r,100));}await new Promise(r=>setTimeout(r,2500));out.push(await request('/probe'));console.log(JSON.stringify({requests:out.length,passed:out.filter(r=>r.status===200).length,failed:out.filter(r=>r.status!==200).length,firstStatus:out[0].status,lastStatus:out.at(-1).status,validTtlSeconds:315360000,elapsedBeyondOriginalTtl:true}));")
            proof['hostsFileUnchangedAcrossCorrection'] = hosts_before == checked(['exec', cid, 'sha256sum', '/etc/hosts']).split()[0]
            phase = 'server'
            server = checked(['run', '-d', '--label', label, '--network', 'container:' + cid, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', 'node', '--read-only', 'node:24.19.0-bookworm-slim', 'node', '--input-type=module', '-e', "import http from 'node:http';http.createServer((req,res)=>{res.statusCode=500;res.end('{}')}).listen(9000,'127.0.0.1');"])
            time.sleep(0.3)
            phase = 'upstream'
            proof['upstream500'] = client(get + "console.log(JSON.stringify(await request('/upstream-error')));")
            phase = 'dns'
            proof['dns500'] = client(get + "console.log(JSON.stringify(await request('/auth/v1/admin/users','POST')));")
            phase = 'refused'
            proof['connect502'] = client(get + "console.log(JSON.stringify(await request('/rest/v1/rpc/app_11941c8fec_account_deletion_allowed','POST')));")
            logs = run(['logs', '--tail', '64', cid])
            assert logs.returncode == 0
            raw = logs.stdout + '\n' + logs.stderr
            proof['gatewayLogSignals'] = {'dnsMessage': bool(re.search('DNS resolution failed|dns client error|name error', raw, re.I)), 'connectMessage': 'connect() failed' in raw, 'requestMarker': 'request: "POST /auth/v1/admin/users HTTP/' in raw, 'nginxError': '[error]' in raw}
            classify = "import fs from 'node:fs';import {classifyGatewayLogs}from " + json.dumps(str(PACKAGE / 'safety.mjs')) + ";const raw=fs.readFileSync(0,'utf8');console.log(JSON.stringify({auth:classifyGatewayLogs(raw,'auth_create'),billing:classifyGatewayLogs(raw,'billing_policy')}));"
            result = subprocess.run(['node', '--input-type=module', '-e', classify], input=raw, text=True, capture_output=True, timeout=5)
            assert result.returncode == 0
            proof['gatewayLogClasses'] = json.loads(result.stdout)
            assert proof['gatewayLogClasses'] == {'auth': 'gateway_dns_failure', 'billing': 'upstream_connect_failure'}
            assert proof['persistentResolution']['passed'] > 0 and proof['persistentResolution']['failed'] > 0 and (proof['persistentResolution']['lastStatus'] == 500)
            assert proof['correctedResolution']['passed'] == 31 and proof['correctedResolution']['failed'] == 0
            assert proof['hostsFileUnchangedAcrossCorrection']
            assert proof['dns500'] == {'status': 500, 'responseLatency': True, 'upstreamLatency': False}
            assert proof['upstream500'] == {'status': 500, 'responseLatency': False, 'upstreamLatency': True}
            assert proof['connect502'] == {'status': 502, 'responseLatency': False, 'upstreamLatency': True}
            proof['containerPidUnchanged'] = checked(['inspect', '--format', '{{.State.Pid}}', cid]) == pid
            proof['imageDigest'] = json.loads(checked(['image', 'inspect', '--format', '{{json .RepoDigests}}', 'kong:2.8.1']))[0]
    finally:
        for item in checked(['ps', '-aq', '--no-trunc', '--filter', 'label=' + label]).split():
            view = json.loads(checked(['inspect', item]))[0]
            assert view['Config']['Labels'].get('amanah009.gateway-runtime') == label.split('=')[1]
            volumes = [m['Name'] for m in view['Mounts'] if m['Type'] == 'volume']
            checked(['rm', '-f', '-v', item])
            assert all((run(['volume', 'inspect', v]).returncode for v in volumes))
        assert not checked(['ps', '-aq', '--filter', 'label=' + label])
        proof['ownedResourcesRemoved'] = True
    assert proof['containerPidUnchanged']
    print(json.dumps(proof))
if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'componentProbe': 'failed', 'nativeAuthExecuted': False}))
        raise SystemExit(1)
