"""Disposable network-none SDK transport probe; no Auth/DB/provider service.

Requires the exact local node:24.19.0-bookworm-slim image and locked package
node_modules. Publishes only closed classifications; never SDK messages/bodies.
This component probe does not execute or replace any of the 21 native groups.
"""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess

PACKAGE = Path(__file__).resolve().parents[2] / 'app/frontend/tests/subscription-009-local'
IMAGE = 'node:24.19.0-bookworm-slim'
STAGE = 'setup'
SCRIPT = r'''
import assert from 'node:assert/strict';
import {createClient} from '/package/node_modules/@supabase/supabase-js/dist/index.mjs';
import {API_ORIGIN,trafficGuard,checkedBillingPolicy,throwIfDatabaseInfrastructure,nativeStage,nativeFailureDetails} from '/package/safety.mjs';
assert.equal(process.version,'v24.19.0');
const guard=trafficGuard(globalThis.fetch);
const client=createClient(API_ORIGIN,'synthetic-public-test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:guard.fetch}});
let response,proof;
try{
 await nativeStage('billing_history_retention','billing_policy',()=>checkedBillingPolicy(async observe=>{
  response=await client.rpc('app_11941c8fec_account_deletion_allowed');observe(response);
  throwIfDatabaseInfrastructure(response.error);assert.equal(response.data,false);
 },()=>guard.state.calls));
 assert.fail('Loopback connection must fail in this fresh empty container');
}catch(error){
 assert.equal(response.status,0);assert.equal(response.error.code,'');
 assert.equal(guard.state.calls.length,1);assert.equal(guard.state.rejected,0);
 assert.equal(guard.state.calls[0].transport,'connection_refused');
 assert.equal(error.category,'database_connection_failed');assert.equal(error.rpcErrorKind,'missing_code');
 proof={nativeAuthExecuted:false,databaseStarted:false,providerCalled:false,node:process.version,sdk:'2.110.0',requests:guard.state.calls.length,
   sdkStatusAbsent:true,sdkErrorCodeEmpty:true,category:error.category,...nativeFailureDetails(error,'billing_history_retention')};
}
console.log(JSON.stringify(proof));
'''


def main():
    global STAGE
    env = dict(os.environ)
    for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
        env.pop(key, None)
    base = ['docker', '--host=unix:///var/run/docker.sock']
    label = 'amanah009.transport-probe=' + secrets.token_hex(12)

    def run(args, text=None):
        return subprocess.run(base + args, env=env, input=text, text=True, capture_output=True, timeout=30)

    def checked(args):
        result = run(args)
        assert result.returncode == 0, 'Owned component command failed'
        return result.stdout.strip()

    try:
        STAGE='sdk_run'
        result = run(['run', '--rm', '--label', label, '--network', 'none', '--cap-drop', 'ALL',
                      '--security-opt', 'no-new-privileges', '--user', 'node', '--read-only',
                      '--mount', 'type=bind,src=' + str(PACKAGE) + ',dst=/package,readonly',
                      '-i', IMAGE, 'node', '--input-type=module'], SCRIPT)
        if result.returncode:
            # Only the controlled component's fixed failure identifiers are exposed.
            match=re.search(r'(ERR_MODULE_NOT_FOUND|ERR_ASSERTION|ERR_ACCESS_DENIED)',result.stderr)
            print(json.dumps({'componentFailureKind':match[1] if match else 'unclassified'}))
            raise RuntimeError('Transport component probe failed')
        STAGE='sdk_json'
        proof = json.loads(result.stdout)
        # Verify the real Docker inspect template against an owned, never-started container.
        STAGE='inspect_create'
        cid = checked(['create', '--label', label, '--label', 'com.supabase.cli.project=component-probe', '--network', 'none',
                       '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', 'node', '--read-only', IMAGE, 'node', '--version'])
        assert re.fullmatch('[a-f0-9]{64}', cid)
        runtime = (PACKAGE / 'local-runtime.mjs').read_text()
        section = runtime.split('export function ownedServiceDiagnostics(', 1)[1].split('export function authServerDiagnostics(', 1)[0]
        template = re.search("const format='([^']+)';", section)[1]
        STAGE='inspect_template'
        view = json.loads(checked(['inspect', '--format', template, cid]))
        assert view['id'] == cid and view['project'] == 'component-probe' and view['running'] is False
        assert view['privileged'] is False and view['oom'] is False and view['health'] is None
        proof['serviceInspectTemplateVerified'] = True
        STAGE='image_digest'
        proof['imageDigest'] = json.loads(checked(['image', 'inspect', '--format', '{{json .RepoDigests}}', IMAGE]))[0]
    finally:
        previous_stage=STAGE
        STAGE='cleanup'
        for cid in checked(['ps', '-aq', '--no-trunc', '--filter', 'label=' + label]).split():
            view = json.loads(checked(['inspect', '--format', '{{json .}}', cid]))
            assert view['Id'] == cid and view['Config']['Labels'].get(label.split('=')[0]) == label.split('=')[1]
            assert view['HostConfig']['NetworkMode'] == 'none' and not view['HostConfig']['PortBindings']
            assert view['HostConfig']['CapDrop'] == ['ALL'] and not view['HostConfig']['Privileged']
            volumes = [mount['Name'] for mount in view['Mounts'] if mount['Type'] == 'volume']
            checked(['rm', '-f', '-v', cid])
            assert all(run(['volume', 'inspect', volume]).returncode != 0 for volume in volumes)
        assert not checked(['ps', '-aq', '--filter', 'label=' + label])
        STAGE=previous_stage
    proof['ownedResourcesRemoved'] = True
    print(json.dumps(proof))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'componentProbe': 'failed', 'nativeAuthExecuted': False,'stage':STAGE,'kind':type(error).__name__ if type(error).__name__ in ['AssertionError','RuntimeError','JSONDecodeError','KeyError','TimeoutExpired'] else 'other'}))
        raise SystemExit(1)
