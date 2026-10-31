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
// Kong 2.8.1 uses this TTL for static hosts; repeated DNS init otherwise
// applies a short configured validTtl to those same immutable owned aliases.
export const GATEWAY_HOST_TTL=315360000;
export const GATEWAY_FAILURE=Object.freeze(['unavailable','ownership_unverified','gateway_service_stopped','gateway_service_restarted',
  'no_matching_gateway_log','ambiguous_gateway_log','gateway_dns_failure','upstream_connect_failure',
  'upstream_timeout','upstream_closed','gateway_resource','gateway_lua_failure','unclassified_gateway_error']);
const GATEWAY_REQUESTS=Object.freeze({auth_create:['POST','/auth/v1/admin/users'],auth_user:['GET','/auth/v1/user'],
  billing_policy:['POST','/rest/v1/rpc/app_11941c8fec_account_deletion_allowed']});
export function gatewayRequest(kind){assert.ok(Object.hasOwn(GATEWAY_REQUESTS,kind));return [...GATEWAY_REQUESTS[kind]];}
export function classifyGatewayLogs(text,kind){
  if(typeof text!=='string'||Buffer.byteLength(text)>512*1024||!Object.hasOwn(GATEWAY_REQUESTS,kind))return 'unavailable';
  const [method,path]=gatewayRequest(kind),marker='request: "'+method+' '+path+' HTTP/';
  const codes=new Set();
  for(const line of text.split('\n')){
    if(Buffer.byteLength(line)>65536||!line.includes(marker)||!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} \[(?:error|crit|alert|emerg)\] \d+#\d+:/.test(line))continue;
    let code='unclassified_gateway_error';
    if(/DNS resolution failed|dns client error/i.test(line))code='gateway_dns_failure';
    else if(/connect\(\) failed .*while connecting to upstream/i.test(line))code='upstream_connect_failure';
    else if(/upstream timed out/i.test(line))code='upstream_timeout';
    else if(/upstream prematurely closed connection|connection reset by peer/i.test(line))code='upstream_closed';
    else if(/worker_connections are not enough|Too many open files|Cannot allocate memory/i.test(line))code='gateway_resource';
    else if(/lua entry thread aborted|failed to run .*_by_lua/i.test(line))code='gateway_lua_failure';
    codes.add(code);
  }
  return codes.size===0?'no_matching_gateway_log':codes.size===1?[...codes][0]:'ambiguous_gateway_log';
}
export const TOKEN_LIFETIME=Object.freeze(['expired','not_yet_valid','not_expired','unavailable']);
export function tokenLifetimeEvidence(token,now=Date.now()){
  try{
    if(typeof token!=='string'||token.length>16000||token.split('.').length!==3||!Number.isSafeInteger(now))return 'unavailable';
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    if(!Number.isSafeInteger(claims?.exp)||claims.exp<=0)return 'unavailable';
    if(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf<0))return 'unavailable';
    const seconds=Math.floor(now/1000);
    return claims.exp<=seconds?'expired':claims.nbf>seconds?'not_yet_valid':'not_expired';
  }catch{return 'unavailable';}
}
export function rollbackTokenHttpResult(calls){
  if(!Array.isArray(calls))return 'unavailable';if(!calls.length)return 'no_request';
  if(calls.length!==1||calls[0]?.method!=='GET'||calls[0]?.path!=='/auth/v1/user')return 'unexpected_requests';
  return httpClass(calls[0].status);
}
export function requestOriginResult(calls){
  if(!Array.isArray(calls)||calls.length!==1||httpClass(calls[0]?.status)!=='http_5xx')return 'unavailable';
  return AUTH_CREATE_ORIGINS.includes(calls[0].gatewayOrigin)?calls[0].gatewayOrigin:'unavailable';
}
export async function checkedRollbackToken(operation,observeCalls,lifetime){
  let outcome='request_rejected',reason='unclassified';
  const observe=response=>{
    if(!response||typeof response!=='object'||!Object.hasOwn(response,'error')){outcome='malformed_response';return;}
    outcome=response.error?'response_error':'malformed_response';reason=authCreateReason(response.error);
  };
  try{return await operation(observe);}
  catch(error){
    const failure=error instanceof Failure?error:new Error('Local rollback token assertion failed');
    let calls,localLifetime='unavailable';try{calls=observeCalls();}catch{}try{const value=lifetime();if(TOKEN_LIFETIME.includes(value))localLifetime=value;}catch{}
    Object.assign(failure,{rollbackTokenOutcome:outcome,rollbackTokenReason:reason,rollbackTokenHttp:rollbackTokenHttpResult(calls),
      rollbackTokenLifetime:localLifetime,requestTransport:requestTransportResult(calls)});
    if(failure.rollbackTokenHttp==='http_5xx')failure.rollbackTokenOrigin=requestOriginResult(calls);
    throw failure;
  }
}
const ROLLBACK_TOKEN_FIELDS=Object.freeze(['rollbackTokenOutcome','rollbackTokenReason','rollbackTokenHttp','rollbackTokenOrigin','rollbackTokenLifetime']);
export const REQUEST_TRANSPORT=Object.freeze(['not_observed','unavailable','timeout','aborted','connection_refused',
  'connection_reset','dns_failure','local_resource','headers_overflow','http_parser','unclassified','ambiguous']);
