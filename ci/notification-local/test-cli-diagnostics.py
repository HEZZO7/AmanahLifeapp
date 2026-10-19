"""Offline only: synthetic logs/fake CLI processes; no Docker, Auth, SQL or API."""
import ast
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('cli_diagnostics', HERE / 'cli-diagnostics.py')
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)
SCRIPT = (HERE / 'run.sh').read_text()
FUNCTION = SCRIPT.split('cli_phase() {\n', 1)[1].split('\n}\ncli_phase init ', 1)[0]
FUNCTION = 'cli_phase() {\n' + FUNCTION + '\n}\n'
FAKE_CLI = r'''#!/usr/bin/env python3
import json,os,sys
args=sys.argv[1:]
phase=next(p for p in ['init','start','status'] if p in args)
with open(os.environ['FAKE_CALLS'],'a') as out:out.write(json.dumps(args)+'\n')
print(os.environ.get('FAKE_STDOUT','synthetic output'))
print(os.environ.get('FAKE_STDERR','synthetic error'),file=sys.stderr)
code=int(os.environ.get('FAKE_EXIT','0')) if phase==os.environ.get('FAKE_FAIL_PHASE',phase) else 0
raise SystemExit(code)
'''


class Classification(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.log = self.root / 'start.log'

    def emit(self, payload, phase='start', code=1):
        self.log.write_bytes(payload)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = diagnostics.main([phase, str(code), str(self.log)])
        self.assertEqual(result, 0)
        line = output.getvalue()
        self.assertTrue(line.startswith('CI_CLI '))
        record = json.loads(line[len('CI_CLI '):])
        self.assertEqual(set(record), {'phase', 'exit_code', 'result', 'diagnostic_code', 'message'})
        self.assertIn(record['message'], diagnostics.MESSAGES.values())
        return line, record

    def test_recognized_errors_are_replaced_with_fixed_messages(self):
        cases = {
            'unknown flag: --synthetic': 'cli_argument_error',
            'failed to parse config: synthetic': 'cli_configuration_error',
            'Cannot connect to the Docker daemon': 'docker_unavailable',
            'bind: address already in use': 'local_port_conflict',
            'failed to pull image: synthetic': 'image_pull_error',
            'health check timed out: synthetic': 'service_health_error',
            'dial tcp: no such host': 'network_error',
        }
        for text, code in cases.items():
            with self.subTest(code=code):
                _, record = self.emit(text.encode())
                self.assertEqual(record['diagnostic_code'], code)
                self.assertEqual(record['exit_code'], 1)

    def test_credentials_identifiers_and_terminal_injection_never_escape(self):
        sentinel = 'SYNTHETIC_SECRET_NOT_REAL_49318'
        payloads = [
            f'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.{sentinel}.signature',
            f'api_key={sentinel}\nSUPABASE_SERVICE_ROLE_KEY={sentinel}',
            f'password={sentinel}\nGITHUB_TOKEN={sentinel}',
            f'postgresql://user:{sentinel}@synthetic-production-id.example.invalid:5432/postgres',
            f'https://synthetic-production-id.example.invalid?apikey={sentinel}',
            f'unknown flag: {sentinel}', f'failed to parse config: {sentinel}',
            f'dial tcp: {sentinel}', f'unhealthy: {sentinel}',
            f'\x1b[31mhealth check failed\x1b[0m {sentinel}\n::warning::{sentinel}\r\x00',
            f'\u202e{sentinel}\u202c',
        ]
        for payload in payloads:
            with self.subTest(payload_type=payload.split(':', 1)[0][:20]):
                line, record = self.emit(payload.encode())
                self.assertNotIn(sentinel, line)
                self.assertNotIn('synthetic-production-id', line)
                self.assertNotIn('postgresql://', line)
                self.assertNotIn('Bearer ', line)
                self.assertNotIn('::warning::', line)
                self.assertNotIn('SUPABASE_SERVICE_ROLE_KEY', line)
                self.assertEqual(record['result'], 'failure')

    def test_unrecognized_error_is_withheld_entirely(self):
        line, record = self.emit(b'PRIVATE_UNKNOWN_SYNTHETIC_INFORMATION')
        self.assertNotIn('PRIVATE_UNKNOWN', line)
        self.assertEqual(record['diagnostic_code'], 'unclassified_error')

    def test_empty_log_gets_safe_message(self):
        _, record = self.emit(b'')
        self.assertEqual(record['diagnostic_code'], 'no_error_output')

    def test_ansi_and_invalid_utf8_are_not_reemitted(self):
        line, record = self.emit(b'\xff\x1b[31mhealth check timed out\x1b[0m\x00PRIVATE')
        self.assertEqual(record['diagnostic_code'], 'service_health_error')
        self.assertNotIn('PRIVATE', line)
        self.assertNotIn('\x1b', line)

    def test_reads_only_bounded_tail(self):
        _, record = self.emit(b'unknown flag: SYNTHETIC_SECRET\n' + b'x' * (diagnostics.MAX_LOG_BYTES * 3) + b'\nhealth check timed out')
        self.assertEqual(record['diagnostic_code'], 'service_health_error')

    def test_missing_file_does_not_mask_original_failure_code(self):
        record = diagnostics.record('init', 23, self.root / 'missing.log')
        self.assertEqual(record['exit_code'], 23)
        self.assertEqual(record['diagnostic_code'], 'diagnostic_unavailable')

    def test_symlink_or_directory_log_is_not_read(self):
        target = self.root / 'target'; target.write_text('unknown flag: SYNTHETIC_SECRET')
        self.log.symlink_to(target)
        self.assertEqual(diagnostics.record('start', 1, self.log)['diagnostic_code'], 'diagnostic_unavailable')
        self.assertEqual(diagnostics.record('start', 1, self.root)['diagnostic_code'], 'diagnostic_unavailable')

    def test_success_does_not_read_private_log(self):
        with patch.object(Path, 'lstat', side_effect=AssertionError('must not read logs on success')):
            record = diagnostics.record('status', 0, self.root / 'status.json')
        self.assertEqual(record['diagnostic_code'], 'success')

    def test_invalid_arguments_are_rejected_without_echo(self):
        cases = [[], ['PRIVATE_INPUT', '1', 'PRIVATE_PATH'], ['init', '-1', 'PRIVATE_PATH'],
                 ['start', '256', 'PRIVATE_PATH'], ['status', 'PRIVATE_CODE', 'PRIVATE_PATH']]
        for args in cases:
            with contextlib.redirect_stderr(io.StringIO()) as err, contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(diagnostics.main(args), 2)
            self.assertNotIn('PRIVATE', err.getvalue() + out.getvalue())

    def test_no_network_or_command_execution_in_sanitizer(self):
        imports = {name.name.split('.')[0] for node in ast.walk(ast.parse((HERE / 'cli-diagnostics.py').read_text()))
                   if isinstance(node, (ast.Import, ast.ImportFrom))
                   for name in (node.names if isinstance(node, ast.Import) else [])}
        self.assertFalse(imports & {'subprocess', 'socket', 'urllib', 'requests', 'http'})


class ShellPropagation(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.fake = self.root / 'fake-cli'
        self.fake.write_text(FAKE_CLI); self.fake.chmod(0o700)
        self.env = {'PATH': os.environ['PATH'], 'LOCAL_RUN_DIR': str(self.root), 'HARNESS_DIR': str(HERE),
                    'FAKE_CLI': str(self.fake), 'FAKE_CALLS': str(self.root / 'calls.jsonl'),
                    'PYTHONDONTWRITEBYTECODE': '1'}

    def invoke(self, phase='init', code=0, *, stdout='PRIVATE_SYNTHETIC_STDOUT', stderr='PRIVATE_SYNTHETIC_STDERR', extra_env=None, sequence=False):
        env = {**self.env, 'FAKE_EXIT': str(code), 'FAKE_STDOUT': stdout, 'FAKE_STDERR': stderr, **(extra_env or {})}
        commands = [
            'cli_phase init "$FAKE_CLI" --workdir "$LOCAL_RUN_DIR/stack" init',
            'cli_phase start "$FAKE_CLI" --workdir "$LOCAL_RUN_DIR/stack" --network-id synthetic-private start --exclude synthetic',
            'cli_phase status "$FAKE_CLI" --workdir "$LOCAL_RUN_DIR/stack" status -o json',
        ]
        if not sequence:
            commands = [commands[['init', 'start', 'status'].index(phase)]]
        script = 'set -euo pipefail\n' + FUNCTION + '\n'.join(commands) + '\nprintf AFTER_CLI\n'
        return subprocess.run(['bash', '-c', script], env=env, capture_output=True, text=True, timeout=10)

    def test_each_phase_success_continues_without_raw_output(self):
        for phase in ['init', 'start', 'status']:
            result = self.invoke(phase)
            self.assertEqual(result.returncode, 0)
            self.assertIn('AFTER_CLI', result.stdout)
            self.assertNotIn('PRIVATE_SYNTHETIC', result.stdout + result.stderr)
            self.assertIn('"exit_code": 0', result.stdout)
            self.assertIn('"phase": "supabase_' + phase + '"', result.stdout)

    def test_each_phase_preserves_nonzero_exit_and_stops_shell(self):
        for phase in ['init', 'start', 'status']:
            for code in [1, 23, 126, 137, 255]:
                with self.subTest(phase=phase, code=code):
                    result = self.invoke(phase, code, stderr='dial tcp: PRIVATE_SYNTHETIC_STDERR')
                    self.assertEqual(result.returncode, code)
                    self.assertNotIn('AFTER_CLI', result.stdout)
                    self.assertNotIn('PRIVATE_SYNTHETIC', result.stdout + result.stderr)
                    self.assertIn('"exit_code": ' + str(code), result.stdout)

    def test_init_failure_prevents_start_and_status(self):
        result = self.invoke(code=23, sequence=True, extra_env={'FAKE_FAIL_PHASE': 'init'})
        self.assertEqual(result.returncode, 23)
        calls = [json.loads(line) for line in (self.root / 'calls.jsonl').read_text().splitlines()]
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][-1], 'init')

    def test_start_failure_prevents_status(self):
        result = self.invoke(code=23, sequence=True, extra_env={'FAKE_FAIL_PHASE': 'start'})
        self.assertEqual(result.returncode, 23)
        calls = [json.loads(line) for line in (self.root / 'calls.jsonl').read_text().splitlines()]
        self.assertEqual(len(calls), 2)
        self.assertNotIn('phase=supabase_status', result.stdout)

    def test_status_stdout_is_preserved_privately_but_never_classified_or_printed(self):
        result = self.invoke('status', 23, stdout='{"service_role":"PRIVATE_SYNTHETIC_JWT","error":"unknown flag"}', stderr='health check timed out')
        self.assertEqual(result.returncode, 23)
        self.assertNotIn('PRIVATE_SYNTHETIC_JWT', result.stdout + result.stderr)
        self.assertIn('service_health_error', result.stdout)
        self.assertNotIn('cli_argument_error', result.stdout)
        self.assertIn('PRIVATE_SYNTHETIC_JWT', (self.root / 'status.json').read_text())
        self.assertEqual((self.root / 'status.log').read_text(), 'health check timed out\n')

    def test_diagnostic_helper_failure_cannot_turn_cli_failure_into_success(self):
        harness = self.root / 'broken-helper'; harness.mkdir()
        (harness / 'cli-diagnostics.py').write_text('raise SystemExit(3)\n')
        result = self.invoke(code=23, extra_env={'HARNESS_DIR': str(harness)})
        self.assertEqual(result.returncode, 23)
        self.assertNotIn('AFTER_CLI', result.stdout)

    def test_diagnostic_helper_failure_also_fails_a_successful_cli(self):
        harness = self.root / 'broken-helper'; harness.mkdir()
        (harness / 'cli-diagnostics.py').write_text('raise SystemExit(3)\n')
        result = self.invoke(code=0, extra_env={'HARNESS_DIR': str(harness)})
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('AFTER_CLI', result.stdout)

    def test_cli_argument_vectors_are_not_rewritten(self):
        self.invoke(sequence=True)
        calls = [json.loads(line) for line in (self.root / 'calls.jsonl').read_text().splitlines()]
        self.assertEqual(calls, [
            ['--workdir', str(self.root / 'stack'), 'init'],
            ['--workdir', str(self.root / 'stack'), '--network-id', 'synthetic-private', 'start', '--exclude', 'synthetic'],
            ['--workdir', str(self.root / 'stack'), 'status', '-o', 'json'],
        ])


