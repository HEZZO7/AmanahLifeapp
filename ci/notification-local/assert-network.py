"""Fail closed if any service can bypass the sealed private Docker network."""
import json, subprocess, sys
from pathlib import Path
project, network, root=sys.argv[1:]
status=json.loads((Path(root)/'status.json').read_text())
pins=json.loads((Path(root)/'pulled-images.json').read_text())
runtime=json.loads((Path(__file__).parent/'runtime-lock.json').read_text())
def docker(*args):
 return subprocess.check_output(['docker',*args],text=True).strip()
assert json.loads(docker('network','inspect',network))[0]['Internal'] is True
ids=docker('ps','-aq','--filter',f'label=com.supabase.cli.project={project}').split()
assert len(ids)==5, 'Unexpected native service count'
services=[]
for cid in ids:
 # Entire inspect JSON remains in memory only; no environment/keys are emitted.
 info=json.loads(docker('inspect',cid))[0]
 name=info['Name'].lstrip('/').removeprefix('supabase_').removesuffix('_'+project)
 assert name in ('db','auth','rest','kong','edge_runtime'), 'Unpinned service'
 assert info['Image']==pins[name]['image_id'], 'Service image content changed'
 assert info['Config']['Image']==runtime['images'][name].get('cli_alias',runtime['images'][name]['reference']), 'Unexpected service image reference'
 assert set(info['NetworkSettings']['Networks'])=={network}, 'Unsealed service network'
 assert not info['HostConfig']['Privileged'], 'Unexpected privileged service'
 assert all('/var/run/docker.sock' not in m.get('Source','') for m in info['Mounts']), 'Docker socket mounted'
 for bindings in (info['NetworkSettings']['Ports'] or {}).values():
  assert all(b['HostIp'] in ('127.0.0.1','::1') for b in (bindings or [])), 'Non-loopback published port'
 if info['Name'].lstrip('/')==f'supabase_edge_runtime_{project}':
  env=dict(item.split('=',1) for item in info['Config']['Env'] if '=' in item)
  assert env.get('SUPABASE_URL')=='http://kong:8000', 'Nonlocal Edge backend'
  assert env.get('NPM_CONFIG_REGISTRY')=='http://dependency-cache:4873/', 'Unpinned runtime registry'
  assert not any(env.get(k) for k in ('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy')), 'Runtime egress proxy present'
  assert env.get('SUPABASE_ANON_KEY')==(status.get('ANON_KEY') or status.get('anon_key')), 'Wrong local public key'
  assert env.get('SUPABASE_SERVICE_ROLE_KEY')==(status.get('SERVICE_ROLE_KEY') or status.get('service_role_key')), 'Wrong local admin key'
  for key in ['VAPID_PRIVATE_KEY','VAPID_PUBLIC_KEY','INTERNAL_PUSH_SECRET','SUPABASE_ACCESS_TOKEN','LEMONSQUEEZY_API_KEY']:
   assert not env.get(key), 'Unexpected unrelated secret available to Edge'
  images={}
  for service in ids:
   entry=json.loads(docker('inspect',service))[0]
   image=json.loads(docker('image','inspect',entry['Image']))[0]
   images[entry['Name'].lstrip('/')]={'image_id':image['Id'],'repo_digests':image.get('RepoDigests',[])}
  (Path(root)/'images.json').write_text(json.dumps(images,indent=2)+'\n')
 services.append(info['Name'].lstrip('/'))
for name in ['db','auth','rest','kong','edge_runtime']:
 assert f'supabase_{name}_{project}' in services, 'Required native service not present'
cache=json.loads(docker('inspect',project+'-cache'))[0]
assert set(cache['NetworkSettings']['Networks'])=={network}, 'Artifact mirror has external route'
assert cache['Image']==pins['python']['image_id'], 'Artifact mirror image drift'
assert cache['HostConfig']['ReadonlyRootfs'] and not cache['HostConfig']['Privileged']
print('PASS: all five native Supabase services attached only to an internal Docker network')
