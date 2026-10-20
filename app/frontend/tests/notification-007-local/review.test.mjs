// Offline review only: no SDK import, Docker invocation, HTTP, SQL or service startup.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {cleanup} from './integration.mjs';
import {API_ORIGIN,CHECKS,CLI_VERSION,CLI_ARCHIVE_SHA256,SOURCE_COMMIT,SDK_VERSION,
  localStatus,allowedURL,workspace,commandCategory,requireCoverage,gitBlob} from './local-safety.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const jwt=role=>'e30.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.synthetic';
const secret='SYNTHETIC-SECRET-MUST-NOT-APPEAR';

test('reviewed source, SDK and official CLI are fixed',()=>{
  assert.equal(SOURCE_COMMIT,'3968fa6795bab794e72596d23d87c6b388659098');
  assert.equal(CLI_VERSION,'2.121.0');assert.equal(SDK_VERSION,'2.110.0');
  assert.equal(CLI_ARCHIVE_SHA256,'4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f');
});
test('workdir must be a dedicated direct child and cannot overlap sources',()=>{
  assert.equal(workspace('/tmp/amanah-007-123-1234abcd','/tmp','/work/subject'),'amanah-007-123-1234abcd');
  for(const [root,base,source] of [['/etc/example','/tmp','/work'],['/tmp/ordinary','/tmp','/work'],
    ['/tmp/amanah-007-123-1234abcd','/tmp','/tmp'],['/tmp/amanah-007-123-1234abcd','/tmp','/tmp/amanah-007-123-1234abcd/subject']])
    assert.throws(()=>workspace(root,base,source));
});
test('status cannot select hosted endpoints or swapped privileged credentials',()=>{
  const good={API_URL:API_ORIGIN,ANON_KEY:jwt('anon'),SERVICE_ROLE_KEY:jwt('service_role')};
  assert.equal(localStatus(good).url,API_ORIGIN);
  for(const bad of [{...good,API_URL:'https://example.supabase.co'}, {...good,API_URL:'http://localhost:54321'},
    {...good,ANON_KEY:jwt('service_role')},{...good,SERVICE_ROLE_KEY:undefined}, {...good,API_URL:API_ORIGIN+'/'}])
    assert.throws(()=>localStatus(bad));
});
test('HTTP guard allows only the native loopback Auth and REST services',()=>{
  for(const p of ['/auth/v1/user','/rest/v1/table'])assert.equal(allowedURL(API_ORIGIN+p).origin,API_ORIGIN);
  for(const u of ['https://example.supabase.co/rest/v1/x','http://localhost:54321/auth/v1/user',
    'http://127.0.0.1.evil.invalid:54321/auth/v1/user','http://169.254.169.254/auth/v1/user',
    'http://user:password@127.0.0.1:54321/auth/v1/user',API_ORIGIN+'/functions/v1/send',API_ORIGIN+'/auth/v1/../../other'])
    assert.throws(()=>allowedURL(u));
});
test('diagnostics contain fixed categories rather than error text or credentials',()=>{
  assert.equal(commandCategory(secret),'command_failed');
  for(const [text,expected] of [['address already in use','port_conflict'],['error running container: exit 1','database_bootstrap'],
    ['no such host','network'],['container is not ready: starting','service_health']]){
    const value=commandCategory(text+' '+secret+' https://secret.invalid postgres://u:p@host JWT=secret');
    assert.equal(value,expected);assert.ok(!value.includes(secret));
  }
  assert.equal(commandCategory('address already in use'+'x'.repeat(70000)),'command_failed');
});
test('mandatory coverage cannot silently omit or duplicate a security group',()=>{
  requireCoverage(CHECKS);assert.throws(()=>requireCoverage(CHECKS.slice(1)));
  assert.throws(()=>requireCoverage([...CHECKS,CHECKS[0]]));assert.throws(()=>requireCoverage([]));
});
test('minimal SDK lock has registry URLs, SHA512 integrity and a complete nine-package graph',()=>{
  const pkg=read('./package.json'),lock=read('./package-lock.json');
  assert.deepEqual(pkg.dependencies,{'@supabase/supabase-js':'2.110.0'});
  assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);
  assert.equal(lock.lockfileVersion,3);assert.equal(Object.keys(lock.packages).length,10);
  for(const [name,p] of Object.entries(lock.packages).filter(([name])=>name)){
    const url=new URL(p.resolved);assert.equal(url.origin,'https://registry.npmjs.org');
    assert.match(p.integrity,/^sha512-[A-Za-z0-9+/]+=*$/);
    assert.equal(Buffer.from(p.integrity.slice(7),'base64').length,64);
    const packageName=name.slice('node_modules/'.length);
    assert.equal(url.pathname,`/${packageName}/-/${packageName.split('/').at(-1)}-${p.version}.tgz`);
    for(const dep of Object.keys(p.dependencies||{}))assert.ok(lock.packages['node_modules/'+dep]);
    assert.ok(!p.hasInstallScript);
  }
  assert.ok(!pkg.scripts.test&&!pkg.scripts.postinstall);
});
test('source manifest includes the real writer, only fixture and migration 007',()=>{
  const m=read('./source-manifest.json');assert.equal(m.sourceCommit,SOURCE_COMMIT);
  assert.equal(Object.keys(m.files).length,6);
  assert.equal(m.files['app/frontend/src/lib/notificationPreferenceWrite.ts'],'b471ab49b0f7b4aabc9cc899f2f3bf8184ec7df4');
  assert.equal(m.files['app/frontend/supabase/migrations/202610180007_notification_table_authority.sql'],'6bb7c00a7db3e607894d5d2d2ba24fbb2e3e4ece');
  assert.ok(Object.keys(m.files).every(p=>!p.includes('0001_')&&!/20261018000[1-6]_/.test(p)));
  assert.equal(gitBlob(Buffer.from('test\n')),'9daeafb9864cf43055ae93beb0afd6c7d144bfa4');
});

