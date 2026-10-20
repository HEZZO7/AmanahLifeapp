// PREPARATION ONLY. Execution requires separate explicit approval.
// No workflow is installed by this package. This entrypoint has no import-time side effects.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {API_ORIGIN,CHECKS,CLI_VERSION,CLI_ARCHIVE_SHA256,SOURCE_COMMIT,SDK_VERSION,
  TABLE,PUSH,FLAGS,LOCATION,COLUMNS,workspace,localStatus,allowedURL,gitBlob,
  commandCategory,requireCoverage,uuid,claims} from './local-safety.mjs';

const fixturePath='ci/notification-local/setup.sql';
const migrationPath='app/frontend/supabase/migrations/202610180007_notification_table_authority.sql';
const manifest=JSON.parse(fs.readFileSync(new URL('./source-manifest.json',import.meta.url)));
const approval='two-synthetic-users-only';
const childEnv={PATH:process.env.PATH,LANG:'C.UTF-8',DO_NOT_TRACK:'1',CI:'true',DOCKER_HOST:'unix:///var/run/docker.sock'};
let root,project,cli,phase='preflight',logNumber=0;
const completed=[];
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
  return command('docker',['exec','-i','-e','PGOPTIONS=-c amanahlife.local_test=approved',
    `supabase_db_${project}`,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],text);
}
function jsonSQL(text){return JSON.parse(sql(text));}
async function check(id,fn){
  assert.ok(CHECKS.includes(id)&&!completed.includes(id));
  phase=id;emit(`007 check=${id} result=started`);await fn();completed.push(id);emit(`007 check=${id} result=passed`);
}
function metadata(){
  return jsonSQL(`select jsonb_build_object(
    'rows',(select jsonb_agg(to_jsonb(p) order by user_id) from public.${TABLE} p),
    'push',(select jsonb_agg(to_jsonb(p) order by user_id,endpoint) from public.${PUSH} p),
    'constraints',(select jsonb_agg(jsonb_build_array(c.conname,c.contype,c.convalidated,pg_get_constraintdef(c.oid)) order by c.conname)
      from pg_constraint c where c.conrelid in ('public.${TABLE}'::regclass,'public.${PUSH}'::regclass)),
    'indexes',(select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='public' and tablename in ('${TABLE}','${PUSH}')),
    'columns',(select jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum)
      from pg_class c join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where c.oid in ('public.${TABLE}'::regclass,'public.${PUSH}'::regclass) and a.attnum>0 and not a.attisdropped),
    'rls',(select jsonb_agg(jsonb_build_array(relname,relrowsecurity) order by relname) from pg_class where oid in ('public.${TABLE}'::regclass,'public.${PUSH}'::regclass)),
    'policies',(select jsonb_agg(jsonb_build_object('name',polname,'table',polrelid::regclass::text,'roles',polroles,'cmd',polcmd,
      'qual',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) order by polrelid,polname)
      from pg_policy where polrelid in ('public.${TABLE}'::regclass,'public.${PUSH}'::regclass)),
    'tableRights',(select jsonb_agg(jsonb_build_object('role',r,'table',t,'priv',p,'allow',has_table_privilege(r,'public.'||t,p),
      'grant',has_table_privilege(r,'public.'||t,p||' WITH GRANT OPTION')) order by r,t,p)
      from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['${TABLE}','${PUSH}']) t
      cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']||
       case when current_setting('server_version_num')::int>=170000 then array['MAINTAIN'] else array[]::text[] end) p),
    'columnRights',(select jsonb_agg(jsonb_build_object('role',r,'table',t,'column',a.attname,'priv',p,
      'allow',has_column_privilege(r,'public.'||t,a.attname,p),'grant',has_column_privilege(r,'public.'||t,a.attname,p||' WITH GRANT OPTION')) order by r,t,a.attname,p)
      from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['${TABLE}','${PUSH}']) t
      join pg_attribute a on a.attrelid=to_regclass('public.'||t) and a.attnum>0 and not a.attisdropped
      cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p)
  );`);
}
function sameDataAndStructure(before,after){
  for(const key of ['rows','push','constraints','indexes','columns'])assert.deepEqual(after[key],before[key]);
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

async function execute(opts){
  assert.equal(process.env.AMANAHLIFE_LOCAL_007_APPROVAL,approval);
  assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
  assert.ok(Number(process.versions.node.split('.')[0])>=22);
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  assert.equal(process.env.GITHUB_REPOSITORY,'HEZZO7/AmanahLifeapp');
  assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  assert.equal(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)).repository?.private,false);
  assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_USE_ENV_PROXY);
  assert.ok(!process.env.DOCKER_HOST||process.env.DOCKER_HOST==='unix:///var/run/docker.sock');
  assert.ok(!process.env.DOCKER_CONTEXT||process.env.DOCKER_CONTEXT==='default');
  const base=fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir());
  root=path.resolve(opts['--workdir']);
  // Native CLI caches/config stay disposable; never inherit the runner's HOME.
  childEnv.HOME=root;childEnv.XDG_CONFIG_HOME=path.join(root,'.config');
  if(opts['--cleanup']){phase='cleanup';assert.ok(cleanup(root));return;}
  const source=fs.realpathSync(opts['--source']);project=workspace(root,base,source);
  assert.ok(!fs.existsSync(root));
  assert.equal(command('git',['-C',source,'rev-parse','HEAD']),SOURCE_COMMIT);
  assert.equal(manifest.sourceCommit,SOURCE_COMMIT);
  for(const [file,hash] of Object.entries(manifest.files)){
    const target=path.join(source,file);assert.ok(!fs.lstatSync(target).isSymbolicLink());
    assert.equal(fs.realpathSync(target),target);
    assert.equal(gitBlob(fs.readFileSync(target)),hash);
  }
  const archive=fs.realpathSync(opts['--cli-archive']);
  assert.equal(path.basename(archive),`supabase_${CLI_VERSION}_linux_amd64.tar.gz`);
  assert.equal(createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),CLI_ARCHIVE_SHA256);
  assert.equal(command('docker',['ps','-aq','--filter','label=com.supabase.cli.project']),'');
  for(const kind of ['volume','network'])
    assert.equal(command('docker',[kind,'ls','-q','--filter',`name=${project}`]),'');
  fs.mkdirSync(root,{mode:0o700});
  fs.writeFileSync(path.join(root,'owned.json'),JSON.stringify({project,source:SOURCE_COMMIT}),{mode:0o600});
  try{
    fs.mkdirSync(path.join(root,'bin'),{mode:0o700});
    command('tar',['-xzf',archive,'-C',path.join(root,'bin'),'supabase']);
    cli=path.join(root,'bin/supabase');assert.equal(command(cli,['--version']),CLI_VERSION);
    protectInbound();
    for(const name of ['init','start']){
      phase=name;emit(`007 phase=${name} result=started`);
      if(name==='start')fs.writeFileSync(path.join(root,'start-attempted'),'1',{mode:0o600});
      command(cli,['--workdir',root,name],undefined,name==='start'?1080000:30000);
      assert.ok(!fs.existsSync(path.join(root,'supabase/.temp/project-ref')));
      if(name==='init'){
        const config=fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8');
        assert.equal(/^project_id\s*=\s*"([a-z0-9-]+)"\s*$/m.exec(config)?.[1],project);
        const migrations=path.join(root,'supabase/migrations');
        assert.ok(!fs.existsSync(migrations)||!fs.readdirSync(migrations).some(x=>x.endsWith('.sql')));
      }
      emit(`007 phase=${name} result=passed`);
    }
    phase='status';inspectOwnedContainers();
    const status=command(cli,['--workdir',root,'status','-o','json']);
    fs.writeFileSync(path.join(root,'status.json'),status,{mode:0o600});
    const credentials=localStatus(JSON.parse(status));
    phase='fixture';sql(fs.readFileSync(path.join(source,fixturePath),'utf8'));
    phase='dependencies';
    const {createClient}=await import('@supabase/supabase-js');
    const installed=JSON.parse(fs.readFileSync(new URL('./node_modules/@supabase/supabase-js/package.json',import.meta.url)));
    assert.equal(installed.version,SDK_VERSION);
    phase='client_module';
    const {createNotificationPreferenceWriter}=await import(pathToFileURL(path.join(source,'app/frontend/src/lib/notificationPreferenceWrite.ts')));
    await exercise({createClient,createNotificationPreferenceWriter,credentials,source});
    requireCoverage(completed);
  }finally{
    const previous=phase;phase='cleanup';
    if(!cleanup(root))throw new Failure('cleanup_failed');
    emit('007 phase=cleanup result=passed');phase=previous;
  }
}