export function transportEvidence(error){
  try{
  const classify=value=>{
    const code=value?.code;
    if(['UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','ETIMEDOUT'].includes(code)||value?.name==='TimeoutError')return 'timeout';
    if(code==='ABORT_ERR'||value?.name==='AbortError')return 'aborted';
    if(code==='ECONNREFUSED')return 'connection_refused';
    if(['ECONNRESET','EPIPE','UND_ERR_SOCKET'].includes(code))return 'connection_reset';
    if(['ENOTFOUND','EAI_AGAIN'].includes(code))return 'dns_failure';
    if(['EMFILE','ENFILE','ENOMEM','ENOBUFS'].includes(code))return 'local_resource';
    if(['UND_ERR_HEADERS_OVERFLOW','HPE_HEADER_OVERFLOW'].includes(code))return 'headers_overflow';
    if(['HPE_INVALID_HEADER_TOKEN','HPE_UNEXPECTED_CONTENT_LENGTH'].includes(code))return 'http_parser';
    return null;
  };
  // Inspect only fixed name/code fields and a bounded aggregate cause. Never messages/stacks.
  const cause=error?.cause,values=[error,cause];
  if(Array.isArray(cause?.errors)&&cause.errors.length<=4)values.push(...cause.errors);
  const codes=[...new Set(values.map(classify).filter(Boolean))];
  return codes.length===1?codes[0]:codes.length>1?'ambiguous':'unclassified';
  }catch{return 'unavailable';}
}
export function requestTransportResult(calls){
  if(!Array.isArray(calls)||calls.length!==1)return 'unavailable';
  return REQUEST_TRANSPORT.includes(calls[0]?.transport)?calls[0].transport:'not_observed';
}
export const OWNED_SERVICE_STATES=Object.freeze(['running','stopped','restarted','oom_observed','unhealthy','starting','ownership_unverified','unavailable']);
export const SERVICE_FIELDS=Object.freeze(['serviceGateway','serviceDatabase','serviceAuth','serviceRest']);
const RPC_OUTCOMES=Object.freeze(['request_rejected','response_error','result_assertion','malformed_response']);
const RPC_ERROR_KINDS=Object.freeze(['missing_code','no_error','sql_permission','sql_error','postgrest_error','other_code','malformed_error','unavailable']);
const RPC_HTTP=Object.freeze(['no_response','http_2xx','http_4xx','http_5xx','http_other','unavailable']);
const FIXTURE_CREATE_FIELDS=Object.freeze(['fixtureCreateOutcome','fixtureCreateReason','fixtureCreateHttp','fixtureCreateOrigin','fixtureCreateServer','fixtureCreateAttempt','fixtureCreateSucceeded']);
const RPC_FIELDS=Object.freeze(['rpcOutcome','rpcErrorKind','rpcSdkHttp','rpcHttp']);
function httpClass(status){
  if(status===0||status===null)return 'no_response';
  if(!Number.isInteger(status)||status<100||status>599)return 'unavailable';
  return status>=500?'http_5xx':status>=400?'http_4xx':status>=200&&status<=299?'http_2xx':'http_other';
}
export function billingPolicyHttpResult(calls){
  if(!Array.isArray(calls))return 'unavailable';
  if(!calls.length)return 'no_request';
  if(calls.length!==1||calls[0]?.method!=='POST'||calls[0]?.path!=='/rest/v1/rpc/app_11941c8fec_account_deletion_allowed')return 'unexpected_requests';
  return httpClass(calls[0].status);
}
export async function checkedBillingPolicy(operation,observeCalls){
  let observed=false,outcome='request_rejected',kind='unavailable',sdkHttp='unavailable';
  const observe=response=>{
    observed=true;sdkHttp=httpClass(response?.status);
    if(!response||typeof response!=='object'||!Object.hasOwn(response,'error')){outcome='malformed_response';kind='malformed_error';return;}
    const error=response.error;
    outcome=error?'response_error':'result_assertion';
    if(error===null){kind='no_error';return;}
    if(!error||typeof error!=='object'){outcome='malformed_response';kind='malformed_error';return;}
    const code=error.code;
    kind=!code?'missing_code':code==='42501'?'sql_permission':typeof code==='string'&&/^[0-9A-Z]{5}$/.test(code)?'sql_error':
      typeof code==='string'&&/^PGRST[0-9]{3}$/.test(code)?'postgrest_error':'other_code';
  };
  try{return await operation(observe);}
  catch(error){
    const failure=error instanceof Failure?error:new Error('Local billing policy assertion failed');
    let calls;try{calls=observeCalls();}catch{}
    Object.assign(failure,{rpcOutcome:observed?outcome:'request_rejected',rpcErrorKind:kind,rpcSdkHttp:sdkHttp,
      rpcHttp:billingPolicyHttpResult(calls),requestTransport:requestTransportResult(calls)});
    if(failure.rpcHttp==='http_5xx')failure.rpcOrigin=requestOriginResult(calls);
    throw failure;
  }
}
function fixtureCreateDetails(value){
  const out={},outcome=value?.fixtureCreateOutcome;
  if(!['request_rejected','response_error','malformed_response'].includes(outcome)||!AUTH_CREATE_HTTP.includes(value.fixtureCreateHttp))return out;
  if(outcome!=='malformed_response'&&!AUTH_CREATE_REASONS.includes(value.fixtureCreateReason))return out;
  out.fixtureCreateOutcome=outcome;out.fixtureCreateHttp=value.fixtureCreateHttp;
  if(outcome!=='malformed_response')out.fixtureCreateReason=value.fixtureCreateReason;
  if(value.fixtureCreateHttp==='http_5xx'){
    if(AUTH_CREATE_ORIGINS.includes(value.fixtureCreateOrigin))out.fixtureCreateOrigin=value.fixtureCreateOrigin;
    if(AUTH_CREATE_SERVER.includes(value.fixtureCreateServer))out.fixtureCreateServer=value.fixtureCreateServer;
  }
  if(Number.isSafeInteger(value.fixtureCreateAttempt)&&value.fixtureCreateAttempt>=1&&value.fixtureCreateAttempt<=64&&
    Number.isSafeInteger(value.fixtureCreateSucceeded)&&value.fixtureCreateSucceeded>=0&&value.fixtureCreateSucceeded<value.fixtureCreateAttempt){
    out.fixtureCreateAttempt=value.fixtureCreateAttempt;out.fixtureCreateSucceeded=value.fixtureCreateSucceeded;
  }
  return out;
}
function requestFailureDetails(value,id){
  const out={},fixture=FIXTURE_GROUPS.includes(id)&&value?.nativeStage==='fixture_create_user';
  const billing=id==='billing_history_retention'&&value?.nativeStage==='billing_policy';
  const rollback=id==='rollback_each_cleanup_phase'&&value?.nativeStage==='token_valid';
  if(fixture)Object.assign(out,fixtureCreateDetails(value));
  if(billing&&RPC_OUTCOMES.includes(value.rpcOutcome)&&RPC_ERROR_KINDS.includes(value.rpcErrorKind)&&RPC_HTTP.includes(value.rpcSdkHttp)&&AUTH_CREATE_HTTP.includes(value.rpcHttp)){
    for(const key of RPC_FIELDS)out[key]=value[key];
    if(value.rpcHttp==='http_5xx'&&AUTH_CREATE_ORIGINS.includes(value.rpcOrigin))out.rpcOrigin=value.rpcOrigin;
  }
  if(rollback&&['request_rejected','response_error','malformed_response'].includes(value.rollbackTokenOutcome)&&
    AUTH_CREATE_REASONS.includes(value.rollbackTokenReason)&&AUTH_CREATE_HTTP.includes(value.rollbackTokenHttp)&&TOKEN_LIFETIME.includes(value.rollbackTokenLifetime)){
    for(const key of ROLLBACK_TOKEN_FIELDS)if(key!=='rollbackTokenOrigin')out[key]=value[key];
    if(value.rollbackTokenHttp==='http_5xx'&&AUTH_CREATE_ORIGINS.includes(value.rollbackTokenOrigin))out.rollbackTokenOrigin=value.rollbackTokenOrigin;
  }
  if((fixture&&out.fixtureCreateOutcome)||(billing&&out.rpcOutcome)||(rollback&&out.rollbackTokenOutcome)){
    const http=fixture?out.fixtureCreateHttp:billing?out.rpcHttp:out.rollbackTokenHttp;
    if(http==='http_5xx'&&GATEWAY_FAILURE.includes(value.gatewayFailure))out.gatewayFailure=value.gatewayFailure;
    if(REQUEST_TRANSPORT.includes(value.requestTransport))out.requestTransport=value.requestTransport;
    if(SERVICE_FIELDS.every(key=>OWNED_SERVICE_STATES.includes(value[key])))for(const key of SERVICE_FIELDS)out[key]=value[key];
  }
  return out;
}
const ACCOUNT_AUTH_STEPS=Object.freeze(['create_user','password_signin','created_identity','session_token',
  'verify_token','verified_identity','seed_personal_data']);
