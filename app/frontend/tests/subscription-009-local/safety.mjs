// Pure validation. Importing this module never starts services or reads secrets.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const SOURCE_COMMIT='e6dd3fc5e014ea0539df8da12a6ee84582b302b9';
export const NODE_VERSION='24.19.0', SDK_VERSION='2.110.0', CLI_VERSION='2.121.0';
export const CLI_ARCHIVE_SHA256='4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f';
export const API_ORIGIN='http://127.0.0.1:54321';
export const APPROVAL='disposable-local-migration-009-only';
export class Failure extends Error {
  constructor(category='assertion_failed',exitCode=1){super('Local test failed');this.category=category;this.exitCode=exitCode;}
}
const ACCOUNT_AUTH_STEPS=Object.freeze(['create_user','password_signin','created_identity','session_token',
  'verify_token','verified_identity','seed_personal_data']);
export const REAL_AUTH_STAGES=Object.freeze([
  ...['a','b'].flatMap(account=>ACCOUNT_AUTH_STEPS.map(step=>account+'_'+step)),
  'a_seed_subscription','b_trial_rpc','b_trial_result','distinct_identities','reject_invalid_token',
  'read_trial_snapshot','trial_row_count','trial_used',
]);
// Diagnostics only: execute the original operation once, preserve Failure's
// classification/exit, and never retain an SDK response or assertion payload.
export async function realAuthStage(stage,operation){
  assert.ok(REAL_AUTH_STAGES.includes(stage));
  try{return await operation();}
  catch(error){
    const failure=error instanceof Failure?error:new Error('Local authentication assertion failed');
    failure.authStage=stage;throw failure;
  }
}
export function realAuthFailureDetails(value){
  return REAL_AUTH_STAGES.includes(value?.authStage)?{authStage:value.authStage}:{};
}
export const WORKER_PREFLIGHT_STAGES=Object.freeze([
  'worker_runtime_temp','worker_workspace','worker_marker','worker_journal','worker_namespace_handle',
  'worker_namespace_identity','worker_uid','worker_gid','worker_no_new_privileges','worker_cancelled',
  'worker_source_path','worker_source_workspace','worker_package_integrity','worker_source_integrity',
  'worker_private_input','worker_approval','worker_credentials','worker_sdk_import','worker_sdk_version',
  'worker_client_setup','worker_migration_order',
]);
const WORKER_STAGES=Object.freeze([...WORKER_PREFLIGHT_STAGES,
  'controller_isolation','controller_identity','controller_launch','controller_report_file','controller_report_json',
  'controller_report_source','controller_report_production','controller_report_checks','controller_report_infrastructure',
  'controller_report_observations','controller_report_result','controller_exit_status',
]);
const WORKER_LAUNCH_STAGES=Object.freeze(['launch_sudo','launch_namespace','launch_privileges','launch_node']);
export function workerStageFailure(stage,error,preflight=null){
  assert.ok(WORKER_STAGES.includes(stage));
  const failure=error instanceof Failure?error:new Failure('assertion_failed',1);
  failure.workerStage=stage;
  if(preflight!==null){assert.ok(WORKER_PREFLIGHT_STAGES.includes(preflight));failure.workerPreflightStage=preflight;}
  return failure;
}
export function workerFailureDetails(value){
  const details={};
  if(WORKER_STAGES.includes(value?.workerStage))details.workerStage=value.workerStage;
  if(WORKER_PREFLIGHT_STAGES.includes(value?.workerPreflightStage))details.workerPreflightStage=value.workerPreflightStage;
  if(WORKER_LAUNCH_STAGES.includes(value?.workerLaunchStage))details.workerLaunchStage=value.workerLaunchStage;
  if(Number.isInteger(value?.workerExit)&&value.workerExit>=0&&value.workerExit<=255)details.workerExit=value.workerExit;
  return details;
}
export function workerStageSignal(stage){
  assert.ok(stage===null||WORKER_PREFLIGHT_STAGES.includes(stage));
  return JSON.stringify({type:'worker_stage',code:stage??'native_groups_started'})+'\n';
}
export function lastWorkerPreflightStage(stdout){
  let stage=null;
  if(typeof stdout!=='string'||stdout.length>1024*1024)return stage;
  for(const line of stdout.split('\n')){
    let value;try{value=JSON.parse(line);}catch{continue;}
    if(!value||Object.keys(value).sort().join(',')!=='code,type'||value.type!=='worker_stage')continue;
    if(WORKER_PREFLIGHT_STAGES.includes(value.code))stage=value.code;
    else if(value.code==='native_groups_started')stage=null;
  }
  return stage;
}
export function workerLaunchDetails(outcome){
  const details={};
  if(Number.isInteger(outcome.status)&&outcome.status>=0&&outcome.status<=255)details.workerExit=outcome.status;
  if(outcome.status!==0){
    const text=typeof outcome.stderr==='string'?outcome.stderr.slice(-65536):'';
    for(const [prefix,stage]of [['sudo','launch_sudo'],['nsenter','launch_namespace'],['setpriv','launch_privileges'],['node','launch_node']]){
      if(new RegExp('^'+prefix+':','m').test(text)){details.workerLaunchStage=stage;break;}
    }
  }
  return details;
}
const COMMAND_OPERATIONS=Object.freeze(['supabase_status_json','supabase_init','supabase_start','supabase_stop',
  'inspect_db_labels','inspect_auth_labels','inspect_rest_labels','inspect_kong_labels',
  'inspect_container','inspect_network','container_uid','read_owned_hosts','write_owned_hosts','append_owned_hosts',
  'read_namespace','bind_namespace','host_rule_probe','host_rule_insert','host_rule_delete',
  'namespace_rule_probe','namespace_rule_insert','namespace_rule_delete','other']);
