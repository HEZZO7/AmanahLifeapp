// Pure validation. Importing this module never starts services or reads secrets.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const SOURCE_COMMIT='c50ae2b2fd99ff8484be67b0f9e5c5c3b7f6cfdc';
export const NODE_VERSION='24.19.0', SDK_VERSION='2.110.0', CLI_VERSION='2.121.0';
export const CLI_ARCHIVE_SHA256='4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f';
export const API_ORIGIN='http://127.0.0.1:54321';
export const APPROVAL='disposable-local-migration-009-only';
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
  const invalid=results.some(x=>!CHECKS.includes(x.id)||!['passed','failed','infrastructure_failed'].includes(x.result))||new Set(ids).size!==ids.length;
  const failed=results.filter(x=>x.result==='failed').map(x=>x.id);
  const infrastructureFailed=results.filter(x=>x.result==='infrastructure_failed').map(x=>x.id);
  return {mode:'integration',source:SOURCE_COMMIT,productionReady:false,
    result:!invalid&&!missing.length&&!failed.length&&!infrastructureFailed.length&&!infrastructureFailure&&cleanupPassed===true?'passed':'failed',
    required:CHECKS.length,completed:CHECKS.length-missing.length,passed:results.filter(x=>x.result==='passed').length,
    failed,missing,infrastructureFailed,invalid,checks:results,cleanupPassed:cleanupPassed===true,
    infrastructureFailure};
}