export const REAL_AUTH_STAGES=Object.freeze([
  ...['a','b'].flatMap(account=>ACCOUNT_AUTH_STEPS.map(step=>account+'_'+step)),
  'a_seed_subscription','b_trial_rpc','b_trial_result','distinct_identities','reject_invalid_token',
  'read_trial_snapshot','trial_row_count','trial_used',
]);
export const AUTH_CREATE_OUTCOMES=Object.freeze(['request_rejected','response_error','malformed_response','identity_assertion']);
export const AUTH_CREATE_REASONS=Object.freeze(['email_invalid','identity_exists','input_validation','password_policy',
  'admin_authorization','token_rejected','request_timeout','rate_limit','service_error','response_decode',
  'no_http_status','unauthorized','forbidden','bad_request','conflict','unprocessable','server_error','unclassified']);
export const AUTH_CREATE_HTTP=Object.freeze(['no_request','no_response','http_2xx','http_4xx','http_5xx',
  'http_other','unexpected_requests','unavailable']);
export const AUTH_CREATE_ORIGINS=Object.freeze(['gateway_generated','proxy_attempted','gotrue_error_signal','conflicting_headers','unavailable']);
export function authResponseOrigin(response){
  try{
    const numeric=name=>/^[0-9]{1,12}$/.test(response.headers.get(name)??'');
    const gateway=numeric('x-kong-response-latency'),upstream=numeric('x-kong-upstream-latency');
    const auth=response.headers.get('x-sb-error-code')==='unexpected_failure';
    if(gateway&&(upstream||auth))return 'conflicting_headers';
    if(gateway)return 'gateway_generated';
    if(auth)return 'gotrue_error_signal';
    if(upstream)return 'proxy_attempted';
  }catch{}
  return 'unavailable';
}
export function authCreateOriginResult(calls){
  if(authCreateHttpResult(calls)!=='http_5xx')return 'unavailable';
  return AUTH_CREATE_ORIGINS.includes(calls[0].authOrigin)?calls[0].authOrigin:'unavailable';
}
export const AUTH_CREATE_SERVER=Object.freeze(['unavailable','ownership_unverified','no_matching_auth_log','ambiguous_auth_log',
  'auth_service_not_running','auth_service_restarted','gotrue_panic','gotrue_server_unclassified',
  'database_dependency','database_privilege','database_constraint','database_raised_exception','database_connection',
  'database_resource','database_timeout','database_transaction','database_data_error','database_other','ambiguous_database_error']);
