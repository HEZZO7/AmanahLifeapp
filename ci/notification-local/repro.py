"""Frozen public dependency inputs. No Docker, Auth, SQL or workflow execution here."""
import base64, hashlib, io, json, re, tarfile, urllib.parse, urllib.request
from pathlib import Path

def require(condition, message):
    if not condition:
        raise ValueError(message)

def read_locks(root):
    package=json.loads((root/'package.json').read_text())
    lock=json.loads((root/'package-lock.json').read_text())
    runtime=json.loads((root/'runtime-lock.json').read_text())
    deno=json.loads((root/'deno.lock').read_text())
    require(lock['lockfileVersion']==3, 'Unsupported npm lock format')
    deps=package['dependencies']
    require(lock['packages']['']['dependencies']==deps, 'Manifest/lock mismatch')
    require(set(lock['packages'])=={''}|{'node_modules/'+name for name in deps}, 'Unexpected package graph')
    expected={}
    for name,version in deps.items():
        p=lock['packages']['node_modules/'+name]
        require(p['version']==version and re.fullmatch(r'\d+\.\d+\.\d+',version), 'Non-exact package version')
        raw=base64.b64decode(p['integrity'].removeprefix('sha512-'),validate=True)
        require(p['integrity'].startswith('sha512-') and len(raw)==64, 'Invalid SRI')
        url=f'https://registry.npmjs.org/{name}/-/{name.split("/")[-1]}-{version}.tgz'
        require(p['resolved']==url, 'Unexpected tarball origin')
        require(set(p.get('dependencies',{}))<=set(deps), 'Unpinned required dependency')
        expected[name+'@'+version]={'integrity':p['integrity']}
        if p.get('dependencies'):
            expected[name+'@'+version]['dependencies']=[n+'@'+deps[n] for n in sorted(p['dependencies'])]
    require(deno['version']=='4' and deno['npm']==expected, 'Deno/npm graph differs')
    require(deno['specifiers']=={'npm:@supabase/supabase-js@2.110.0':'2.110.0','npm:web-push@3.6.7':'3.6.7'}, 'Deno root drift')
    require(runtime['platform']=='linux/amd64', 'Wrong platform')
    require(runtime['cli']['version']=='2.121.0' and re.fullmatch('[a-f0-9]{64}',runtime['cli']['sha256']), 'Invalid CLI pin')
    for p in runtime['images'].values():
        require(p['platform']=='linux/amd64' and re.fullmatch(r'[^\s]+@sha256:[a-f0-9]{64}',p['reference']), 'Floating image')
    return package,lock,runtime

def verify_sha256(data, expected):
    require(hashlib.sha256(data).hexdigest()==expected, 'SHA256 mismatch')

def verify_image(info,pin):
    require(info['Architecture']=='amd64' and info['Os']=='linux', 'Wrong OCI architecture')
    require(any(d.endswith('@'+pin['reference'].split('@')[1]) for d in info.get('RepoDigests',[])), 'Pulled manifest digest mismatch')
    if 'image_id' in pin:
        require(info['Id']==pin['image_id'], 'Image config digest mismatch')

def verify_tarball(data, name, package):
    expected=base64.b64decode(package['integrity'][7:],validate=True)
    require(hashlib.sha512(data).digest()==expected, 'Tarball SRI mismatch')
    # Read one bounded manifest, never extract untrusted paths to the filesystem.
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        member=archive.getmember('package/package.json')
        require(member.isfile() and member.size<2*1024**2, 'Unexpected package manifest')
        manifest=json.load(archive.extractfile(member))
    require(manifest['name']==name and manifest['version']==package['version'], 'Package identity mismatch')
    require(manifest.get('dependencies',{})==package.get('dependencies',{}), 'Published dependency graph differs')
    return manifest

class RegistryRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url=urllib.parse.urlsplit(newurl)
        require(url.scheme=='https' and url.hostname=='registry.npmjs.org' and url.port in (None,443) and not url.username and not url.password, 'Forbidden download redirect')
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def download_tarballs(root, destination):
    _,lock,_=read_locks(root)
    destination.mkdir(parents=True,exist_ok=False)
    (destination/'tarballs').mkdir()
    opener=urllib.request.build_opener(RegistryRedirects())
    records={}
    for path,package in lock['packages'].items():
        if not path: continue
        name=path[len('node_modules/'):]
        with opener.open(package['resolved'],timeout=60) as response:
            data=response.read(32*1024**2+1)
        require(len(data)<=32*1024**2, 'Tarball too large')
        manifest=verify_tarball(data,name,package)
        filename=hashlib.sha512(data).hexdigest()+'.tgz'
        (destination/'tarballs'/filename).write_bytes(data)
        version=package['version']
        entry={k:manifest[k] for k in ['name','version','dependencies','optionalDependencies','peerDependencies','peerDependenciesMeta','engines','os','cpu'] if k in manifest}
        entry['dist']={'integrity':package['integrity'],'shasum':hashlib.sha1(data).hexdigest(),
            'tarball':'http://dependency-cache:4873/tarballs/'+filename}
        records[name]={'name':name,'dist-tags':{'latest':version},'versions':{version:entry}}
    (destination/'index.json').write_text(json.dumps(records,sort_keys=True)+'\n')
    print('PASS: all frozen npm tarballs verified before starting services; no runtime Internet path')
