// OFFLINE ONLY. Child-process entrypoints are disabled below: no SQL/services.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
import {CHECKS,CLEANUP_TABLES,SOURCE_COMMIT,SOURCE_FILES,MIGRATIONS,NODE_VERSION,SDK_VERSION,
  CLI_VERSION,CLI_ARCHIVE_SHA256,API_ORIGIN,workspace,localStatus,allowedURL,
  trafficGuard,commandCategory,summarize,sha256,gitBlob,assertCleanEnvironment} from './safety.mjs';
import {cleanup,createWorkspace,verifySource,verifyPackage,shutdown} from './local-runtime.mjs';
import {options,nullTriggerSQL,reserveSQL} from './integration.mjs';

const processMethods=['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'];
const originals=Object.fromEntries(processMethods.map(name=>[name,childProcess[name]]));
for(const name of processMethods)childProcess[name]=()=>{throw Error('Offline review forbids subprocesses');};
syncBuiltinESMExports();after(()=>{Object.assign(childProcess,originals);syncBuiltinESMExports();});
const directory=path.dirname(fileURLToPath(import.meta.url)),source=path.resolve(directory,'../../../..');
const read=name=>fs.readFileSync(path.join(directory,name),'utf8');
const manifest=JSON.parse(read('source-manifest.json'));
const runner=read('integration.mjs'),runtime=read('local-runtime.mjs'),fixture=read('fixture.sql'),metadata=read('metadata.sql');
const complete=()=>CHECKS.map(id=>({id,result:'passed'}));
const id='10000000-0000-4000-8000-000000000001';