function owned(started=false){
  const base=fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir());
  const root=path.join(base,`amanah-007-${process.pid}-${Math.random().toString(16).slice(2,10).padEnd(8,'0')}`);
  fs.mkdirSync(root,{mode:0o700});
  fs.writeFileSync(path.join(root,'owned.json'),JSON.stringify({source:SOURCE_COMMIT,project:path.basename(root)}));
  if(started)fs.writeFileSync(path.join(root,'start-attempted'),'1');
  return root;
}
test('partial preparation cleanup needs neither CLI nor Docker',()=>{
  const root=owned();fs.writeFileSync(path.join(root,'private-1.log'),secret);
  assert.equal(cleanup(root,()=>{throw Error('Offline test must not invoke a command');}),true);
  assert.ok(!fs.existsSync(root));
});
test('cleanup refuses an unowned directory and preserves its contents',()=>{
  const root=owned();fs.rmSync(path.join(root,'owned.json'));fs.writeFileSync(path.join(root,'keep'),'synthetic');
  try{assert.throws(()=>cleanup(root,()=>{throw Error('Unexpected command');}));assert.ok(fs.existsSync(path.join(root,'keep')));}
  finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('successful cleanup stops only this project and checks all three resource kinds',()=>{
  const root=owned(true),calls=[];
  assert.equal(cleanup(root,(exe,args)=>{calls.push([exe,args]);return '';}),true);
  assert.ok(calls[0][1].includes('--no-backup'));assert.equal(calls.length,4);
  for(const call of calls.slice(1))assert.ok(call[1].includes(`label=com.supabase.cli.project=${path.basename(root)}`));
  assert.ok(!fs.existsSync(root));
});
test('stop failure, failed inspection or residual resources never become clean success',()=>{
  for(const scenario of ['stop','inspect','remaining']){
    const root=owned(true);fs.writeFileSync(path.join(root,'status.json'),secret);fs.writeFileSync(path.join(root,'private-1.log'),secret);
    try{
      const result=cleanup(root,(exe)=>{
        if(scenario==='stop'&&exe!=='docker')throw Error(secret);
        if(scenario==='inspect'&&exe==='docker')throw Error(secret);
        return scenario==='remaining'&&exe==='docker'?'synthetic-resource':'';
      });
      assert.equal(result,false);assert.ok(fs.existsSync(path.join(root,'owned.json')));
      assert.ok(!fs.existsSync(path.join(root,'status.json'))&&!fs.existsSync(path.join(root,'private-1.log')));
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  }
});
test('integration wiring preserves independent race, idempotency, fail-closed final coverage and safe reports',()=>{
  const text=fs.readFileSync(new URL('./integration.mjs',import.meta.url),'utf8');
  const ids=[...text.matchAll(/await check\('([^']+)'/g)].map(x=>x[1]);requireCoverage(ids);
  assert.ok(text.includes('assert.deepEqual(metadata(),first)'));
  assert.ok(text.includes('one=await login(writerClient(1,wait),1),two=await login(writerClient(1,wait),1)'));
  assert.ok(text.includes('assert.equal(waiting,2)'));assert.ok(text.includes('[201,409]'));
  assert.ok(text.includes('requireCoverage(completed)'));assert.ok(text.includes('finally{'));
  assert.ok(text.includes("import.meta.url===pathToFileURL"));
  assert.ok(!text.includes('console.error(error')&&!text.includes('console.log(status')&&!text.includes('console.log(credentials'));
  assert.ok(!/db push|db reset|functions deploy|--db-url|supabase login|--linked/.test(text));
});
