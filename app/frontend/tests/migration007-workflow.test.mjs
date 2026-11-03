// Preparation review only: these tests never start Docker, SQL or an Actions run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { safeEvent } from '../../../ci/migration007/reporter.mjs';
import { validateNineteen } from '../../../ci/migration007/run.mjs';
import { fixtureFromProfile, cases } from '../../../ci/migration007/native-cases.mjs';
const read = path => readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
const workflow = YAML.parse(read('.github/workflows/migration007-isolated-security.yml'));
test('007 workflow is manual-only, read-only, SHA-pinned and cannot deploy or use production identities',()=>{
  assert.deepEqual(Object.keys(workflow.on),['workflow_dispatch']);
  assert.equal(workflow.on.workflow_dispatch.inputs.expected_commit.required,true);
  assert.deepEqual(workflow.permissions,{contents:'read'});
  assert.deepEqual(Object.keys(workflow.jobs),['security']);
  const job=workflow.jobs.security;
  assert.equal(job['runs-on'],'ubuntu-latest'); assert.equal(job.strategy['fail-fast'],false);
  assert.deepEqual(job.strategy.matrix.phase,['pglite','native']);
  for(const step of job.steps) {
    if(step.uses) assert.match(step.uses,/^actions\/(checkout|setup-node|upload-artifact)@[a-f0-9]{40}$/);
    assert.equal(step['continue-on-error'],undefined);
  }
  assert.equal(job.steps.find(x=>x.uses?.startsWith('actions/checkout')).with['persist-credentials'],false);
  assert.equal(job.steps.find(x=>x.uses?.startsWith('actions/setup-node')).with['node-version'],'24.19.0');
  const raw=read('.github/workflows/migration007-isolated-security.yml');
  assert.doesNotMatch(raw,/secrets\.|secrets:|environment:|id-token:|write-all|workflow_call|repository_dispatch|pull_request|schedule:/);
  assert.match(raw,/GITHUB_REF.*refs\/heads\/repair\/migration007-notification-security-20261102/);
});
test('007 runner rejects a harness-only pass and every missing, failed or skipped SQL case',()=>{
  const events=Array.from({length:19},(_,n)=>({type:'test:pass',name:'case-'+n,skip:false,todo:false}));
  events.push({type:'test:summary',success:true,counts:{tests:19,passed:19,failed:0,skipped:0,todo:0,cancelled:0}});
  assert.doesNotThrow(()=>validateNineteen(events));
  for(const altered of [events.slice(1),[{type:'test:pass',name:'file only'}],events.map((x,n)=>n===0?{...x,skip:true}:x),[...events,{type:'test:fail'}]]) assert.throws(()=>validateNineteen(altered));
});
test('007 reporter excludes SQL, credentials, assertion values, messages and arbitrary diagnostics',()=>{
  const poison={message:'secret-value',actual:'secret-value',expected:'secret-value',query:'secret-value',parameters:['secret-value']};
  const output=safeEvent({type:'test:fail',data:{name:'safe test',...poison,details:{...poison,error:{...poison,code:'ERR_ASSERTION',failureType:'testCodeFailure',cause:{code:'42501',...poison}}}}});
  assert.doesNotMatch(JSON.stringify(output),/secret-value/); assert.equal(output.errorCode,'42501');
  assert.equal(safeEvent({type:'test:diagnostic',data:poison}),null);
});
test('007 input manifest preserves the exact original nineteen assertions, migration and lockfile',()=>{
  const manifest=JSON.parse(read('ci/migration007/inputs.json'));
  assert.equal(manifest.sourceBase,'7c7e6694144c6cdb1f9b924803031f7830f97966');
  assert.equal(manifest.sha256['app/frontend/tests/payment-phase2-db/migration007-repair.test.mjs'],'0e0c0fb809c82c6cfa9f77e9fbf36f899d58ef8a12c4a1cd076a1317a5d6dd85');
  assert.equal(manifest.sha256['app/frontend/tests/payment-phase2-db/package-lock.json'],'50c7667bb51d88b946b2e67386c53549414725566ae5206487eea9f42fd86b5e');
  for(const [path,expected] of Object.entries(manifest.sha256)) assert.equal(createHash('sha256').update(read(path)).digest('hex'),expected,path);
});
test('007 native fixture uses only the existing synthetic literal, without evaluating arbitrary JS',()=>{
  const profile=read('app/frontend/tests/payment-phase2-db/migration007-repair.test.mjs');
  const fixture=fixtureFromProfile(profile);
  assert.doesNotMatch(fixture,/\$\{/); assert.equal((fixture.match(/on delete no action/g)||[]).length,2);
  assert.match(fixture,/grant all privileges/); assert.match(fixture,/service_role_all_prefs/);
  assert.throws(()=>fixtureFromProfile('const fixture = `${process.env.SECRET}`;'));
  assert.throws(()=>fixtureFromProfile('no fixture'));
  assert.equal(cases.length,15); assert.equal(new Set(cases.map(x=>x.id)).size,15);
  assert.equal(cases.filter(x=>x.failure).length,5);
});
test('007 native boundary disallows remote Docker and database URLs and verifies cleanup',()=>{
  const runner=read('ci/migration007/run.mjs');
  assert.match(runner,/'--network','none'/); assert.match(runner,/'--read-only'/);
  assert.match(runner,/listen_addresses=/); assert.match(runner,/170006/);
  assert.match(runner,/'--force','--volumes',name/); assert.match(runner,/remaining=required\('docker'/);
  assert.doesNotMatch(runner,/supabase\.co|DATABASE_URL|process\.env\.PG|--privileged|--publish|--network.host|--mount|'--volume'/);
  assert.match(runner,/if\(result\.error\) throw/);
});
test('007 locked install and Windows fallback keep scripts disabled and propagate failure',()=>{
  const install=read('ci/migration007/install.mjs');
  assert.match(install,/'ci','--ignore-scripts','--no-audit','--no-fund','--registry=https:\/\/registry\.npmjs\.org'/);
  assert.match(install,/if\(result\.error\) throw/);
  assert.doesNotMatch(install,/execSync|@electric-sql\/pglite@|npm install|strict-ssl.*false/);
  const windows=read('ci/migration007/Run-Migration007.ps1');
  assert.match(windows,/LASTEXITCODE/); assert.match(windows,/\$Failures -ne 0/);
  assert.doesNotMatch(windows,/ExecutionPolicy|supabase|Invoke-WebRequest|Remove-Item/);
});
