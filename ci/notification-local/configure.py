"""Configure only a freshly generated, unlinked local CLI workspace."""
from pathlib import Path
import re, sys, tomllib
root=Path(sys.argv[1]); project=sys.argv[2]
p=root/'supabase/config.toml'; s=p.read_text()
s=re.sub(r'^project_id\s*=.*$',f'project_id = "{project}"',s,flags=re.M)
# Keep API, native Auth, Postgres and Edge enabled; remove optional services.
for section in ['studio','local_smtp','storage','realtime','analytics','db.pooler','db.migrations','db.seed']:
    pattern=r'(?ms)(^\['+re.escape(section)+r'\]\n)(.*?)(?=^\[|\Z)'
    def disable(m):
        body=re.sub(r'^enabled\s*=.*$','enabled = false',m[2],flags=re.M)
        return m[1]+body
    s=re.sub(pattern,disable,s)
s=re.sub(r'(?m)^major_version\s*=.*$','major_version = 17',s)
s+='\n[functions.app_11941c8fec_push_notify]\nenabled = true\nverify_jwt = false\n'
# Verify application Auth guard without the optional gateway JWT guard.
# The managed production verify_jwt setting is still an external evidence gap.
config=tomllib.loads(s)
assert config['project_id']==project and config['db']['major_version']==17
for section in ['studio','local_smtp','storage','realtime','analytics']:
    assert config[section]['enabled'] is False, 'Optional service was not disabled'
for section in ['pooler','migrations','seed']:
    assert config['db'][section]['enabled'] is False, 'Automatic database operation enabled'
assert config['auth']['enabled'] is True and config['api']['enabled'] is True
assert all(not provider.get('enabled',False) for provider in config['auth'].get('external',{}).values())
assert not config['auth'].get('email',{}).get('smtp',{}).get('enabled',False)
assert config['functions']['app_11941c8fec_push_notify']['verify_jwt'] is False
assert not (root/'supabase/.temp/project-ref').exists()
p.write_text(s)
