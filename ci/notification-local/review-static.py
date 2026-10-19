"""Offline harness checks only. Never starts Docker, Auth, SQL or a workflow."""
import ast,base64,hashlib,importlib.util,io,json,subprocess,sys,tarfile,tempfile,tomllib
from pathlib import Path
import unittest
from repro import RegistryRedirects,read_locks,verify_sha256,verify_image,verify_tarball

HERE=Path(__file__).resolve().parent

class ProposalReview(unittest.TestCase):
    def test_script_syntax_only(self):
        for name in ['run.sh','cleanup.sh']:
            subprocess.run(['bash','-n',str(HERE/name)],check=True)
        subprocess.run(['node','--check',str(HERE/'suite.mjs')],check=True)
        subprocess.run(['node','--check',str(HERE/'test-register.mjs')],check=True)
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
        self.assertEqual(len(versions),26)
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

    def test_frozen_graphs_and_images_are_consistent(self):
        package,lock,runtime=read_locks(HERE)
        self.assertEqual(len(lock['packages'])-1,26)
        self.assertEqual(len(runtime['images']),7)
        self.assertEqual(runtime['deno']['version'],'2.1.4')
        self.assertEqual(package['engines']['node'],'22.23.3')
        script=(HERE/'run.sh').read_text()
        self.assertIn('npm ci --ignore-scripts',script)
        self.assertNotIn('npm install',script)
        self.assertNotIn('network connect bridge',script)
        self.assertIn('SUPABASE_USE_SLIM_IMAGES=true',script)

    def test_cli_checksum_mismatch_fails_closed(self):
        data=b'offline-unit-fixture-not-a-CLI-binary'
        verify_sha256(data,hashlib.sha256(data).hexdigest())
        with self.assertRaises(ValueError): verify_sha256(data,'0'*64)

    def test_image_content_and_architecture_fail_closed(self):
        pin={'reference':'fixture.invalid/unit@sha256:'+'a'*64,'image_id':'sha256:'+'b'*64}
        image={'Architecture':'amd64','Os':'linux','RepoDigests':[pin['reference']],'Id':pin['image_id']}
        verify_image(image,pin)
        for patch in [{'Architecture':'arm64'},{'Os':'windows'},{'RepoDigests':[]},{'Id':'different'}]:
            with self.assertRaises(ValueError):verify_image({**image,**patch},pin)

    def test_download_redirect_cannot_leave_canonical_registry(self):
        import urllib.request
        handler=RegistryRedirects(); request=urllib.request.Request('https://registry.npmjs.org/unit')
        for url in ['https://blocked.example.invalid/unit','http://registry.npmjs.org/unit','https://registry.npmjs.org:1234/unit','https://unit:unit@registry.npmjs.org/unit']:
            with self.assertRaises(ValueError):handler.redirect_request(request,None,302,'',{},url)

    def test_tarball_integrity_and_identity_fail_closed(self):
        # Synthetic package-format unit fixture; no npm download or installation.
        content=json.dumps({'name':'ci-unit-fixture','version':'1.0.0'}).encode()
        stream=io.BytesIO()
        with tarfile.open(fileobj=stream,mode='w:gz') as archive:
            member=tarfile.TarInfo('package/package.json'); member.size=len(content)
            archive.addfile(member,io.BytesIO(content))
        data=stream.getvalue()
        package={'version':'1.0.0','integrity':'sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode()}
        verify_tarball(data,'ci-unit-fixture',package)
        with self.assertRaises(ValueError): verify_tarball(data+b'tamper','ci-unit-fixture',package)
        with self.assertRaises(ValueError): verify_tarball(data,'different-identity',package)
        with self.assertRaises(ValueError): verify_tarball(data,'ci-unit-fixture',{**package,'version':'9.0.0'})

    def test_local_registry_has_no_fallback_or_path_access(self):
        spec=importlib.util.spec_from_file_location('locked_registry',HERE/'locked-registry.py')
        module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'tarballs').mkdir()
            body=b'offline-unit-artifact'
            filename=hashlib.sha512(body).hexdigest()+'.tgz'
            (root/'tarballs'/filename).write_bytes(body)
            records={'@fixture/pkg':{'versions':{'1.0.0':{}}}}
            self.assertEqual(module.route(root,records,'/@fixture%2fpkg')[0],'application/json')
            self.assertEqual(module.route(root,records,'/tarballs/'+filename)[1],body)
            for path in ['/missing-package','/../.env','/https://registry.npmjs.org/']:
                with self.assertRaises(ValueError):module.route(root,records,path)
            (root/'tarballs'/filename).write_bytes(b'tamper')
            with self.assertRaises(ValueError):module.route(root,records,'/tarballs/'+filename)

    def test_lock_mismatch_or_floating_image_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for name in ['package.json','package-lock.json','runtime-lock.json','deno.lock']:
                (root/name).write_bytes((HERE/name).read_bytes())
            lock=json.loads((root/'runtime-lock.json').read_text())
            lock['images']['node']['reference']='node:latest'
            (root/'runtime-lock.json').write_text(json.dumps(lock))
            with self.assertRaises(ValueError):read_locks(root)
            (root/'runtime-lock.json').write_bytes((HERE/'runtime-lock.json').read_bytes())
            deno=json.loads((root/'deno.lock').read_text());deno['npm'].pop('tslib@2.8.1')
            (root/'deno.lock').write_text(json.dumps(deno))
            with self.assertRaises(ValueError):read_locks(root)

    def test_regression_log_rejects_empty_and_file_only_success(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'unit.log'
            for body in ['', '# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n']:
                path.write_text(body)
                result=subprocess.run([sys.executable,str(HERE/'verify-test-log.py'),'notification-preferences.test.mjs',str(path)],capture_output=True)
                self.assertNotEqual(result.returncode,0)

if __name__=='__main__':
    unittest.main(verbosity=2)
