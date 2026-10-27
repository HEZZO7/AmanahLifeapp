// OFFLINE ONLY. Child-process entrypoints are disabled below: no SQL/services.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import childProcess from 'node:child_process';
import {EventEmitter} from 'node:events';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
import {CHECKS,CLEANUP_TABLES,SOURCE_COMMIT,SOURCE_FILES,MIGRATIONS,NODE_VERSION,SDK_VERSION,
  CLI_VERSION,CLI_ARCHIVE_SHA256,API_ORIGIN,workspace,localStatus,allowedURL,
  trafficGuard,commandCategory,commandDiagnostic,commandFailureDetails,summarize,sha256,gitBlob,assertCleanEnvironment,Failure,failureLatch,expectSQLFailure,throwIfDatabaseInfrastructure,PG_LIMITS,PG_OPTIONS,sessionPrefix,
  WORKER_PREFLIGHT_STAGES,workerStageFailure,workerFailureDetails,workerStageSignal,lastWorkerPreflightStage,workerLaunchDetails,
  REAL_AUTH_STAGES,realAuthStage,realAuthFailureDetails,AUTH_CREATE_OUTCOMES,AUTH_CREATE_REASONS,authCreateReason,
  checkedAuthCreate,createdAuthIdentity,validRealAuthDiagnostics,AUTH_CREATE_HTTP,authCreateHttpResult,AUTH_CREATE_SERVER,classifyAuthServerLogs,
  AUTH_CREATE_ORIGINS,authResponseOrigin,authCreateOriginResult} from './safety.mjs';