// Auth/HTTP and SQL assertions are intentionally in this single test file.
async function exercise({createClient,createNotificationPreferenceWriter,credentials,source}){
  const fetchLocal=(input,init={})=>{
    allowedURL(input);
    return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});
  };
  const sdk=fetcher=>createClient(API_ORIGIN,credentials.anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetcher||fetchLocal}});
  const users=[];let admin=createClient(API_ORIGIN,credentials.service,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchLocal}});
  const clients=[];
  async function login(client,index){
    const {data,error}=await client.auth.signInWithPassword({email:users[index].email,password:users[index].password});
    assert.equal(error,null);assert.equal(data.user.id,users[index].id);
    assert.equal((await client.auth.getUser()).data.user.id,users[index].id);
    users[index].token=data.session.access_token;return client;
  }
  await check('auth',async()=>{
    for(const label of ['A','B']){
      const email=`${label.toLowerCase()}-${randomBytes(8).toString('hex')}@example.invalid`,password=randomBytes(24).toString('base64url')+'Aa1!';
      const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{amanahlife_fixture:'notification-007'}});
      assert.equal(error,null);users.push({id:uuid(data.user.id),email,password});
      clients.push(await login(sdk(),users.length-1));
    }
    assert.notEqual(users[0].id,users[1].id);admin=null;
    assert.equal(jsonSQL('select count(*)::int from auth.users;'),2);
  });
  const A=users[0].id,B=users[1].id;
  sql(`insert into public.${TABLE}(user_id,bill_reminders,last_suhoor_sent_date) values('${A}',false,date '2026-01-01');
    insert into public.${PUSH}(user_id,endpoint,p256dh,auth_key) values
    ('${A}','https://push.invalid/a','synthetic-A','synthetic-A'),('${B}','https://push.invalid/b','synthetic-B','synthetic-B');`);
  const before=metadata();let first;
  await check('migration_first',()=>{sql(fs.readFileSync(path.join(source,migrationPath),'utf8'));first=metadata();sameDataAndStructure(before,first);});
  await check('migration_repeat',()=>{sql(fs.readFileSync(path.join(source,migrationPath),'utf8'));assert.deepEqual(metadata(),first);});
  await check('effective_acl',()=>{
    for(const x of first.tableRights){assert.equal(x.grant,false);assert.equal(x.allow,x.role==='service_role'&&['SELECT','INSERT','UPDATE','DELETE'].includes(x.priv));}
    for(const x of first.columnRights){
      const allow=x.role==='service_role'?['SELECT','INSERT','UPDATE'].includes(x.priv):
        x.role==='authenticated'&&x.table===TABLE&&['user_id',...FLAGS,...LOCATION].includes(x.column)&&
        ['SELECT','INSERT','UPDATE'].includes(x.priv)&&!(x.column==='user_id'&&x.priv==='UPDATE');
      assert.equal(x.grant,false);assert.equal(x.allow,allow);
    }
    assert.ok(first.rls.every(x=>x[1]===true));assert.ok(first.policies.every(x=>!x.roles.includes(0)));
    assert.equal(first.policies.length,5);
  });
  async function http(token,route,method='GET',body,prefer){
    const headers={apikey:credentials.anon,'Content-Type':'application/json'};
    if(token)headers.Authorization=`Bearer ${token}`;if(prefer)headers.Prefer=prefer;
    const response=await fetchLocal(API_ORIGIN+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    let data;try{data=await response.json();}catch{data=null;}
    return {status:response.status,data,range:response.headers.get('content-range')};
  }
  const route=(id,select=COLUMNS)=>`/rest/v1/${TABLE}?user_id=eq.${id}&select=${select}`;
  const ok=r=>assert.ok(r.status>=200&&r.status<300);
  const denied=r=>assert.ok([401,403].includes(r.status));
  async function own(index){const r=await http(users[index].token,route(users[index].id));ok(r);assert.equal(r.data.length,1);return r.data[0];}
  phase='schema_ready';
  for(let attempt=0;;attempt++){
    const response=await http(users[0].token,route(A));
    if(response.status===200){assert.equal(response.data.length,1);break;}
    // Only the documented missing-table schema-cache response is readiness,
    // never an authorization failure or a failed security test retry.
    if(response.status!==404||response.data?.code!=='PGRST205')throw new Failure('schema_not_ready');
    if(attempt===19)throw new Failure('schema_cache_timeout');
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  await check('forged_auth',async()=>{
    for(const field of ['sub','role']){
      const parts=users[0].token.split('.'),payload=claims(users[0].token);
      payload[field]=field==='sub'?B:'service_role';parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');
      const token=parts.join('.');denied(await http(token,route(B)));denied(await http(token,route(B),'PATCH',{bill_reminders:false}));
      denied(await http(token,'/auth/v1/user'));
    }
    for(const token of [undefined,'invalid.jwt']){
      denied(await http(token,'/auth/v1/user'));denied(await http(token,route(A)));
      denied(await http(token,route(A),'PATCH',{bill_reminders:true}));
      denied(await http(token,`/rest/v1/${TABLE}`,'POST',{user_id:A,bill_reminders:false}));
    }
  });
  await check('foreign_insert',async()=>{
    // B has no preference row: rejection must be RLS, not an incidental UNIQUE conflict.
    const r=await http(users[0].token,`/rest/v1/${TABLE}`,'POST',{user_id:B,bill_reminders:false});
    assert.equal(r.status,403);assert.equal(r.data.code,'42501');assert.equal(jsonSQL(`select count(*)::int from public.${TABLE} where user_id='${B}';`),0);
  });
  const audit=[];
  function writerClient(index,barrier){
    return sdk(async(input,init={})=>{
      const url=allowedURL(input),method=init.method||'GET',headers=new Headers(init.headers);
      if(url.pathname===`/rest/v1/${TABLE}`&&['PATCH','POST'].includes(method)){
        const body=JSON.parse(init.body);
        assert.ok(!url.searchParams.has('select')&&!url.searchParams.has('on_conflict'));
        assert.ok(!/return=representation|resolution=merge-duplicates/.test(headers.get('Prefer')||''));
        assert.equal(claims(headers.get('Authorization').slice(7)).sub,users[index].id);
        assert.equal(headers.get('apikey'),credentials.anon);
        for(const field of ['id','created_at','updated_at','last_suhoor_sent_date','last_iftar_sent_date','role','auth_key'])assert.ok(!(field in body));
        if(method==='PATCH'){assert.ok(!('user_id' in body));assert.equal(url.searchParams.get('user_id'),`eq.${users[index].id}`);assert.ok(headers.get('Prefer')?.includes('count=exact'));}
        else assert.equal(body.user_id,users[index].id);
      }
      const response=await fetchLocal(input,init);
      if(url.pathname===`/rest/v1/${TABLE}`&&['PATCH','POST'].includes(method)){
        audit.push({index,method,status:response.status});
        if(barrier&&method==='PATCH'&&response.ok&&/\/0$/.test(response.headers.get('content-range')||''))await barrier();
      }
      return response;
    });
  }
  const settings={method:'UmmAlQura',mode:'manual',city:{name:'Fixture',nameAr:'Fixture',country:'Fixture',countryCode:'XX',lat:21,lon:39},timezone:'UTC',language:'ar'};
  await check('first_insert_race',async()=>{
    let waiting=0,release;const barrier=new Promise(resolve=>{release=resolve;});
    const wait=async()=>{if(++waiting===2)release();await Promise.race([barrier,new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Failure('race_not_observed')),10000);t.unref();})]);};
    const one=await login(writerClient(1,wait),1),two=await login(writerClient(1,wait),1);
    await Promise.all([createNotificationPreferenceWriter(one).syncLocation(B,settings),
      createNotificationPreferenceWriter(two).restore(B,{bill_reminders:false,habit_reminders:false,user_id:A})]);
    assert.equal(waiting,2);const race=audit.filter(x=>x.index===1);
    assert.deepEqual(race.filter(x=>x.method==='POST').map(x=>x.status).sort(),[201,409]);
    assert.equal(race.filter(x=>x.method==='PATCH').length,3);
    const row=await own(1);assert.equal(row.bill_reminders,false);assert.equal(row.habit_reminders,false);
    assert.equal(row.prayer_manual_city.lat,21);assert.equal(row.prayer_location_mode,'manual');assert.equal(row.savings_reminders,true);
    assert.deepEqual(row.prayer_manual_city,settings.city);assert.equal(row.prayer_calc_method,settings.method);
    for(const key of ['prayer_reminders','fasting_reminders','general_activity'])assert.equal(row[key],true);
    assert.equal(row.timezone,'UTC');assert.equal(row.language,'ar');
    assert.equal(jsonSQL(`select count(*)::int from public.${TABLE} where user_id='${B}';`),1);
  });
  await check('cross_account',async()=>{
    for(let i=0;i<2;i++){
      const foreign=1-i,before=await own(foreign);
      const r=await http(users[i].token,route(users[foreign].id));ok(r);assert.deepEqual(r.data,[]);
      const update=await http(users[i].token,route(users[foreign].id),'PATCH',{bill_reminders:true},'count=exact,return=minimal');
      ok(update);assert.match(update.range,/\/0$/);assert.deepEqual(await own(foreign),before);
      const self=await http(users[i].token,route(users[i].id),'PATCH',{bill_reminders:false},'count=exact,return=minimal');ok(self);assert.match(self.range,/\/1$/);
    }
  });
  await check('column_denials',async()=>{
    for(let i=0;i<2;i++){
      denied(await http(users[i].token,route(users[i].id,'*')));
      denied(await http(users[i].token,route(users[i].id),'DELETE'));
      for(const body of [{user_id:users[1-i].id},{id:A},{created_at:'2099-01-01'},{updated_at:'2099-01-01'},
        {last_suhoor_sent_date:'2099-01-01'},{last_iftar_sent_date:'2099-01-01'}])denied(await http(users[i].token,route(users[i].id),'PATCH',body));
      for(const token of [users[i].token,undefined]){
        denied(await http(token,`/rest/v1/${PUSH}?select=endpoint,auth_key`));
        denied(await http(token,`/rest/v1/${PUSH}`,'POST',{user_id:users[i].id,endpoint:'https://push.invalid/no-send',p256dh:'synthetic',auth_key:'synthetic'}));
      }
    }
  });
  await check('client_compatibility',async()=>{
    for(let i=0;i<2;i++){
      const other=await own(1-i),before=await own(i),client=await login(writerClient(i),i),writer=createNotificationPreferenceWriter(client);
      await writer.syncLocation(users[i].id,settings);const location=await own(i);
      for(const key of FLAGS)assert.equal(location[key],before[key]);
      assert.equal(location.timezone,settings.timezone);assert.equal(location.language,settings.language);
      assert.equal(location.prayer_calc_method,settings.method);assert.equal(location.prayer_location_mode,settings.mode);
      assert.deepEqual(location.prayer_manual_city,settings.city);
      await writer.restore(users[i].id,{...Object.fromEntries(FLAGS.map(k=>[k,false])),user_id:users[1-i].id,id:'legacy-id',role:'service_role',updated_at:'2099-01-01'});
      const restored=await own(i);for(const key of FLAGS)assert.equal(restored[key],false);
      assert.deepEqual(restored.prayer_manual_city,settings.city);assert.deepEqual(await own(1-i),other);
    }
  });
  await check('session_switch',async()=>{
    const client=await login(writerClient(0),0),writer=createNotificationPreferenceWriter(client);
    assert.equal((await client.auth.signOut({scope:'local'})).error,null);
    let count=audit.length;await assert.rejects(writer.restore(A,{bill_reminders:true}));assert.equal(audit.length,count);
    await login(client,1);count=audit.length;await assert.rejects(writer.restore(A,{bill_reminders:true}));assert.equal(audit.length,count);
    await login(clients[0],0);await login(clients[1],1);
  });
  await check('server_crud',()=>{
    sql(`begin; set local role service_role;
      do $$ begin if current_user<>'service_role' or (select count(*) from public.${PUSH})<>2 then raise exception 'server read failed'; end if; end $$;
      delete from public.${PUSH} where user_id='${A}';
      do $$ begin if (select count(*) from public.${PUSH})<>1 then raise exception 'server delete failed'; end if; end $$;
      insert into public.${PUSH}(user_id,endpoint,p256dh,auth_key) values('${A}','https://push.invalid/server','synthetic','synthetic');
      do $$ begin if (select count(*) from public.${PUSH})<>2 then raise exception 'server insert failed'; end if; end $$;
      update public.${TABLE} set last_suhoor_sent_date=date '2026-02-01' where user_id='${A}';
      do $$ begin if not exists(select 1 from public.${TABLE} where user_id='${A}' and last_suhoor_sent_date=date '2026-02-01') then raise exception 'server update failed'; end if; end $$;
      delete from public.${TABLE} where user_id='${B}';
      do $$ begin if (select count(*) from public.${TABLE})<>1 then raise exception 'server preference delete failed'; end if; end $$;
      insert into public.${TABLE}(user_id,bill_reminders) values('${B}',false);
      do $$ begin if (select count(*) from public.${TABLE})<>2 then raise exception 'server preference insert failed'; end if; end $$;
      rollback;`);
  });
  await check('sql_denials',()=>{
    for(const actor of ['anon','authenticated','service_role'])for(const table of [TABLE,PUSH]){
      sql(`begin; set local role ${actor}; do $$ begin
        begin execute 'truncate public.${table}'; exception when insufficient_privilege then return; end;
        raise exception 'Unexpected TRUNCATE permission'; end $$; rollback;`);
    }
  });
  await check('preservation',()=>{
    const after=metadata();assert.deepEqual(after.push,first.push);
    for(const key of ['constraints','indexes','columns','rls','policies','tableRights','columnRights'])assert.deepEqual(after[key],first[key]);
    const a=after.rows.find(x=>x.user_id===A),initial=first.rows[0],b=after.rows.find(x=>x.user_id===B);
    for(const key of ['id','user_id','created_at','updated_at','last_suhoor_sent_date','last_iftar_sent_date'])assert.deepEqual(a[key],initial[key]);
    assert.equal(after.rows.length,2);assert.ok(b.id);assert.equal(b.created_at,b.updated_at);
    assert.equal(b.last_suhoor_sent_date,null);assert.equal(b.last_iftar_sent_date,null);
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  // Third-party SDK diagnostics must not reflect even disposable keys/JWTs.
  // All our progress/results use emit() with fixed fields/categories instead.
  for(const method of ['log','info','warn','error','debug','trace','dir','table'])console[method]=()=>{};
  try{
    const opts=options(process.argv.slice(2));await execute(opts);
    emit(opts['--cleanup']?{mode:'cleanup',cleanupPassed:true}:
      {mode:'integration',result:'passed',checks:completed,source:SOURCE_COMMIT,hostedVerified:false,productionReady:false});
  }
  catch(error){
    // Never print error.message, stack, SQL, SDK errors, IDs, URLs or credentials.
    const known=error instanceof Failure;
    emit({result:'failed',phase,category:known?error.category:'assertion_failed',exit:known?error.exitCode:1,completed:completed.length,productionReady:false});
    process.exitCode=known?error.exitCode:1;
  }
}
