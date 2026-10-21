// PREPARATION ONLY. Execution requires separate explicit approval.
// No workflow is installed by this package. This entrypoint has no import-time side effects.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
import {API_ORIGIN,CHECKS,CLI_VERSION,CLI_ARCHIVE_SHA256,SOURCE_COMMIT,SDK_VERSION,
  workspace,localStatus,allowedURL,gitBlob,commandCategory,uuid,summarize} from './safety.mjs';

const fixturePath=new URL('./fixture.sql',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('./source-manifest.json',import.meta.url)));
const approval='synthetic-deletion-tests-only';
const childEnv={PATH:process.env.PATH,LANG:'C.UTF-8',DO_NOT_TRACK:'1',CI:'true',DOCKER_HOST:'unix:///var/run/docker.sock'};
let root,project,cli,phase='preflight',logNumber=0;
const results=[];let cleanupPassed=false;
const emit=value=>process.stdout.write((typeof value==='string'?value:JSON.stringify(value))+'\n');
class Failure extends Error {
  constructor(category='assertion_failed',exitCode=1){super('Local test failed');this.category=category;this.exitCode=exitCode;}
}
function options(args){
  const out={};
  for(let i=0;i<args.length;i++){
    const key=args[i];assert.ok(['--source','--workdir','--cli-archive','--cleanup'].includes(key),'Unknown option');
    assert.equal(out[key],undefined,'Duplicate option');
    out[key]=key==='--cleanup'?true:args[++i];
    assert.ok(out[key],'Missing option value');
  }
  return out;
}
function command(exe,args,input,timeout=30000){
  const r=spawnSync(exe,args,{env:childEnv,input,encoding:'utf8',timeout,maxBuffer:32*1024*1024});
  const text=(r.stdout||'')+(r.stderr||'');
  if(root&&fs.existsSync(path.join(root,'owned.json')))
    fs.writeFileSync(path.join(root,`private-${++logNumber}.log`),text,{mode:0o600});
  if(r.error||r.status!==0)throw new Failure(r.error?.code==='ETIMEDOUT'?'timeout':commandCategory(text),
    r.error?.code==='ETIMEDOUT'?124:(r.status>0?r.status:r.signal?128+(os.constants.signals[r.signal]||0):1));
  return (r.stdout||'').trim();
}
function sql(text){
  return command('docker',['exec','-i','-e','PGOPTIONS=-c amanahlife.local_test=approved -c amanahlife.security_fixture=isolated',
    `supabase_db_${project}`,'psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],text);
}
function jsonSQL(text){return JSON.parse(sql(text));}
async function check(id,fn,fatal=false){
  assert.ok(CHECKS.includes(id)&&!results.some(x=>x.id===id));
  phase=id;emit('008 check='+id+' result=started');
  try { await fn();results.push({id,result:'passed'});emit('008 check='+id+' result=passed'); }
  catch { results.push({id,result:'failed'});emit('008 check='+id+' result=failed');if(fatal)throw new Failure('prerequisite_failed'); }
}
function inspectOwnedContainers(){
  for(const service of ['db','auth','rest','kong']){
    const labels=JSON.parse(command('docker',['inspect','--format','{{json .Config.Labels}}',`supabase_${service}_${project}`]));
    assert.equal(labels['com.supabase.cli.project'],project);
  }
}
function protectInbound(){
  const route=command('ip',['-4','route','show','default']);
  const iface=/\bdev ([A-Za-z0-9_.-]+)\b/.exec(route)?.[1];assert.ok(iface);
  for(const args of [
    ['iptables','-I','DOCKER-USER','1','-i',iface,'-m','conntrack','--ctstate','NEW','-j','DROP'],
    ['iptables','-I','INPUT','1','-i',iface,'-p','tcp','-m','conntrack','--ctstate','NEW','-j','DROP'],
    ['ip6tables','-I','INPUT','1','!','-i','lo','-p','tcp','-m','conntrack','--ctstate','NEW','-j','DROP'],
    ['ip6tables','-I','FORWARD','1','-i',iface,'-m','conntrack','--ctstate','NEW','-j','DROP'],
  ])command('sudo',args);
}
export function cleanup(workdir,run=command){
  const base=fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir());
  workspace(workdir,base);
  if(!fs.existsSync(workdir))return true;
  assert.ok(!fs.lstatSync(workdir).isSymbolicLink());
  const marker=JSON.parse(fs.readFileSync(path.join(workdir,'owned.json')));
  assert.equal(marker.project,path.basename(workdir));assert.equal(marker.source,SOURCE_COMMIT);
  let failed=false;
  if(fs.existsSync(path.join(workdir,'start-attempted'))){
    try{run(path.join(workdir,'bin/supabase'),['--workdir',workdir,'stop','--no-backup'],undefined,180000);}catch{failed=true;}
    for(const kind of ['container','volume','network']){
      try{
        const args=kind==='container'?['ps','-aq']: [kind,'ls','-q'];
        const remaining=run('docker',[...args,'--filter',`label=com.supabase.cli.project=${marker.project}`]);
        if(remaining)failed=true;
      }catch{failed=true;}
    }
  }
  if(failed){
    // Retain ownership/config/CLI for the external always-cleanup step. Never
    // erase evidence and then report a missing workdir as successful cleanup.
    for(const file of fs.readdirSync(workdir))if(/^private-\d+\.log$|^status\.json$/.test(file))fs.rmSync(path.join(workdir,file),{force:true});
    return false;
  }
  fs.rmSync(workdir,{recursive:true,force:true});
  assert.ok(!fs.existsSync(workdir));
  return !failed;
}

export function createWorkspace(workdir,write=fs.writeFileSync){
  workspace(workdir,fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir()));
  fs.mkdirSync(workdir,{mode:0o700}); // Never reuse a pre-existing directory.
  const directory=fs.lstatSync(workdir),marker=path.join(workdir,'owned.json');
  let fd,ownedMarker;
  try{
    fd=fs.openSync(marker,'wx',0o600);ownedMarker=fs.fstatSync(fd);
    write(fd,JSON.stringify({project:path.basename(workdir),source:SOURCE_COMMIT}));
  }catch(error){
    const current=fs.lstatSync(workdir);
    assert.ok(!current.isSymbolicLink()&&current.dev===directory.dev&&current.ino===directory.ino);
    if(ownedMarker){
      const file=fs.lstatSync(marker);
      assert.ok(!file.isSymbolicLink()&&file.dev===ownedMarker.dev&&file.ino===ownedMarker.ino);
      fs.unlinkSync(marker);
    }
    // Nonrecursive: foreign/replacement files are never removed on marker failure.
    fs.rmdirSync(workdir);
    throw error;
  }finally{if(fd!==undefined)fs.closeSync(fd);}
}


