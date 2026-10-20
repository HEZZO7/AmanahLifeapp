// Pure guards only. Importing this file never starts services or reads credentials.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const CLI_VERSION = '2.121.0';
export const CLI_ARCHIVE_SHA256 = '4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f';
export const SOURCE_COMMIT = '3968fa6795bab794e72596d23d87c6b388659098';
export const SDK_VERSION = '2.110.0';
export const API_ORIGIN = 'http://127.0.0.1:54321';
export const TABLE = 'app_11941c8fec_notification_preferences';
export const PUSH = 'app_11941c8fec_push_subscriptions';
export const FLAGS = ['prayer_reminders','bill_reminders','habit_reminders','fasting_reminders','savings_reminders','general_activity'];
export const LOCATION = ['timezone','language','prayer_calc_method','prayer_location_mode','prayer_manual_city'];
export const COLUMNS = ['user_id',...FLAGS,...LOCATION].join(',');
export const CHECKS = ['auth','migration_first','migration_repeat','effective_acl','forged_auth',
  'foreign_insert','first_insert_race','cross_account','column_denials','client_compatibility',
  'session_switch','server_crud','sql_denials','preservation'];

export function gitBlob(bytes) {
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
}
export function workspace(root, base, source) {
  assert.equal(path.dirname(path.resolve(root)),path.resolve(base),'Unsafe workdir');
  assert.match(path.basename(root),/^amanah-007-[0-9]+-[a-f0-9]{8}$/,'Unsafe project name');
  if (source) {
    const a=path.resolve(root),b=path.resolve(source);
    assert.ok(a!==b&&!a.startsWith(b+path.sep)&&!b.startsWith(a+path.sep),'Source/workdir overlap');
  }
  return path.basename(root);
}
export function claims(token) {
  assert.equal(typeof token,'string');
  assert.ok(token.length<16000&&token.split('.').length===3);
  return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
}
export function localStatus(status) {
  // Only status produced by this owned CLI instance is accepted, never VITE_* or hosted settings.
  assert.equal(status.API_URL,API_ORIGIN,'Nonlocal API');
  assert.equal(claims(status.ANON_KEY).role,'anon');
  assert.equal(claims(status.SERVICE_ROLE_KEY).role,'service_role');
  return {url:API_ORIGIN,anon:status.ANON_KEY,service:status.SERVICE_ROLE_KEY};
}
export function allowedURL(input) {
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  assert.equal(url.origin,API_ORIGIN,'Nonlocal request');
  assert.ok(!url.username&&!url.password&&!url.hash,'Unexpected URL');
  assert.ok(url.pathname.startsWith('/auth/v1/')||url.pathname.startsWith('/rest/v1/'),'Unexpected service');
  return url;
}
export function commandCategory(text) {
  // No matched text, keys, URLs or unknown strings ever leave this function.
  const bounded=text.slice(-65536).toLowerCase();
  for(const [name,re] of [
    ['port_conflict',/address already in use|port is already allocated/],
    ['docker_unavailable',/cannot connect to the docker daemon|docker daemon is not running/],
    ['image_download',/failed to pull|manifest unknown|no matching manifest/],
    ['database_bootstrap',/error running container: exit/],
    ['service_health',/not ready:|unhealthy|health.*timed out/],
    ['network',/network is unreachable|no such host|tls handshake timeout/],
  ]) if(re.test(bounded))return name;
  return 'command_failed';
}
export function requireCoverage(completed) {
  assert.deepEqual([...completed].sort(),[...CHECKS].sort(),'Incomplete mandatory coverage');
}
export function uuid(value) {
  assert.match(value,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
  return value;
}
