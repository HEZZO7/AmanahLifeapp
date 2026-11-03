// Executes only reviewed local007 tests. No database URL or hosted SDK is accepted.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fixtureFromProfile, helpers, cases, prefs, push } from './native-cases.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const profileDir = resolve(root, 'app/frontend/tests/payment-phase2-db');
const manifest = JSON.parse(readFileSync(new URL('./inputs.json', import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Pass proxy/CA controls through unchanged; never pass hosted credentials to tests.
export function childEnv(extra = {}) {
  const allowed = /^(PATH|Path|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|SystemRoot|SYSTEMROOT|COMSPEC|ComSpec|PATHEXT|TEMP|TMP|TMPDIR|LANG|LC_ALL|CI|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|http_proxy|https_proxy|all_proxy|no_proxy|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_CONFIG|DOCKER_TLS_VERIFY|DOCKER_CERT_PATH)$/;
  return { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.test(key))), ...extra };
}
function command(bin, args, options = {}) {
  return spawnSync(bin, args, { cwd: root, encoding: 'utf8', env: childEnv(), timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...options });
}
function required(bin, args, options) {
  const result = command(bin, args, options);
  if(result.error) throw Object.assign(Error('Local subprocess unavailable'),{code:result.error.code??'SUBPROCESS_UNAVAILABLE'});
  assert.equal(result.status, 0, 'Local preparation command failed; no raw environment/output exported');
  return result.stdout.trim();
}
export function verifyInputs() {
  assert.equal(process.version, 'v24.19.0');
  assert.equal(required('git', ['branch','--show-current']), 'repair/migration007-notification-security-20261102');
  required('git', ['merge-base','--is-ancestor',manifest.sourceBase,'HEAD']);
  const origin = required('git', ['config','--get','remote.origin.url']);
  assert.match(origin, /^(?:https:\/\/github\.com\/|git@github\.com:)HEZZO7\/AmanahLifeapp(?:\.git)?$/);
  assert.equal(required('git',['diff','--name-only','HEAD','--',...Object.keys(manifest.sha256)]), '', 'Reviewed inputs have tracked changes');
  for (const [name, expected] of Object.entries(manifest.sha256)) {
    const path = resolve(root,name);
    assert.ok(!isAbsolute(relative(root,path)) && !relative(root,path).startsWith('..'));
    assert.equal(lstatSync(path).isSymbolicLink(), false);
    assert.equal(hash(readFileSync(path)), expected, 'Input digest mismatch: ' + name);
  }
  const lock = JSON.parse(readFileSync(resolve(profileDir,'package-lock.json')));
  const pkg = JSON.parse(readFileSync(resolve(profileDir,'package.json')));
  assert.deepEqual(pkg.dependencies, { '@electric-sql/pglite': '0.3.14' });
  assert.equal(Object.keys(lock.packages).length,2);
  assert.equal(lock.packages['node_modules/@electric-sql/pglite'].version,'0.3.14');
  assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity, manifest.pgliteIntegrity);
  return { commit: required('git',['rev-parse','HEAD']), sourceBase: manifest.sourceBase, node: process.version, pglite: '0.3.14', migrationSha256: manifest.sha256['app/frontend/supabase/migrations/202610180007_notification_table_authority.sql'], inputManifestSha256: hash(readFileSync(new URL('./inputs.json',import.meta.url))) };
}
export function validateNineteen(events) {
  const pass = events.filter(x => x.type==='test:pass');
  const fail = events.filter(x => x.type==='test:fail');
  const summary = events.filter(x => x.type==='test:summary').at(-1);
  assert.equal(pass.length,19); assert.equal(fail.length,0);
  assert.ok(pass.every(x => !x.skip && !x.todo));
  assert.equal(summary?.success,true);
  assert.equal(summary?.counts?.tests,19); assert.equal(summary?.counts?.passed,19);
  for (const key of ['failed','skipped','todo','cancelled']) assert.equal(summary?.counts?.[key],0);
}
function errorCodes(result) {
  return [...new Set((String(result.stderr) + String(result.error?.code ?? '')).match(/\b(?:ERR_[A-Z_]+|E[A-Z]{2,}|[0-9A-Z]{5})\b/g) ?? [])].slice(0,20);
}
function executePglite(out) {
  assert.equal(JSON.parse(readFileSync(resolve(profileDir,'node_modules/@electric-sql/pglite/package.json'))).version,'0.3.14');
  const result = command(process.execPath, ['--experimental-strip-types','--import','./app/frontend/tests/deny-network.mjs','--test','--test-isolation=none','--test-reporter=./ci/migration007/reporter.mjs','app/frontend/tests/payment-phase2-db/migration007-repair.test.mjs'], { timeout: 360000 });
  // Reporter output is an allowlist. stderr is reduced to codes; raw logs stay private.
  const events = result.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
  writeFileSync(resolve(out,'pglite-events.jsonl'),events.map(x=>JSON.stringify(x)).join('\n')+'\n');
  writeFileSync(resolve(out,'pglite-process.json'),JSON.stringify({exit:result.status,errorCodes:errorCodes(result)},null,2));
  if(result.error) throw Object.assign(Error('PGlite subprocess unavailable'),{code:result.error.code??'SUBPROCESS_UNAVAILABLE'});
  assert.equal(result.status,0,'PGlite process failed; see sanitized process/event reports');
  validateNineteen(events);
}
function executeNative(out) {
  // Docker must point to this computer, never a remote daemon. No host ports/mounts.
  const endpoint = required('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}']);
  for (const value of [endpoint, process.env.DOCKER_HOST].filter(Boolean))
    assert.match(value,/^(?:unix:\/\/\/[^\r\n]+|npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+)$/);
  assert.equal(process.env.DOCKER_TLS_VERIFY || '', '');
  const name = 'amanah-migration007-' + randomBytes(8).toString('hex');
  const label = 'amanahlife.migration007=' + name;
  const logs=[]; let started=false;
  const record = row => { logs.push(row); writeFileSync(resolve(out,'native-events.jsonl'),logs.map(x=>JSON.stringify(x)).join('\n')+'\n'); };
  const sql = (db, text) => command('docker',['exec','--interactive','--user','postgres',name,'psql','-X','--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--set','VERBOSITY=verbose','--set','SHOW_CONTEXT=never','--username','postgres','--dbname',db,'--file','-'],{input:text,timeout:60000});
  const successful = (db,text) => { const r=sql(db,text); if(r.error || r.status!==0) throw Object.assign(Error('Native SQL failed; raw SQL/values withheld'),{code:'NATIVE_PSQL_FAILED',sqlStates:errorCodes(r)}); return r.stdout.trim(); };
  function cleanup() {
    if (!started) return;
    const remaining=required('docker',['ps','--all','--quiet','--filter','label='+label]);
    if(remaining) required('docker',['rm','--force','--volumes',name]);
    assert.equal(required('docker',['ps','--all','--quiet','--filter','label='+label]),'');
    started=false; record({type:'cleanup',success:true});
  }
  const signal = () => { try { cleanup(); } finally { process.exit(143); } };
  process.once('SIGTERM',signal); process.once('SIGINT',signal);
  try {
    required('docker',['pull','--platform','linux/amd64',manifest.postgresImage]);
    started=true;
    required('docker',['run','--detach','--name',name,'--label',label,'--platform','linux/amd64','--network','none','--read-only','--security-opt','no-new-privileges=true','--memory','1g','--cpus','2','--pids-limit','256','--tmpfs','/tmp:rw,nosuid,noexec,size=64m','--tmpfs','/var/run/postgresql:rw,nosuid,noexec,size=16m','--tmpfs','/var/lib/postgresql/data:rw,nosuid,noexec,size=512m','--env','POSTGRES_PASSWORD',manifest.postgresImage,'-c',"listen_addresses=",'-c','log_statement=none'],{env:childEnv({POSTGRES_PASSWORD:randomBytes(32).toString('hex')})});
    let ready=false;
    for(let i=0;i<60;i++) {
      const r=command('docker',['exec','--user','postgres',name,'pg_isready','--username','postgres'],{timeout:5000});
      const pid=command('docker',['exec',name,'cat','/proc/1/comm'],{timeout:5000});
      if(!r.error && !pid.error && r.status===0 && pid.status===0 && pid.stdout.trim()==='postgres'){ready=true;break;}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
    }
    assert.equal(ready,true,'Isolated PostgreSQL initialization timed out');
    assert.equal(successful('postgres',"select current_setting('server_version_num');"),'170006');
    record({type:'version',serverVersion:170006,image:manifest.postgresImage,network:'none',hostPorts:0});
    const profile=readFileSync(resolve(profileDir,'migration007-repair.test.mjs'),'utf8');
    const fixture=fixtureFromProfile(profile);
    const roles=fixture.match(/^create role [^\n]+;$/gm); assert.equal(roles.length,3);
    successful('postgres',roles.join('\n')+'\ncreate database fixture007_base;');
    successful('fixture007_base',fixture.replace(/^create role [^\n]+;\n/gm,'')+'\n'+helpers);
    const migration=readFileSync(resolve(root,'app/frontend/supabase/migrations/202610180007_notification_table_authority.sql'),'utf8');
    const snapshot=`select md5(jsonb_build_object('tables',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c where c.oid in ('public.${prefs}'::regclass,'public.${push}'::regclass)),'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p),'columns',(select jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum) from pg_attribute a where a.attrelid in ('public.${prefs}'::regclass,'public.${push}'::regclass)),'prefs',(select jsonb_agg(to_jsonb(t) order by user_id) from public.${prefs} t),'push',(select jsonb_agg(to_jsonb(t) order by user_id) from public.${push} t),'constraints',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_constraint c where c.conrelid in ('public.${prefs}'::regclass,'public.${push}'::regclass)))::text);`;
    for (let i=0;i<cases.length;i++) {
      const item=cases[i], db='fixture007_'+i;
      try {
        successful('postgres',`create database ${db} template fixture007_base;`);
        if(item.setup) successful(db,item.setup);
        if(item.failure) {
          const before=successful(db,snapshot);
          const result=sql(db,migration);
          assert.equal(result.error,undefined);
          assert.notEqual(result.status,0);
          assert.match(result.stderr,/Inherited\/excess (?:table|column) permission requires separate review/);
          assert.equal(successful(db,snapshot),before,'Failed migration must roll back all policy/ACL/data changes');
        } else {
          if(!item.beforeOnly) successful(db,migration);
          if(item.repeat) successful(db,migration);
          successful(db,item.sql);
        }
        record({type:'test:pass',name:item.id});
      } catch (error) {
        record({type:'test:fail',name:item.id,error:error.code??'SQL_OR_ASSERTION_FAILURE',sqlStates:error.sqlStates??[]});
      } finally {
        successful('postgres',`drop database if exists ${db}; revoke pg_maintain from authenticated; do $$begin if exists(select 1 from pg_roles where rolname='fixture_carrier') then revoke fixture_carrier from authenticated; drop role fixture_carrier; end if; end$$;`);
      }
    }
    const passed=logs.filter(x=>x.type==='test:pass').length, failed=logs.filter(x=>x.type==='test:fail').length;
    record({type:'summary',passed,failed,total:cases.length});
    assert.equal(passed,cases.length); assert.equal(failed,0);
  } finally {
    try { cleanup(); } finally { process.removeListener('SIGTERM',signal); process.removeListener('SIGINT',signal); }
  }
}
let safeOutput;
async function main() {
  const [mode='verify', destination] = process.argv.slice(2);
  assert.ok(['verify','pglite','native'].includes(mode));
  assert.ok(destination,'An external report directory is required');
  const out=resolve(destination);
  const rel=relative(root,out);
  assert.ok(rel.startsWith('..') || isAbsolute(rel),'Reports must stay outside the checkout');
  mkdirSync(out,{recursive:true});
  safeOutput=out;
  const versions=verifyInputs(); writeFileSync(resolve(out,'versions.json'),JSON.stringify(versions,null,2));
  if(mode==='pglite') executePglite(out);
  if(mode==='native') executeNative(out);
  writeFileSync(resolve(out,mode+'-status.json'),JSON.stringify({phase:mode,result:'PASS',...versions},null,2));
  console.log('Completed '+mode+'; sanitized evidence: '+out);
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{
  // No raw exception/cause/SQL/env is exported. A failed process can never be PASS.
  const safe={phase:process.argv[2],result:'FAIL_OR_BLOCKED',code:String(error.code??'PRECONDITION_OR_EXECUTION_FAILED'),sqlStates:error.sqlStates??[]};
  if(safeOutput) { try { writeFileSync(resolve(safeOutput,'failure.json'),JSON.stringify(safe,null,2)); } catch { /* nonzero exit remains authoritative */ } }
  console.error(JSON.stringify(safe)); process.exitCode=1;
});
