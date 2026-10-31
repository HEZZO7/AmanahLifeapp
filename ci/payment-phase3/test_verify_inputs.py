import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('phase3_verify', Path(__file__).with_name('verify-inputs.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class InputIntegrityTests(unittest.TestCase):
    def test_traversal_and_absolute_paths_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for path in ['../outside', '/etc/passwd', 'sub/../../outside']:
                with self.assertRaises(AssertionError):
                    module.checked_path(root, path)

    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'source').write_text('synthetic')
            (root / 'alias').symlink_to(root / 'source')
            with self.assertRaises(AssertionError):
                module.checked_path(root, 'alias')

    def test_sha256_and_git_blob_independently_match(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture'
            data = b'synthetic integrity fixture\n'
            path.write_bytes(data)
            sha = hashlib.sha256(data).hexdigest()
            blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            self.assertEqual(module.checked_hash(path, sha, blob), data)
            with self.assertRaises(AssertionError):
                module.checked_hash(path, '0' * 64, blob)
            with self.assertRaises(AssertionError):
                module.checked_hash(path, sha, '0' * 40)

    def test_fixed_package_and_source_scope(self):
        self.assertEqual(len(module.PACKAGE_FILES), 14)
        self.assertEqual(module.SOURCE, '7e7ee889c4f356ba1da1856a668ca6e32fc791dd')
        self.assertEqual(module.HISTORICAL, '9baaa89718e51638d97dfd3f8030e50424c5f28c')


if __name__ == '__main__':
    unittest.main()