test('review process cannot invoke subprocesses',()=>{
  for(const name of processMethods)assert.throws(()=>childProcess[name](),/forbids subprocesses/);
});
test('all twenty-one required groups are reachable exactly once in declared order',()=>{
  assert.equal(CHECKS.length,21);
  assert.deepEqual([...runner.matchAll(/await check\('([^']+)'/g)].map(m=>m[1]),CHECKS);
  assert.doesNotMatch(runner,/test\.skip|test\.todo|result:'skipped'|expectedFailure\s*:/);
});
test('security failures remain nonzero even if cleanup succeeds',()=>{
  for(const id of CHECKS){const r=complete();r.find(x=>x.id===id).result='failed';assert.equal(summarize(r,true).result,'failed');}
  assert.match(runner,/process\.exitCode=report\.result==='passed'\?0:1/);
});
test('missing, duplicate, unsupported and infrastructure-failed groups cannot pass',()=>{
  for(const r of [[],complete().slice(1),[...complete(),complete()[0]],
    complete().map((x,i)=>i?x:{...x,result:'skipped'}),complete().map((x,i)=>i?x:{...x,result:'infrastructure_failed'}),
    [...complete(),{id:'unknown',result:'passed'}]])assert.equal(summarize(r,true).result,'failed');
});
test('cleanup and infrastructure failure always veto a green summary',()=>{
  for(const cleanup of [false,null,undefined,'true'])assert.equal(summarize(complete(),cleanup).result,'failed');
  assert.equal(summarize(complete(),true,{phase:'init',category:'command_failed',exit:1}).result,'failed');
  assert.equal(summarize(complete(),true).result,'passed');assert.equal(summarize(complete(),true).productionReady,false);
});
test('readiness and BEFORE-veto failures are mandatory, with no expected-pass conversion',()=>{
  const rows=complete();
  for(const row of rows)if(['unreviewed_trigger_readiness','before_delete_null_preserves_trial','before_delete_null_cannot_restart_trial'].includes(row.id))row.result='failed';
  const report=summarize(rows,true);assert.equal(report.failed.length,3);assert.equal(report.result,'failed');
  assert.match(runner,/assert\.equal\(r\.data,false,'Readiness must reject/);
  assert.match(runner,/A vetoed deletion must never grant a second trial/);
});
test('AFTER NULL is a control; BEFORE NULL is a distinct adversarial test',()=>{
  for(const timing of ['BEFORE','AFTER']){
    const text=nullTriggerSQL(id,timing);assert.ok(text.includes(timing+' delete on auth.users'));
    assert.match(text,/return null/);assert.match(text,/nextval\('public\.fixture_009_witness'\)/);
  }
  assert.match(runner,/admin\.auth\.admin\.deleteUser\(user\.id,false\)/);
  assert.match(runner,/observations\.afterNullTriggerDetected/);
  assert.throws(()=>nullTriggerSQL(id,'INSTEAD OF'));assert.throws(()=>nullTriggerSQL('untrusted','BEFORE'));
});
test('only exact local Auth/PostgREST HTTP routes are accepted',()=>{
  for(const route of ['/auth/v1/token','/rest/v1/rpc/test'])assert.equal(allowedURL(API_ORIGIN+route).origin,API_ORIGIN);
  for(const u of ['https://example.supabase.co/rest/v1/','https://api.lemonsqueezy.com/v1/',
    'http://localhost:54321/rest/v1/','http://127.0.0.1:54322/rest/v1/',
    API_ORIGIN+'/functions/v1/test',API_ORIGIN+'/rest/v1/#secret',
    'http://user:password@127.0.0.1:54321/auth/v1/'])assert.throws(()=>allowedURL(u));
});
test('SDK-catching a rejected request cannot hide the attempt',async()=>{
  let calls=0;const guard=trafficGuard(async()=>{calls++;return new Response('{}');});
  // Reproduce a consumer/SDK that catches a guard error and returns normally.
  await guard.fetch('https://hosted.example.invalid/rest/v1/').catch(()=>({error:true}));
  assert.equal(calls,0);assert.equal(guard.state.attempted,1);assert.equal(guard.state.rejected,1);
  assert.throws(()=>assert.equal(guard.state.rejected,0));
  assert.match(runner,/assert\.equal\(guard\.state\.rejected,0\)/);
});
test('valid requests are recorded before the underlying fetch runs or throws',async()=>{
  let guard;guard=trafficGuard(async()=>{assert.equal(guard.state.calls.length,1);throw Error('synthetic transport');});
  await assert.rejects(guard.fetch(API_ORIGIN+'/auth/v1/user'));
  assert.equal(guard.state.attempted,1);assert.equal(guard.state.calls[0].status,null);
});
test('real status provenance is required; foreign endpoints and roles are rejected',()=>{
  const key=role=>'e30.'+Buffer.from(JSON.stringify({role,iss:'supabase-demo'})).toString('base64url')+'.synthetic-not-valid';
  const status={API_URL:API_ORIGIN,DB_URL:'postgresql://postgres:postgres@127.0.0.1:54322/postgres',ANON_KEY:key('anon'),SERVICE_ROLE_KEY:key('service_role')};
  assert.equal(localStatus(status).url,API_ORIGIN);
  for(const changes of [{API_URL:'https://hosted.supabase.co'},{DB_URL:'postgresql://other.invalid/postgres'},
    {SERVICE_ROLE_KEY:key('authenticated')},{ANON_KEY:'invalid'}])assert.throws(()=>localStatus({...status,...changes}));
  assert.match(runtime,/localStatus\(JSON\.parse\(command\(cli/);
});
test('workspace rejects overlap, traversal, arbitrary names and non-direct children',()=>{
  assert.equal(workspace('/tmp/amanah-009-1-aabbccdd','/tmp','/source'),'amanah-009-1-aabbccdd');
  for(const args of [['/tmp/other','/tmp'],['/tmp/sub/amanah-009-1-aabbccdd','/tmp'],
    ['/tmp/amanah-009-1-aabbccdd','/tmp','/tmp/amanah-009-1-aabbccdd/source']])assert.throws(()=>workspace(...args));
});
test('production-like credential variables are rejected regardless of app prefix',()=>{
  assertCleanEnvironment({PATH:'/bin',AMANAHLIFE_009_APPROVAL:'synthetic'});
  for(const name of ['SUPABASE_URL','VITE_SUPABASE_ANON_KEY','APP_11941c8fec_PADDLE_WEBHOOK_SECRET',
    'LEMON_SQUEEZY_API_KEY','APP_11941c8fec_LEMONSQUEEZY_SECRET','ANTHROPIC_API_KEY',
    'DATABASE_URL','POSTGRES_PASSWORD','PGHOST','PGPASSWORD','PGSERVICE','PGOPTIONS']){
    assert.throws(()=>assertCleanEnvironment({[name]:'SIMULATED-DO-NOT-PRINT'}));
  }
  assert.match(runtime,/assertCleanEnvironment\(process\.env\)/);
});
test('CLI options reject unknown commands and ambiguous arguments',()=>{
  assert.equal(options(['--workdir','/tmp/a','--cleanup'])['--cleanup'],true);
  for(const args of [[],['--deploy'],['--workdir'],['--workdir','x','--workdir','y','--cleanup'],['--workdir','x','--source','x']])assert.throws(()=>options(args));
});
test('diagnostic categories never contain simulated secrets, URLs or unknown output',()=>{
  for(const [text,expected]of [['address already in use','port_conflict'],['cannot connect to the docker daemon','docker_unavailable'],
    ['failed to pull','image_download'],['error running container: exit','database_bootstrap'],['unhealthy','service_health'],
    ['no such host','network'],['unknown','command_failed']]){
    assert.equal(commandCategory(text+' jwt=SIMULATED password=SIMULATED https://sensitive.invalid'),expected);
  }
  assert.doesNotMatch(runner,/emit\([^\n]*(?:error\.message|error\.stack|credentials|token|status\.json)/);
  assert.doesNotMatch(runtime,/stdio:\s*'inherit'|console\.(log|error)|writeFileSync[^\n]*status/);
});
test('all twelve application source hashes match exact approved contents',()=>{
  assert.equal(SOURCE_COMMIT,'c50ae2b2fd99ff8484be67b0f9e5c5c3b7f6cfdc');
  assert.deepEqual(Object.keys(manifest.files),SOURCE_FILES);assert.equal(SOURCE_FILES.length,12);
  verifySource(source,manifest);
  for(const hashes of Object.values(manifest.files)){assert.match(hashes.gitBlob,/^[a-f0-9]{40}$/);assert.match(hashes.sha256,/^[a-f0-9]{64}$/);}
});
test('source verification rejects a changed hash, filename or migration order',()=>{
  for(const mutate of [m=>{m.files[SOURCE_FILES[0]].sha256='0'.repeat(64);},m=>{m.files['../escape']=m.files[SOURCE_FILES[0]];},
    m=>{m.migrationOrder.reverse();}]){const m=structuredClone(manifest);mutate(m);assert.throws(()=>verifySource(source,m));}
});
test('all nine package file hashes match; one byte change is rejected',()=>{
  verifyPackage(directory,manifest);const m=structuredClone(manifest);m.packageFiles['fixture.sql']='0'.repeat(64);
  assert.throws(()=>verifyPackage(directory,m));
});
test('digest algorithms use raw bytes and git blob framing',()=>{
  assert.equal(gitBlob(Buffer.from('test\n')),'9daeafb9864cf43055ae93beb0afd6c7d144bfa4');
  assert.equal(sha256(Buffer.from('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('native Auth and roles are never replaced or seeded by fixture SQL',()=>{
  assert.doesNotMatch(fixture,/create role|create schema auth|create table auth\.users|insert into auth\.users|alter table auth\.users/i);
  assert.match(fixture,/current_setting\('amanahlife\.local_test',true\)/);
  assert.match(fixture,/user_id uuid not null unique references auth\.users\(id\)/);
  assert.match(fixture,/trial_used boolean not null default false/);
});
test('family fixture preserves ownership cascades and member SET NULL references',()=>{
  assert.match(fixture,/families_owner_user_id_fkey FOREIGN KEY \(owner_user_id\) REFERENCES auth.users\(id\) ON DELETE CASCADE/);
  assert.match(fixture,/family_members_user_id_fkey FOREIGN KEY \(user_id\) REFERENCES auth.users\(id\) ON DELETE SET NULL/);
  assert.match(runner,/assert\.equal\(row\.display_name,retained\.display_name\)/);
  assert.match(runner,/observations\.ownerDeletionCascadesSharedFamily=true/);
});
test('fault witness is nontransactional and requires verified cleanup before increment',()=>{
  assert.match(fixture,/create sequence public\.fixture_009_witness/);
  assert.ok(fixture.indexOf("raise exception 'Fault prerequisite not reached'")<fixture.indexOf("perform nextval('public.fixture_009_witness')"));
  assert.match(fixture,/raise exception 'Synthetic local cleanup failure' using errcode='ZX009'/);
  assert.match(fixture,/select f\.phase into stage from public\.fixture_009_faults/);
  assert.match(fixture,/where f\.target=v_target/);
  assert.doesNotMatch(fixture,/where f\.target=target[;\s]/);
  assert.match(runner,/assert\.equal\(witness\(\),hit\+1/);
  assert.match(runner,/for\(const stage of \[\.\.\.CLEANUP_TABLES,'auth'\]\)/);
});
test('trial protection uses real surviving JWT client and complete snapshots',()=>{
  assert.match(runner,/B\.client\.auth\.getUser\(B\.token\)/);
  assert.match(runner,/rpc\(B\.client,'start_trial'\)/);
  assert.match(runner,/assert\.equal\(r\.data\.error,'trial_already_used'\)/);
  assert.match(runner,/assert\.equal\(faultProof,true\)/);
  assert.match(runner,/assert\.deepEqual\(accountRows\(B\.id\),baselineB\)/);
});
test('all seven migrations are explicitly ordered and no historical test is invoked',()=>{
  assert.deepEqual(manifest.migrationOrder,MIGRATIONS);
  assert.deepEqual(MIGRATIONS.map(x=>x.match(/00([1-9])_/)[1]),['1','2','3','4','5','8','9']);
  assert.match(runner,/migrationFiles\.slice\(0,6\)/);
  assert.match(runner,/sql\(fs\.readFileSync\(file,'utf8'\)\);assert\.deepEqual\(jsonSQL/);
  assert.doesNotMatch(runner,/subscription-008-local|migration-007-local/);
});
test('metadata requires complete ACL matrices and exact roles/triggers, not just counts',()=>{
  for(const name of ['has_function_privilege','has_table_privilege','has_column_privilege','pg_get_triggerdef','prosecdef','proconfig','convalidated','condeferrable','relrowsecurity','MAINTAIN'])assert.ok(metadata.includes(name));
  for(const evidence of ['m.acl.map','m.columnAcl.map','m.foreignKeys.map','m.functions.map','m.rls.map','m.policies.length'])assert.ok(runner.includes(evidence));
  assert.match(metadata,/confdeltype::text/);
});
test('races require independent backend PIDs, actual blocking and expected SQLSTATEs',()=>{
  assert.match(runner,/Promise\.all\(\[checkout\.pid\(\),deletion\.pid\(\)\]\)/);
  assert.match(runner,/waitForBlock\(dpid,cpid\)/);assert.match(runner,/waitForBlock\(cpid,dpid\)/);
  assert.match(runner,/waitForBlockedCount\(pid,2\)/);
  assert.match(runner,/waitForBlock\(bpid,wpid\)/);
  assert.match(runner,/denied\.error\.sqlState,'42501'/);
  assert.match(runtime,/with recursive blocked\(pid\)/);assert.match(runtime,/wait_event_type='Lock'/);
  assert.match(runner,/outcome\.error\.sqlState,'42501'/);assert.match(runner,/outcome\.error\.sqlState,'23503'/);
  assert.match(runner,/for\(const rollback of \[true,false\]\)/);
  assert.throws(()=>reserveSQL('unsafe','a'));assert.throws(()=>reserveSQL(id,"';DROP"));
});
test('only actual source adapter imports the pinned SDK, with no remote module download',()=>{
  assert.match(runner,/context\.parentURL===entry/);assert.match(runner,/unexpected_module_download/);
  assert.match(runner,/await import\(entry\)/);assert.match(runner,/SDK_VERSION/);
  assert.match(runtime,/NODE_OPTIONS/);assert.match(runtime,/NODE_USE_ENV_PROXY/);
});
test('locked dependencies have exact versions, fixed public URLs and SHA512 integrity',()=>{
  const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
  assert.equal(pkg.name,lock.name);assert.deepEqual(pkg.dependencies,lock.packages[''].dependencies);
  assert.equal(pkg.engines.node,NODE_VERSION);assert.equal(lock.packages[''].engines.node,NODE_VERSION);
  assert.equal(pkg.dependencies['@supabase/supabase-js'],SDK_VERSION);assert.equal(Object.keys(lock.packages).length,10);
  for(const [name,item]of Object.entries(lock.packages))if(name){
    assert.match(item.version,/^\d+\.\d+\.\d+$/);assert.equal(item.hasInstallScript,undefined);
    const u=new URL(item.resolved);assert.equal(u.origin,'https://registry.npmjs.org');assert.ok(!u.username&&!u.password);
    assert.match(item.integrity,/^sha512-[A-Za-z0-9+/]+=*$/);assert.equal(Buffer.from(item.integrity.slice(7),'base64').length,64);
    for(const [dep,range]of Object.entries(item.dependencies||{})){
      const resolved=lock.packages['node_modules/'+dep];assert.ok(resolved);assert.equal(resolved.version,range.replace(/^\^/,''));
    }
  }
  assert.equal(CLI_VERSION,'2.121.0');assert.equal(CLI_ARCHIVE_SHA256,'4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f');
});
test('startup uses default owned CLI workdir; no linked project, custom network or provider',()=>{
  assert.match(runtime,/protectInbound\(\)/);assert.match(runtime,/sealOutbound\(\)/);
  assert.match(runtime,/\['--workdir',root,name\]/);assert.match(runtime,/supabase\/\.temp\/project-ref/);
  assert.doesNotMatch(runtime,/docker[^\n]*network[^\n]*create|supabase login|db push|functions deploy|registry mirror/);
  assert.match(runtime,/assertCleanEnvironment\(process\.env\)/);
});
test('finally cleanup cannot overwrite a previous security failure or failure phase',()=>{
  assert.match(runner,/finally\{[\s\S]*cleanupPassed=await shutdown\(workingDirectory\)/);
  assert.match(runner,/phase=previous/);assert.match(runner,/if\(opts\['--cleanup'\]\)/);
  assert.match(runtime,/try\{stopped=await stopSessions\(\);\}catch/);
  assert.match(runtime,/try\{removed=cleanup\(workdir\);\}catch/);
  assert.match(runtime,/if\(!acquired\)return !fs\.existsSync\(workdir\)/);
  assert.match(runtime,/createWorkspace\(root\);acquired=true/);
  assert.match(runtime,/childEnv\.HOME=workdir;childEnv\.XDG_CONFIG_HOME=path\.join\(workdir,'\.config'\);childEnv\.DOCKER_CONFIG=/);
});
function scratch(fn){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'amanah009-offline-')),previous=process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP=base;
  try{fn(base);}finally{if(previous===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=previous;fs.rmSync(base,{recursive:true,force:true});}
}
test('partial preparation removes owned files without invoking services',()=>scratch(base=>{
  const root=path.join(base,'amanah-009-1-aabbccdd');createWorkspace(root);
  assert.equal(cleanup(root,()=>assert.fail('No command before startup')),true);assert.equal(fs.existsSync(root),false);
}));
test('marker failure removes only its freshly created empty directory',()=>scratch(base=>{
  const root=path.join(base,'amanah-009-1-aabbccdd');assert.throws(()=>createWorkspace(root,()=>{throw Error('synthetic failure');}));
  assert.equal(fs.existsSync(root),false);
}));
test('foreign files or missing ownership are never recursively deleted',()=>scratch(base=>{
  const root=path.join(base,'amanah-009-1-aabbccdd');
  assert.throws(()=>createWorkspace(root,()=>{fs.writeFileSync(path.join(root,'foreign'),'keep');throw Error('synthetic failure');}));
  assert.equal(fs.readFileSync(path.join(root,'foreign'),'utf8'),'keep');assert.throws(()=>cleanup(root,()=>''));
}));
test('failed CLI stop remains failure and retains owned fallback resources',()=>scratch(base=>{
  const root=path.join(base,'amanah-009-1-aabbccdd');createWorkspace(root);fs.writeFileSync(path.join(root,'start-attempted'),'1');
  assert.equal(cleanup(root,()=>{throw Error('synthetic failure');}),false);assert.equal(fs.existsSync(path.join(root,'owned.json')),true);
}));
test('label/name resource leftovers fail cleanup even if CLI stop succeeds',()=>scratch(base=>{
  const root=path.join(base,'amanah-009-1-aabbccdd');createWorkspace(root);fs.writeFileSync(path.join(root,'start-attempted'),'1');
  assert.equal(cleanup(root,(exe,args)=>args.includes('stop')?'':args.some(a=>a.startsWith('name='))?'synthetic-resource':''),false);
  assert.equal(fs.existsSync(root),true);
}));
test('fallback verifies resources even if workdir is already absent',()=>scratch(base=>{
  const root=path.join(base,'amanah-009-1-aabbccdd');assert.equal(cleanup(root,()=>''),true);
  assert.equal(cleanup(root,()=> 'synthetic-resource'),false);
}));
test('preflight failure never acquires or removes a preexisting run',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'amanah009-preflight-'));
  try{
    const existing=path.join(base,'unowned');fs.mkdirSync(existing);
    assert.equal(await shutdown(existing),false);assert.equal(fs.existsSync(existing),true);
    assert.equal(await shutdown(path.join(base,'absent')),true);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