const sessions=new Set();
class Session {
  constructor(name){
    assert.ok(/^[a-z0-9-]+$/.test(name));this.name=name;this.buffer='';this.output='';this.errorText='';this.serial=0;this.pending=null;
    this.child=spawn('docker',['exec','-i','-e','PGAPPNAME='+name,'supabase_db_'+project,
      'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],
      {env:childEnv,stdio:['pipe','pipe','pipe']});
    this.closed=new Promise(resolve=>{
      this.child.on('error',()=>{this.ended=true;this.pending?.reject(new Failure('session_failed'));resolve(false);});
      this.child.on('close',code=>{
        this.ended=true;const failure=new Failure('sql_session_failed',code>0?code:1);
        failure.sqlState=/(?:ERROR|FATAL):\s+([0-9A-Z]{5})/.exec(this.errorText)?.[1];
        this.pending?.reject(failure);resolve(code===0);
      });
    });
    this.child.stderr.on('data',b=>{this.errorText=(this.errorText+b).slice(-65536);});
    this.child.stdout.on('data',b=>{
      this.buffer+=b;
      while(this.buffer.includes('\n')){
        const split=this.buffer.indexOf('\n'),line=this.buffer.slice(0,split).replace(/\r$/,'');this.buffer=this.buffer.slice(split+1);
        if(this.pending&&line===this.pending.marker){
          const p=this.pending;this.pending=null;const out=this.output.trim();this.output='';p.resolve(out);
        }else this.output+=line+'\n';
      }
    });
    this.child.stdin.on('error',()=>{this.pending?.reject(new Failure('session_failed'));});
    sessions.add(this);
  }
  async query(text){
    assert.ok(!this.pending&&!this.ended);
    const marker='amanah008_done_'+(++this.serial);
    let timer;
    try{
      return await new Promise((resolve,reject)=>{
        timer=setTimeout(()=>{reject(new Failure('session_timeout',124));this.child.kill('SIGTERM');},15000);
        this.pending={marker,resolve,reject};
        this.child.stdin.write(text+'\n\\echo '+marker+'\n');
      });
    }finally{clearTimeout(timer);}
  }
  async pid(){const value=Number(await this.query('select pg_backend_pid();'));assert.ok(Number.isSafeInteger(value)&&value>0);return value;}
  async finish(text='rollback;'){
    await this.query(text);this.child.stdin.end();assert.equal(await this.closed,true);
  }
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForBlock(waiter,blocker){
  assert.ok(waiter!==blocker);
  const deadline=Date.now()+6000;
  while(Date.now()<deadline){
    const blocked=jsonSQL('select to_jsonb(exists(select 1 from pg_stat_activity where pid='+waiter+
      " and wait_event_type='Lock' and "+blocker+'=any(pg_blocking_pids(pid))));');
    if(blocked===true)return;
    await delay(100);
  }
  throw new Failure('required_lock_not_observed');
}
async function stopSessions(){
  for(const session of sessions){try{session.child.stdin.end('\nrollback;\n');}catch{/* no raw errors */}}
  await delay(50);
  for(const session of sessions)if(!session.ended)session.child.kill('SIGTERM');
  const closed=await Promise.race([Promise.all([...sessions].map(s=>s.closed)).then(()=>true),delay(3000).then(()=>false)]);
  if(!closed)for(const session of sessions)if(!session.ended)session.child.kill('SIGKILL');
  return closed;
}
function quoted(value){return "'"+uuid(value)+"'";}
function reserve(user,digit){
  return "select public.app_11941c8fec_payment_reserve_checkout('test',"+quoted(user)+",repeat('"+digit+
    "',64),'8001','8002','8003','balanced','monthly',0,null);";
}
function currentRows(user){
  return jsonSQL("select jsonb_build_object('auth',exists(select 1 from auth.users where id="+quoted(user)+
    "),'subscription',(select to_jsonb(s) from public.app_11941c8fec_subscriptions s where user_id="+quoted(user)+"));");
}
function billingRows(user){
  const tables=['payment_accounts','payment_intents','payment_bindings','payment_periods','subscriptions'];
  return jsonSQL('select jsonb_build_object('+tables.map(t=>"'"+t+"',(select jsonb_agg(to_jsonb(t)) from public.app_11941c8fec_"+t+
    " t where user_id="+quoted(user)+")").join(',')+');');
}

// Pure SQL builder; offline review must not execute it. All state changes target
// the disposable synthetic account and roll back, including on psql disconnect.
export function historyRetentionSQL(user,control){
  const target=quoted(user),clean=quoted(control);assert.notEqual(user,control);
  const retained=[
    ['accounts','user_id','to_jsonb(t)'],
    ['intents','intent_hash',"to_jsonb(t)-'expires_at'"],
    ['bindings','mode,subscription_id',"to_jsonb(t)||jsonb_build_object('last_state',t.last_state-'provider_status')"],
    ['periods','mode,subscription_id,proof_id',"to_jsonb(t)-'access_end'-'service_period_end'"],
  ];
  const evidence='jsonb_build_object('+retained.map(([name,order,value])=>
    "'"+name+"',coalesce((select jsonb_agg("+value+' order by '+order.split(',').map(k=>'t.'+k).join(',')+
    ') from public.app_11941c8fec_payment_'+name+' t where user_id='+target+"),'[]'::jsonb)").join(',')+')';
  return `begin;
do $history$
declare historical jsonb; part text; previous_guard text;
begin
  if current_setting('amanahlife.local_test',true) is distinct from 'approved'
     or current_user<>'postgres'
     or not exists(select 1 from public.app_11941c8fec_payment_environment where mode='test') then
    raise exception 'Owned local test required';
  end if;
  historical := ${evidence};
  foreach part in array array['accounts','intents','bindings','periods'] loop
    if jsonb_array_length(historical->part)=0 then raise exception 'Historical evidence missing'; end if;
  end loop;

  update public.app_11941c8fec_payment_periods
    set access_end=least(access_end,transaction_timestamp()-interval '1 second'),
        service_period_end=case when service_period_end is null then null
          else least(service_period_end,transaction_timestamp()-interval '1 second') end
    where user_id=${target};
  update public.app_11941c8fec_payment_intents
    set expires_at=least(expires_at,transaction_timestamp()-interval '1 second') where user_id=${target};
  update public.app_11941c8fec_payment_bindings
    set last_state=jsonb_set(last_state,'{provider_status}','"expired"'::jsonb) where user_id=${target};

  -- Use the existing trusted fixture-write mechanism; never disable a trigger or RLS.
  previous_guard:=current_setting('amanahlife.trusted_payment_write',true);
  perform set_config('amanahlife.trusted_payment_write','yes',true);
  update public.app_11941c8fec_subscriptions set tier='free',status='expired',
    paid_access_from=null,paid_access_until=null,current_period_start=null,current_period_end=null,
    lemonsqueezy_customer_id=null,lemonsqueezy_subscription_id=null,
    paddle_customer_id=null,paddle_subscription_id=null where user_id=${target};
  perform set_config('amanahlife.trusted_payment_write',coalesce(previous_guard,''),true);

  if historical is distinct from ${evidence} then raise exception 'Historical evidence changed'; end if;
  if not exists(select 1 from auth.users where id=${target})
     or not exists(select 1 from public.app_11941c8fec_subscriptions where user_id=${target}) then
    raise exception 'Synthetic account missing';
  end if;
  if exists(select 1 from public.app_11941c8fec_payment_periods where user_id=${target}
       and (access_end>transaction_timestamp() or service_period_end>transaction_timestamp() or review_required))
     or exists(select 1 from public.app_11941c8fec_payment_intents where user_id=${target} and expires_at>transaction_timestamp())
     or exists(select 1 from public.app_11941c8fec_payment_bindings where user_id=${target}
       and (last_state->>'provider_status' is distinct from 'expired'
         or coalesce((last_state->>'review_required')::boolean,false)
         or (last_state->>'paid_access_until')::timestamptz>transaction_timestamp()
         or (last_state->>'ends_at')::timestamptz>transaction_timestamp()
         or (last_state->>'renews_at')::timestamptz>transaction_timestamp()))
     or exists(select 1 from public.app_11941c8fec_payment_accounts a where user_id=${target}
       and (review_required or (subscription_id is not null and not exists(
         select 1 from public.app_11941c8fec_payment_bindings b where b.user_id=a.user_id
           and b.mode=a.mode and b.subscription_id=a.subscription_id and b.last_state->>'provider_status'='expired'))))
     or exists(select 1 from public.app_11941c8fec_payment_plan_changes where user_id=${target} and status<>'activated')
     or exists(select 1 from public.app_11941c8fec_payment_deliveries where status<>'done')
     or exists(select 1 from public.app_11941c8fec_subscriptions where user_id=${target} and (
       tier<>'free' or status<>'expired' or paid_access_from is not null or paid_access_until is not null
       or current_period_start is not null or current_period_end is not null
       or lemonsqueezy_subscription_id is not null or lemonsqueezy_customer_id is not null
       or paddle_subscription_id is not null or paddle_customer_id is not null
       or trial_started_at>transaction_timestamp()-interval '7 days')) then
    raise exception 'Current obligation or entitlement remains';
  end if;
  -- Positive control: the same guard must allow the existing trial-only account.
  if public.app_11941c8fec_account_deletion_allowed(${clean}) is distinct from true then
    raise exception 'Clean control blocked';
  end if;
  if public.app_11941c8fec_account_deletion_allowed(${target}) is distinct from false then
    raise exception 'Historical billing must block deletion';
  end if;
end $history$;
rollback;`;
}

async function execute(opts){
  assert.equal(process.env.AMANAHLIFE_LOCAL_008_APPROVAL,approval);
  assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
  const [major,minor]=process.versions.node.split('.').map(Number);assert.ok(major>22||(major===22&&minor>=18));
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  assert.equal(process.env.GITHUB_REPOSITORY,'HEZZO7/AmanahLifeapp');
  assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  assert.equal(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)).repository?.private,false);
  assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_USE_ENV_PROXY);
  assert.ok(!process.env.DOCKER_HOST||process.env.DOCKER_HOST==='unix:///var/run/docker.sock');
  assert.ok(!process.env.DOCKER_CONTEXT||process.env.DOCKER_CONTEXT==='default');
  const base=fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir());
  root=path.resolve(opts['--workdir']);childEnv.HOME=root;childEnv.XDG_CONFIG_HOME=path.join(root,'.config');
  if(opts['--cleanup']){phase='cleanup';cleanupPassed=cleanup(root);assert.ok(cleanupPassed);return;}
  const source=fs.realpathSync(opts['--source']);project=workspace(root,base,source);
  assert.ok(!fs.existsSync(root));assert.equal(command('git',['-C',source,'rev-parse','HEAD']),SOURCE_COMMIT);
  assert.equal(manifest.sourceCommit,SOURCE_COMMIT);
  for(const [file,hash] of Object.entries(manifest.files)){
    const target=path.join(source,file);assert.ok(!fs.lstatSync(target).isSymbolicLink());
    assert.equal(fs.realpathSync(target),target);assert.equal(gitBlob(fs.readFileSync(target)),hash);
  }
  const archive=fs.realpathSync(opts['--cli-archive']);
  assert.equal(path.basename(archive),'supabase_'+CLI_VERSION+'_linux_amd64.tar.gz');
  assert.equal(createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),CLI_ARCHIVE_SHA256);
  assert.equal(command('docker',['ps','-aq','--filter','label=com.supabase.cli.project']),'');
  for(const kind of ['volume','network'])assert.equal(command('docker',[kind,'ls','-q','--filter','name='+project]),'');
  createWorkspace(root);
  try{
    fs.mkdirSync(path.join(root,'bin'),{mode:0o700});
    command('tar',['-xzf',archive,'-C',path.join(root,'bin'),'supabase']);
    cli=path.join(root,'bin/supabase');assert.equal(command(cli,['--version']),CLI_VERSION);
    protectInbound();
    for(const name of ['init','start']){
      phase=name;emit('008 phase='+name+' result=started');
      if(name==='start')fs.writeFileSync(path.join(root,'start-attempted'),'1',{mode:0o600});
      command(cli,['--workdir',root,name],undefined,name==='start'?1080000:30000);
      assert.ok(!fs.existsSync(path.join(root,'supabase/.temp/project-ref')));
      if(name==='init'){
        const config=fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8');
        assert.equal(/^project_id\s*=\s*"([a-z0-9-]+)"\s*$/m.exec(config)?.[1],project);
        const migrations=path.join(root,'supabase/migrations');
        assert.ok(!fs.existsSync(migrations)||!fs.readdirSync(migrations).some(x=>x.endsWith('.sql')));
      }
      emit('008 phase='+name+' result=passed');
    }
    phase='status';inspectOwnedContainers();
    const status=command(cli,['--workdir',root,'status','-o','json']);
    fs.writeFileSync(path.join(root,'status.json'),status,{mode:0o600});
    await exercise(source,localStatus(JSON.parse(status)));
  }finally{
    const previous=phase;let stopped=false;
    try{stopped=await stopSessions();}catch{/* resource cleanup must still run */}
    phase='cleanup';cleanupPassed=cleanup(root)&&stopped;
    if(!cleanupPassed)throw new Failure('cleanup_failed');
    emit('008 phase=cleanup result=passed');phase=previous;
  }
}

