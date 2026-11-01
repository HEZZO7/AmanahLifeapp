// Independent PostgreSQL connections, NOT GoTrue or the hosted 21-group suite.
// Starts ONLY a fresh owned cluster, no TCP, inherited PG credentials or Docker.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {SQL_FIXTURE_OPTIONS,verifySource} from '../../app/frontend/tests/payment-phase3-native/local-runtime.mjs';
import {PG_OPTIONS,PG_LIMITS} from '../../app/frontend/tests/payment-phase3-native/safety.mjs';
import {reserveSQL} from '../../app/frontend/tests/payment-phase3-native/integration.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const pkg=path.join(root,'app/frontend/tests/payment-phase3-native');
const manifest=JSON.parse(fs.readFileSync(path.join(pkg,'source-manifest.json')));
const bin=process.env.AMANAHLIFE_TEST_PG_BIN;
assert.equal(typeof bin,'string','Explicit local PostgreSQL binaries required; no hosted fallback');
assert.equal(fs.realpathSync(bin),bin);assert.ok(path.isAbsolute(bin));assert.notEqual(process.getuid(),0);
for(const name of ['initdb','pg_ctl','postgres','psql'])assert.ok(fs.statSync(path.join(bin,name)).isFile());
const owned=fs.mkdtempSync(path.join(os.tmpdir(),'amanah-races-pg-'));
fs.chmodSync(owned,0o700);
const data=path.join(owned,'data'),socket=path.join(owned,'socket');fs.mkdirSync(socket,{mode:0o700});
const env={PATH:process.env.PATH,LANG:'C.UTF-8',HOME:owned,LC_ALL:'C.UTF-8'};
const prefix='app_11941c8fec_',sub='public.'+prefix+'subscriptions';
const psqlArgs=['-X','-qAt','-h',socket,'-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'];
const connections=new Set();let started=false,stopped=false,serverPid;
const allowedStates=new Set(['P0001','42501','23503','55P03','57014','25P03']);
const state=text=>{const code=/(?:ERROR|FATAL):\s+([0-9A-Z]{5})/.exec(text)?.[1];return allowedStates.has(code)?code:'unclassified';};
function binary(name,args,options={}){
  const r=spawnSync(path.join(bin,name),args,{env,cwd:owned,encoding:'utf8',timeout:20000,...options});
  assert.equal(r.error,undefined,'Owned PostgreSQL process transport failed');
  assert.equal(r.status,0,'Owned PostgreSQL process failed; private output withheld');return r.stdout.trim();
}
function control(sql){return binary('psql',psqlArgs,{input:sql,env:{...env,PGOPTIONS:SQL_FIXTURE_OPTIONS}});}
const json=sql=>JSON.parse(control(sql));
const user=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
const q=id=>"'"+id+"'";
function seed(n,trial=false){
  const id=user(n);control('insert into auth.users(id) values('+q(id)+');insert into '+sub+'(user_id,trial_used,trial_started_at) values('+q(id)+','+trial+','+(trial?'now()':'null')+');');return id;
}
function snapshot(id){return json("select jsonb_build_object('auth',(select to_jsonb(t) from auth.users t where id="+q(id)+"),'subscription',(select to_jsonb(t) from "+sub+' t where user_id='+q(id)+"),'accounts',coalesce((select jsonb_agg(to_jsonb(t)) from public."+prefix+'payment_accounts t where user_id='+q(id)+"),'[]'::jsonb),'intents',coalesce((select jsonb_agg(to_jsonb(t)) from public."+prefix+'payment_intents t where user_id='+q(id)+"),'[]'::jsonb));");}
function assertGateClosed(){assert.equal(json('select to_json(not checkouts_enabled) from public.'+prefix+'payment_environment;'),true);}
let controlUser,controlBefore;
function unchangedControl(){assert.deepEqual(snapshot(controlUser),controlBefore);assertGateClosed();}
class Connection {
  constructor(options=SQL_FIXTURE_OPTIONS){
    this.pending=null;this.buffer='';this.output='';this.errors='';this.serial=0;
    this.child=spawn(path.join(bin,'psql'),psqlArgs,{env:{...env,PGOPTIONS:options},cwd:owned,stdio:['pipe','pipe','pipe']});
    this.closed=new Promise(resolve=>{
      this.child.on('error',()=>{this.pending?.reject(new Error('owned_session_transport'));resolve(false);});
      this.child.on('close',code=>{
        this.ended=true;this.exit=code;
        this.pending?.reject(Object.assign(new Error('owned_session_failed'),{sqlState:state(this.errors),exit:code}));resolve(code===0);
      });
    });
    this.child.stderr.on('data',chunk=>{this.errors=(this.errors+chunk).slice(-65536);});
    this.child.stdout.on('data',chunk=>{
      this.buffer+=chunk;
      while(this.buffer.includes('\n')){
        const i=this.buffer.indexOf('\n'),line=this.buffer.slice(0,i).replace(/\r$/,'');this.buffer=this.buffer.slice(i+1);
        if(this.pending&&line===this.pending.marker){const pending=this.pending;this.pending=null;const out=this.output.trim();this.output='';pending.resolve(out);}
        else this.output+=line+'\n';
      }
    });
    this.child.stdin.on('error',()=>{this.pending?.reject(new Error('owned_session_transport'));});connections.add(this);
  }
  async query(sql){
    assert.equal(this.pending,null);assert.notEqual(this.ended,true);
    let timer;
    try{return await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>{this.child.kill('SIGTERM');reject(new Error('owned_session_timeout'));},PG_LIMITS.client);
      const marker='race_done_'+(++this.serial);this.pending={marker,resolve,reject};
      this.child.stdin.write(sql+'\n\\echo '+marker+'\n');
    });}finally{clearTimeout(timer);}
  }
  async pid(){const id=Number(await this.query('select pg_backend_pid();'));assert.ok(Number.isSafeInteger(id)&&id>0);return id;}
  async finish(sql){await this.query(sql);this.child.stdin.end();assert.equal(await this.closed,true);}
  async close(){this.child.stdin.end();await this.closed;assert.equal(this.ended,true);}
}
const outcome=promise=>promise.then(()=>({ok:true}),error=>({ok:false,error}));
async function waitLock(waiter,blocker){
  assert.notEqual(waiter,blocker);const end=Date.now()+6000;
  do{
    const seen=json('select to_json(exists(select 1 from pg_stat_activity where pid='+waiter+" and wait_event_type='Lock' and "+blocker+'=any(pg_blocking_pids(pid))));');
    if(seen===true)return;
    // Yield for psql IO, not an arbitrary sleep or a retry of any SQL mutation.
    await new Promise(setImmediate);
  }while(Date.now()<end);
  throw new Error('required_owned_lock_not_observed');
}
function assertDenied(result,sqlState){assert.equal(result.ok,false);assert.equal(result.error.sqlState,sqlState);assert.equal(result.error.exit,3);}
async function stop(){
  if(stopped)return;
  for(const connection of connections)await connection.close();
  // A failed startup can still leave an owned postmaster: inspect the journal.
  if(started||fs.existsSync(path.join(data,'postmaster.pid'))){
    serverPid??=Number(fs.readFileSync(path.join(data,'postmaster.pid'),'utf8').split('\n')[0]);
    assert.equal(fs.statSync(data).uid,process.getuid());
    assert.equal(fs.statSync('/proc/'+serverPid).uid,process.getuid());
    assert.ok(fs.readFileSync('/proc/'+serverPid+'/cmdline','utf8').split('\0').includes(data));
    binary('pg_ctl',['-D',data,'-m','fast','-w','-t','15','stop']);
    assert.equal(fs.existsSync(path.join(data,'postmaster.pid')),false);
    assert.equal(fs.existsSync(path.join(socket,'.s.PGSQL.55439')),false);
  }
  fs.rmSync(owned,{recursive:true});assert.equal(fs.existsSync(owned),false);stopped=true;
}
before(()=>{
  verifySource(root,manifest);
  binary('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  assert.match(owned,/^\/[a-zA-Z0-9/_-]+$/);
  binary('pg_ctl',['-D',data,'-l',path.join(owned,'server-private.log'),'-w','-t','15','-o',"-c listen_addresses='' -c unix_socket_directories='"+socket+"' -c unix_socket_permissions=0700 -p 55439",'start']);
  started=true;serverPid=Number(fs.readFileSync(path.join(data,'postmaster.pid'),'utf8').split('\n')[0]);
  assert.deepEqual(json("select jsonb_build_object('local',inet_server_addr() is null,'postgres',current_database()='postgres' and current_user='postgres','version',current_setting('server_version_num')::int>=170000 and current_setting('server_version_num')::int<180000,'socketPrivate',current_setting('unix_socket_permissions')='0700','noTcp',current_setting('listen_addresses')='');"),{local:true,postgres:true,version:true,socketPrivate:true,noTcp:true});
  control("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);grant usage on schema auth,public to anon,authenticated,service_role;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;");
  for(const file of ['fixture.sql','phase3-schema.sql'])control(fs.readFileSync(path.join(pkg,file),'utf8'));
  for(const file of manifest.migrationOrder)control(fs.readFileSync(path.join(root,file),'utf8'));
  control("insert into public."+prefix+"payment_environment(singleton,mode) values(true,'test');");
  controlUser=seed(99,true);controlBefore=snapshot(controlUser);
});
after(stop);
test('legacy checkout session fails its FIRST fixture statement with P0001 and rolls back',async()=>{
  const id=seed(1),before=snapshot(id),session=new Connection(PG_OPTIONS);
  assert.equal(await session.query("select current_setting('amanahlife.local_test',true) is null;"),'t');
  const result=await outcome(session.query('begin;'+reserveSQL(id,'a')));
  assertDenied(result,'P0001');assert.deepEqual(snapshot(id),before);unchangedControl();
});
test('legacy deletion-first checkout exits before an FK lock can be observed',async()=>{
  const id=seed(2,true),before=snapshot(id),deletion=new Connection(),checkout=new Connection(PG_OPTIONS);
  const [dpid,cpid]=await Promise.all([deletion.pid(),checkout.pid()]);assert.notEqual(dpid,cpid);
  await deletion.query('begin;delete from auth.users where id='+q(id)+';');await checkout.query('begin;');
  const result=await outcome(checkout.query(reserveSQL(id,'b')));assertDenied(result,'P0001');
  assert.equal(json('select to_json(exists(select 1 from pg_stat_activity where pid='+cpid+" and wait_event_type='Lock' and "+dpid+'=any(pg_blocking_pids(pid))));'),false);
  await deletion.finish('rollback;');assert.deepEqual(snapshot(id),before);unchangedControl();
});
for(const commit of [true,false])test('checkout-first lock waits, then checkout '+(commit?'commit retains ownership and denies delete':'rollback permits deletion'),async()=>{
  const id=seed(commit?3:4),checkout=new Connection(),deletion=new Connection();
  const [cpid,dpid]=await Promise.all([checkout.pid(),deletion.pid()]);assert.notEqual(cpid,dpid);
  assert.equal(await checkout.query("select current_setting('amanahlife.local_test');"),'approved');
  await checkout.query('begin;'+reserveSQL(id,commit?'a':'c'));await deletion.query('begin;');assertGateClosed();
  const pending=outcome(deletion.query('delete from auth.users where id='+q(id)+';'));
  await waitLock(dpid,cpid);await checkout.finish(commit?'commit;':'rollback;');
  const result=await pending;
  if(commit){assertDenied(result,'42501');const kept=snapshot(id);assert.ok(kept.auth);assert.equal(kept.intents.length,1);assert.equal(kept.intents[0].user_id,id);assert.equal(kept.accounts[0].user_id,id);}
  else{assert.equal(result.ok,true);await deletion.finish('commit;');assert.deepEqual(snapshot(id),{auth:null,subscription:null,accounts:[],intents:[]});}
  unchangedControl();
});
for(const commit of [true,false])test('deletion-first lock waits, then deletion '+(commit?'commit rejects reservation with FK':'rollback preserves trial and reservation ownership'),async()=>{
  const id=seed(commit?5:6,true),before=snapshot(id),deletion=new Connection(),checkout=new Connection();
  const [dpid,cpid]=await Promise.all([deletion.pid(),checkout.pid()]);assert.notEqual(dpid,cpid);
  await deletion.query('begin;delete from auth.users where id='+q(id)+';');await checkout.query('begin;');
  const pending=outcome(checkout.query(reserveSQL(id,'b')));await waitLock(cpid,dpid);assertGateClosed();
  await deletion.finish(commit?'commit;':'rollback;');const result=await pending;
  if(commit){assertDenied(result,'23503');assert.deepEqual(snapshot(id),{auth:null,subscription:null,accounts:[],intents:[]});}
  else{assert.equal(result.ok,true);await checkout.finish('commit;');const kept=snapshot(id);assert.deepEqual(kept.auth,before.auth);assert.deepEqual(kept.subscription,before.subscription);assert.equal(kept.intents.length,1);assert.equal(kept.intents[0].user_id,id);}
  unchangedControl();
});
test('paid-projection writer holds row lock; committed paid state denies deletion and keeps trial',async()=>{
  const id=seed(7,true),writer=new Connection(),deletion=new Connection();
  const [wpid,dpid]=await Promise.all([writer.pid(),deletion.pid()]);assert.notEqual(wpid,dpid);
  await writer.query("begin;select set_config('amanahlife.trusted_payment_write','yes',true);update "+sub+" set tier='balanced',paid_access_from=now()-interval '1 day',paid_access_until=now()+interval '1 day' where user_id="+q(id)+';');
  await deletion.query('begin;');const pending=outcome(deletion.query('delete from auth.users where id='+q(id)+';'));
  await waitLock(dpid,wpid);await writer.finish('commit;');assertDenied(await pending,'42501');
  const kept=snapshot(id);assert.ok(kept.auth);assert.equal(kept.subscription.tier,'balanced');assert.equal(kept.subscription.trial_used,true);unchangedControl();
});
test('owned PostgreSQL processes, sockets, data and private logs are independently removed',async()=>{await stop();assert.equal(stopped,true);});
