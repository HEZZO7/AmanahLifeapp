"""Emit fixed CLI diagnostic categories only. Never echo raw CLI output or argv."""
import json
from pathlib import Path
import re
import stat
import sys

MAX_LOG_BYTES = 16 * 1024
PHASES = {'init', 'start', 'status'}
MESSAGES = {
    'success': 'CLI phase completed.',
    'cli_argument_error': 'CLI reported an unsupported command, flag or argument.',
    'cli_configuration_error': 'CLI reported a local configuration error.',
    'docker_unavailable': 'CLI could not access the local Docker daemon.',
    'local_port_conflict': 'CLI reported a local port already in use.',
    'image_pull_error': 'CLI reported a container image retrieval error.',
    'service_health_error': 'CLI reported a service health check failure.',
    'network_error': 'CLI reported a connectivity or name resolution error.',
    'no_error_output': 'CLI failed without diagnostic output.',
    'diagnostic_unavailable': 'CLI failed; its private diagnostic file was unavailable.',
    'unclassified_error': 'CLI failed; diagnostic text withheld because it was not allowlisted.',
}
PATTERNS = [
    ('cli_argument_error', r'unknown (?:flag|option|command)|unexpected argument|flag provided but not defined|unrecognized (?:option|argument)'),
    ('cli_configuration_error', r'failed to (?:parse|load) config|invalid config|decoding failed'),
    ('docker_unavailable', r'cannot connect to the docker daemon|is the docker daemon running|permission denied[^\n]{0,200}docker\.sock'),
    ('local_port_conflict', r'address already in use|port is already allocated'),
    ('image_pull_error', r'failed to pull|pull access denied|manifest unknown|no matching manifest'),
    ('service_health_error', r'health checks?[^\n]{0,100}(?:timed out|failed)|timed out[^\n]{0,100}health|unhealthy|failed health check'),
    ('network_error', r'network is unreachable|connection refused|could not resolve host|dial tcp|no such host|tls handshake timeout|i/o timeout'),
]


def classify(raw):
    """Classification is a hint, not proof of a root cause. No input is returned."""
    text = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', raw.decode('utf-8', errors='replace')).lower()
    if not text.strip():
        return 'no_error_output'
    for code, pattern in PATTERNS:
        if re.search(pattern, text):
            return code
    return 'unclassified_error'


def record(phase, exit_code, path):
    if phase not in PHASES or type(exit_code) is not int or not 0 <= exit_code <= 255:
        raise ValueError('Invalid diagnostic arguments')
    code = 'success'
    if exit_code:
        try:
            # Bounded tail only. Never read status.json or any environment file.
            if not stat.S_ISREG(path.lstat().st_mode):
                raise OSError('Non-regular private log')
            with path.open('rb') as stream:
                stream.seek(0, 2)
                stream.seek(max(0, stream.tell() - MAX_LOG_BYTES))
                code = classify(stream.read(MAX_LOG_BYTES))
        except OSError:
            code = 'diagnostic_unavailable'
    return {'phase': 'supabase_' + phase, 'exit_code': exit_code,
            'result': 'failure' if exit_code else 'success',
            'diagnostic_code': code, 'message': MESSAGES[code]}


def main(args):
    # Invalid inputs are rejected without argparse/tracebacks echoing their text.
    if len(args) != 3 or args[0] not in PHASES or not re.fullmatch(r'\d{1,3}', args[1]) or int(args[1]) > 255:
        print('FAIL: CLI diagnostic arguments rejected; raw input withheld', file=sys.stderr)
        return 2
    print('CI_CLI ' + json.dumps(record(args[0], int(args[1]), Path(args[2])), sort_keys=True))
    # The Bash wrapper retains and returns the original CLI exit code.
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
