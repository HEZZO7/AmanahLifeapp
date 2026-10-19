"""Offline harness checks only. Never starts Docker, Auth, SQL or a workflow."""
import ast,json,subprocess,sys,tempfile,tomllib
from pathlib import Path
import unittest

HERE=Path(__file__).resolve().parent

class ProposalReview(unittest.TestCase):
    def test_script_syntax_only(self):
        for name in ['run.sh','cleanup.sh']:
            subprocess.run(['bash','-n',str(HERE/name)],check=True)
        subprocess.run(['node','--check',str(HERE/'suite.mjs')],check=True)
        for path in HERE.glob('*.py'):
            ast.parse(path.read_text(),filename=str(path))

    def test_config_missing_sections_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'supabase').mkdir()
            (root/'supabase/config.toml').write_text('project_id="unused"\n[db]\nmajor_version=15\n')
            result=subprocess.run([sys.executable,str(HERE/'configure.py'),str(root),'amanah-local-1-1'],capture_output=True)
            self.assertNotEqual(result.returncode,0)

    def test_summary_cannot_pass_without_complete_run_and_teardown(self):
        # Output-format unit fixture only; not an integration-test result.
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'results').mkdir()
            for phase in ['warm','users','network','client','edge','cleanup']:
                (root/'results'/f'{phase}.json').write_text(json.dumps({'passed':True}))
            (root/'completed').write_text('output-format-fixture')
            subprocess.run([sys.executable,str(HERE/'summarize.py'),str(root)],check=True)
            self.assertIn('NOT ESTABLISHED',(root/'summary.md').read_text())
            self.assertNotIn('all steps: PASS',(root/'summary.md').read_text())
            (root/'teardown-completed').write_text('output-format-fixture')
            (root/'results/edge.json').write_text(json.dumps({'passed':False}))
            subprocess.run([sys.executable,str(HERE/'summarize.py'),str(root)],check=True)
            self.assertIn('NOT ESTABLISHED',(root/'summary.md').read_text())

    def test_source_manifest_and_dependency_versions_are_exact(self):
        manifest=json.loads((HERE/'source-manifest.json').read_text())
        self.assertEqual(manifest['subject'],'f29d8df16e434e8cd064968e4b832e9c8f84e2fb')
        self.assertEqual(len(manifest['files']),13)
        self.assertFalse(any('/.env' in name or name.endswith('config.toml') for name in manifest['files']))
        versions=json.loads((HERE/'package.json').read_text())['dependencies']
        self.assertEqual(versions['@supabase/supabase-js'],'2.110.0')
        self.assertEqual(len(versions),9)
        for value in versions.values():
            self.assertRegex(value,r'^\d+\.\d+\.\d+$')

    def test_workflow_is_template_and_has_no_privileged_trigger(self):
        path=HERE.parent.parent/'docs/ci/notification-local-supabase.yml.proposed'
        if not path.exists():
            path=HERE.parent.parent/'notification-local-supabase.yml.proposed'
        text=path.read_text()
        self.assertNotIn('.github/workflows',str(path.relative_to(HERE.parent.parent)))
        self.assertIn('contents: read',text)
        self.assertIn('persist-credentials: false',text)
        self.assertIn('uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',text)
        self.assertNotIn('secrets.',text)
        self.assertNotIn('environment:',text)
        self.assertNotIn('pull_request_target:',text)
        self.assertNotIn('workflow_run:',text)
        self.assertIn('env -i PATH=',text)

if __name__=='__main__':
    unittest.main(verbosity=2)
