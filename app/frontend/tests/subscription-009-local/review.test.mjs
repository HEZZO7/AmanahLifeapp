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
  trafficGuard,commandCategory,commandDiagnostic,commandFailureDetails,summarize,sha256,gitBlob,assertCleanEnvironment,Failure,failureLatch,expectSQLFailure,throwIfDatabaseInfrastructure,PG_LIMITS,PG_OPTIONS,sessionPrefix} from './safety.mjs';
import {command,cleanup,createWorkspace,verifySource,verifyPackage,shutdown,withSessions,ownedSessionSQL} from './local-runtime.mjs';
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
  assert.match(runner,/infrastructureFailure=\{phase,[^\n]*commandFailureDetails\(error\)/);
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
  assert.match(runtime,/identity.hostEntries.join/);assert.match(runtime,/runIsolatedWorker|worker-report/);
  assert.match(runtime,/--no-new-privs/);assert.match(runtime,/--bounding-set=-all/);
  assert.match(runtime,/env:\{\.\.\.childEnv,RUNNER_TEMP/);assert.doesNotMatch(runtime,/env:process.env/);
});
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
