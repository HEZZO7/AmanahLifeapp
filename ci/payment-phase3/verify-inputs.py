#!/usr/bin/env python3
"""Read-only immutable input verification. No services, credentials or provider IO."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

SOURCE = '7e7ee889c4f356ba1da1856a668ca6e32fc791dd'
HISTORICAL = '9baaa89718e51638d97dfd3f8030e50424c5f28c'
DIRECTORY = 'app/frontend/tests/payment-phase3-native'
REGRESSION_FILES = {'ci/payment-phase3/races-postgres.test.mjs'}
PACKAGE_FILES = {'README.md', 'assertion-preservation.mjs', 'fixture.sql', 'integration.mjs',
                 'isolation.mjs', 'local-runtime.mjs', 'metadata.sql', 'package-lock.json',
                 'package.json', 'phase3-schema.sql', 'review.test.mjs', 'safety.mjs',
                 'schema.test.mjs', 'sql-statements.mjs'}


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL)


def checked_path(root, relative):
    assert re.fullmatch(r'[A-Za-z0-9_./-]+', relative)
    assert not relative.startswith('/') and not set(Path(relative).parts) & {'.', '..'}
    target = root / relative
    assert target.resolve(strict=True) == target and target.is_file() and not target.is_symlink()
    return target


def checked_hash(target, expected, blob=None):
    data = target.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    assert digest == expected
    assert digest == subprocess.check_output(['sha256sum', str(target)], text=True).split()[0]
    if blob:
        assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == blob
    return data


def main():
    parser = argparse.ArgumentParser()
    for key in ['source', 'package', 'source-sha', 'package-sha', 'evidence']:
        parser.add_argument('--' + key, required=True)
    args = parser.parse_args()
    stage = 'evidence_directory'
    evidence = None
    try:
        candidate = Path(args.evidence)
        assert candidate.resolve(strict=True) == candidate and candidate.is_dir() and not candidate.is_symlink()
        evidence = candidate
        stage = 'checkout_identity'
        source = Path(args.source).resolve(strict=True)
        package = Path(args.package).resolve(strict=True)
        for root, sha in [(source, args.source_sha), (package, args.package_sha)]:
            assert re.fullmatch(r'[a-f0-9]{40}', sha)
            assert git(root, 'rev-parse', 'HEAD').decode().strip() == sha
            assert Path(git(root, 'rev-parse', '--show-toplevel').decode().strip()) == root
            assert not git(root, 'status', '--porcelain').strip()
        assert args.source_sha == SOURCE
        stage = 'manifest_identity'
        raw = checked_path(package, DIRECTORY + '/source-manifest.json').read_bytes()
        assert raw == git(package, 'show', args.package_sha + ':' + DIRECTORY + '/source-manifest.json')
        manifest = json.loads(raw)
        assert manifest['sourceCommit'] == SOURCE and manifest['historicalPackage'] == HISTORICAL
        assert len(manifest['files']) == 22 and set(manifest['packageFiles']) == PACKAGE_FILES
        assert len(manifest['historicalFiles']) == 7
        assert set(manifest['regressionFiles']) == REGRESSION_FILES
        assert len(manifest['migrationOrder']) == 11 and len(manifest['legacyMigrationOrder']) == 7
        assert [int(re.search(r'(\d{3})_[^/]+$', p)[1]) for p in manifest['migrationOrder']] == list(range(1, 12))
        stage = 'source_hashes'
        for name, expected in manifest['files'].items():
            target = checked_path(source, name)
            data = checked_hash(target, expected['sha256'], expected['gitBlob'])
            assert data == git(source, 'show', SOURCE + ':' + name)
            assert git(source, 'rev-parse', SOURCE + ':' + name).decode().strip() == expected['gitBlob']
        stage = 'package_hashes'
        for name, expected in manifest['packageFiles'].items():
            data = checked_hash(checked_path(package, DIRECTORY + '/' + name), expected)
            assert data == git(package, 'show', args.package_sha + ':' + DIRECTORY + '/' + name)
        stage = 'regression_hashes'
        for name, expected in manifest['regressionFiles'].items():
            data = checked_hash(checked_path(package, name), expected)
            assert data == git(package, 'show', args.package_sha + ':' + name)
        stage = 'historical_assertions'
        for name, expected in manifest['historicalFiles'].items():
            data = checked_hash(checked_path(package, name), expected['sha256'], expected['gitBlob'])
            assert data == git(source, 'show', HISTORICAL + ':' + name)
            assert git(source, 'rev-parse', HISTORICAL + ':' + name).decode().strip() == expected['gitBlob']
        stage = 'dependency_pins'
        metadata = json.loads(checked_path(package, DIRECTORY + '/package.json').read_text())
        lock = json.loads(checked_path(package, DIRECTORY + '/package-lock.json').read_text())
        assert metadata['engines']['node'] == '24.19.0'
        for name, version in {'@supabase/supabase-js': '2.110.0', 'acorn': '8.15.0', '@electric-sql/pglite': '0.3.14'}.items():
            assert lock['packages']['node_modules/' + name]['version'] == version
            assert metadata.get('dependencies', {}).get(name, metadata.get('devDependencies', {}).get(name)) == version
        for name, entry in lock['packages'].items():
            if name:
                assert entry['resolved'].startswith('https://registry.npmjs.org/')
                assert re.fullmatch(r'sha512-[A-Za-z0-9+/]+=*', entry['integrity'])
        (evidence / 'source-manifest.json').write_bytes(raw)
        (evidence / 'provenance.json').write_text(json.dumps({
            'application': SOURCE, 'remediationBase': 'b8ebc32946e2941761bd65ee69d3d8695a468c82',
            'package': args.package_sha, 'historicalReference': HISTORICAL,
            'workflow': os.environ.get('GITHUB_SHA'), 'node': '24.19.0', 'sdk': '2.110.0',
            'cli': '2.121.0', 'migrations': list(range(1, 12)),
            'manifestSha256': hashlib.sha256(raw).hexdigest(), 'productionReady': False,
            'providerCallsAuthorized': False,
        }, indent=2) + '\n')
        result = {'result': 'passed', 'stage': 'complete'}
    except (AssertionError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        result = {'result': 'failed', 'stage': stage, 'code': 'verification_assertion'}
    if evidence is not None:
        (evidence / 'verification.json').write_text(json.dumps(result) + '\n')
    print(json.dumps(result))
    return 0 if result['result'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
