"""Require real per-case summaries; a zero-test/file-only exit 0 cannot pass."""
from pathlib import Path
import re,sys
expected={'notification-preferences.test.mjs':68,'notification-preference-client.test.mjs':30,
    'notification-backup.test.mjs':7,'notification-preference-write.test.mjs':23}
name,path=sys.argv[1:]
text=Path(path).read_text()
counts={m[1]:int(m[2]) for m in re.finditer(r'^(?:# |ℹ )(tests|pass|fail|cancelled|skipped) (\d+)\s*$',text,re.M)}
if counts!={'tests':expected[name],'pass':expected[name],'fail':0,'cancelled':0,'skipped':0}:
    raise SystemExit('FAIL: actual regression case summary missing or incomplete; raw logs withheld')
print('PASS: '+name+' '+str(expected[name])+' cases, no failures/skips')
