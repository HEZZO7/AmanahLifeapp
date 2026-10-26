"""Run the actual pinned in-place writer on temporary files; no services/network."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
TEXT = (ROOT / 'app/frontend/tests/subscription-009-local/local-runtime.mjs').read_text()
SCRIPT = TEXT.split('export const OWNED_HOSTS_APPEND_SCRIPT=String.raw`\n', 1)[1].split('\n`;', 1)[0]


class OwnedHostsWriter(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='amanah-owned-hosts-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'docker'
        self.container = 'a' * 64
        self.directory = self.root / 'containers' / self.container
        self.directory.mkdir(parents=True)
        self.hosts = self.directory / 'hosts'
        self.original = b'127.0.0.1 localhost\n172.18.0.2 db\n'
        self.hosts.write_bytes(self.original)
        self.hosts.chmod(0o640)
        self.value = dict(dockerRoot=str(self.root), container=self.container,
                          subnet='172.18.0.0/16', entries=['172.18.0.2 db supabase_db', '172.18.0.3 auth'])

    def invoke(self, value=None):
        return subprocess.run(['python3', '-I', '-c', SCRIPT], input=json.dumps(self.value if value is None else value),
                              text=True, capture_output=True, env={'PATH': os.environ['PATH']})

    def rejected(self, value=None):
        result = self.invoke(value)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertIn(result.stderr, ['', 'permission denied\n'])

    def test_preserves_inode_owner_mode_prefix_and_checks_digest(self):
        before = self.hosts.stat()
        result = self.invoke()
        self.assertEqual(result.returncode, 0, 'writer failed')
        actual = self.hosts.read_bytes()
        self.assertTrue(actual.startswith(self.original))
        self.assertIn(b'172.18.0.2 supabase_db\n', actual)
        self.assertIn(b'172.18.0.3 auth\n', actual)
        after = self.hosts.stat()
        for key in ['st_dev', 'st_ino', 'st_mode', 'st_uid', 'st_gid']:
            self.assertEqual(getattr(before, key), getattr(after, key))
        self.assertEqual(result.stdout.strip(), hashlib.sha256(actual).hexdigest())
        self.assertRegex(result.stdout, r'^[a-f0-9]{64}\n$')
        self.assertEqual(result.stderr, '')

    def test_repeat_is_idempotent(self):
        self.assertEqual(self.invoke().returncode, 0)
        saved = self.hosts.read_bytes()
        self.assertEqual(self.invoke().returncode, 0)
        self.assertEqual(self.hosts.read_bytes(), saved)

    def test_conflicting_existing_alias_is_rejected_before_writing(self):
        self.hosts.write_bytes(b'172.18.9.9 db\n')
        self.rejected()
        self.assertEqual(self.hosts.read_bytes(), b'172.18.9.9 db\n')

    def test_hosts_symlink_does_not_modify_foreign_file(self):
        target = Path(self.temporary.name) / 'foreign'
        target.write_bytes(b'unchanged')
        self.hosts.unlink()
        self.hosts.symlink_to(target)
        self.rejected()
        self.assertEqual(target.read_bytes(), b'unchanged')

    def test_parent_symlink_is_rejected(self):
        moved = self.directory.with_name('moved')
        self.directory.rename(moved)
        self.directory.symlink_to(moved, target_is_directory=True)
        self.rejected()
        self.assertEqual((moved / 'hosts').read_bytes(), self.original)

    def test_hardlinks_are_rejected(self):
        os.link(self.hosts, self.directory / 'linked')
        self.rejected()
        self.assertEqual(self.hosts.read_bytes(), self.original)

    def test_missing_hosts_is_never_created(self):
        self.hosts.unlink()
        self.rejected()
        self.assertFalse(self.hosts.exists())

    def test_invalid_identity_paths_and_external_addresses_are_rejected(self):
        for change in [dict(container='../foreign'), dict(dockerRoot='/'),
                       dict(dockerRoot=str(self.root) + '/../docker'),
                       dict(entries=['8.8.8.8 external']), dict(entries=['172.18.0.2 db\nforeign']),
                       dict(entries=['172.18.0.2 same', '172.18.0.3 same']), dict(target='/etc/hosts')]:
            self.rejected({**self.value, **change})
            self.assertEqual(self.hosts.read_bytes(), self.original)

    def test_oversized_file_is_not_truncated(self):
        saved = b'x' * 1048577
        self.hosts.write_bytes(saved)
        self.rejected()
        self.assertEqual(self.hosts.read_bytes(), saved)


if __name__ == '__main__':
    unittest.main()
