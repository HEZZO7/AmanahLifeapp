"""Local workflow review. Requires PyYAML; never starts services or uses GitHub."""
import ast
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/subscription-009-native-validation.yml'
RAW = WORKFLOW.read_text()
CONFIG = yaml.load(RAW, Loader=yaml.BaseLoader)
JOB = CONFIG['jobs']['native-validation']
STEPS = JOB['steps']
GATE = next(s['run'] for s in STEPS if s['name'].startswith('Independently require'))
GATE_PYTHON = GATE.split("python3 - <<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]
IDS = ast.literal_eval(re.search(r'^ids=(.+)$', GATE_PYTHON, re.M)[1])
SOURCE = JOB['env']['SOURCE_SHA']


class WorkflowReview(unittest.TestCase):
    def test_manual_hosted_recovery_only(self):
        self.assertEqual(list(CONFIG['on']), ['workflow_dispatch'])
        self.assertEqual(JOB['runs-on'], 'ubuntu-24.04')
        self.assertEqual(CONFIG['permissions'], {'contents': 'read'})
        self.assertEqual(CONFIG['concurrency']['cancel-in-progress'], 'false')
        for token in ['github-hosted', 'refs/heads/recovery/subscription-009-validation-20261026',
                      'GITHUB_RUN_ATTEMPT', "['private'] is False"]:
            self.assertIn(token, STEPS[0]['run'])
        self.assertNotIn('secrets.', RAW)
        self.assertNotIn('continue-on-error', RAW)
        self.assertNotIn('self-hosted', RAW)
        self.assertEqual(len(IDS), 21)
        self.assertEqual(len(set(IDS)), 21)

    def test_pinned_checkouts_and_actions(self):
        checkouts = [s for s in STEPS if s.get('uses', '').startswith('actions/checkout@')]
        self.assertEqual(len(checkouts), 2)
        self.assertEqual([s['with']['ref'] for s in checkouts],
                         [SOURCE, JOB['env']['PACKAGE_SHA']])
        for s in checkouts:
            self.assertEqual(s['with']['persist-credentials'], 'false')
        for s in STEPS:
            if 'uses' in s:
                self.assertRegex(s['uses'], r'@([a-f0-9]{40})$')

    def test_shell_and_python_syntax(self):
        for s in STEPS:
            if 'run' not in s:
                continue
            result = subprocess.run(['bash', '-n'], input=s['run'], text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, (s['name'], result.stderr))
            lines = s['run'].splitlines()
            for i, line in enumerate(lines):
                if "<<'PY'" in line:
                    ast.parse('\n'.join(lines[i + 1:lines.index('PY', i + 1)]))

    def test_cleanup_preserves_report_before_overwrite(self):
        cleanup = next(s for s in STEPS if s.get('id') == 'cleanup')
        self.assertIn('always()', cleanup['if'])
        self.assertIn("steps.verify.outcome == 'success'", cleanup['if'])
        script = cleanup['run']
        self.assertLess(script.index('cp "$report" "$EVIDENCE_DIR/integration.json"'),
                        script.index('node integration.mjs --cleanup'))
        self.assertIn('exit "$status"', script)
        artifact = STEPS[-1]
        self.assertIn('always()', artifact['if'])
        self.assertEqual(artifact['with']['path'], '${{ env.EVIDENCE_DIR }}')

    def gate(self, mutate=lambda state: None):
        integration = dict(mode='integration', source=SOURCE, productionReady=False,
                           result='passed', required=21, completed=21, passed=21,
                           failed=[], missing=[], infrastructureFailed=[], invalid=False,
                           checks=[dict(id=id, result='passed') for id in IDS],
                           cleanupPassed=True, infrastructureFailure=None)
        cleanup = dict(mode='cleanup', productionReady=False, result='passed',
                       cleanupPassed=True, infrastructureFailure=None)
        summary = dict(tests=76, pass_=76, fail=0, skipped=0, cancelled=0, todo=0)
        summary['pass'] = summary.pop('pass_')
        state = {'integration.json': integration, 'cleanup.json': cleanup,
                 'review-summary.json': dict(summary), 'billing-summary.json': dict(summary),
                 **{name + '-exit.txt': '0' for name in ['harness', 'cleanup', 'review', 'billing']}}
        mutate(state)
        with tempfile.TemporaryDirectory(prefix='amanah-workflow-review-') as directory:
            base = Path(directory)
            for name, value in state.items():
                (base / name).write_text(value if isinstance(value, str) else json.dumps(value))
            environment = {'PATH': os.environ['PATH'], 'EVIDENCE_DIR': directory,
                           'SOURCE_SHA': SOURCE, 'GITHUB_STEP_SUMMARY': str(base / 'summary.md')}
            for key in ['PRIVATE_LOG', 'CLEANUP_LOG', 'BILLING_LOG', 'REVIEW_LOG', 'INSTALL_LOG']:
                environment[key] = str(base / (key + '.private'))
                Path(environment[key]).write_text('synthetic private log')
            result = subprocess.run(['python3', '-c', GATE_PYTHON], env=environment,
                                    text=True, capture_output=True)
            self.assertTrue((base / 'verdict.json').is_file(), result.stderr)
            verdict = json.loads((base / 'verdict.json').read_text())
            for key in ['PRIVATE_LOG', 'CLEANUP_LOG', 'BILLING_LOG', 'REVIEW_LOG', 'INSTALL_LOG']:
                self.assertFalse(Path(environment[key]).exists())
            return result.returncode, verdict

    def assert_rejected(self, mutate):
        code, report = self.gate(mutate)
        self.assertEqual(code, 1)
        self.assertEqual(report['result'], 'failed')
        self.assertFalse(report['productionReady'])

    def test_complete_pass_requires_every_gate(self):
        code, report = self.gate()
        self.assertEqual(code, 0)
        self.assertEqual(report['result'], 'passed')
        self.assertFalse(report['productionReady'])

    def test_cleanup_success_cannot_hide_failed_harness_exit(self):
        self.assert_rejected(lambda s: s.update({'harness-exit.txt': '1'}))

    def test_cleanup_failure_prevents_acceptance(self):
        self.assert_rejected(lambda s: s.update({'cleanup-exit.txt': '1'}))

    def test_missing_duplicate_and_skipped_groups_fail(self):
        for variant in ['missing', 'duplicate', 'skipped']:
            def mutate(state):
                rows = state['integration.json']['checks']
                if variant == 'missing':
                    rows.pop()
                elif variant == 'duplicate':
                    rows[-1] = rows[0]
                else:
                    rows[-1]['result'] = 'skipped'
            self.assert_rejected(mutate)

    def test_security_failure_cannot_be_hidden_by_summary_counts(self):
        self.assert_rejected(lambda s: s['integration.json']['checks'][0].update(result='failed'))

    def test_wrong_source_or_infrastructure_failure_fails(self):
        self.assert_rejected(lambda s: s['integration.json'].update(source='0' * 40))
        self.assert_rejected(lambda s: s['integration.json'].update(infrastructureFailure={'category': 'network'}))

    def test_missing_reports_cannot_pass(self):
        self.assert_rejected(lambda s: s.pop('integration.json'))
        self.assert_rejected(lambda s: s.pop('cleanup.json'))

    def test_billing_must_execute_and_pass_without_skips(self):
        self.assert_rejected(lambda s: s['billing-summary.json'].update(tests=0, **{'pass': 0}))
        self.assert_rejected(lambda s: s['billing-summary.json'].update(skipped=1))
        self.assert_rejected(lambda s: s.update({'billing-exit.txt': '1'}))


if __name__ == '__main__':
    unittest.main()