async function exercise(source,credentials){
  let rejected=0,attempted=0,capturedHandler;const traffic=[];
  const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;
  globalThis.fetch=async(input,init={})=>{
    attempted++;let url;
    try{url=allowedURL(input);}catch{rejected++;throw new Failure('nonlocal_request');}
    const response=await originalFetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});
    traffic.push({method:init.method||input?.method||'GET',path:url.pathname,status:response.status});
    return response;
  };
  try{
    phase='dependencies';
    const {createClient}=await import('@supabase/supabase-js');
    assert.equal(JSON.parse(fs.readFileSync(new URL('./node_modules/@supabase/supabase-js/package.json',import.meta.url))).version,SDK_VERSION);
    const sdk=key=>createClient(API_ORIGIN,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const admin=sdk(credentials.service),users=[],clients=[];
    const q=quoted,sub='public.app_11941c8fec_subscriptions';
    const migrationFiles=Object.keys(manifest.files).filter(p=>p.includes('/migrations/'));
    assert.equal(migrationFiles.length,6);
    await check('schema_migrations',()=>{
      sql(fs.readFileSync(fixturePath,'utf8'));
      for(const file of migrationFiles.slice(0,5))sql(fs.readFileSync(path.join(source,file),'utf8'));
      sql("insert into public.app_11941c8fec_payment_environment(singleton,mode) values(true,'test');");
    },true);
    async function login(i){
      const {data,error}=await clients[i].auth.signInWithPassword({email:users[i].email,password:users[i].password});
      assert.equal(error,null);assert.equal(data.user.id,users[i].id);
      const verified=await clients[i].auth.getUser(data.session.access_token);
      assert.equal(verified.error,null);assert.equal(verified.data.user.id,users[i].id);
      users[i].token=data.session.access_token;
    }
    await check('auth',async()=>{
      for(const letter of ['a','b']){
        const email='migration008-'+letter+'-'+randomBytes(6).toString('hex')+'@example.invalid';
        const password=randomBytes(24).toString('base64url')+'aA1!';
        const r=await admin.auth.admin.createUser({email,password,email_confirm:true});
        assert.equal(r.error,null);users.push({id:uuid(r.data.user.id),email,password});clients.push(sdk(credentials.anon));
        await login(users.length-1);
      }
      assert.notEqual(users[0].id,users[1].id);
    },true);
    const A=users[0].id,B=users[1].id;
    async function rpcReady(name,args){
      const deadline=Date.now()+6000;
      while(true){
        const r=await admin.rpc(name,args);
        if(!r.error)return r.data;
        if(r.error.code!=='PGRST202'||Date.now()>deadline)throw new Failure('rpc_unavailable');
        await delay(100);
      }
    }
    let trialBefore,billingBefore;
    await check('migration_metadata',async()=>{
      // Auth schema/roles remain native; only the public baseline fixture is adapted.
      sql("insert into "+sub+"(user_id) values("+q(A)+");");
      const deadline=Date.now()+6000;let trial;
      do {trial=await clients[1].rpc('app_11941c8fec_start_trial');if(trial.error?.code==='PGRST202')await delay(100);else break;}while(Date.now()<deadline);
      assert.equal(trial.error,null);assert.equal(trial.data.error,null);
      trialBefore=currentRows(B).subscription;assert.equal(trialBefore.trial_used,true);
      for(const t of ['search_history','email_digest','notification_preferences','push_subscriptions']){
        sql("insert into public.app_11941c8fec_"+t+"(user_id,marker) values("+q(B)+",'synthetic-preserve');");
      }
      const dataBefore=currentRows(B),file=path.join(source,migrationFiles[5]);
      assert.ok(file.endsWith('202610210008_account_deletion_safety.sql'));
      sql(fs.readFileSync(file,'utf8'));
      assert.deepEqual(currentRows(B),dataBefore);
      const metadata=()=>jsonSQL(fs.readFileSync(new URL('./metadata.sql',import.meta.url),'utf8'));
      const first=metadata();sql(fs.readFileSync(file,'utf8'));
      assert.deepEqual(metadata(),first);assert.deepEqual(currentRows(B),dataBefore);
      assert.equal(first.functions.length,2);
      for(const f of first.functions){
        assert.equal(f.owner,'postgres');assert.equal(f.definer,true);assert.equal(f.config.length,1);assert.match(f.config[0],/^search_path=(?:""|)$/);
        const allowed=f.name==='app_11941c8fec_account_deletion_allowed';
        for(const [role,canExecute,grant]of f.rights){assert.equal(canExecute,allowed&&role==='service_role');assert.equal(grant,false);}
      }
      assert.equal(first.triggers.length,2);
      assert.deepEqual(first.triggers.map(t=>t.schema+'.'+t.table).sort(),['auth.users','public.app_11941c8fec_subscriptions'].sort());
      for(const t of first.triggers){assert.equal(t.type,11);assert.equal(t.enabled,'O');assert.equal(t.function,'app_11941c8fec_guard_account_deletion');}
      assert.equal(first.foreignKeys.length,5);
      for(const f of first.foreignKeys){
        assert.equal(f.valid,true);assert.equal(f.deferred,false);assert.match(f.definition,/FOREIGN KEY \(user_id\) REFERENCES auth\.users\(id\)/);
        assert.equal(f.delete,f.table.endsWith('_subscriptions')?'a':'c');
      }
      for(const[role,table,priv,allow]of first.acl){
        const expected=table==='subscriptions'&&((role==='authenticated'&&priv==='SELECT')||(role==='service_role'&&['SELECT','INSERT','UPDATE','DELETE'].includes(priv)));
        assert.equal(allow,expected);
      }
      for(const row of first.columnAcl)assert.equal(row[3],false);
      for(const row of first.rls)assert.equal(row[1],true);
      assert.deepEqual(first.roles,[['anon',false,false],['authenticated',false,false],['service_role',false,true]]);
      assert.equal(await rpcReady('app_11941c8fec_account_deletion_allowed',{p_user:B}),true);
      const entry=pathToFileURL(path.join(source,'app/frontend/supabase/functions/app_11941c8fec_delete_account/index.ts')).href;
      const sdkModule=import.meta.resolve('@supabase/supabase-js');
      const hook=registerHooks({resolve(specifier,context,next){
        if(specifier==='https://esm.sh/@supabase/supabase-js@2'&&context.parentURL===entry)return{url:sdkModule,shortCircuit:true};
        if(/^https?:/.test(specifier))throw new Failure('unexpected_module_download');
        return next(specifier,context);
      }});
      globalThis.Deno={env:{get:key=>({SUPABASE_URL:API_ORIGIN,SUPABASE_ANON_KEY:credentials.anon,SUPABASE_SERVICE_ROLE_KEY:credentials.service}[key])},
        serve:handler=>{assert.equal(capturedHandler,undefined);capturedHandler=handler;}};
      try{await import(entry);}finally{hook.deregister();}
      assert.equal(typeof capturedHandler,'function');
    },true);
    const request=(i,body={},token=users[i].token)=>new Request(API_ORIGIN+'/functions/v1/app_11941c8fec_delete_account',{
      method:'POST',headers:token?{Authorization:'Bearer '+token,'Content-Type':'application/json'}:{},body:JSON.stringify(body)});
    const protectedNames=['app_11941c8fec_account_deletion_allowed','app_11941c8fec_payment_reserve_checkout'];
    await check('untrusted_denials',async()=>{
      for(const token of [null,'invalid-synthetic-token'])assert.equal((await capturedHandler(request(1,{},token))).status,401);
      const parts=users[0].token.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
      parts[1]=Buffer.from(JSON.stringify({...claims,sub:B,role:'service_role'})).toString('base64url');
      assert.equal((await capturedHandler(request(1,{},parts.join('.')))).status,401);
      for(let i=0;i<2;i++){
        for(const name of protectedNames){
          const args=name.endsWith('_allowed')?{p_user:users[1-i].id}:{p_mode:'test',p_user:users[1-i].id,p_hash:'a'.repeat(64),p_store:'8001',p_product:'8002',p_variant:'8003',p_tier:'family',p_billing:'monthly',p_revision:0,p_supersedes:null};
          const r=await clients[i].rpc(name,args);assert.ok(r.error);assert.ok([401,403,404].includes(r.status));
        }
        for(const patch of [{tier:'family'},{trial_used:false},{user_id:users[1-i].id}]){
          const r=await clients[i].from('app_11941c8fec_subscriptions').update(patch).eq('user_id',users[i].id);
          assert.equal(r.error?.code,'42501');
        }
        assert.equal((await clients[i].from('app_11941c8fec_subscriptions').delete().eq('user_id',users[i].id)).error?.code,'42501');
        assert.equal((await clients[i].from('app_11941c8fec_payment_accounts').select('user_id')).error?.code,'42501');
      }
      // Actual PostgreSQL denial, not only PostgREST schema visibility.
      for(const role of ['anon','authenticated']){
        sql("begin;set local role "+role+";do $$ begin begin perform public.app_11941c8fec_account_deletion_allowed("+q(B)+");exception when insufficient_privilege then return;end;raise exception 'unexpected execute';end $$;rollback;");
      }
    });
    await check('checkout_wins_race',async()=>{
      const reservation=new Session(project+'-checkout1'),deletion=new Session(project+'-delete1');
      const [rpid,dpid]=await Promise.all([reservation.pid(),deletion.pid()]);assert.notEqual(rpid,dpid);
      await reservation.query('begin;'+reserve(A,'a'));
      await deletion.query('begin;');
      const pending=deletion.query('delete from auth.users where id='+q(A)+';');
      const observed=pending.then(()=>({ok:true}),error=>({ok:false,error}));
      await waitForBlock(dpid,rpid);await reservation.finish('commit;');
      const result=await observed;assert.equal(result.ok,false);assert.equal(result.error.sqlState,'42501');
      assert.equal(currentRows(A).auth,true);
      assert.equal(jsonSQL("select to_jsonb(exists(select 1 from public.app_11941c8fec_payment_intents where user_id="+q(A)+"));"),true);
    },true);
    await check('active_billing_denial',async()=>{
      sql("begin;insert into public.app_11941c8fec_payment_bindings(mode,subscription_id,user_id,customer_id,order_id,product_id,variant_id,tier,billing,last_state) values('test','8008',"+q(A)+",'8009','8010','8002','8003','balanced','monthly','{\"provider_status\":\"active\"}');"+
        "update public.app_11941c8fec_payment_accounts set subscription_id='8008',customer_id='8009',order_id='8010',product_id='8002',variant_id='8003',tier='balanced',billing='monthly' where user_id="+q(A)+";"+
        "insert into public.app_11941c8fec_payment_periods(mode,subscription_id,proof_id,user_id,kind,access_start,access_end,confirmed_at,tier,billing,product_id,variant_id) values('test','8008','8011',"+q(A)+",'renewal',now()-interval '1 day',now()+interval '14 days',now()-interval '1 day','balanced','monthly','8002','8003');"+
        "select set_config('amanahlife.trusted_payment_write','yes',true);update "+sub+" set tier='balanced',paid_access_from=now()-interval '1 day',paid_access_until=now()+interval '14 days',lemonsqueezy_subscription_id='8008' where user_id="+q(A)+";commit;");
      billingBefore=billingRows(A);
      assert.equal((await admin.rpc('app_11941c8fec_account_deletion_allowed',{p_user:A})).data,false);
      const r=await capturedHandler(request(0,{user_id:B,status:'expired',cancelled:true}));
      assert.equal(r.status,409);assert.equal((await r.json()).manage_path,'/subscription');
      assert.deepEqual(billingRows(A),billingBefore);assert.equal(currentRows(A).auth,true);
      // The database guards also stop direct trusted DELETE/cascade attempts.
      for(const table of [sub,'auth.users']){
        sql("begin;do $$ begin begin delete from "+table+" where "+(table==='auth.users'?'id':'user_id')+"="+q(A)+";exception when insufficient_privilege then return;end;raise exception 'guard bypass';end $$;rollback;");
      }
      assert.deepEqual(billingRows(A),billingBefore);
    },true);
    await check('history_retention',()=>{
      try{sql(historyRetentionSQL(A,B));}
      finally{assert.deepEqual(billingRows(A),billingBefore);}
    });
    await check('failed_delete_setup',async()=>{
      assert.equal((await admin.rpc('app_11941c8fec_account_deletion_allowed',{p_user:B})).data,true);
      assert.deepEqual(currentRows(B).subscription,trialBefore);
      sql("create function public.fixture_008_auth_failure() returns trigger language plpgsql set search_path='' as $$ begin if old.id="+q(B)+" then raise exception 'fixture auth deletion failure' using errcode='P0001';end if;return old;end $$;"+
        "revoke all on function public.fixture_008_auth_failure() from public,anon,authenticated,service_role;"+
        "create trigger zz_fixture_008_auth_failure before delete on auth.users for each row execute function public.fixture_008_auth_failure();");
      const begin=traffic.length;
      const response=await capturedHandler(request(1,{user_id:A,status:'expired',cancelled:true}));
      assert.equal(response.status,503);assert.equal(currentRows(B).auth,true);
      const calls=traffic.slice(begin);
      for(const table of ['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions']){
        assert.ok(calls.some(c=>c.method==='DELETE'&&c.path==='/rest/v1/app_11941c8fec_'+table&&c.status>=200&&c.status<300));
      }
      assert.ok(calls.some(c=>c.method==='DELETE'&&c.path==='/auth/v1/admin/users/'+B&&c.status>=400));
      // A broken Auth session is a prerequisite failure, not evidence that the
      // second-trial assertion reproduced the known subscription defect.
      await login(1);
    },true);
    // Both remain ordinary MANDATORY assertions. There is no xfail/skip/pass
    // conversion. At the reviewed defective commit these must fail the run.
    await check('failed_delete_preserves_trial',()=>{
      assert.deepEqual(currentRows(B).subscription,trialBefore,'Failed deletion must preserve trial-used evidence');
    });
    await check('failed_delete_cannot_restart_trial',async()=>{
      const r=await clients[1].rpc('app_11941c8fec_start_trial');
      assert.equal(r.error,null);assert.equal(r.data.error,'trial_already_used','Second trial must be refused');
      assert.deepEqual(currentRows(B).subscription,trialBefore);
    });
    await check('delete_wins_race',async()=>{
      sql("drop trigger zz_fixture_008_auth_failure on auth.users;drop function public.fixture_008_auth_failure();");
      const deletion=new Session(project+'-delete2'),reservation=new Session(project+'-checkout2');
      const [dpid,rpid]=await Promise.all([deletion.pid(),reservation.pid()]);assert.notEqual(dpid,rpid);
      await deletion.query('begin;delete from '+sub+' where user_id='+q(B)+';delete from auth.users where id='+q(B)+';');
      await reservation.query('begin;');
      const pending=reservation.query(reserve(B,'b'));
      const observed=pending.then(()=>({ok:true}),error=>({ok:false,error}));
      await waitForBlock(rpid,dpid);await deletion.finish('commit;');
      const result=await observed;assert.equal(result.ok,false);assert.equal(result.error.sqlState,'23503');
      assert.equal(currentRows(B).auth,false);
      assert.equal(jsonSQL("select to_jsonb(exists(select 1 from public.app_11941c8fec_payment_accounts where user_id="+q(B)+"));"),false);
    },true);
    await check('billing_preservation',()=>{
      assert.deepEqual(billingRows(A),billingBefore);assert.equal(currentRows(A).auth,true);
      assert.ok(attempted>0);assert.equal(rejected,0,'Unexpected outbound access must fail the suite');
    });
  }finally{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  for(const method of ['log','info','warn','error','debug','trace','dir','table'])console[method]=()=>{};
  let opts,infraFailure;
  try{opts=options(process.argv.slice(2));await execute(opts);}
  catch(error){infraFailure={phase,category:error instanceof Failure?error.category:'assertion_failed',exit:error instanceof Failure?error.exitCode:1};}
  if(opts?.['--cleanup']){
    emit({mode:'cleanup',cleanupPassed:!infraFailure&&cleanupPassed,productionReady:false});
    if(infraFailure)process.exitCode=1;
  }else{
    const result=summarize(results,cleanupPassed);
    if(infraFailure){result.result='failed';result.infrastructureFailure=infraFailure;}
    emit({...result,source:SOURCE_COMMIT});
    process.exitCode=result.result==='passed'?0:1;
  }
}
