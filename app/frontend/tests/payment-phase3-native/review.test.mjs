import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
import {requireOriginalAssertions,assertionCalls} from './assertion-preservation.mjs';
import {SOURCE_COMMIT,CHECKS,MIGRATIONS,LEGACY_MIGRATIONS,SOURCE_FILES,APPROVAL,summarize,sha256,gitBlob} from './safety.mjs';
import {verifySource,verifyPackage} from './local-runtime.mjs';
import {execute,reserveSQL} from './integration.mjs';

const methods=['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'];
const originals=Object.fromEntries(methods.map(k=>[k,childProcess[k]]));
for(const key of methods)childProcess[key]=()=>{throw Error('Offline review forbids subprocesses');};
syncBuiltinESMExports();after(()=>{Object.assign(childProcess,originals);syncBuiltinESMExports();});
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../../..');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const old=name=>fs.readFileSync(path.join(dir,'../subscription-009-local',name),'utf8');
const manifest=JSON.parse(read('source-manifest.json'));
test('native assertions are verbatim; runtime file enumeration only expands its exact allowlist',()=>{
  assert.equal(manifest.historicalPackage,'9baaa89718e51638d97dfd3f8030e50424c5f28c');
  for(const [name,hash] of Object.entries(manifest.historicalFiles)) {
    const bytes=fs.readFileSync(path.join(root,name));assert.equal(sha256(bytes),hash.sha256);assert.equal(gitBlob(bytes),hash.gitBlob);
  }
  for(const name of ['integration.mjs','local-runtime.mjs','safety.mjs']) {
    let original=old(name);
    if(name==='local-runtime.mjs') {
      // The old ten-file closed list must expand to fourteen reviewed files.
      // No native assertion or permission/hash/ownership predicate is exempted.
      const previous=assertionCalls(original).find(c=>c.startsWith('assert.deepEqual(Object.keys(manifest.packageFiles).sort()'));
      const next=assertionCalls(read(name)).find(c=>c.startsWith('assert.deepEqual(Object.keys(manifest.packageFiles).sort()'));
      const literals=c=>[...c.matchAll(/'([^']+)'/g)].map(m=>m[1]);
      assert.equal(literals(previous).length,10);assert.equal(literals(next).length,14);
      for(const file of literals(previous))assert.ok(literals(next).includes(file));
      original=original.replace(previous,next);
    }
    const counts=requireOriginalAssertions(original,read(name));
    assert.ok(counts.originalAssertions>0);assert.ok(counts.extendedAssertions>=counts.originalAssertions);
  }
});
test('assertion preservation rejects deletion and modified expected values',()=>{
  assert.throws(()=>requireOriginalAssertions('assert.equal(x,1);','assert.equal(x,2);'));
  assert.throws(()=>requireOriginalAssertions('assert.ok(x);assert.ok(x);','assert.ok(x);'));
});
test('all 21 original groups retain IDs and order, with no skip or expected failure',()=>{
  const runner=read('integration.mjs');
  assert.equal(CHECKS.length,21);
  assert.deepEqual([...runner.matchAll(/await check\('([^']+)'/g)].map(m=>m[1]),CHECKS);
  assert.doesNotMatch(runner,/test\.skip|test\.todo|result:'skipped'|expectedFailure\s*:/);
  assert.equal(read('fixture.sql'),old('fixture.sql'));
  assert.equal(read('metadata.sql'),old('metadata.sql'));
  assert.equal(read('isolation.mjs'),old('isolation.mjs'));
});
test('new source, exact 001..011 order and all independent hashes validate',()=>{
  assert.equal(SOURCE_COMMIT,'7e7ee889c4f356ba1da1856a668ca6e32fc791dd');
  assert.equal(MIGRATIONS.length,11);assert.equal(LEGACY_MIGRATIONS.length,7);assert.equal(SOURCE_FILES.length,22);
  verifySource(root,manifest);verifyPackage(dir,manifest);
  for(const mutate of [m=>m.migrationOrder.reverse(),m=>m.legacyMigrationOrder.pop(),m=>m.files[SOURCE_FILES[0]].sha256='0'.repeat(64)]){
    const m=structuredClone(manifest);mutate(m);assert.throws(()=>verifySource(root,m));
  }
});
for(const value of [undefined,'wrong-approval'])test('source rejects absent/wrong native approval: '+String(value),async()=>{
  const previous=process.env.AMANAHLIFE_009_APPROVAL;
  try {
    if(value===undefined)delete process.env.AMANAHLIFE_009_APPROVAL;else process.env.AMANAHLIFE_009_APPROVAL=value;
    assert.notEqual(process.env.AMANAHLIFE_009_APPROVAL,APPROVAL);
    await assert.rejects(execute({'--workdir':'/not-an-owned-workspace'}));
  } finally {
    if(previous===undefined)delete process.env.AMANAHLIFE_009_APPROVAL;else process.env.AMANAHLIFE_009_APPROVAL=previous;
  }
});
test('every original failure and missing group stays nonzero despite cleanup success',()=>{
  const passing=CHECKS.map(id=>({id,result:'passed'}));
  assert.equal(summarize(passing,true).result,'passed');
  assert.equal(summarize(passing,true).productionReady,false);
  for(const id of CHECKS){const checks=structuredClone(passing);checks.find(c=>c.id===id).result='failed';assert.equal(summarize(checks,true).result,'failed');}
  assert.equal(summarize(passing.slice(1),true).result,'failed');
  assert.equal(summarize(passing,false).result,'failed');
});
test('reservation instrumentation retains actual RPC and restores false before commit',()=>{
  const sql=reserveSQL('10000000-0000-4000-8000-000000000001','a');
  assert.match(sql,/local_test/);assert.match(sql,/payment_reserve_checkout/);
  assert.ok(sql.indexOf('checkouts_enabled=true')<sql.indexOf('payment_reserve_checkout'));
  assert.ok(sql.indexOf('checkouts_enabled=false')>sql.indexOf('payment_reserve_checkout'));
  assert.doesNotMatch(sql,/\bcommit\b/i);
  assert.equal((read('integration.mjs').match(/reserveSQL\((?:user|A)\.id/g)||[]).length,3);
});
test('new checks preserve DNS, capabilities, no-new-privileges and credential protection',()=>{
  const runtime=read('local-runtime.mjs'),guard=read('isolation.mjs');
  for(const text of ['--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--no-new-privs'])assert.ok(runtime.includes(text));
  assert.ok(runtime.includes('runtimeTemp,credentials:prepared.credentials'));
  assert.doesNotMatch(runtime,/sudo[^\n]*['"]-E['"]/);
  assert.match(guard,/127\.0\.0\.11/);
});