const COMMAND_REASONS=Object.freeze(['timeout','executable_missing','permission_denied','resource_busy',
  'object_missing','unknown_option','not_running','connection_refused','terminated','unknown']);
// Never retain an argv item, executable path, stdout/stderr fragment or error
// message. These are bounded classifications of a failed subprocess, not proof
// that a matching message identifies the ultimate root cause.
export function commandDiagnostic(exe,args,result){
  let operation='other';const tool=path.basename(exe);
  if(tool==='supabase'){
    if(args.includes('status'))operation='supabase_status_json';
    else for(const name of ['init','start','stop'])if(args.includes(name))operation='supabase_'+name;
  }else if(tool==='docker'){
    if(args[0]==='inspect'){
      const service=['db','auth','rest','kong'].find(name=>args.some(x=>x.startsWith('supabase_'+name+'_')));
      operation=args.includes('--format')&&service?'inspect_'+service+'_labels':'inspect_container';
    }else if(args[0]==='network'&&args[1]==='inspect')operation='inspect_network';
    else if(args[0]==='exec'&&args.at(-2)==='id'&&args.at(-1)==='-u')operation='container_uid';
    else if(args[0]==='cp')operation=args[1]?.endsWith(':/etc/hosts')?'read_owned_hosts':'write_owned_hosts';
  }else if(tool==='sudo'){
    if(args[1]==='python3'&&args.includes('-c'))operation='append_owned_hosts';
    else if(args[1]==='readlink')operation='read_namespace';
    else if(args[1]==='mount'&&args.includes('--bind'))operation='bind_namespace';
    else if(args.includes('iptables')||args.includes('ip6tables')){
      const scope=args.includes('nsenter')?'namespace':'host';
      for(const [flag,name]of [['-C','probe'],['-I','insert'],['-D','delete']])if(args.includes(flag))operation=scope+'_rule_'+name;
    }
  }
  const text=String(result.stdout||'').slice(-32768)+'\n'+String(result.stderr||'').slice(-32768);
  let reason='unknown';
  if(result.error?.code==='ETIMEDOUT')reason='timeout';
  else if(result.error?.code==='ENOENT')reason='executable_missing';
  else if(result.error?.code==='EACCES')reason='permission_denied';
  else if(result.signal)reason='terminated';
  else for(const [name,pattern]of [
    ['resource_busy',/device or resource busy|resource is busy/i],
    ['permission_denied',/permission denied|operation not permitted|a password is required/i],
    ['object_missing',/no such (?:container|network|object|file)|does not exist/i],
    ['unknown_option',/unknown (?:flag|option)|unrecognized (?:flag|option)/i],
    ['not_running',/is not running|not running/i],
    ['connection_refused',/connection refused|cannot connect to the docker daemon/i],
  ])if(pattern.test(text)){reason=name;break;}
  return {operation,reason};
}
export function commandFailureDetails(error){
  const d=error instanceof Failure?error.diagnostic:null;
  return d&&COMMAND_OPERATIONS.includes(d.operation)&&COMMAND_REASONS.includes(d.reason)
    ?{diagnostic:{operation:d.operation,reason:d.reason}}:{};
}
export const PG_LIMITS=Object.freeze({statement:15000,lock:12000,idle:20000,client:22000});
export const PG_OPTIONS='-c statement_timeout='+PG_LIMITS.statement+' -c lock_timeout='+PG_LIMITS.lock+' -c idle_in_transaction_session_timeout='+PG_LIMITS.idle;
export function sessionPrefix(project){return 'al009-'+sha256(Buffer.from(project)).slice(0,16)+'-';}
export function expectSQLFailure(outcome,expected){
  assert.equal(outcome.ok,false);const error=outcome.error;
  const code=error?.sqlState;
  if(error instanceof Failure&&error.category!=='sql_session_failed')throw error;
  if(!code||/^08/.test(code)||['57P01','57P02','57P03','53300'].includes(code))throw new Failure('database_connection_failed');
  if(['57014','55P03','25P03'].includes(code))throw new Failure('database_timeout',124);
  assert.equal(code,expected); // Wrong security/constraint SQLSTATE remains a failed assertion.
}
export function throwIfDatabaseInfrastructure(error){
  if(!error)return;
  const code=error.code;
  if(['57014','55P03','25P03'].includes(code))throw new Failure('database_timeout',124);
  if(!code||/^08/.test(code)||['57P01','57P02','57P03','53300','PGRST000','PGRST001','PGRST002'].includes(code))throw new Failure('database_connection_failed');
}
export function failureLatch(target,publish){
  let report=null,failed=false;
  const send=()=>{
    try{publish(report);}catch{failed=true;report.result='failed';target.exitCode=1;}
  };
  const invalidate=()=>{
    failed=true;target.exitCode=1; // Immediate, even AFTER a nominal success report.
    if(report){report={...report,result:'failed',productionReady:false,
      infrastructureFailure:{phase:'asynchronous',category:'asynchronous_failure',exit:1}};send();}
  };
  return {reject:invalidate,get failed(){return failed;},publish(value){
    report=structuredClone(value);
    if(failed){report.result='failed';report.infrastructureFailure={phase:'asynchronous',category:'asynchronous_failure',exit:1};}
    send();target.exitCode=failed||report.result!=='passed'?1:0;return report;
  }};
}
export const CHECKS=Object.freeze([
  'schema_dependencies','real_auth_jwt','migration_idempotency_metadata',
  'untrusted_denials','service_role_history_denial','successful_auth_deletion',
  'rollback_each_cleanup_phase','failed_delete_preserves_trial','failed_delete_cannot_restart_trial',
  'checkout_wins_race','deletion_wins_race','trial_races_deletion','simultaneous_auth_deletions',
  'billing_history_retention','family_member_privacy','family_owner_deletion',
  'after_delete_null_control','unreviewed_trigger_readiness',
  'before_delete_null_preserves_trial','before_delete_null_cannot_restart_trial',
  'isolation_and_billing_preservation',
]);
export const CLEANUP_TABLES=Object.freeze(['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions']);
export const MIGRATIONS=Object.freeze([
 '202610140001_subscription_authority.sql','202610140002_family_helper_execution.sql',
 '202610150003_family_authority.sql','202610150004_trusted_lemon_payments.sql',
 '202610150005_subscription_lifecycle.sql','202610210008_account_deletion_safety.sql',
 '202610210009_atomic_account_deletion.sql',
].map(name=>'app/frontend/supabase/migrations/'+name));
export const SOURCE_FILES=Object.freeze([
 'app/frontend/tests/subscription-security-fixture.sql','app/frontend/tests/family-helper-fixture.sql',
 ...MIGRATIONS.slice(0,6),
 'app/frontend/supabase/functions/app_11941c8fec_delete_account/index.ts',
 'app/frontend/supabase/functions/app_11941c8fec_delete_account/handler.ts',
 MIGRATIONS[6],'app/frontend/tests/account-deletion-atomic-regression.sql',
]);
export function gitBlob(bytes){return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');}
export function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
export function uuid(value){assert.equal(typeof value,'string');assert.match(value,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);return value;}
export function assertCleanEnvironment(env){
  for(const key of Object.keys(env))assert.ok(!/(?:SUPABASE|PADDLE|LEMON.*SQUEEZY|ANTHROPIC|DATABASE_URL|POSTGRES_|^PG(?:HOST|SERVICE|PASSWORD|USER|PORT|DATABASE|SSLMODE|OPTIONS|APPNAME)$)/i.test(key));
}
export function workspace(root,base,source){
  assert.equal(path.dirname(path.resolve(root)),path.resolve(base));
  assert.match(path.basename(root),/^amanah-009-[0-9]+-[a-f0-9]{8}$/);
  if(source){const a=path.resolve(root),b=path.resolve(source);assert.ok(a!==b&&!a.startsWith(b+path.sep)&&!b.startsWith(a+path.sep));}
  return path.basename(root);
}
export function tokenClaims(token){
  assert.equal(typeof token,'string');assert.ok(token.length<16000&&token.split('.').length===3);
  return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
}
export function localStatus(status){
  assert.equal(status.API_URL,API_ORIGIN);
  // CLI-generated keys only. Real authentication is independently checked by Auth.
  for(const [field,role] of [['ANON_KEY','anon'],['SERVICE_ROLE_KEY','service_role']]){
    const claims=tokenClaims(status[field]);assert.equal(claims.role,role);
    assert.equal(claims.iss,'supabase-demo');
  }
  assert.equal(status.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  return {url:API_ORIGIN,anon:status.ANON_KEY,service:status.SERVICE_ROLE_KEY};
}
export function allowedURL(input){
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  assert.equal(u.origin,API_ORIGIN);assert.ok(!u.username&&!u.password&&!u.hash);
  assert.ok(u.pathname.startsWith('/auth/v1/')||u.pathname.startsWith('/rest/v1/'));
  return u;
}
export function trafficGuard(originalFetch){
  const state={attempted:0,rejected:0,calls:[]};
  return {state,fetch:async(input,init={})=>{
    state.attempted++;let u;
    try{u=allowedURL(input);}catch{state.rejected++;throw Error('nonlocal_request');}
    // Record BEFORE fetch: a caught SDK guard/fetch exception cannot hide attempts.
    const call={method:init.method||input?.method||'GET',path:u.pathname,status:null};state.calls.push(call);
    const response=await originalFetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});
    call.status=response.status;return response;
  }};
}
export function commandCategory(text){
  const bounded=String(text).slice(-65536).toLowerCase();
  for(const [id,re] of [['port_conflict',/address already in use|port is already allocated/],
    ['docker_unavailable',/cannot connect to the docker daemon/],['image_download',/failed to pull|manifest unknown/],
    ['database_bootstrap',/error running container: exit/],['service_health',/unhealthy|not ready:|health.*timed out/],
    ['network',/network is unreachable|no such host|tls handshake timeout/]])if(re.test(bounded))return id;
  return 'command_failed';
}
export function summarize(results,cleanupPassed,infrastructureFailure=null){
  const ids=results.map(x=>x.id),missing=CHECKS.filter(x=>!ids.includes(x));
  const invalid=results.some(x=>!CHECKS.includes(x.id)||!['passed','failed','infrastructure_failed'].includes(x.result)||
    ('authStage' in x&&(x.id!=='real_auth_jwt'||x.result==='passed'||!REAL_AUTH_STAGES.includes(x.authStage))))||new Set(ids).size!==ids.length;
  const failed=results.filter(x=>x.result==='failed').map(x=>x.id);
  const infrastructureFailed=results.filter(x=>x.result==='infrastructure_failed').map(x=>x.id);
  return {mode:'integration',source:SOURCE_COMMIT,productionReady:false,
    result:!invalid&&!missing.length&&!failed.length&&!infrastructureFailed.length&&!infrastructureFailure&&cleanupPassed===true?'passed':'failed',
    required:CHECKS.length,completed:CHECKS.length-missing.length,passed:results.filter(x=>x.result==='passed').length,
    failed,missing,infrastructureFailed,invalid,checks:results,cleanupPassed:cleanupPassed===true,
    infrastructureFailure};
}