class StaticSafety(unittest.TestCase):
    def test_bash_and_python_syntax(self):
        subprocess.run(['bash', '-n', str(HERE / 'run.sh')], check=True)
        for name in ['cli-diagnostics.py', 'test-cli-diagnostics.py']:
            ast.parse((HERE / name).read_text())

    def test_only_three_cli_calls_use_diagnostics(self):
        self.assertEqual(SCRIPT.count('\ncli_phase '), 3)
        self.assertIn('cli_phase init "$cli" --workdir "$LOCAL_RUN_DIR/stack" init', SCRIPT)
        self.assertIn('cli_phase status "$cli" --workdir "$LOCAL_RUN_DIR/stack" status -o json', SCRIPT)
        self.assertNotIn('set -x', SCRIPT)
        self.assertNotIn('BASH_COMMAND', SCRIPT)

    def test_pins_network_and_existing_fail_closed_guards_remain(self):
        self.assertIn('set -euo pipefail', SCRIPT)
        self.assertIn('umask 077', SCRIPT)
        self.assertIn('SUPABASE_USE_SLIM_IMAGES=true SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io', SCRIPT)
        self.assertIn('docker network create --internal', SCRIPT)
        self.assertIn('python3 "$HARNESS_DIR/assert-network.py"', SCRIPT)
        self.assertIn('python3 "$HARNESS_DIR/verify-test-log.py"', SCRIPT)
        self.assertIn('test "$CLI_VERSION" = 2.121.0', SCRIPT)


if __name__ == '__main__':
    unittest.main(verbosity=2)
