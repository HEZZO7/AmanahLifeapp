// Public registry + unchanged nested lockfile only. No lifecycle scripts or app install.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, relative, isAbsolute } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { verifyInputs, childEnv, root } from './run.mjs';

const destination = resolve(process.argv[2] ?? '');
const rel = relative(root,destination);
assert.ok(process.argv[2] && (rel.startsWith('..') || isAbsolute(rel)),'External report directory required');
mkdirSync(destination,{recursive:true});
let temporary;
try {
  verifyInputs();
  const cwd = resolve(root,'app/frontend/tests/payment-phase2-db');
  assert.equal(existsSync(resolve(cwd,'.npmrc')),false,'No unreviewed project npm configuration');
  temporary=mkdtempSync(resolve(tmpdir(),'amanah007-npm-'));
  const userconfig=resolve(temporary,'user.npmrc'), globalconfig=resolve(temporary,'global.npmrc');
  writeFileSync(userconfig,''); writeFileSync(globalconfig,'');
  const env=childEnv({npm_config_userconfig:userconfig,npm_config_globalconfig:globalconfig,npm_config_cache:resolve(temporary,'cache')});
  // All command arguments are fixed literals; Windows npm.cmd needs cmd.exe.
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  const options={cwd,env,encoding:'utf8',shell:process.platform==='win32',timeout:240000,maxBuffer:8*1024*1024};
  const version=spawnSync(npm,['--version'],options);
  if(version.error) throw Object.assign(Error('npm version subprocess unavailable'),{code:version.error.code??'SUBPROCESS_UNAVAILABLE'});
  assert.equal(version.status,0); assert.match(version.stdout.trim(),/^11\.[0-9]+\.[0-9]+$/);
  const result=spawnSync(npm,['ci','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org'],options);
  // Deliberately exclude URLs, headers, npm logs and inherited credentials.
  const codes=[...new Set((String(result.stderr)+String(result.error?.code??'')).match(/\b(?:ERR_[A-Z_]+|E[A-Z]{2,})\b/g)??[])];
  writeFileSync(resolve(destination,'npm-install.json'),JSON.stringify({npm:version.stdout.trim(),exit:result.status,codes,lockfile:'unchanged',scripts:false},null,2));
  if(result.error) throw Object.assign(Error('Dependency installation subprocess unavailable'),{code:result.error.code??'SUBPROCESS_UNAVAILABLE'});
  assert.equal(result.status,0,'Locked public dependency installation failed');
  verifyInputs();
} catch(error) {
  writeFileSync(resolve(destination,'npm-failure.json'),JSON.stringify({result:'FAIL_OR_BLOCKED',code:error.code??'NPM_PRECONDITION_FAILED'},null,2));
  console.error('Locked dependency installation failed; see sanitized npm report.'); process.exitCode=1;
} finally {
  if(temporary) rmSync(temporary,{recursive:true,force:true});
}
