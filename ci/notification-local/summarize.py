"""Allowlisted redacted summary only; never dump CLI/DB/Edge logs or secrets."""
import json,sys
from pathlib import Path
root=Path(sys.argv[1]); lines=['### Local Supabase notification validation (proposal execution)',
 'Subject: `f29d8df16e434e8cd064968e4b832e9c8f84e2fb`',
 'Hosted/production readiness: **NOT ESTABLISHED**',
 'Defaults: representative fixture expressions; production definitions not yet supplied.',
 '', '| Phase | Status |', '|---|---|']
complete=(root/'completed').exists() and (root/'teardown-completed').exists()
for phase in ['warm','users','network','client','edge','cleanup']:
 p=root/'results'/f'{phase}.json'
 try:
  r=json.loads(p.read_text()); passed=r.get('passed') is True
  complete=complete and passed
  lines.append(f'| {phase} | {"PASS" if passed else "FAIL"} |')
 except (OSError,ValueError):
  complete=False
  lines.append(f'| {phase} | NOT RUN |')
lines+=['',f'All local steps including migrations, regressions and teardown: **{"PASS" if complete else "NOT ESTABLISHED"}**',
 'No tokens, account identifiers, passwords, customer rows or raw logs are included.']
(root/'summary.md').write_text('\n'.join(lines)+'\n')
