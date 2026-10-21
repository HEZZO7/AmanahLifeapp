// Offline/static only. Never invokes execute(), SQL, Docker, Supabase or SDK.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {workspace,allowedURL,commandCategory,summarize,CHECKS,SOURCE_COMMIT,SDK_VERSION,CLI_VERSION,CLI_ARCHIVE_SHA256} from './safety.mjs';
import {cleanup,createWorkspace,historyRetentionSQL} from './integration.mjs';

const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
const runner=read('./integration.mjs'),fixture=read('./fixture.sql'),meta=read('./metadata.sql');
const complete=()=>CHECKS.map(id=>({id,result:'passed'}));
test('known security failures remain FAILED despite successful cleanup',()=>{
  for(const id of ['failed_delete_preserves_trial','failed_delete_cannot_restart_trial']){
    const results=complete();results.find(x=>x.id===id).result='failed';
    const report=summarize(results,true);
    assert.equal(report.result,'failed');assert.ok(report.failed.includes(id));
    assert.match(runner,/process\.exitCode=result\.result==='passed'\?0:1/);
  }
});
test('both known failures remain mandatory and are not converted to xfail/skip',()=>{
  const results=complete().map(x=>x.id.startsWith('failed_delete_')&&x.id!=='failed_delete_setup'?{...x,result:'failed'}:x);
  assert.equal(summarize(results,true).failed.length,2);
  assert.equal(summarize(results,true).result,'failed');
  assert.equal(/test\.skip|test\.todo|result:'skipped'|expectedFailure\s*:/.test(runner),false);
  assert.match(runner,/assert\.deepEqual\(currentRows\(B\)\.subscription,trialBefore/);
  assert.match(runner,/r\.data\.error,'trial_already_used'/);
});
test('missing, duplicate, invalid and skipped checks cannot pass',()=>{
  for(const results of [[],complete().slice(1),[...complete(),complete()[0]],
    complete().map((x,i)=>i?x:{...x,result:'skipped'}),[...complete(),{id:'extra',result:'passed'}]]){
    assert.equal(summarize(results,true).result,'failed');
  }
});
test('failed or unverified cleanup prevents success',()=>{
  for(const value of [false,undefined,null,'true'])assert.equal(summarize(complete(),value).result,'failed');
  assert.equal(summarize(complete(),true).result,'passed');
});
test('only fixed local Auth/PostgREST URLs are accepted',()=>{
  for(const route of ['/auth/v1/token','/rest/v1/rpc/test'])assert.equal(allowedURL('http://127.0.0.1:54321'+route).hostname,'127.0.0.1');
  for(const target of ['https://example.invalid/rest/v1/','http://localhost:54321/rest/v1/',
    'http://127.0.0.1:54322/rest/v1/','http://127.0.0.1:54321/functions/v1/test',
    'http://user@127.0.0.1:54321/rest/v1/','http://127.0.0.1:54321/rest/v1/#secret']){
    assert.throws(()=>allowedURL(target));
  }
});
test('workspace cannot overlap source, escape root or use an unowned project name',()=>{
  assert.equal(workspace('/tmp/amanah-008-123-aabbccdd','/tmp','/workspace/source'),'amanah-008-123-aabbccdd');
  for(const args of [['/tmp/other','/tmp'],['/tmp/sub/amanah-008-1-aabbccdd','/tmp'],
    ['/tmp/amanah-008-1-aabbccdd','/tmp','/tmp/amanah-008-1-aabbccdd/subject']])assert.throws(()=>workspace(...args));
});
test('diagnostics expose fixed categories rather than simulated credentials',()=>{
  for(const category of ['port_conflict','docker_unavailable','image_download','database_bootstrap','service_health','network','command_failed']){
    const sample={port_conflict:'address already in use',docker_unavailable:'cannot connect to the docker daemon',
      image_download:'failed to pull',database_bootstrap:'error running container: exit',
      service_health:'unhealthy',network:'no such host',command_failed:'unknown'}[category];
    const result=commandCategory(sample+' password=SIMULATED jwt=SIMULATED');
    assert.equal(result,category);assert.equal(result.includes('SIMULATED'),false);
  }
});
test('immutable app source and exactly 001–005,008 dependencies are declared',()=>{
  const manifest=JSON.parse(read('./source-manifest.json'));
  assert.equal(manifest.sourceCommit,SOURCE_COMMIT);
  assert.equal(Object.keys(manifest.files).length,10);
  assert.deepEqual(Object.keys(manifest.files).filter(p=>p.includes('/migrations/')).map(p=>p.match(/00([1-8])_/)[1]),['1','2','3','4','5','8']);
  for(const hash of Object.values(manifest.files))assert.match(hash,/^[a-f0-9]{40}$/);
  assert.match(runner,/gitBlob\(fs\.readFileSync\(target\)\),hash/);
  assert.match(runner,/migrationFiles\.slice\(0,5\)/);
});
test('native fixture preserves real Auth objects and excludes old fixture seed users',()=>{
  assert.equal(/create role|create schema auth|create table auth\.users|alter table auth\.users|insert into auth\.users/i.test(fixture),false);
  assert.match(fixture,/user_id uuid not null unique references auth\.users\(id\)/);
  assert.match(fixture,/trial_used boolean not null default false/);
  for(const name of ['families','family_members','family_budget_settings','family_budget_categories','family_income','family_expenses']){
    assert.match(fixture,new RegExp('create table public.app_11941c8fec_'+name+' \\('));
  }
  assert.match(fixture,/amanahlife\.local_test/);
});
test('SDK lock keeps the proven exact graph and integrity constraints',()=>{
  const pkg=JSON.parse(read('./package.json')),lock=JSON.parse(read('./package-lock.json'));
  assert.equal(pkg.name,lock.name);assert.deepEqual(pkg.dependencies,lock.packages[''].dependencies);
  assert.equal(pkg.dependencies['@supabase/supabase-js'],SDK_VERSION);
  assert.equal(Object.keys(lock.packages).length,10);
  for(const [key,value]of Object.entries(lock.packages))if(key){
    assert.match(value.resolved,/^https:\/\/registry\.npmjs\.org\//);
    assert.match(value.integrity,/^sha512-[A-Za-z0-9+/]+=*$/);
    assert.equal(value.hasInstallScript,undefined);
  }
  assert.equal(CLI_VERSION,'2.121.0');assert.match(CLI_ARCHIVE_SHA256,/^[a-f0-9]{64}$/);
});
test('metadata assertions cover actual ACLs, ownership, search_path, FK and trigger definitions',()=>{
  for(const item of ['pg_get_userbyid','prosecdef','proconfig','has_function_privilege','has_column_privilege','has_table_privilege',
    'pg_get_triggerdef','condeferrable','convalidated','relrowsecurity'])assert.ok(meta.includes(item));
  assert.match(runner,/assert\.equal\(t\.type,11\)/);
  assert.match(runner,/assert\.equal\(f\.owner,'postgres'\)/);
  assert.match(runner,/assert\.deepEqual\(metadata\(\),first\)/);
});
test('race assertions require independent live backend PIDs and observed blocking',()=>{
  assert.match(runner,/Promise\.all\(\[reservation\.pid\(\),deletion\.pid\(\)\]\)/);
  assert.match(runner,/waitForBlock\(dpid,rpid\)/);assert.match(runner,/waitForBlock\(rpid,dpid\)/);
  assert.match(runner,/pg_blocking_pids/);assert.match(runner,/wait_event_type='Lock'/);
  assert.match(runner,/result\.error\.sqlState,'42501'/);assert.match(runner,/result\.error\.sqlState,'23503'/);
  assert.match(runner,/required_lock_not_observed/);
});
test('actual delete adapter is loaded without a Deno runtime or external module download',()=>{
  assert.match(runner,/registerHooks/);assert.match(runner,/context\.parentURL===entry/);
  assert.match(runner,/unexpected_module_download/);assert.match(runner,/await import\(entry\)/);
  assert.match(runner,/capturedHandler\(request\(1/);
  assert.match(runner,/fixture_008_auth_failure/);
  assert.match(runner,/rejected,0/);
});
test('cleanup is independently invocable and runs even if closing sessions fails',()=>{
  assert.match(runner,/if\(opts\['--cleanup'\]\)/);
  assert.match(runner,/try\{stopped=await stopSessions\(\);\}catch/);
  assert.match(runner,/cleanupPassed=cleanup\(root\)&&stopped/);
  assert.equal(/docker.*prune|--all|functions deploy|db push|supabase login/.test(runner),false);
});
test('partial preparation cleanup uses only the owned directory',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'amanah008-offline-')),old=process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP=base;
  try{
    const root=path.join(base,'amanah-008-1-aabbccdd');createWorkspace(root);
    assert.equal(cleanup(root,()=>{assert.fail('No CLI/Docker for pre-start cleanup');}),true);
    assert.equal(fs.existsSync(root),false);
    const unknown=path.join(base,'amanah-008-2-aabbccdd');fs.mkdirSync(unknown);
    assert.throws(()=>cleanup(unknown,()=>''));assert.equal(fs.existsSync(unknown),true);
  }finally{if(old===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=old;fs.rmSync(base,{recursive:true,force:true});}
});
test('marker-write failure removes only its new empty workdir',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'amanah008-offline-')),old=process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP=base;
  try{
    const root=path.join(base,'amanah-008-1-aabbccdd');
    assert.throws(()=>createWorkspace(root,()=>{throw Error('synthetic marker write failure');}));
    assert.equal(fs.existsSync(root),false);
  }finally{if(old===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=old;fs.rmSync(base,{recursive:true,force:true});}
});
test('failed native stop is a cleanup failure and retains ownership for fallback',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'amanah008-offline-')),old=process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP=base;
  try{
    const root=path.join(base,'amanah-008-1-aabbccdd');createWorkspace(root);fs.writeFileSync(path.join(root,'start-attempted'),'1');
    fs.writeFileSync(path.join(root,'private-1.log'),'synthetic private text');
    assert.equal(cleanup(root,()=>{throw Error('synthetic stop/inspect failure');}),false);
    assert.equal(fs.existsSync(path.join(root,'owned.json')),true);
    assert.equal(fs.existsSync(path.join(root,'private-1.log')),false);
  }finally{if(old===undefined)delete process.env.RUNNER_TEMP;else process.env.RUNNER_TEMP=old;fs.rmSync(base,{recursive:true,force:true});}
});

