// PREPARATION ONLY. Does not start processes/services, issue HTTP, run SQL or CI.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const blob = bytes => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
function require(condition, message) { if (!condition) throw Error(message); }

export function verifyInputs(root, manifest, approvedSource) {
  require(/^[0-9a-f]{40}$/.test(approvedSource) && manifest.sourceCommit === approvedSource, 'Approved immutable source mismatch');
  require(manifest.productionReady === false && manifest.mode === 'preparation-only', 'Invalid validation mode');
  const base = fs.realpathSync(root);
  require(Object.keys(manifest.files).length > 20, 'Incomplete validation manifest');
  for (const [name, expected] of Object.entries(manifest.files)) {
    require(!path.isAbsolute(name) && !name.split('/').includes('..'), 'Invalid input path');
    const resolved = fs.realpathSync(path.join(base, name));
    require(resolved.startsWith(base + path.sep), 'Input outside verified checkout');
    require(!fs.lstatSync(path.join(base, name)).isSymbolicLink(), 'Symlink input rejected');
    const bytes = fs.readFileSync(resolved);
    require(digest(bytes) === expected.sha256 && blob(bytes) === expected.gitBlob, 'Source checksum mismatch: ' + name);
  }
}

export function prepare(root, manifest, approvedSource, destination) {
  verifyInputs(root, manifest, approvedSource);
  const output = path.resolve(destination);
  require(path.dirname(output) === fs.realpathSync(os.tmpdir()) && path.basename(output).startsWith('amanahlife-phase4b-native-'), 'Fresh task-specific /tmp directory required');
  require(!fs.existsSync(output), 'Existing output must not be overwritten');
  const legacyPrefix = 'app/frontend/tests/subscription-009-local/';
  const legacy = JSON.parse(fs.readFileSync(path.join(root, legacyPrefix, 'source-manifest.json')));
  require(legacy.sourceCommit === 'e6dd3fc5e014ea0539df8da12a6ee84582b302b9', 'Unexpected historical package source');
  fs.mkdirSync(output);
  const target = path.join(output, legacyPrefix); fs.mkdirSync(target, { recursive: true });
  // Preserve the repository layout expected by the unchanged offline review.
  for (const name of Object.keys(legacy.files)) {
    require(manifest.files[name], 'Unpinned native source input');
    const destination = path.join(output, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, fs.readFileSync(path.join(root, name)));
  }
  for (const name of Object.keys(legacy.packageFiles)) {
    require(manifest.files[legacyPrefix + name], 'Unpinned native package input');
    const bytes = fs.readFileSync(path.join(root, legacyPrefix, name));
    require(digest(bytes) === legacy.packageFiles[name], 'Historical native package drift');
    fs.writeFileSync(path.join(target, name), bytes);
  }
  // Only the immutable source constant and checksums are rebased. All 21 groups,
  // fixtures, metadata assertions, isolation and fail-closed guards are preserved.
  const safetyPath = path.join(target, 'safety.mjs');
  const safety = fs.readFileSync(safetyPath, 'utf8');
  const anchor = "export const SOURCE_COMMIT='e6dd3fc5e014ea0539df8da12a6ee84582b302b9';";
  require(safety.split(anchor).length === 2, 'Native source anchor drift');
  fs.writeFileSync(safetyPath, safety.replace(anchor, `export const SOURCE_COMMIT='${approvedSource}';`));
  const reviewPath = path.join(target, 'review.test.mjs');
  const review = fs.readFileSync(reviewPath, 'utf8');
  const sourceAssertion = "assert.equal(SOURCE_COMMIT,'e6dd3fc5e014ea0539df8da12a6ee84582b302b9');";
  require(review.split(sourceAssertion).length === 2, 'Native review source assertion drift');
  fs.writeFileSync(reviewPath, review.replace(sourceAssertion, `assert.equal(SOURCE_COMMIT,'${approvedSource}');`));
  legacy.sourceCommit = approvedSource;
  for (const name of Object.keys(legacy.files)) {
    require(manifest.files[name], 'Unpinned native source input');
    legacy.files[name] = manifest.files[name];
  }
  for (const name of Object.keys(legacy.packageFiles)) legacy.packageFiles[name] = digest(fs.readFileSync(path.join(target, name)));
  fs.writeFileSync(path.join(target, 'source-manifest.json'), JSON.stringify(legacy, null, 2) + '\n');
  const notificationTarget = path.join(output, 'notifications'); fs.mkdirSync(notificationTarget);
  for (const name of manifest.notificationInputs) {
    require(manifest.files[name], 'Unpinned notification input');
    fs.writeFileSync(path.join(notificationTarget, path.basename(name)), fs.readFileSync(path.join(root, name)));
  }
  fs.writeFileSync(path.join(output, 'validation-plan.json'), JSON.stringify(manifest.requiredValidation, null, 2) + '\n');
  const outputFiles = {};
  function checksums(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) checksums(file);
      else outputFiles[path.relative(output, file)] = digest(fs.readFileSync(file));
    }
  }
  checksums(output);
  fs.writeFileSync(path.join(output, 'bundle-checksums.json'), JSON.stringify({ sourceCommit: approvedSource, productionReady: false, files: outputFiles }, null, 2) + '\n');
  return { sourceCommit: approvedSource, status: 'PREPARED_NOT_EXECUTED', productionReady: false, files: Object.keys(outputFiles).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const manifest = JSON.parse(fs.readFileSync(new URL('./source-manifest.json', import.meta.url)));
  const [approvedSource, output] = process.argv.slice(2);
  console.log(JSON.stringify(prepare(root, manifest, approvedSource, output)));
}