import {command,cleanup,createWorkspace,verifySource,verifyPackage,shutdown,withSessions,ownedSessionSQL,installOwnedHosts,OWNED_HOSTS_APPEND_SCRIPT,initializeWorker,workerRuntimeDirectory,runIsolatedWorker,authServerDiagnostics,reloadOwnedGateway} from './local-runtime.mjs';
import {isolationRules,validateIsolation,ruleCommand,installIsolation,removeIsolation,assertNoHostRules,isolationTag} from './isolation.mjs';
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
  assert.match(runner,/failureLatch\(process,publish\)/);
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
  assert.match(runner,/Direct Auth deletion must reject a late unreviewed veto/);
  assert.match(runner,/Late veto must not run after destructive cleanup/);
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
  assert.equal(SOURCE_COMMIT,'e6dd3fc5e014ea0539df8da12a6ee84582b302b9');
  assert.deepEqual(Object.keys(manifest.files),SOURCE_FILES);assert.equal(SOURCE_FILES.length,12);
  verifySource(source,manifest);
  for(const hashes of Object.values(manifest.files)){assert.match(hashes.gitBlob,/^[a-f0-9]{40}$/);assert.match(hashes.sha256,/^[a-f0-9]{64}$/);}
});
test('status subprocess diagnostics identify fixed operations without retaining arguments',()=>{
  const cases=[
    ['/private/SIMULATED_SECRET/bin/supabase',['--workdir','/private/SIMULATED_SECRET','status','-o','json'],'supabase_status_json'],
    ...['db','auth','rest','kong'].map(s=>['docker',['inspect','--format','{{json .Config.Labels}}','supabase_'+s+'_SIMULATED_SECRET'],'inspect_'+s+'_labels']),
    ['docker',['inspect','SIMULATED_SECRET'],'inspect_container'],
    ['docker',['network','inspect','SIMULATED_SECRET'],'inspect_network'],
    ['docker',['exec','SIMULATED_SECRET','id','-u'],'container_uid'],
    ['docker',['cp','SIMULATED_SECRET:/etc/hosts','/private/secret'],'read_owned_hosts'],
    ['docker',['cp','/private/secret','SIMULATED_SECRET:/etc/hosts'],'write_owned_hosts'],
    ['sudo',['-n','readlink','/proc/secret/ns/net'],'read_namespace'],
    ['sudo',['-n','mount','--bind','/proc/secret/ns/net','/private/secret'],'bind_namespace'],
    ['sudo',['-n','python3','-c','SIMULATED_SECRET'],'append_owned_hosts'],
    ['unreviewed-secret-executable',['SIMULATED_SECRET'],'other'],
  ];
  for(const scope of ['host','namespace'])for(const [flag,operation]of [['-C','probe'],['-I','insert'],['-D','delete']]){
    cases.push(['sudo',['-n',...(scope==='namespace'?['nsenter','--net=/private/secret','--']:[]),'ip6tables','-t','filter',flag,'OUTPUT'],scope+'_rule_'+operation]);
  }
  for(const [exe,args,operation]of cases){
    const diagnostic=commandDiagnostic(exe,args,{stderr:'SIMULATED_SECRET private JWT token password',status:1});
    assert.deepEqual(diagnostic,{operation,reason:'unknown'});
    assert.doesNotMatch(JSON.stringify(diagnostic),/SIMULATED|private|password|JWT|token|\/proc/);
  }
});
test('status failure reasons are bounded allowlisted hints, never raw error evidence',()=>{
  for(const [text,reason]of [['Device or resource busy','resource_busy'],['Permission denied','permission_denied'],
    ['No such container','object_missing'],['unknown flag','unknown_option'],['Container is not running','not_running'],
    ['connect: connection refused','connection_refused'],['arbitrary private text','unknown']]){
    assert.deepEqual(commandDiagnostic('docker',['cp','/private','secret:/etc/hosts'],{stderr:text+' JWT=SIMULATED_SECRET',status:1}),{operation:'write_owned_hosts',reason});
  }
  for(const [code,reason]of [['ETIMEDOUT','timeout'],['ENOENT','executable_missing'],['EACCES','permission_denied'],['SECRET_CODE','unknown']]){
    assert.equal(commandDiagnostic('docker',[],{error:{code,message:'SIMULATED_SECRET'}}).reason,reason);
  }
});
test('actual command failure plumbing preserves nonzero exit and emits only classified fields',()=>{
  for(const [result,exit,reason]of [
    [{status:7,stderr:'device or resource busy SIMULATED_SECRET'},7,'resource_busy'],
    [{status:null,error:{code:'ETIMEDOUT',message:'SIMULATED_SECRET'}},124,'timeout'],
    [{status:null,error:{code:'ENOENT',message:'SIMULATED_SECRET'}},1,'executable_missing'],
    [{status:null,signal:'SIGTERM',stderr:'SIMULATED_SECRET'},143,'terminated'],
  ]){
    assert.throws(()=>command('/private/bin/supabase',['--workdir','/private','status','-o','json'],undefined,30000,(_exe,_args,options)=>{
      assert.equal(options.env.DOCKER_HOST,'unix:///var/run/docker.sock');assert.equal(options.timeout,30000);return result;
    }),error=>{
      assert.ok(error instanceof Failure);assert.equal(error.exitCode,exit);
      assert.deepEqual(commandFailureDetails(error),{diagnostic:{operation:'supabase_status_json',reason}});
      assert.doesNotMatch(JSON.stringify(error),/SIMULATED_SECRET|\/private/);return true;
    });
  }
  assert.equal(command('docker',['inspect'],undefined,30000,()=>({status:0,stdout:'  ok\n'})),'ok');
  assert.match(runner,/commandFailureDetails\(failure\)/);
});
test('failure reporting rejects unknown diagnostic values and strips extra keys',()=>{
  const error=new Failure('command_failed',1);
  for(const diagnostic of [{operation:'SIMULATED_SECRET',reason:'unknown'},{operation:'supabase_status_json',reason:'SIMULATED_SECRET'}]){
    error.diagnostic=diagnostic;assert.deepEqual(commandFailureDetails(error),{});
  }
  error.diagnostic={operation:'supabase_status_json',reason:'unknown',stderr:'SIMULATED_SECRET'};
  assert.deepEqual(commandFailureDetails(error),{diagnostic:{operation:'supabase_status_json',reason:'unknown'}});
  assert.deepEqual(commandFailureDetails({diagnostic:error.diagnostic}),{});
});
test('source verification rejects a changed hash, filename or migration order',()=>{
  for(const mutate of [m=>{m.files[SOURCE_FILES[0]].sha256='0'.repeat(64);},m=>{m.files['../escape']=m.files[SOURCE_FILES[0]];},
    m=>{m.migrationOrder.reverse();}]){const m=structuredClone(manifest);mutate(m);assert.throws(()=>verifySource(source,m));}
});
test('all ten package file hashes match; one byte change is rejected',()=>{
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
  assert.match(runner,/expectSQLFailure\(denied,'42501'\)/);
  assert.match(runtime,/with recursive blocked\(pid\)/);assert.match(runtime,/wait_event_type='Lock'/);
  assert.match(runner,/expectSQLFailure\(outcome,'42501'\)/);assert.match(runner,/expectSQLFailure\(outcome,'23503'\)/);
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
  assert.match(runtime,/installIsolation\(root,null,command\)/);assert.match(runtime,/verifyIsolation\(root,command\)/);
  assert.match(runtime,/\['--workdir',root,name\]/);assert.match(runtime,/supabase\/\.temp\/project-ref/);
  assert.doesNotMatch(runtime,/docker[^\n]*network[^\n]*create|supabase login|db push|functions deploy|registry mirror/);
  assert.match(runtime,/assertCleanEnvironment\(process\.env\)/);
});
test('finally cleanup cannot overwrite a previous security failure or failure phase',()=>{
  assert.match(runner,/finally\{[\s\S]*cleanupPassed=await shutdown\(workingDirectory\)/);
  assert.match(runner,/phase=previous/);assert.match(runner,/if\(opts\['--cleanup'\]\)/);
  assert.match(runtime,/try\{return cleanup\(workdir\);\}catch\{return false;\}/);
  assert.match(runner,/finally\{cleanupPassed=await stopSessions\(\);\}/);
  assert.match(runtime,/if\(!acquired\)return !fs\.existsSync\(workdir\)/);
  assert.match(runtime,/createWorkspace\(root\);acquired=true/);
  assert.match(runtime,/childEnv\.HOME=root;childEnv\.XDG_CONFIG_HOME=path\.join\(root,'\.config'\);childEnv\.DOCKER_CONFIG=/);
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


// New regressions are pure/injected: subprocesses remain disabled above.
const projectName='amanah-009-1-aabbccdd';
const identity=()=>({pid:101,bridge:'br-0123456789ab',namespace:'net:[1001]',hostNamespace:'net:[999]',
  uid:1001,gid:1001,groups:[1001,121],kongUid:0,handle:'/tmp/'+projectName+'/kong-netns',subnet:'172.18.0.0/16',
  hostEntries:['172.18.0.2 kong','172.18.0.3 db','172.18.0.4 auth','172.18.0.5 rest'],
  peers:Array.from({length:4},(_,i)=>({id:String(i+1).repeat(64),pid:101+i,namespace:'net:['+(1001+i)+']',
    handle:'/tmp/'+projectName+'/'+(i?'netns-'+String(i+1).repeat(12):'kong-netns')}))});
function fakeRules(){
  const installed=new Set(),calls=[];let inserts=0,failAt=Infinity;
  const run=(exe,args)=>{
    assert.equal(exe,'sudo');calls.push(args);
    const op=args.find(x=>['-C','-I','-D'].includes(x));
    if(!op){assert.ok(args.includes('-S'));return [...installed].join('\n');}
    const at=args.indexOf(op),copy=[...args];copy[at]='OP';if(op==='-I')copy.splice(at+2,1);
    const key=JSON.stringify(copy);
    if(op==='-C'){if(!installed.has(key))throw new Failure('command_failed',1);return '';}
    if(op==='-I'){if(++inserts===failAt)throw new Failure('command_failed',2);installed.add(key);return '';}
    installed.delete(key);return '';
  };
  return {run,calls,installed,failAfter:n=>{failAt=n;}};
}
test('unsafe legacy host OUTPUT and IPv4/IPv6 blanket egress plans are rejected',()=>{
  const journal={version:1,project:projectName,identity:identity(),rules:isolationRules(projectName,identity())};
  validateIsolation(journal);
  assert.ok(journal.rules.filter(r=>r.scope==='host').every(r=>['INPUT','FORWARD'].includes(r.chain)));
  for(const tool of ['iptables','ip6tables']){
    const old=structuredClone(journal);old.rules.push({scope:'host',tool,table:'filter',chain:'OUTPUT',args:['-j','REJECT']});
    assert.throws(()=>validateIsolation(old));
  }
  const namespaces=journal.rules.filter(r=>r.chain==='OUTPUT');assert.ok(namespaces.length);
  for(const r of namespaces){const args=ruleCommand(r,'-I',journal.identity);assert.ok(args.includes('nsenter'));assert.ok(args.some(x=>x.startsWith('--net=/tmp/')));}
});
test('network policy protects the worker and every owned container in BOTH address families',()=>{
  const i=identity(),rules=isolationRules(projectName,i);
  for(const scope of ['kong',...i.peers.map(p=>p.id)])for(const tool of ['iptables','ip6tables']){
    assert.ok(rules.some(r=>r.scope===scope&&r.tool===tool&&r.chain==='OUTPUT'&&r.args.includes('REJECT')));
  }
  assert.ok(rules.some(r=>r.scope==='kong'&&r.table==='nat'&&r.args.includes('8000')));
  for(const peer of i.peers)assert.ok(rules.some(r=>r.scope===peer.id&&r.args.includes('127.0.0.11')&&r.args.includes('REJECT')));
  assert.match(runtime,/entries:identity.hostEntries/);assert.match(runtime,/installOwnedHosts\(root,identity\)/);assert.match(runtime,/runIsolatedWorker|worker-report/);
  assert.match(runtime,/--no-new-privs/);assert.match(runtime,/--bounding-set=-all/);
  assert.match(runtime,/env:\{\.\.\.childEnv\}/);assert.doesNotMatch(runtime,/preserve-env|sudo.*-E/);assert.doesNotMatch(runtime,/env:process.env/);
});
function ownedHostsFixture(base,mutate=()=>{}){
  const workdir=path.join(base,projectName);fs.mkdirSync(workdir);
  const i=identity();i.handle=path.join(workdir,'kong-netns');
  for(const peer of i.peers)peer.handle=path.join(workdir,path.basename(peer.handle));
  const writes=[],calls=[],content=Buffer.from('127.0.0.1 localhost\n'+i.hostEntries.join('\n')+'\n');
  let copyContent=content;
  const run=(exe,args,input)=>{
    calls.push([exe,args]);
    if(exe==='docker'&&args[0]==='info')return '/var/lib/docker';
    if(exe==='docker'&&args[0]==='inspect'){
      const peer=i.peers.find(p=>p.id===args[1]),index=i.peers.indexOf(peer);
      const item={Id:peer.id,Config:{Labels:{'com.supabase.cli.project':projectName}},State:{Pid:peer.pid,Running:true},
        HostConfig:{Privileged:false},NetworkSettings:{Networks:{owned:{IPAddress:i.hostEntries[index].split(' ')[0]}}},
        HostsPath:'/var/lib/docker/containers/'+peer.id+'/hosts'};
      mutate(item);return JSON.stringify([item]);
    }
    if(exe==='sudo'){
      assert.deepEqual(args,['-n','python3','-I','-c',OWNED_HOSTS_APPEND_SCRIPT]);
      const value=JSON.parse(input);assert.deepEqual(value.entries,i.hostEntries);assert.equal(value.subnet,i.subnet);
      assert.equal(value.dockerRoot,'/var/lib/docker');assert.ok(i.peers.some(p=>p.id===value.container));
      writes.push(value.container);return sha256(content);
    }
    assert.equal(exe,'docker');assert.equal(args[0],'cp');
    assert.ok(args[1].endsWith(':/etc/hosts'));assert.equal(path.dirname(args[2]),workdir);
    fs.writeFileSync(args[2],copyContent);return '';
  };
  const verify=peer=>{assert.equal(path.dirname(peer.handle),workdir);assert.notEqual(peer.namespace,peer.hostNamespace);};
  return {workdir,identity:i,run,verify,writes,calls,corruptReadback(){copyContent=Buffer.from('mismatch');}};
}
test('owned hosts append never replaces Docker mountpoints and verifies every readback',()=>scratch(base=>{
  assert.throws(()=>command('docker',['cp','/private/replacement','owned:/etc/hosts'],undefined,30000,
    ()=>({status:1,stderr:'Device or resource busy'})),error=>{
    assert.equal(error.exitCode,1);assert.deepEqual(commandFailureDetails(error),{
      diagnostic:{operation:'write_owned_hosts',reason:'resource_busy'},
    });return true;
  });
  const f=ownedHostsFixture(base);installOwnedHosts(f.workdir,f.identity,f.run,f.verify);
  assert.equal(f.writes.length,4);assert.equal(f.calls.filter(([exe,args])=>exe==='docker'&&args[0]==='cp').length,4);
  assert.deepEqual(fs.readdirSync(f.workdir),[]);
  assert.match(OWNED_HOSTS_APPEND_SCRIPT,/os\.O_APPEND\|os\.O_NOFOLLOW/);
  assert.doesNotMatch(OWNED_HOSTS_APPEND_SCRIPT,/O_CREAT|O_TRUNC|os\.rename|os\.replace|os\.unlink/);
}));
test('foreign ownership, stale PID, wrong hosts path and changed network fail before any write',()=>{
  for(const mutate of [item=>item.Config.Labels['com.supabase.cli.project']='foreign',item=>item.State.Pid++,
    item=>item.HostsPath='/etc/hosts',item=>item.HostConfig.Privileged=true,item=>item.State.Running=false,
    item=>item.NetworkSettings.Networks.owned.IPAddress='172.18.99.99'])scratch(base=>{
      const f=ownedHostsFixture(base,mutate);assert.throws(()=>installOwnedHosts(f.workdir,f.identity,f.run,f.verify));
      assert.deepEqual(f.writes,[]);
    });
});
test('hosts helper failure is propagated without retries, fallbacks or subsequent writes',()=>scratch(base=>{
  const f=ownedHostsFixture(base);let attempts=0;
  const run=(exe,args,input)=>{if(exe==='sudo'){attempts++;throw new Failure('command_failed',1);}return f.run(exe,args,input);};
  assert.throws(()=>installOwnedHosts(f.workdir,f.identity,run,f.verify),e=>e instanceof Failure&&e.exitCode===1);
  assert.equal(attempts,1);assert.equal(f.calls.some(([exe,args])=>exe==='docker'&&args[0]==='cp'),false);
}));
test('container hosts readback mismatch stops setup before processing another peer',()=>scratch(base=>{
  const f=ownedHostsFixture(base);f.corruptReadback();
  assert.throws(()=>installOwnedHosts(f.workdir,f.identity,f.run,f.verify));assert.equal(f.writes.length,1);
}));
test('invalid pinned namespace never authorizes a hosts append',()=>scratch(base=>{
  const f=ownedHostsFixture(base);
  assert.throws(()=>installOwnedHosts(f.workdir,f.identity,f.run,()=>{throw Error('invalid namespace');}));
  assert.deepEqual(f.writes,[]);
}));
test('host namespace, root worker, Kong UID collision and foreign bind paths fail closed',()=>{
  for(const change of [{namespace:'net:[999]'},{uid:0},{kongUid:1001},{handle:'/unrelated/kong-netns'},
    {subnet:'0.0.0.0/0'},{groups:[]},{peers:identity().peers.map(p=>({...p,namespace:'net:[999]'}))}]){
    assert.throws(()=>isolationRules(projectName,{...identity(),...change}));
  }
  const isolation=read('isolation.mjs');
  assert.ok(isolation.indexOf('save(root,journal);')<isolation.indexOf("run('sudo',['-n','mount'"));
  assert.match(isolation,/verifyNamespaceHandle\(\{\.\.\.peer,hostNamespace:identity.hostNamespace\}\)/);
  assert.match(isolation,/resourcesStopped,true/);
});
test('partial firewall installation is journalled and independent cleanup removes only owned rules',()=>scratch(base=>{
  const root=path.join(base,projectName);createWorkspace(root);
  const fake=fakeRules();fake.installed.add('unrelated-rule');fake.failAfter(3);
  assert.throws(()=>installIsolation(root,null,fake.run));
  assert.equal(fake.installed.size,3);assert.ok(fs.existsSync(path.join(root,'isolation.json')));
  assert.equal(cleanup(root,fake.run),true);assert.deepEqual([...fake.installed],['unrelated-rule']);
  assert.equal(fs.existsSync(root),false);assert.equal(assertNoHostRules(projectName,fake.run),true);
}));
test('firewall verification/cleanup failure retains journal and explicitly fails fallback',()=>scratch(base=>{
  const root=path.join(base,projectName);createWorkspace(root);const fake=fakeRules();installIsolation(root,null,fake.run);
  assert.equal(cleanup(root,()=>{throw new Failure('command_failed',2);}),false);
  assert.ok(fs.existsSync(path.join(root,'isolation.json')));assert.ok(fs.existsSync(path.join(root,'owned.json')));
  assert.equal(cleanup(root,fake.run),true);
}));
test('namespace cleanup never enters an invalid bind and requires stopped resources',()=>scratch(base=>{
  const root=path.join(base,projectName);createWorkspace(root);const fake=fakeRules();installIsolation(root,null,fake.run);
  assert.throws(()=>removeIsolation(root,fake.run,false));
  assert.equal(removeIsolation(root,fake.run,true),true);
  assert.ok(fake.calls.every(args=>!args.includes('nsenter')));
}));
test('late unhandled rejection invalidates an already published success and immediately sets exit 1',async()=>{
  const target=new EventEmitter();target.exitCode=0;const published=[];
  const latch=failureLatch(target,r=>published.push(structuredClone(r)));target.on('unhandledRejection',latch.reject);
  latch.publish(summarize(complete(),true));assert.equal(target.exitCode,0);assert.equal(published.at(-1).result,'passed');
  await Promise.resolve().then(()=>{
    target.emit('unhandledRejection',new Error('SIMULATED-JWT password=private https://private.invalid'));
    assert.equal(target.exitCode,1);
  });
  assert.equal(latch.failed,true);assert.equal(published.at(-1).result,'failed');
  assert.equal(published.at(-1).infrastructureFailure.category,'asynchronous_failure');
  assert.equal(published.at(-1).productionReady,false);
  assert.doesNotMatch(JSON.stringify(published),/SIMULATED|password|https:/);
  latch.publish(summarize(complete(),true));assert.equal(target.exitCode,1);assert.equal(published.at(-1).result,'failed');
  assert.match(runner,/process.on\('unhandledRejection',latch.reject\)/);
});
test('rejection before publication and report-write failure cannot reset exit status',()=>{
  const target={exitCode:0},reports=[];const latch=failureLatch(target,r=>reports.push(r));
  latch.reject();assert.equal(target.exitCode,1);latch.publish(summarize(complete(),true));
  assert.equal(reports.at(-1).result,'failed');assert.equal(target.exitCode,1);
  const other={exitCode:0};failureLatch(other,()=>{throw Error('simulated sink failure');}).publish(summarize(complete(),true));
  assert.equal(other.exitCode,1);
});
test('PostgreSQL server bounds precede client cutoff and intended lock observation deadline',()=>{
  assert.ok(PG_LIMITS.lock>6000);assert.ok(PG_LIMITS.statement>PG_LIMITS.lock);assert.ok(PG_LIMITS.client>PG_LIMITS.statement);
  for(const value of ['statement_timeout=15000','lock_timeout=12000','idle_in_transaction_session_timeout=20000'])assert.ok(PG_OPTIONS.includes(value));
  assert.match(runtime,/PGAPPNAME='\+this.name/);assert.match(runtime,/PGOPTIONS='\+PG_OPTIONS/);
});
test('transport, connection and timeout failures cannot masquerade as a security SQLSTATE',()=>{
  for(const error of [new Failure('session_transport_failed'),new Failure('session_timeout',124),
    {sqlState:undefined},...['08006','57P01','53300','57014','55P03','25P03'].map(sqlState=>({sqlState}))]){
    assert.throws(()=>expectSQLFailure({ok:false,error},'42501'),e=>e instanceof Failure);
  }
  for(const code of ['08001','57014','55P03','25P03','PGRST000','PGRST001','PGRST002',undefined]){
    assert.throws(()=>throwIfDatabaseInfrastructure({code}),e=>e instanceof Failure);
  }
  expectSQLFailure({ok:false,error:{sqlState:'42501'}},'42501');expectSQLFailure({ok:false,error:{sqlState:'23503'}},'23503');
  assert.throws(()=>expectSQLFailure({ok:false,error:{sqlState:'23503'}},'42501'),e=>e.code==='ERR_ASSERTION');
  assert.throws(()=>expectSQLFailure({ok:true},'42501'));
});
test('every race closes independent sessions in finally while preserving the original security assertion',async()=>{
  const closed=[],failure=new assert.AssertionError({message:'synthetic required security failure'});
  await assert.rejects(withSessions(['one','two'],async()=>{throw failure;},name=>({close:async()=>{closed.push(name);return true;}})),e=>e===failure);
  assert.deepEqual(closed,['one','two']);
  const success=[];assert.equal(await withSessions(['a','b'],async()=>42,name=>({close:async()=>{success.push(name);return true;}})),42);
  assert.deepEqual(success,['a','b']);
  assert.equal([...runner.matchAll(/await withSessions\(/g)].length,5);assert.doesNotMatch(runner,/new Session/);
  assert.match(runtime,/finally\{if\(!await closeRaceSessions\(items\)/);
});
test('partial race construction and session close failures remain nonzero',async()=>{
  let closed=0;
  await assert.rejects(withSessions(['a','b'],async()=>assert.fail('unreachable'),name=>{
    if(name==='b')throw new Failure('session_transport_failed');return {close:async()=>{closed++;return true;}};
  }),e=>e instanceof Failure);assert.equal(closed,1);
  await assert.rejects(withSessions(['a','b'],async()=>{},()=>({close:async()=>false})),e=>e.category==='session_cleanup_failed');
});
test('backend termination is restricted to project-owned postgres sessions and verified independently',()=>{
  const root='/tmp/'+projectName,name=sessionPrefix(projectName)+'aabbcc';
  for(const queries of [ownedSessionSQL(root),ownedSessionSQL(root,name)]){
    assert.match(queries.kill,/pg_terminate_backend\(pid\)/);assert.match(queries.kill,/pid<>pg_backend_pid\(\)/);
    assert.match(queries.kill,/usename='postgres'/);assert.ok(queries.kill.includes(sessionPrefix(projectName)));
    assert.ok(queries.count.includes('count(*)'));assert.ok(queries.count.includes(sessionPrefix(projectName)));
  }
  assert.throws(()=>ownedSessionSQL(root,'unrelated'));assert.throws(()=>ownedSessionSQL(root,name+"';select"));
  assert.match(runtime,/if\(running\)\{const queries=ownedSessionSQL\(workdir\);sql\(queries.kill,run\);assert.equal\(jsonSQL\(queries.count,run\),0\)/);
  assert.match(runtime,/while\(Date.now\(\)<deadline\).*jsonSQL\(queries.count\)===0/);
  assert.match(runtime,/this.child.kill\('SIGKILL'\)/);assert.match(runtime,/return closed&&absent&&!sessionCleanupFailed/);
});

test('partial namespace bind failure removes owned handles without entering an unverified namespace',()=>scratch(base=>{
  const root=path.join(base,projectName);createWorkspace(root);const fake=fakeRules();installIsolation(root,null,fake.run);
  const i=identity();i.handle=path.join(root,'kong-netns');
  for(const p of i.peers)p.handle=path.join(root,path.basename(p.handle));
  // Model a write-ahead journal followed by touch-before-bind failure. No mount
  // or namespace command executes in this offline test.
  fs.writeFileSync(path.join(root,'isolation.json'),JSON.stringify({version:1,project:projectName,identity:i,rules:isolationRules(projectName,i)}));
  for(const p of i.peers)fs.writeFileSync(p.handle,'',{mode:0o600});
  assert.equal(removeIsolation(root,fake.run,true),true);
  for(const p of i.peers)assert.equal(fs.existsSync(p.handle),false);
  assert.ok(fake.calls.every(args=>!args.includes('nsenter')&&!args.includes('mount')&&!args.includes('umount')));
  assert.equal(fake.installed.size,0);assert.equal(cleanup(root,fake.run),true);
}));
test('resource leftovers keep isolation intact until independent fallback verifies removal',()=>scratch(base=>{
  const root=path.join(base,projectName);createWorkspace(root);const fake=fakeRules();installIsolation(root,null,fake.run);
  fs.writeFileSync(path.join(root,'start-attempted'),'1');
  const busy=(exe,args,...rest)=>exe==='sudo'?fake.run(exe,args,...rest):
    args.includes('stop')?'':args.some(a=>a.startsWith('name='))?'owned-leftover':'';
  assert.equal(cleanup(root,busy),false);assert.equal(fake.installed.size,6);
  assert.ok(fs.existsSync(path.join(root,'isolation.json')));
  const gone=(exe,args,...rest)=>exe==='sudo'?fake.run(exe,args,...rest):'';
  assert.equal(cleanup(root,gone),true);assert.equal(fake.installed.size,0);
}));

function preflightFixture(){
  const i=identity(),journal={version:1,project:projectName,identity:i,rules:isolationRules(projectName,i)};
  const state={marker:{project:projectName,source:SOURCE_COMMIT},journal,namespace:i.namespace,uid:i.uid,gid:i.gid,
    status:'NoNewPrivs:\t1\n',cancelled:false,badHandle:false};
  const probe={
    fs:{realpathSync:()=>'/tmp',statSync:()=>({isDirectory:()=>true}),readFileSync:file=>file.endsWith('owned.json')?JSON.stringify(state.marker):
      file.endsWith('isolation.json')?JSON.stringify(state.journal):state.status,
      readlinkSync:()=>state.namespace,existsSync:()=>state.cancelled},
    uid:()=>state.uid,gid:()=>state.gid,
    verifyNamespaceHandle:()=>{assert.equal(state.badHandle,false);},
  };
  return {state,probe,identity:i};
}
function controllerFixture(){
  const i=identity(),state={report:{...summarize(complete(),true),observations:{}},outcome:{status:0,stdout:workerStageSignal(null)},
    isolationError:null,readError:null,raw:null,launched:null};
  const prepared={identity:i,runtimeTemp:'/tmp',source:'/tmp/source',credentials:{url:API_ORIGIN,anon:'offline-anon',service:'offline-service'}};
  const probe={workdir:'/tmp/'+projectName,
    verifyIsolation:()=>{if(state.isolationError)throw state.isolationError;return {identity:i};},
    launch:(exe,args,options)=>{state.launched={exe,args,options};return state.outcome;},
    readReport:()=>{if(state.readError)throw state.readError;return state.raw??JSON.stringify(state.report);},
  };
  return {state,prepared,probe,run:()=>runIsolatedWorker(prepared,'/tmp/package/integration.mjs',probe)};
}
test('worker stage protocol only accepts fixed two-field codes and clears before native groups',()=>{
  for(const stage of WORKER_PREFLIGHT_STAGES){assert.equal(lastWorkerPreflightStage(workerStageSignal(stage)),stage);}
  for(const output of ['SIMULATED_PRIVATE',JSON.stringify({type:'worker_stage',code:'SIMULATED_PRIVATE'}),
    JSON.stringify({type:'worker_stage',code:'worker_uid',token:'SIMULATED_PRIVATE'}),'x'.repeat(1024*1024+1)]){
    assert.equal(lastWorkerPreflightStage(output),null);
  }
  assert.equal(lastWorkerPreflightStage(workerStageSignal('worker_uid')+'SIMULATED_PRIVATE\n'), 'worker_uid');
  assert.equal(lastWorkerPreflightStage(workerStageSignal('worker_uid')+workerStageSignal(null)),null);
  assert.throws(()=>workerStageSignal('SIMULATED_PRIVATE'));
  assert.deepEqual(workerFailureDetails({workerStage:'SIMULATED_PRIVATE',workerPreflightStage:'SIMULATED_PRIVATE',token:'SIMULATED_PRIVATE'}),{});
});
test('initializeWorker preserves every identity assertion and identifies each failed stage',()=>{
  const previous=process.env.RUNNER_TEMP;process.env.RUNNER_TEMP='/tmp';
  try{
    const good=preflightFixture(),stages=[];
    assert.deepEqual(initializeWorker('/tmp/'+projectName,'/tmp',stage=>stages.push(stage),good.probe),good.identity);
    assert.deepEqual(stages,WORKER_PREFLIGHT_STAGES.slice(0,10));
    for(const [stage,mutate]of [
      ['worker_marker',s=>s.marker.source='SIMULATED_PRIVATE'],
      ['worker_journal',s=>s.journal.project='foreign'],
      ['worker_namespace_handle',s=>s.badHandle=true],
      ['worker_namespace_identity',s=>s.namespace='net:[999]'],
      ['worker_uid',s=>s.uid++],['worker_gid',s=>s.gid++],
      ['worker_no_new_privileges',s=>s.status='NoNewPrivs:\t0\n'],
      ['worker_cancelled',s=>s.cancelled=true],
    ]){
      const f=preflightFixture();mutate(f.state);
      assert.throws(()=>initializeWorker('/tmp/'+projectName,'/tmp',()=>{},f.probe),error=>{
        assert.ok(error instanceof Failure);assert.equal(error.exitCode,1);assert.equal(error.workerStage,stage);
        assert.doesNotMatch(JSON.stringify(error),/SIMULATED_PRIVATE/);return true;
      });
    }
  }finally{if(previous===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=previous;}
});
test('missing explicit temporary context fails even if inherited environment could be present',()=>{
  const previous=process.env.RUNNER_TEMP;process.env.RUNNER_TEMP='/tmp';
  try{
    const signals=[];
    assert.throws(()=>initializeWorker('/tmp/'+projectName,undefined,stage=>signals.push(stage)),error=>error.workerStage==='worker_runtime_temp'&&error.exitCode===1);
    assert.deepEqual(signals,['worker_runtime_temp']);
  }finally{if(previous===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=previous;}
});
test('worker launch retains namespace, credentials stdin, no-new-privileges and all capability drops',()=>{
  const f=controllerFixture();assert.equal(f.run().report.result,'passed');
  const {exe,args,options}=f.state.launched;assert.equal(exe,'sudo');assert.equal(args[0],'-n');
  assert.ok(args.includes('nsenter'));assert.ok(args.includes('--net='+f.prepared.identity.handle));
  for(const flag of ['--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--no-new-privs'])assert.ok(args.includes(flag));
  assert.ok(args.includes('--reuid='+f.prepared.identity.uid));assert.ok(args.includes('--regid='+f.prepared.identity.gid));
  assert.ok(args.includes('--groups='+f.prepared.identity.groups.join(',')));
  assert.equal(options.timeout,480000);assert.equal(options.env.DOCKER_HOST,'unix:///var/run/docker.sock');
  assert.deepEqual(JSON.parse(options.input).credentials,f.prepared.credentials);
  assert.equal(JSON.parse(options.input).runtimeTemp,'/tmp');assert.equal(options.env.RUNNER_TEMP,undefined);
  assert.doesNotMatch(args.join(' '),/offline-service|offline-anon/);
});
test('controller validation tags exact failed assertions without accepting incomplete or forged reports',()=>{
  for(const [stage,mutate]of [
    ['controller_isolation',f=>f.state.isolationError=new Failure('isolation_not_established',7)],
    ['controller_identity',f=>f.prepared.identity={...f.prepared.identity,uid:9999}],
    ['controller_launch',f=>f.state.outcome={error:{code:'ETIMEDOUT'},stdout:''}],
    ['controller_report_file',f=>f.state.readError=Error('SIMULATED_PRIVATE')],
    ['controller_report_json',f=>f.state.raw='SIMULATED_PRIVATE'],
    ['controller_report_source',f=>f.state.report.source='SIMULATED_PRIVATE'],
    ['controller_report_production',f=>f.state.report.productionReady=true],
    ['controller_report_checks',f=>f.state.report.checks=[{id:'SIMULATED_PRIVATE',result:'passed'}]],
    ['controller_report_infrastructure',f=>f.state.report.infrastructureFailure={phase:'worker_preflight',category:'assertion_failed',exit:1,workerStage:'SIMULATED_PRIVATE'}],
    ['controller_report_observations',f=>f.state.report.observations=null],
    ['controller_report_result',f=>f.state.report.result='failed'],
    ['controller_exit_status',f=>f.state.outcome.status=1],
  ]){
    const f=controllerFixture();mutate(f);
    assert.throws(f.run,error=>{
      assert.ok(error instanceof Failure);assert.equal(error.workerStage,stage);assert.ok(error.exitCode>0);
      assert.doesNotMatch(JSON.stringify(error),/SIMULATED_PRIVATE|offline-service/);return true;
    });
  }
});
test('missing report preserves an allowlisted child preflight hint even when publishing failed',()=>{
  const f=controllerFixture();f.state.readError=Error('SIMULATED_PRIVATE');
  f.state.outcome={status:1,stdout:workerStageSignal('worker_runtime_temp')+'SIMULATED_PRIVATE\n',stderr:'SIMULATED_PRIVATE'};
  assert.throws(f.run,error=>{
    assert.deepEqual(workerFailureDetails(error),{workerStage:'controller_report_file',workerPreflightStage:'worker_runtime_temp',workerExit:1});
    assert.equal(error.exitCode,1);assert.doesNotMatch(JSON.stringify(error),/SIMULATED_PRIVATE/);return true;
  });
});
test('valid failed worker report keeps its preflight code when forwarded and can never become green',()=>{
  const f=controllerFixture(),infra={phase:'worker_preflight',category:'assertion_failed',exit:1,workerStage:'worker_uid'};
  f.state.report={...summarize([],false,infra),observations:{}};f.state.outcome={status:1,stdout:workerStageSignal('worker_uid')};
  const r=f.run().report;assert.equal(r.result,'failed');assert.equal(r.completed,0);
  assert.equal(r.infrastructureFailure.workerStage,'worker_uid');
  const forwarded=Object.assign(new Failure(r.infrastructureFailure.category,r.infrastructureFailure.exit),workerFailureDetails(r.infrastructureFailure));
  assert.equal(forwarded.workerStage,'worker_uid');assert.equal(forwarded.exitCode,1);
  assert.match(runner,/Object.assign\(failure,workerFailureDetails\(report.infrastructureFailure\)\)/);
  assert.match(runner,/notifyWorkerStage\(null\);\s*await check\('schema_dependencies'/);
  const original=new Failure('worker_timeout',124);assert.equal(workerStageFailure('controller_launch',original),original);
  assert.equal(original.exitCode,124);assert.throws(()=>workerStageFailure('SIMULATED_PRIVATE',original));
});
test('launcher diagnostics expose only fixed stderr origins and bounded exit numbers',()=>{
  for(const [prefix,code]of [['sudo','launch_sudo'],['nsenter','launch_namespace'],['setpriv','launch_privileges'],['node','launch_node']]){
    const details=workerLaunchDetails({status:2,stderr:prefix+': SIMULATED_PRIVATE /private/token'});
    assert.deepEqual(details,{workerExit:2,workerLaunchStage:code});
    assert.doesNotMatch(JSON.stringify(details),/SIMULATED_PRIVATE|\/private/);
  }
  assert.deepEqual(workerLaunchDetails({status:0,stderr:'sudo: SIMULATED_PRIVATE'}),{workerExit:0});
  assert.deepEqual(workerLaunchDetails({status:999,stderr:'unknown SIMULATED_PRIVATE'}),{});
  assert.deepEqual(workerFailureDetails({workerLaunchStage:'SIMULATED_PRIVATE',workerExit:999}),{});
});

test('invalid explicit runtime directories fail before ownership or namespace access',()=>{
  for(const value of [undefined,null,0,{},'', '/', 'relative', '/tmp/../tmp','/tmp/', '/tmp\0bad','x'.repeat(4097)]){
    const f=preflightFixture();let reads=0;f.probe.fs.readFileSync=()=>{reads++;throw Error('unexpected ownership read');};
    assert.throws(()=>initializeWorker('/tmp/'+projectName,value,()=>{},f.probe),error=>error.workerStage==='worker_runtime_temp');
    assert.equal(reads,0);
  }
});
test('runtime directory validation rejects missing paths, files, symlinks and foreign workspace parents',()=>scratch(base=>{
  const directory=path.join(base,'runtime');fs.mkdirSync(directory);
  const file=path.join(base,'file');fs.writeFileSync(file,'');
  const link=path.join(base,'alias');fs.symlinkSync(directory,link);
  for(const value of [path.join(base,'absent'),file,link,base]){
    assert.throws(()=>workerRuntimeDirectory(path.join(directory,projectName),value));
  }
  assert.equal(workerRuntimeDirectory(path.join(directory,projectName),directory),directory);
}));
test('valid private runtime context survives missing or hostile inherited RUNNER_TEMP',()=>{
  const previous=process.env.RUNNER_TEMP;
  try{
    for(const inherited of [undefined,'/foreign/private-context']){
      if(inherited===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=inherited;
      const f=preflightFixture(),stages=[];
      assert.deepEqual(initializeWorker('/tmp/'+projectName,'/tmp',stage=>stages.push(stage),f.probe),f.identity);
      assert.deepEqual(stages,WORKER_PREFLIGHT_STAGES.slice(0,10));
      const controller=controllerFixture();assert.equal(controller.run().report.result,'passed');
      assert.equal(JSON.parse(controller.state.launched.options.input).runtimeTemp,'/tmp');
      assert.equal(controller.state.launched.options.env.RUNNER_TEMP,undefined);
    }
  }finally{if(previous===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=previous;}
});
test('controller rejects unvalidated private runtime context before privileged launch',()=>{
  for(const value of [undefined,'relative','/tmp/../tmp','/foreign/absent']){
    const f=controllerFixture();f.prepared.runtimeTemp=value;
    assert.throws(f.run,error=>error.workerStage==='controller_identity');
    assert.equal(f.state.launched,null);
  }
});

test('JWT diagnostic stages are fixed, unique and reject unknown codes before any operation',async()=>{
  assert.equal(REAL_AUTH_STAGES.length,22);assert.equal(new Set(REAL_AUTH_STAGES).size,22);
  for(const stage of REAL_AUTH_STAGES)assert.match(stage,/^[a-z_]{1,80}$/);
  for(const stage of [undefined,null,'SIMULATED_PRIVATE','a_create_user /private/path',{},42]){
    let calls=0;await assert.rejects(realAuthStage(stage,()=>{calls++;}));assert.equal(calls,0);
    assert.deepEqual(realAuthFailureDetails({authStage:stage,token:'SIMULATED_PRIVATE'}),{});
  }
});
test('every JWT assertion diagnostic omits assertion values, SDK errors and private context',async()=>{
  for(const stage of REAL_AUTH_STAGES){
    let calls=0;
    await assert.rejects(realAuthStage(stage,()=>{
      calls++;assert.equal('SIMULATED_PRIVATE_JWT /private/path user@example.invalid','other');
    }),error=>{
      assert.equal(error instanceof Failure,false);assert.equal(error.message,'Local authentication assertion failed');
      assert.deepEqual(realAuthFailureDetails(error),{authStage:stage});
      assert.doesNotMatch(JSON.stringify(error)+error.stack,/SIMULATED_PRIVATE|\/private\/path|user@example/);
      assert.equal(error.cause,undefined);assert.equal(error.actual,undefined);assert.equal(error.expected,undefined);return true;
    });
    assert.equal(calls,1);
  }
});
test('async JWT diagnostic wrappers execute once and preserve success values and infrastructure classification',async()=>{
  const value={opaque:true};let calls=0;
  assert.equal(await realAuthStage('a_create_user',async()=>{calls++;return value;}),value);assert.equal(calls,1);
  for(const [category,exit]of [['database_timeout',124],['rpc_unavailable',1],['database_connection_failed',7]]){
    const original=new Failure(category,exit);
    await assert.rejects(realAuthStage('b_trial_rpc',async()=>{throw original;}),error=>{
      assert.equal(error,original);assert.equal(error.category,category);assert.equal(error.exitCode,exit);
      assert.deepEqual(realAuthFailureDetails(error),{authStage:'b_trial_rpc'});return true;
    });
  }
  await assert.rejects(realAuthStage('b_verify_token',async()=>{throw {token:'SIMULATED_PRIVATE'};}),error=>{
    assert.deepEqual(realAuthFailureDetails(error),{authStage:'b_verify_token'});
    assert.doesNotMatch(JSON.stringify(error),/SIMULATED_PRIVATE/);return true;
  });
});
test('controller preserves allowlisted JWT stages and recomputes failed native reports',()=>{
  for(const result of ['failed','infrastructure_failed']){
    const f=controllerFixture(),rows=[{id:'schema_dependencies',result:'passed'},
      {id:'real_auth_jwt',result,category:result==='failed'?'assertion_failed':'database_timeout',
        ...(result==='infrastructure_failed'?{exit:124}:{}),authStage:'b_trial_result'}];
    f.state.report={...summarize(rows,true),observations:{}};f.state.outcome={status:1,stdout:''};
    const report=f.run().report;
    assert.deepEqual(report.checks,rows);assert.equal(report.result,'failed');
    assert.equal(report.completed,2);assert.equal(report.passed,1);assert.equal(report.missing.length,19);
  }
});
test('controller rejects forged JWT diagnostics, wrong groups and stages attached to passing checks',()=>{
  for(const [id,result,authStage]of [
    ['real_auth_jwt','failed','SIMULATED_PRIVATE'],['real_auth_jwt','failed',null],
    ['schema_dependencies','failed','a_verify_token'],['real_auth_jwt','passed','a_verify_token'],
  ]){
    const f=controllerFixture();f.state.report.checks=[{id,result,authStage}];f.state.outcome={status:1,stdout:''};
    assert.throws(f.run,error=>error.workerStage==='controller_report_checks');
  }
});
test('JWT diagnostics cannot change native pass/fail status or make an incomplete suite pass',()=>{
  for(const authStage of REAL_AUTH_STAGES){
    const rows=complete();Object.assign(rows[1],{result:'failed',category:'assertion_failed',authStage});
    const report=summarize(rows,true);assert.equal(report.invalid,false);assert.equal(report.result,'failed');
    assert.deepEqual(report.failed,['real_auth_jwt']);assert.equal(report.passed,20);
    assert.equal(summarize(rows.slice(0,2),true).result,'failed');
  }
  for(const [index,stage]of [[0,'a_verify_token'],[1,'SIMULATED_PRIVATE'],[1,'a_verify_token']]){
    const rows=complete();rows[index].authStage=stage;
    const report=summarize(rows,true);assert.equal(report.invalid,true);assert.equal(report.result,'failed');
  }
});

test('admin response validator preserves a valid response and original UUID validation',async()=>{
  const response={error:null,data:{user:{id}}};let calls=0;
  assert.equal(await checkedAuthCreate(async()=>{calls++;return response;}),response);assert.equal(calls,1);
  assert.equal(createdAuthIdentity(response),id);
});
test('admin request rejection is distinct from a resolved response error and never retries',async()=>{
  let calls=0;
  await assert.rejects(realAuthStage('a_create_user',()=>checkedAuthCreate(async()=>{
    calls++;throw new Error('SIMULATED_PRIVATE credential user@example.invalid /private/path');
  })),error=>{
    assert.deepEqual(realAuthFailureDetails(error),{authStage:'a_create_user',authCreateOutcome:'request_rejected',authCreateReason:'unclassified',authCreateHttp:'unavailable'});
    assert.doesNotMatch(JSON.stringify(error)+error.stack,/SIMULATED_PRIVATE|user@example|\/private\/path/);return true;
  });
  assert.equal(calls,1);
  await assert.rejects(realAuthStage('b_create_user',()=>checkedAuthCreate(async()=>({data:{user:null},
    error:{code:'not_admin',status:403,message:'SIMULATED_PRIVATE'}}))),error=>{
    assert.deepEqual(realAuthFailureDetails(error),{authStage:'b_create_user',authCreateOutcome:'response_error',authCreateReason:'admin_authorization',authCreateHttp:'unavailable'});
    assert.doesNotMatch(JSON.stringify(error)+error.stack,/SIMULATED_PRIVATE/);return true;
  });
});
test('admin malformed success responses fail closed before identity is consumed',async()=>{
  for(const response of [undefined,null,[],{}, {error:undefined},{error:null},{error:null,data:null},
    {error:null,data:[]},{error:null,data:{user:null}},{error:null,data:{user:[]}}]){
    await assert.rejects(realAuthStage('a_create_user',()=>checkedAuthCreate(async()=>response)),error=>{
      assert.deepEqual(realAuthFailureDetails(error),{authStage:'a_create_user',authCreateOutcome:'malformed_response',authCreateHttp:'unavailable'});return true;
    });
  }
});
test('admin identity assertion remains separate from request and response validation',async()=>{
  for(const invalid of [undefined,null,'SIMULATED_PRIVATE','not-a-uuid',42]){
    const response={error:null,data:{user:{id:invalid}}};assert.equal(await checkedAuthCreate(async()=>response),response);
    await assert.rejects(realAuthStage('a_created_identity',()=>createdAuthIdentity(response)),error=>{
      assert.deepEqual(realAuthFailureDetails(error),{authStage:'a_created_identity',authCreateOutcome:'identity_assertion'});
      assert.doesNotMatch(JSON.stringify(error)+error.stack,/SIMULATED_PRIVATE/);return true;
    });
  }
});
test('admin error hints expose only fixed allowlisted classifications',()=>{
  for(const [input,expected]of [
    [{code:'email_address_invalid'},'email_invalid'],[{code:'email_exists'},'identity_exists'],[{code:'user_already_exists'},'identity_exists'],
    [{code:'validation_failed'},'input_validation'],[{code:'weak_password'},'password_policy'],[{code:'not_admin'},'admin_authorization'],
    [{code:'bad_jwt'},'token_rejected'],[{code:'request_timeout'},'request_timeout'],[{code:'over_request_rate_limit'},'rate_limit'],
    [{code:'unexpected_failure'},'service_error'],[{name:'AuthUnknownError'},'response_decode'],
    [{status:0},'no_http_status'],[{status:400},'bad_request'],[{status:401},'unauthorized'],[{status:403},'forbidden'],
    [{status:409},'conflict'],[{status:422},'unprocessable'],[{status:429},'rate_limit'],[{status:500},'server_error'],[{status:599},'server_error'],
    [{code:'SIMULATED_PRIVATE',status:999,message:'SIMULATED_PRIVATE'},'unclassified'],[{code:'__proto__'},'unclassified'],
    [{status:'401'},'unclassified'],[{status:NaN},'unclassified'],[null,'unclassified'],
  ]){
    assert.equal(authCreateReason(input),expected);assert.ok(AUTH_CREATE_REASONS.includes(expected));
  }
});
test('admin operation diagnostics preserve infrastructure category and exit without leaking errors',async()=>{
  const original=new Failure('database_timeout',124);let calls=0;
  await assert.rejects(realAuthStage('a_create_user',()=>checkedAuthCreate(async()=>{calls++;throw original;})),error=>{
    assert.equal(error,original);assert.equal(error.category,'database_timeout');assert.equal(error.exitCode,124);
    assert.deepEqual(realAuthFailureDetails(error),{authStage:'a_create_user',authCreateOutcome:'request_rejected',authCreateReason:'unclassified',authCreateHttp:'unavailable'});return true;
  });
  assert.equal(calls,1);
});
test('controller preserves all four admin outcomes without changing failed native results',()=>{
  for(const outcome of AUTH_CREATE_OUTCOMES){
    const authStage=outcome==='identity_assertion'?'a_created_identity':'a_create_user';
    const details={authStage,authCreateOutcome:outcome,...(outcome!=='identity_assertion'?{authCreateHttp:'unavailable'}:{}),
      ...(['request_rejected','response_error'].includes(outcome)?{authCreateReason:'unclassified'}:{})};
    const f=controllerFixture(),rows=[{id:'schema_dependencies',result:'passed'},
      {id:'real_auth_jwt',result:'failed',category:'assertion_failed',...details}];
    assert.equal(validRealAuthDiagnostics(rows[1]),true);
    f.state.report={...summarize(rows,true),observations:{}};f.state.outcome={status:1,stdout:''};
    const report=f.run().report;assert.deepEqual(report.checks,rows);assert.equal(report.result,'failed');
    assert.equal(report.completed,2);assert.equal(report.passed,1);assert.equal(report.missing.length,19);
  }
});
test('forged admin diagnostic fields and incoherent stage/outcome pairs are rejected',()=>{
  const base={id:'real_auth_jwt',result:'failed',authStage:'a_create_user',authCreateOutcome:'response_error',authCreateReason:'forbidden',authCreateHttp:'http_4xx'};
  for(const patch of [
    {id:'schema_dependencies'},{result:'passed'},{authStage:'b_verify_token'},{authStage:null},
    {authCreateOutcome:'SIMULATED_PRIVATE'},{authCreateOutcome:'identity_assertion'},
    {authCreateReason:'SIMULATED_PRIVATE'},{authCreateReason:null},{authCreateReason:undefined},
    {authStage:'a_created_identity',authCreateOutcome:'malformed_response',authCreateHttp:'unavailable'},
    {authCreateOutcome:undefined},{authCreateOutcome:null},{authCreateHttp:'SIMULATED_PRIVATE'},{authCreateHttp:null},{authCreateHttp:undefined},
  ]){
    const row={...base,...patch};assert.equal(validRealAuthDiagnostics(row),false);
    const rows=complete();rows[1]=row;assert.equal(summarize(rows,true).invalid,true);
    const f=controllerFixture();f.state.report={...summarize([rows[0],row],true),observations:{}};
    f.state.outcome={status:1,stdout:''};
    assert.throws(f.run,error=>error.workerStage==='controller_report_checks');
  }
});

test('admin HTTP observations distinguish absent responses, HTTP refusal and SDK errors after HTTP success',async()=>{
  const call=status=>({method:'POST',path:'/auth/v1/admin/users',status});
  for(const [calls,expected]of [[[],'no_request'],[[call(null)],'no_response'],[[call(200)],'http_2xx'],
    [[call(201)],'http_2xx'],[[call(401)],'http_4xx'],[[call(403)],'http_4xx'],[[call(500)],'http_5xx'],
    [[call(302)],'http_other'],[[call(200),call(200)],'unexpected_requests'],
    [[{method:'GET',path:'SIMULATED_PRIVATE',status:200}],'unexpected_requests'],
    [[call('SIMULATED_PRIVATE')],'unavailable'],[null,'unavailable']]){
    assert.equal(authCreateHttpResult(calls),expected);assert.ok(AUTH_CREATE_HTTP.includes(expected));
  }
  for(const status of [201,403]){
    await assert.rejects(realAuthStage('a_create_user',()=>checkedAuthCreate(async()=>({error:{status:0},data:{user:null}}),
      ()=>authCreateHttpResult([call(status)]))),error=>{
      assert.deepEqual(realAuthFailureDetails(error),{authStage:'a_create_user',authCreateOutcome:'response_error',
        authCreateReason:'no_http_status',authCreateHttp:status===201?'http_2xx':'http_4xx'});return true;
    });
  }
});
test('failed HTTP observation cannot hide an original admin failure or expose private details',async()=>{
  for(const observe of [()=>{throw Error('SIMULATED_PRIVATE');},()=> 'SIMULATED_PRIVATE']){
    await assert.rejects(realAuthStage('a_create_user',()=>checkedAuthCreate(async()=>({error:{code:'not_admin'},data:{user:null}}),observe)),error=>{
      assert.deepEqual(realAuthFailureDetails(error),{authStage:'a_create_user',authCreateOutcome:'response_error',
        authCreateReason:'admin_authorization',authCreateHttp:'unavailable'});
      assert.doesNotMatch(JSON.stringify(error)+error.stack,/SIMULATED_PRIVATE/);return true;
    });
  }
});

function authLog(error='SIMULATED_PRIVATE',patch={}){
  return JSON.stringify({component:'api',method:'POST',path:'/admin/users',level:'error',status:500,msg:'request completed',
    error,request_id:'SIMULATED_PRIVATE_ID',auth_event:{user_email:'SIMULATED_PRIVATE'},...patch})+'\n';
}
test('Auth server classifier maps a single structured PostgreSQL error to a fixed category only',()=>{
  for(const [code,category]of [
    ['42P01','database_dependency'],['42703','database_dependency'],['42883','database_dependency'],['3F000','database_dependency'],
    ['42501','database_privilege'],['23503','database_constraint'],['23505','database_constraint'],['P0001','database_raised_exception'],
    ['ZX009','database_raised_exception'],['08006','database_connection'],['57P01','database_connection'],['53300','database_resource'],
    ['57014','database_timeout'],['55P03','database_timeout'],['25P03','database_timeout'],['25P02','database_transaction'],
    ['40001','database_transaction'],['40P01','database_transaction'],['22001','database_data_error'],['XX000','database_other'],
  ]){
    const result=classifyAuthServerLogs(authLog('SIMULATED_PRIVATE SQL and credentials (SQLSTATE '+code+')'));
    assert.equal(result,category);assert.ok(AUTH_CREATE_SERVER.includes(result));
    assert.doesNotMatch(result,/SIMULATED|SQLSTATE|42P01|23503|42501/);
  }
});
test('Auth server classifier rejects absent, unrelated, ambiguous and unstructured evidence',()=>{
  assert.equal(classifyAuthServerLogs('SIMULATED_PRIVATE (SQLSTATE 42501)'),'no_matching_auth_log');
  for(const patch of [{component:'other'},{method:'GET'},{path:'/other'},{level:'info'},{status:400},{msg:'other'}]){
    assert.equal(classifyAuthServerLogs(authLog('(SQLSTATE 42501)',patch)),'no_matching_auth_log');
  }
  assert.equal(classifyAuthServerLogs(authLog('(SQLSTATE 42501)')+authLog('(SQLSTATE 42501)')),'ambiguous_auth_log');
  assert.equal(classifyAuthServerLogs(authLog('(SQLSTATE 42501) (SQLSTATE 25P02)')),'ambiguous_database_error');
  assert.equal(classifyAuthServerLogs(authLog('SQLSTATE 42501 without the driver marker')),'gotrue_server_unclassified');
  assert.equal(classifyAuthServerLogs(authLog()),'gotrue_server_unclassified');
  assert.equal(classifyAuthServerLogs(authLog('',{panic:'SIMULATED_PRIVATE'})),'gotrue_panic');
  assert.equal(classifyAuthServerLogs('x'.repeat(512*1024+1)),'unavailable');
  assert.equal(classifyAuthServerLogs(authLog('x'.repeat(65537))),'no_matching_auth_log');
});
function authServerFixture(){
  const workdir='/tmp/'+projectName,i=identity(),peer=i.peers[2];
  const state={marker:{project:projectName,source:SOURCE_COMMIT},journal:{version:1,project:projectName,identity:i,rules:isolationRules(projectName,i)},
    item:{id:peer.id,name:'/supabase_auth_'+projectName,project:projectName,running:true,pid:peer.pid,privileged:false},
    outcome:{status:0,stdout:'',stderr:authLog('(SQLSTATE 42501)')},verified:false,captures:[],inspections:[],badNamespace:false};
  const probe={now:()=>100000,fs:{realpathSync:()=>workdir,readFileSync:file=>JSON.stringify(file.endsWith('owned.json')?state.marker:state.journal)},
    run:(exe,args)=>{assert.equal(exe,'docker');assert.equal(args[0],'inspect');state.inspections.push(args);return JSON.stringify(state.item);},
    verifyNamespaceHandle:value=>{assert.equal(value.id,peer.id);assert.equal(value.hostNamespace,i.hostNamespace);assert.equal(state.badNamespace,false);state.verified=true;},
    capture:(exe,args,options)=>{assert.equal(state.verified,true);state.captures.push({exe,args,options});return state.outcome;},
  };
  return {state,probe,workdir,run:()=>authServerDiagnostics(workdir,99000,100000,probe)};
}
test('Auth diagnostics read only bounded logs from the owned ID after revalidating namespace and PID',()=>{
  const f=authServerFixture();assert.equal(f.run(),'database_privilege');assert.equal(f.state.captures.length,1);
  const {exe,args,options}=f.state.captures[0];assert.equal(exe,'docker');assert.equal(args[0],'logs');
  assert.deepEqual(args.slice(-3),['--tail','64',f.state.item.id]);assert.ok(args.includes('--since'));assert.ok(args.includes('--until'));
  assert.ok(args.includes('--follow'));
  assert.equal(options.timeout,5000);assert.equal(options.maxBuffer,512*1024);assert.equal(options.env.DOCKER_HOST,'unix:///var/run/docker.sock');
  assert.doesNotMatch(f.state.inspections[0][2],/Config\.Env|\.State\.Error/);
});
test('foreign ownership, unsafe journals and stale namespaces prevent any Auth log read',()=>{
  for(const mutate of [s=>s.marker.source='foreign',s=>s.marker.project='foreign',s=>s.journal.project='foreign',
    s=>s.item.id='f'.repeat(64),s=>s.item.name='/foreign',s=>s.item.project='foreign',s=>s.item.privileged=true,
    s=>s.badNamespace=true,s=>s.item.pid=0]){
    const f=authServerFixture();mutate(f.state);assert.equal(f.run(),'ownership_unverified');assert.equal(f.state.captures.length,0);
  }
  const f=authServerFixture();assert.equal(authServerDiagnostics(f.workdir,1,100000,f.probe),'ownership_unverified');assert.equal(f.state.captures.length,0);
});
test('owned Auth liveness changes are reported without entering stale namespaces or reading logs',()=>{
  for(const [mutate,code]of [[s=>s.item.running=false,'auth_service_not_running'],[s=>s.item.pid++,'auth_service_restarted']]){
    const f=authServerFixture();mutate(f.state);assert.equal(f.run(),code);assert.equal(f.state.captures.length,0);assert.equal(f.state.verified,false);
  }
});
test('Auth diagnostic timeout or log failure cannot expose private output or replace the native failure',()=>{
  for(const outcome of [{status:1,stderr:'SIMULATED_PRIVATE'}, {status:0,stdout:'x'.repeat(512*1024+1)},
    {error:{code:'ETIMEDOUT'},stderr:'SIMULATED_PRIVATE'}, {signal:'SIGTERM',stdout:'SIMULATED_PRIVATE'}]){
    const f=authServerFixture();f.state.outcome=outcome;assert.equal(f.run(),'unavailable');assert.equal(f.state.captures.length,1);
  }
});
test('controller preserves allowlisted server categories only on failed admin HTTP 5xx checks',()=>{
  for(const authCreateServer of AUTH_CREATE_SERVER){
    const f=controllerFixture(),row={id:'real_auth_jwt',result:'failed',category:'assertion_failed',authStage:'a_create_user',
      authCreateOutcome:'response_error',authCreateReason:'server_error',authCreateHttp:'http_5xx',authCreateServer};
    f.state.report={...summarize([{id:'schema_dependencies',result:'passed'},row],true),observations:{}};f.state.outcome={status:1,stdout:''};
    const report=f.run().report;assert.deepEqual(report.checks[1],row);assert.equal(report.result,'failed');assert.equal(report.passed,1);
  }
});
test('forged or incoherent server diagnostics cannot pass controller or summary validation',()=>{
  const base={id:'real_auth_jwt',result:'failed',authStage:'a_create_user',authCreateOutcome:'response_error',
    authCreateReason:'server_error',authCreateHttp:'http_5xx',authCreateServer:'database_privilege'};
  for(const patch of [{authCreateServer:'SIMULATED_PRIVATE'},{authCreateServer:null},{authCreateServer:undefined},
    {authCreateHttp:'http_4xx'},{authStage:'a_verify_token'},{id:'schema_dependencies'},{result:'passed'}]){
    const row={...base,...patch};assert.equal(validRealAuthDiagnostics(row),false);
    assert.equal(summarize([row],true).invalid,true);
    const f=controllerFixture();f.state.report={...summarize([row],true),observations:{}};f.state.outcome={status:1,stdout:''};
    // undefined cannot survive JSON; use a literal raw JSON with an unknown
    // value so this case still tests the remote report's untrusted boundary.
    if(patch.authCreateServer===undefined&&Object.hasOwn(patch,'authCreateServer'))f.state.raw=JSON.stringify({...f.state.report,checks:[{...row,authCreateServer:null}]});
    assert.throws(f.run,error=>error.workerStage==='controller_report_checks');
  }
});

function gatewayReloadFixture(base){
  const root=path.join(base,projectName);createWorkspace(root);const i=identity();i.handle=path.join(root,'kong-netns');
  for(const peer of i.peers)peer.handle=path.join(root,path.basename(peer.handle));
  fs.writeFileSync(path.join(root,'isolation.json'),JSON.stringify({version:1,project:projectName,identity:i,rules:isolationRules(projectName,i)}));
  const peer=i.peers[0],state={view:{id:peer.id,name:'/supabase_kong_'+projectName,project:projectName,running:true,pid:peer.pid,privileged:false},
    calls:[],reloads:0,checks:0,uid:String(i.kongUid),afterReload:null,reloadError:null};
  const run=(exe,args)=>{
    assert.equal(exe,'docker');state.calls.push(args);
    if(args[0]==='inspect')return JSON.stringify(state.view);
    assert.equal(args[0],'exec');assert.equal(args[1],peer.id);
    if(args.at(-2)==='id')return state.uid;
    if(args.at(-1)==='reload'){
      state.reloads++;if(state.reloadError)throw state.reloadError;state.afterReload?.();return '';
    }
    assert.equal(args.at(-1),'health');return '';
  };
  const verify=value=>{assert.equal(value.id,peer.id);assert.equal(value.handle,i.handle);assert.equal(value.hostNamespace,i.hostNamespace);state.checks++;};
  return {root,i,state,run:()=>reloadOwnedGateway(root,i,run,verify)};
}
test('Kong hosts refresh reloads the same owned master once and rechecks UID, PID and namespace',()=>scratch(base=>{
  const f=gatewayReloadFixture(base);f.run();assert.equal(f.state.reloads,1);assert.equal(f.state.checks,2);
  assert.deepEqual(f.state.calls.filter(args=>args[0]==='exec').map(args=>args.slice(2)),[
    ['id','-u'],['kong','reload'],['id','-u'],['kong','health'],
  ]);
  assert.ok(f.state.calls.every(args=>!args.includes('restart')&&!args.includes('start')&&!args.includes('sh')));
  assert.match(runtime,/installOwnedHosts\(root,identity\);[\s\S]*?reloadOwnedGateway\(root,identity\);verifyIsolation\(root,command\)/);
}));
test('Kong reload refuses foreign ownership, stale PID and malformed UID before any reload',()=>{
  for(const mutate of [s=>s.view.project='foreign',s=>s.view.id='f'.repeat(64),s=>s.view.name='/foreign',
    s=>s.view.running=false,s=>s.view.pid++,s=>s.view.privileged=true,s=>s.uid='',s=>s.uid='1001'])scratch(base=>{
    const f=gatewayReloadFixture(base);mutate(f.state);assert.throws(f.run);assert.equal(f.state.reloads,0);
  });
});
test('Kong reload failures and changed post-reload identities stay nonzero without retries',()=>{
  scratch(base=>{const f=gatewayReloadFixture(base),error=new Failure('command_failed',7);f.state.reloadError=error;
    assert.throws(f.run,value=>value===error);assert.equal(f.state.reloads,1);assert.equal(f.state.checks,1);
  });
  for(const mutate of [s=>s.view.pid++,s=>s.uid='1001'])scratch(base=>{
    const f=gatewayReloadFixture(base);f.state.afterReload=()=>mutate(f.state);
    assert.throws(f.run);assert.equal(f.state.reloads,1);assert.equal(f.state.calls.some(args=>args.at(-1)==='health'),false);
  });
  for(const [action,operation]of [['reload','reload_owned_gateway'],['health','health_owned_gateway']]){
    assert.equal(commandDiagnostic('docker',['exec','SIMULATED_PRIVATE','kong',action],{status:1,stderr:'SIMULATED_PRIVATE'}).operation,operation);
  }
});
test('gateway origin diagnostics read only three allowlisted headers and never the response body',()=>{
  const cases=[
    [{'x-kong-response-latency':'0'},'gateway_generated'],
    [{'x-kong-upstream-latency':'1'},'proxy_attempted'],
    [{'x-kong-upstream-latency':'1','x-sb-error-code':'unexpected_failure'},'gotrue_error_signal'],
    [{'x-sb-error-code':'unexpected_failure'},'gotrue_error_signal'],
    [{'x-kong-response-latency':'0','x-kong-upstream-latency':'1'},'conflicting_headers'],
    [{'x-kong-response-latency':'0','x-sb-error-code':'unexpected_failure'},'conflicting_headers'],
    [{'server':'kong/SIMULATED_PRIVATE','via':'SIMULATED_PRIVATE'},'unavailable'],
    [{'x-kong-response-latency':'SIMULATED_PRIVATE'},'unavailable'],[{},'unavailable'],
  ];
  for(const [headers,expected]of cases){
    const reads=[];const response={headers:{get:name=>{reads.push(name);return headers[name]??null;}},
      get body(){throw Error('Body must never be read');},json(){throw Error('Body must never be read');}};
    assert.equal(authResponseOrigin(response),expected);assert.ok(AUTH_CREATE_ORIGINS.includes(expected));
    assert.ok(reads.every(name=>['x-kong-response-latency','x-kong-upstream-latency','x-sb-error-code'].includes(name)));
  }
});
test('guard records closed origin codes only for the exact failed admin request',async()=>{
  const response=new Response('SIMULATED_PRIVATE',{status:500,headers:{'x-kong-response-latency':'2'}});
  const guard=trafficGuard(async()=>response);assert.equal(await guard.fetch(API_ORIGIN+'/auth/v1/admin/users',{method:'POST'}),response);
  assert.equal(authCreateOriginResult(guard.state.calls),'gateway_generated');
  assert.doesNotMatch(JSON.stringify(guard.state.calls),/SIMULATED_PRIVATE|x-kong|latency/);
  const other=trafficGuard(async()=>response);await other.fetch(API_ORIGIN+'/auth/v1/health');
  assert.equal('authOrigin' in other.state.calls[0],false);assert.equal(authCreateOriginResult(other.state.calls),'unavailable');
});
test('a closed log window may retain complete evidence on bounded follow timeout, never partial or truncated output',()=>{
  const f=authServerFixture();let clock=0;f.probe.now=()=>clock++===0?100000:105000;
  f.state.outcome={error:{code:'ETIMEDOUT'},signal:'SIGTERM',status:null,stdout:authLog('(SQLSTATE 42501)')};
  assert.equal(f.run(),'database_privilege');
  for(const patch of [{stdout:authLog('(SQLSTATE 42501)').trim()},{stdout:'{"partial":'},
    {error:{code:'ENOBUFS'}},{signal:'SIGKILL'},{stdout:'SIMULATED_PRIVATE\n'}]){
    const f=authServerFixture();let clock=0;f.probe.now=()=>clock++===0?100000:105000;
    f.state.outcome={error:{code:'ETIMEDOUT'},signal:'SIGTERM',status:null,stdout:authLog('(SQLSTATE 42501)'),...patch};
    assert.equal(f.run(),'unavailable');
  }
  const open=authServerFixture();open.state.outcome={error:{code:'ETIMEDOUT'},signal:'SIGTERM',status:null,stdout:authLog('(SQLSTATE 42501)')};
  assert.equal(open.run(),'unavailable');
});
test('origin evidence survives failed reports but cannot make a check pass or appear without HTTP 5xx',()=>{
  for(const authCreateOrigin of AUTH_CREATE_ORIGINS){
    const f=controllerFixture(),row={id:'real_auth_jwt',result:'failed',category:'assertion_failed',authStage:'a_create_user',
      authCreateOutcome:'response_error',authCreateReason:'server_error',authCreateHttp:'http_5xx',authCreateOrigin};
    f.state.report={...summarize([{id:'schema_dependencies',result:'passed'},row],true),observations:{}};f.state.outcome={status:1,stdout:''};
    assert.deepEqual(f.run().report.checks[1],row);
    for(const patch of [{authCreateOrigin:'SIMULATED_PRIVATE'},{authCreateHttp:'http_4xx'},{result:'passed'}]){
      const bad={...row,...patch};assert.equal(validRealAuthDiagnostics(bad),false);assert.equal(summarize([bad],true).invalid,true);
      const f=controllerFixture();f.state.report={...summarize([bad],true),observations:{}};f.state.outcome={status:1,stdout:''};
      assert.throws(f.run,error=>error.workerStage==='controller_report_checks');
    }
  }
});