// This is a static SQL contract check, never a database or integration execution.
const historicalUser='10000000-0000-4000-8000-000000000001';
const cleanUser='10000000-0000-4000-8000-000000000002';
function requireHistoryIsolation(text){
  assert.match(text,/^begin;[\s\S]*rollback;$/);
  assert.doesNotMatch(text,/\b(?:commit|delete|truncate|alter|grant|revoke|drop)\b/i);
  for(const pattern of [
    /access_end=least\(access_end,transaction_timestamp\(\)-interval '1 second'\)/,
    /service_period_end=case when service_period_end is null then null/,
    /expires_at=least\(expires_at,transaction_timestamp\(\)-interval '1 second'\)/,
    /last_state=jsonb_set\(last_state,'\{provider_status\}','"expired"'::jsonb\)/,
    /tier='free',status='expired'/,
    /Historical evidence missing/,
    /Historical evidence changed/,
    /Synthetic account missing/,
    /Current obligation or entitlement remains/,
    /Clean control blocked/,
  ])assert.match(text,pattern);
  for(const name of ['accounts','intents','bindings','periods'])assert.ok(text.includes("'"+name+"'"));
  for(const field of ['paid_access_from','paid_access_until','current_period_start','current_period_end',
    'lemonsqueezy_customer_id','lemonsqueezy_subscription_id','paddle_customer_id','paddle_subscription_id']){
    assert.ok(text.includes(field+'=null'));assert.ok(text.includes(field+' is not null'));
  }
  for(const condition of ["access_end>transaction_timestamp()","expires_at>transaction_timestamp()",
    "last_state->>'provider_status' is distinct from 'expired'",'review_required',
    'app_11941c8fec_payment_plan_changes','app_11941c8fec_payment_deliveries'])assert.ok(text.includes(condition));
  const guard=text.indexOf('app_11941c8fec_account_deletion_allowed(\''+historicalUser+'\')');
  assert.ok(guard>text.indexOf("raise exception 'Current obligation or entitlement remains'"));
  assert.ok(guard>text.indexOf("raise exception 'Historical evidence changed'"));
  assert.ok(guard>text.indexOf("raise exception 'Clean control blocked'"));
}
test('historical-only SQL requires evidence and absence of every seeded current obligation before the guard',()=>{
  requireHistoryIsolation(historyRetentionSQL(historicalUser,cleanUser));
});
test('the previous expired-binding-only false-positive fixture fails the isolation contract',()=>{
  const old="begin;update public.app_11941c8fec_payment_bindings set last_state='{\"provider_status\":\"expired\"}';"+
    "select public.app_11941c8fec_account_deletion_allowed('"+historicalUser+"');rollback;";
  assert.throws(()=>requireHistoryIsolation(old));
  const fixed=historyRetentionSQL(historicalUser,cleanUser);
  for(const text of ["access_end>transaction_timestamp()","expires_at>transaction_timestamp()",
    "raise exception 'Historical evidence changed'","raise exception 'Current obligation or entitlement remains'",
    "raise exception 'Clean control blocked'"]){
    assert.throws(()=>requireHistoryIsolation(fixed.replace(text,'removed prerequisite')));
  }
});
test('history SQL preserves billing identities and non-status metadata without inventing a service end',()=>{
  const text=historyRetentionSQL(historicalUser,cleanUser);
  assert.match(text,/to_jsonb\(t\)\|\|jsonb_build_object\('last_state',t\.last_state-'provider_status'\)/);
  assert.match(text,/to_jsonb\(t\)-'access_end'-'service_period_end'/);
  assert.match(text,/jsonb_array_length\(historical->part\)=0 then raise exception/);
  assert.match(text,/previous_guard:=current_setting/);
  assert.match(text,/coalesce\(previous_guard,''\)/);
  assert.throws(()=>historyRetentionSQL(historicalUser,historicalUser));
  assert.throws(()=>historyRetentionSQL('invalid',cleanUser));
});
test('history retention always verifies rollback while retaining exactly twelve required groups',()=>{
  assert.match(runner,/try\{sql\(historyRetentionSQL\(A,B\)\);\}\s*finally\{assert\.deepEqual\(billingRows\(A\),billingBefore\);\}/);
  assert.deepEqual([...runner.matchAll(/await check\('([^']+)'/g)].map(m=>m[1]),CHECKS);
});
