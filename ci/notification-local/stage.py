"""Copy only verified public test inputs, never repository env/config/customer files."""
from pathlib import Path
import hashlib, json, re, shutil, sys

source, destination, manifest_path = map(Path, sys.argv[1:])
manifest=json.loads(manifest_path.read_text())
assert manifest['subject']=='f29d8df16e434e8cd064968e4b832e9c8f84e2fb'
assert not destination.exists()
for name, expected in manifest['files'].items():
    rel=Path(name)
    assert not rel.is_absolute() and '..' not in rel.parts and name.startswith('app/frontend/')
    path=source/rel
    assert not path.is_symlink() and path.is_file() and path.resolve().is_relative_to(source.resolve())
    raw=path.read_bytes()
    actual=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    assert actual==expected, 'Subject input differs from reviewed Git blob'
    text=raw.decode()
    assert not re.search(r'https?://[^\s\'"<>]*(?:supabase\.co|supabase\.in)',text,re.I), 'Hosted URL in runtime input'
    target=destination/rel
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(raw)
print('PASS: 13 reviewed subject blobs staged; no repository env/config mounted')
