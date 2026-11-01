import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyInputs, digest, blob } from './phase4b-native/prepare.mjs';
const SHA = '1'.repeat(40);
function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amanahlife-manifest-test-'));
  try {
    const files = {};
    for (let n = 0; n < 21; n++) {
      const name = `source-${n}.txt`, bytes = Buffer.from('synthetic fixture ' + n);
      fs.writeFileSync(path.join(root, name), bytes); files[name] = { sha256: digest(bytes), gitBlob: blob(bytes) };
    }
    run(root, { sourceCommit: SHA, productionReady: false, mode: 'preparation-only', files });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test('immutable input verifier accepts exactly matching dual hashes and approved source', () => fixture((root, manifest) => {
  assert.doesNotThrow(() => verifyInputs(root, manifest, SHA));
}));
test('immutable input verifier rejects a changed application file', () => fixture((root, manifest) => {
  fs.writeFileSync(path.join(root, 'source-0.txt'), 'changed'); assert.throws(() => verifyInputs(root, manifest, SHA), /checksum mismatch/);
}));
test('immutable input verifier rejects mismatched source approval', () => fixture((root, manifest) => {
  assert.throws(() => verifyInputs(root, manifest, '2'.repeat(40)), /source mismatch/);
}));
test('immutable input verifier rejects a symlink even when its bytes match', () => fixture((root, manifest) => {
  fs.unlinkSync(path.join(root, 'source-0.txt')); fs.symlinkSync('source-1.txt', path.join(root, 'source-0.txt'));
  manifest.files['source-0.txt'] = manifest.files['source-1.txt']; assert.throws(() => verifyInputs(root, manifest, SHA), /Symlink/);
}));
test('immutable input verifier rejects incomplete input sets or production claims', () => fixture((root, manifest) => {
  assert.throws(() => verifyInputs(root, { ...manifest, files: {} }, SHA), /Incomplete/);
  assert.throws(() => verifyInputs(root, { ...manifest, productionReady: true }, SHA), /mode/);
}));
