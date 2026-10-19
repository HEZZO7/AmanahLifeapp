"""Verify a committed npm ci lock and installed identities; never regenerate it."""
from pathlib import Path
import hashlib,json,sys
root,output=map(Path,sys.argv[1:])
manifest=json.loads((root/'package.json').read_text())['dependencies']
lock_path=root/'package-lock.json'
lock=json.loads(lock_path.read_text())['packages']
assert set(lock)=={''}|{'node_modules/'+name for name in manifest}, 'Unexpected dependency graph'
for name,version in manifest.items():
    package=lock['node_modules/'+name]
    assert package['version']==version, 'Resolved version drift'
    assert package['resolved'].startswith('https://registry.npmjs.org/')
    assert package['integrity'].startswith('sha512-'), 'Missing package integrity'
    installed=json.loads((root/'node_modules'/name/'package.json').read_text())
    assert installed['name']==name and installed['version']==version, 'Installed identity drift'
output.write_text(json.dumps({'lock_sha256':hashlib.sha256(lock_path.read_bytes()).hexdigest(),
    'versions':manifest,'committed_integrity_lock':True},indent=2)+'\n')
print('PASS: npm ci used the committed graph and installed pinned identities')