// Input is a bounded private buffer from ONE owned Auth container and ONE
// request time window. Return only fixed codes; never a log field or SQLSTATE.
export function classifyAuthServerLogs(text){
  if(typeof text!=='string'||Buffer.byteLength(text)>512*1024)return 'unavailable';
  const matches=[];
  for(const line of text.split('\n')){
    if(Buffer.byteLength(line)>65536)continue;
    let row;try{row=JSON.parse(line);}catch{continue;}
    if(row?.component==='api'&&row.method==='POST'&&row.path==='/admin/users'&&row.level==='error'&&
      row.msg==='request completed'&&Number.isInteger(row.status)&&row.status>=500&&row.status<=599)matches.push(row);
  }
  if(matches.length===0)return 'no_matching_auth_log';
  if(matches.length!==1)return 'ambiguous_auth_log';
  const row=matches[0];
  if(typeof row.panic==='string'&&row.panic.length>0)return 'gotrue_panic';
  if(typeof row.error!=='string'||row.error.length>32768)return 'gotrue_server_unclassified';
  const codes=[...new Set([...row.error.matchAll(/\(SQLSTATE ([0-9A-Z]{5})\)/g)].map(match=>match[1]))];
  if(codes.length===0)return 'gotrue_server_unclassified';
  if(codes.length!==1)return 'ambiguous_database_error';
  const code=codes[0];
  if(['42P01','42703','42883','3F000','42704','42804'].includes(code))return 'database_dependency';
  if(code==='42501')return 'database_privilege';
  if(code.startsWith('23'))return 'database_constraint';
  if(['P0001','ZX008','ZX009'].includes(code))return 'database_raised_exception';
  if(code.startsWith('08')||['57P01','57P02','57P03'].includes(code))return 'database_connection';
  if(code.startsWith('53'))return 'database_resource';
  if(['57014','55P03','25P03'].includes(code))return 'database_timeout';
  if(code.startsWith('40')||code==='25P02')return 'database_transaction';
  if(code.startsWith('22'))return 'database_data_error';
  return 'database_other';
}
export function authCreateHttpResult(calls){
  if(!Array.isArray(calls))return 'unavailable';
  if(calls.length===0)return 'no_request';
  if(calls.length!==1||calls[0]?.method!=='POST'||calls[0]?.path!=='/auth/v1/admin/users')return 'unexpected_requests';
  const status=calls[0].status;
  if(status===null)return 'no_response';
  if(!Number.isInteger(status)||status<100||status>599)return 'unavailable';
  if(status>=200&&status<=299)return 'http_2xx';
  if(status>=400&&status<=499)return 'http_4xx';
  if(status>=500)return 'http_5xx';
  return 'http_other';
}
// Hints only. Never retain a message, response body, raw code/status or URL.
export function authCreateReason(error){
  const codes={email_address_invalid:'email_invalid',email_exists:'identity_exists',user_already_exists:'identity_exists',
    validation_failed:'input_validation',weak_password:'password_policy',not_admin:'admin_authorization',bad_jwt:'token_rejected',
    request_timeout:'request_timeout',over_request_rate_limit:'rate_limit',unexpected_failure:'service_error'};
  if(typeof error?.code==='string'&&Object.hasOwn(codes,error.code))return codes[error.code];
  if(error?.name==='AuthUnknownError')return 'response_decode';
  const status=error?.status;
  if(Number.isInteger(status)){
    const statuses={0:'no_http_status',400:'bad_request',401:'unauthorized',403:'forbidden',409:'conflict',422:'unprocessable',429:'rate_limit'};
    if(Object.hasOwn(statuses,status))return statuses[status];
    if(status>=500&&status<=599)return 'server_error';
  }
  return 'unclassified';
}
function authCreateFailure(outcome,error,responseError=error){
  assert.ok(AUTH_CREATE_OUTCOMES.includes(outcome));
  const failure=error instanceof Failure?error:new Error('Local authentication operation failed');
  failure.authCreateOutcome=outcome;
  if(['request_rejected','response_error'].includes(outcome))failure.authCreateReason=authCreateReason(responseError);
  return failure;
}
export async function checkedAuthCreate(operation,observe=()=> 'unavailable'){
  const failed=(outcome,error,responseError=error)=>{
    const failure=authCreateFailure(outcome,error,responseError);let http='unavailable';
    try{const value=observe();if(AUTH_CREATE_HTTP.includes(value))http=value;}catch{}
    failure.authCreateHttp=http;return failure;
  };
  let response;
  try{response=await operation();}catch(error){throw failed('request_rejected',error);}
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  try{
    assert.ok(object(response));assert.ok(Object.hasOwn(response,'error'));assert.notEqual(response.error,undefined);
  }catch(error){throw failed('malformed_response',error);}
  try{assert.equal(response.error,null);}catch(error){throw failed('response_error',error,response.error);}
  try{assert.ok(object(response.data));assert.ok(object(response.data.user));}
  catch(error){throw failed('malformed_response',error);}
  return response;
}
export function createdAuthIdentity(response){
  try{return uuid(response.data.user.id);}catch(error){throw authCreateFailure('identity_assertion',error);}
}
// Diagnostics only: execute the original operation once, preserve Failure's
// classification/exit, and never retain an SDK response or assertion payload.
export async function realAuthStage(stage,operation){
  assert.ok(REAL_AUTH_STAGES.includes(stage));
  try{return await operation();}
  catch(error){
    const failure=error instanceof Failure?error:new Error('Local authentication assertion failed');
    Object.assign(failure,realAuthFailureDetails({authStage:stage,authCreateOutcome:error?.authCreateOutcome,
      authCreateReason:error?.authCreateReason,authCreateHttp:error?.authCreateHttp,authCreateServer:error?.authCreateServer,
      authCreateOrigin:error?.authCreateOrigin}));throw failure;
  }
}
export function realAuthFailureDetails(value){
  if(!REAL_AUTH_STAGES.includes(value?.authStage))return {};
  const details={authStage:value.authStage},outcome=value.authCreateOutcome;
  const create=['a_create_user','b_create_user'].includes(value.authStage),identity=['a_created_identity','b_created_identity'].includes(value.authStage);
  if((create&&['request_rejected','response_error','malformed_response'].includes(outcome))||(identity&&outcome==='identity_assertion')){
    const reasonRequired=['request_rejected','response_error'].includes(outcome);
    if((!reasonRequired||AUTH_CREATE_REASONS.includes(value.authCreateReason))&&(!create||AUTH_CREATE_HTTP.includes(value.authCreateHttp))){
      details.authCreateOutcome=outcome;
      if(reasonRequired)details.authCreateReason=value.authCreateReason;
      if(create)details.authCreateHttp=value.authCreateHttp;
      if(create&&value.authCreateHttp==='http_5xx'&&AUTH_CREATE_SERVER.includes(value.authCreateServer))details.authCreateServer=value.authCreateServer;
      if(create&&value.authCreateHttp==='http_5xx'&&AUTH_CREATE_ORIGINS.includes(value.authCreateOrigin))details.authCreateOrigin=value.authCreateOrigin;
    }
  }
  return details;
}
export function validRealAuthDiagnostics(row){
  const keys=['authStage','authCreateOutcome','authCreateReason','authCreateHttp','authCreateServer','authCreateOrigin'].filter(key=>key in row);
  if(!keys.length)return true;
  if(row.id!=='real_auth_jwt'||!['failed','infrastructure_failed'].includes(row.result))return false;
  const details=realAuthFailureDetails(row);
  return keys.every(key=>Object.hasOwn(details,key)&&details[key]===row[key]);
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
// Closed diagnostic vocabulary only; never retain assertion values or raw SDK/SQL errors.
const FIXTURE_STAGES=Object.freeze(['fixture_create_user','fixture_password_signin','fixture_created_identity',
  'fixture_session_token','fixture_verify_token','fixture_verified_identity','fixture_trial_rpc',
  'fixture_trial_result','fixture_seed_subscription','fixture_seed_personal_data']);
export const NATIVE_CHECK_STAGES=Object.freeze({
  rollback_each_cleanup_phase:['install_fault','read_before','delete_status','witness_increment','account_rollback',
    'control_unchanged','auth_links_rollback','token_valid','token_identity','clear_fault'],
  failed_delete_preserves_trial:['fault_proof','trial_snapshot'],
  failed_delete_cannot_restart_trial:['fault_proof','trial_rpc','trial_result','trial_snapshot'],
  checkout_wins_race:['race_sessions','expected_sql_failure'],
  deletion_wins_race:['race_sessions','expected_sql_failure'],
  trial_races_deletion:['race_sessions'],
  simultaneous_auth_deletions:['race_sessions'],
  unreviewed_trigger_readiness:['fixture_snapshot','install_null_trigger'],
  billing_history_retention:['seed_billing','set_billing_state','expire_evidence','expired_fixture','read_evidence',
    'billing_policy','evidence_seeded','adapter_denial','direct_auth_denial','billing_unchanged','account_unchanged',
    'save_billing','seed_projection','read_projection','projection_adapter_denial','projection_auth_denial','projection_unchanged'],
});
const FIXTURE_GROUPS=Object.freeze(['successful_auth_deletion','checkout_wins_race','deletion_wins_race',
  'trial_races_deletion','simultaneous_auth_deletions','billing_history_retention','family_member_privacy',
  'family_owner_deletion','after_delete_null_control','unreviewed_trigger_readiness']);
export const DATABASE_EVIDENCE=Object.freeze(['missing_error_code','missing_sqlstate','connection_sqlstate',
  'server_shutdown','connection_limit','postgrest_connection']);
function allowedNativeStage(id,stage){
  return NATIVE_CHECK_STAGES[id]?.includes(stage)||(FIXTURE_GROUPS.includes(id)&&FIXTURE_STAGES.includes(stage));
}
export function nativeFailureDetails(value,id){
  const out={};
  if(!allowedNativeStage(id,value?.nativeStage))return out;
  out.nativeStage=value.nativeStage;
  if(id==='rollback_each_cleanup_phase'&&[...CLEANUP_TABLES,'auth'].includes(value.cleanupPhase))out.cleanupPhase=value.cleanupPhase;
  if(id==='billing_history_retention'&&['active','expired','refunded'].includes(value.billingState))out.billingState=value.billingState;
  if(DATABASE_EVIDENCE.includes(value.databaseEvidence))out.databaseEvidence=value.databaseEvidence;
  Object.assign(out,requestFailureDetails(value,id));
  return out;
}
export function validNativeDiagnostics(row){
  const keys=['nativeStage','cleanupPhase','billingState','databaseEvidence',...FIXTURE_CREATE_FIELDS,...RPC_FIELDS,'rpcOrigin',...ROLLBACK_TOKEN_FIELDS,'gatewayFailure','requestTransport',...SERVICE_FIELDS];
  if(!keys.some(key=>key in row))return true;
  if(!['failed','infrastructure_failed'].includes(row.result))return false;
  if(!allowedNativeStage(row.id,row.nativeStage))return false;
  if('databaseEvidence' in row&&(row.result!=='infrastructure_failed'||row.category!=='database_connection_failed'))return false;
  const http=row.nativeStage==='fixture_create_user'?row.fixtureCreateHttp:row.nativeStage==='token_valid'?row.rollbackTokenHttp:row.rpcHttp;
  if('requestTransport' in row&&!['not_observed','unavailable'].includes(row.requestTransport)&&http!=='no_response')return false;
  if(row.rpcOutcome==='request_rejected'&&(row.rpcErrorKind!=='unavailable'||row.rpcSdkHttp!=='unavailable'))return false;
  if(row.rpcOutcome==='result_assertion'&&row.rpcErrorKind!=='no_error')return false;
  const details=nativeFailureDetails(row,row.id);
  return keys.every(key=>!(key in row)||(Object.hasOwn(details,key)&&details[key]===row[key]));
}
export function nativeStage(id,stage,operation,context={}){
  assert.ok(allowedNativeStage(id,stage));
  const details=nativeFailureDetails({nativeStage:stage,...context},id);
  const fail=error=>{
    const failure=error instanceof Failure?error:new Error('Local native assertion failed');
    const inner=nativeFailureDetails(error,id);
    Object.assign(failure,details,inner);
    const carried={...error,...nativeFailureDetails(failure,id)};
    if(stage==='fixture_create_user'&&AUTH_CREATE_OUTCOMES.includes(error?.authCreateOutcome))Object.assign(carried,{
      fixtureCreateOutcome:error.authCreateOutcome,fixtureCreateReason:error.authCreateReason,fixtureCreateHttp:error.authCreateHttp});
    Object.assign(failure,requestFailureDetails(carried,id));
    if(DATABASE_EVIDENCE.includes(error?.databaseEvidence))failure.databaseEvidence=error.databaseEvidence;
    throw failure;
  };
  try{const value=operation();return value&&typeof value.then==='function'?Promise.resolve(value).catch(fail):value;}
  catch(error){return fail(error);}
}
function databaseConnectionFailure(code,missing){
  const error=new Failure('database_connection_failed');
  error.databaseEvidence=!code?missing:/^08/.test(code)?'connection_sqlstate':
    ['57P01','57P02','57P03'].includes(code)?'server_shutdown':code==='53300'?'connection_limit':'postgrest_connection';
  return error;
}
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
  'read_namespace','bind_namespace','reload_owned_gateway','health_owned_gateway','host_rule_probe','host_rule_insert','host_rule_delete',
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
    else if(args[0]==='exec'&&args.at(-2)==='kong'&&args.at(-1)==='reload')operation='reload_owned_gateway';
    else if(args[0]==='exec'&&args.at(-2)==='kong'&&args.at(-1)==='health')operation='health_owned_gateway';
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
  if(!code||/^08/.test(code)||['57P01','57P02','57P03','53300'].includes(code))throw databaseConnectionFailure(code,'missing_sqlstate');
  if(['57014','55P03','25P03'].includes(code))throw new Failure('database_timeout',124);
  assert.equal(code,expected); // Wrong security/constraint SQLSTATE remains a failed assertion.
}
export function throwIfDatabaseInfrastructure(error){
  if(!error)return;
  const code=error.code;
  if(['57014','55P03','25P03'].includes(code))throw new Failure('database_timeout',124);
  if(!code||/^08/.test(code)||['57P01','57P02','57P03','53300','PGRST000','PGRST001','PGRST002'].includes(code))throw databaseConnectionFailure(code,'missing_error_code');
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
    let response;
    try{response=await originalFetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});}
    catch(error){call.transport=transportEvidence(error);throw error;}
    call.status=response.status;
    if(response.status>=500&&response.status<=599&&Object.values(GATEWAY_REQUESTS).some(([method,path])=>call.method===method&&call.path===path)){
      call.gatewayOrigin=authResponseOrigin(response);
      if(call.path==='/auth/v1/admin/users')call.authOrigin=call.gatewayOrigin;
    }
    return response;
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
  const invalid=(infrastructureFailure!==null&&!validNativeDiagnostics({...infrastructureFailure,id:infrastructureFailure.phase,result:'infrastructure_failed'}))||results.some(x=>!CHECKS.includes(x.id)||!['passed','failed','infrastructure_failed'].includes(x.result)||
    (!validRealAuthDiagnostics(x)||!validNativeDiagnostics(x)))||new Set(ids).size!==ids.length;
  const failed=results.filter(x=>x.result==='failed').map(x=>x.id);
  const infrastructureFailed=results.filter(x=>x.result==='infrastructure_failed').map(x=>x.id);
  return {mode:'integration',source:SOURCE_COMMIT,productionReady:false,
    result:!invalid&&!missing.length&&!failed.length&&!infrastructureFailed.length&&!infrastructureFailure&&cleanupPassed===true?'passed':'failed',
    required:CHECKS.length,completed:CHECKS.length-missing.length,passed:results.filter(x=>x.result==='passed').length,
    failed,missing,infrastructureFailed,invalid,checks:results,cleanupPassed:cleanupPassed===true,
    infrastructureFailure};
}
