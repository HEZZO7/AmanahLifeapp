// Local process plumbing only. Importing never starts processes or services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,spawn} from 'node:child_process';
import {SOURCE_COMMIT,SOURCE_FILES,MIGRATIONS,NODE_VERSION,CLI_VERSION,CLI_ARCHIVE_SHA256,APPROVAL,
  workspace,gitBlob,sha256,localStatus,commandCategory,assertCleanEnvironment} from './safety.mjs';

export class Failure extends Error {
  constructor(category='assertion_failed',exitCode=1){super('Local test failed');this.category=category;this.exitCode=exitCode;}
}
const childEnv={PATH:process.env.PATH,LANG:'C.UTF-8',DO_NOT_TRACK:'1',CI:'true',DOCKER_HOST:'unix:///var/run/docker.sock'};
let root,project,cli,acquired=false;
export function command(exe,args,input,timeout=30000){
  const r=spawnSync(exe,args,{env:childEnv,input,encoding:'utf8',timeout,maxBuffer:32*1024*1024});
  const text=(r.stdout||'')+(r.stderr||'');
  if(r.error||r.status!==0)throw new Failure(r.error?.code==='ETIMEDOUT'?'timeout':commandCategory(text),
    r.error?.code==='ETIMEDOUT'?124:(r.status>0?r.status:r.signal?128+(os.constants.signals[r.signal]||0):1));
  return (r.stdout||'').trim();
}
export function sql(text){
  assert.ok(project&&root);
  return command('docker',['exec','-i','-e','PGOPTIONS=-c amanahlife.local_test=approved -c amanahlife.security_fixture=isolated',
    'supabase_db_'+project,'psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],text);
}
export function jsonSQL(text){return JSON.parse(sql(text));}
export function verifySource(source,manifest){
  assert.equal(manifest.sourceCommit,SOURCE_COMMIT);
  assert.deepEqual(Object.keys(manifest.files),SOURCE_FILES);assert.deepEqual(manifest.migrationOrder,MIGRATIONS);
  for(const[file,hash]of Object.entries(manifest.files)){
    const target=path.join(source,file);assert.equal(fs.realpathSync(target),target);assert.ok(!fs.lstatSync(target).isSymbolicLink());
    const bytes=fs.readFileSync(target);assert.equal(gitBlob(bytes),hash.gitBlob);assert.equal(sha256(bytes),hash.sha256);
  }
}
export function verifyPackage(directory,manifest){
  assert.deepEqual(Object.keys(manifest.packageFiles).sort(),['README.md','fixture.sql','integration.mjs','local-runtime.mjs',
    'metadata.sql','package-lock.json','package.json','review.test.mjs','safety.mjs'].sort());
  for(const [file,hash]of Object.entries(manifest.packageFiles)){
    const target=path.join(directory,file);assert.equal(fs.realpathSync(target),target);
    assert.ok(!fs.lstatSync(target).isSymbolicLink());assert.equal(sha256(fs.readFileSync(target)),hash);
  }
}
export function createWorkspace(workdir,write=fs.writeFileSync){
  workspace(workdir,fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir()));
  fs.mkdirSync(workdir,{mode:0o700});
  const directory=fs.lstatSync(workdir),marker=path.join(workdir,'owned.json');let fd,ownedMarker;
  try{
    fd=fs.openSync(marker,'wx',0o600);ownedMarker=fs.fstatSync(fd);
    write(fd,JSON.stringify({project:path.basename(workdir),source:SOURCE_COMMIT}));
  }catch(error){
    const current=fs.lstatSync(workdir);assert.ok(!current.isSymbolicLink()&&current.dev===directory.dev&&current.ino===directory.ino);
    if(ownedMarker){const file=fs.lstatSync(marker);assert.ok(!file.isSymbolicLink()&&file.dev===ownedMarker.dev&&file.ino===ownedMarker.ino);fs.unlinkSync(marker);}
    fs.rmdirSync(workdir);throw error;
  }finally{if(fd!==undefined)fs.closeSync(fd);}
}
function resourceIDs(run,kind,name){
  const args=kind==='container'?['ps','-aq']:[kind,'ls','-q'];
  // Verify BOTH labels and the CLI naming convention. Missing labels cannot hide leftovers.
  return [...new Set([run('docker',[...args,'--filter','label=com.supabase.cli.project='+name]),
    run('docker',[...args,'--filter','name='+name])].flatMap(s=>s.split(/\s+/).filter(Boolean)))];
}
export function cleanup(workdir,run=command){
  workspace(workdir,fs.realpathSync(process.env.RUNNER_TEMP||os.tmpdir()));
  // The independent fallback starts in a new Node process, without prepare().
  // Never discover a runner user's Supabase/Docker credentials during stop.
  childEnv.HOME=workdir;childEnv.XDG_CONFIG_HOME=path.join(workdir,'.config');childEnv.DOCKER_CONFIG=path.join(workdir,'.docker');
  const name=path.basename(workdir);
  if(!fs.existsSync(workdir)){
    return ['container','volume','network'].every(kind=>resourceIDs(run,kind,name).length===0);
  }
  assert.equal(fs.realpathSync(workdir),workdir);assert.ok(!fs.lstatSync(workdir).isSymbolicLink());
  const markerPath=path.join(workdir,'owned.json');assert.ok(!fs.lstatSync(markerPath).isSymbolicLink());
  const marker=JSON.parse(fs.readFileSync(markerPath));assert.equal(marker.project,name);assert.equal(marker.source,SOURCE_COMMIT);
  let failed=false;
  if(fs.existsSync(path.join(workdir,'start-attempted'))){
    try{run(path.join(workdir,'bin/supabase'),['--workdir',workdir,'stop','--no-backup'],undefined,180000);}catch{failed=true;}
    for(const kind of ['container','volume','network']){try{if(resourceIDs(run,kind,name).length)failed=true;}catch{failed=true;}}
  }
  if(failed)return false; // Keep marker, config and CLI for separately invocable fallback.
  fs.rmSync(workdir,{recursive:true,force:true});assert.ok(!fs.existsSync(workdir));return true;
}
function firewall(args){command('sudo',args);}
function protectInbound(){
  const iface=/\bdev ([A-Za-z0-9_.-]+)\b/.exec(command('ip',['-4','route','show','default']))?.[1];assert.ok(iface);
  for(const args of [
    ['iptables','-I','DOCKER-USER','1','-i',iface,'-m','conntrack','--ctstate','NEW','-j','DROP'],
    ['iptables','-I','INPUT','1','-i',iface,'-p','tcp','-m','conntrack','--ctstate','NEW','-j','DROP'],
    ['ip6tables','-I','INPUT','1','!','-i','lo','-p','tcp','-m','conntrack','--ctstate','NEW','-j','DROP'],
    ['ip6tables','-I','FORWARD','1','-i',iface,'-m','conntrack','--ctstate','NEW','-j','DROP'],
  ])firewall(args);
}
export function sealOutbound(){
  const iface=/\bdev ([A-Za-z0-9_.-]+)\b/.exec(command('ip',['-4','route','show','default']))?.[1];assert.ok(iface);
  // Only after official image downloads/startup. No custom Docker network is created.
  for(const args of [
    ['iptables','-I','OUTPUT','1','-o',iface,'-j','REJECT'],
    ['iptables','-I','DOCKER-USER','1','-o',iface,'-j','DROP'],
    ['ip6tables','-I','OUTPUT','1','!','-o','lo','-j','REJECT'],
  ])firewall(args);
  for(const [tool,chain,tail]of [['iptables','OUTPUT',['-o',iface,'-j','REJECT']],
    ['iptables','DOCKER-USER',['-o',iface,'-j','DROP']],['ip6tables','OUTPUT',['!','-o','lo','-j','REJECT']]])firewall([tool,'-C',chain,...tail]);
}
export async function prepare(opts,manifest,notify){
  assert.equal(process.env.AMANAHLIFE_009_APPROVAL,APPROVAL);
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  assert.equal(process.env.GITHUB_REPOSITORY,'HEZZO7/AmanahLifeapp');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
  assert.equal(process.versions.node,NODE_VERSION);assert.equal(process.env.RUNNER_OS,'Linux');
  assert.equal(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH)).repository?.private,false);
  assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_USE_ENV_PROXY);
  assert.ok(!process.env.DOCKER_HOST||process.env.DOCKER_HOST==='unix:///var/run/docker.sock');
  assert.ok(!process.env.DOCKER_CONTEXT||process.env.DOCKER_CONTEXT==='default');
  assertCleanEnvironment(process.env);
  root=path.resolve(opts['--workdir']);const base=fs.realpathSync(process.env.RUNNER_TEMP);
  const source=fs.realpathSync(opts['--source']);project=workspace(root,base,source);
  childEnv.HOME=root;childEnv.XDG_CONFIG_HOME=path.join(root,'.config');childEnv.DOCKER_CONFIG=path.join(root,'.docker');
  assert.ok(!fs.existsSync(root));assert.equal(command('git',['-C',source,'rev-parse','HEAD']),SOURCE_COMMIT);verifySource(source,manifest);
  verifyPackage(path.dirname(fileURLToPath(import.meta.url)),manifest);
  const archive=fs.realpathSync(opts['--cli-archive']);
  assert.equal(path.basename(archive),'supabase_'+CLI_VERSION+'_linux_amd64.tar.gz');assert.equal(sha256(fs.readFileSync(archive)),CLI_ARCHIVE_SHA256);
  assert.equal(command('docker',['ps','-aq','--filter','label=com.supabase.cli.project']),'');
  for(const kind of ['container','volume','network'])assert.equal(resourceIDs(command,kind,project).length,0);
  createWorkspace(root);acquired=true;childEnv.HOME=root;childEnv.XDG_CONFIG_HOME=path.join(root,'.config');
  fs.mkdirSync(path.join(root,'bin'),{mode:0o700});command('tar',['-xzf',archive,'-C',path.join(root,'bin'),'supabase']);
  cli=path.join(root,'bin/supabase');assert.equal(command(cli,['--version']),CLI_VERSION);protectInbound();
  for(const name of ['init','start']){
    notify(name);if(name==='start')fs.writeFileSync(path.join(root,'start-attempted'),'1',{mode:0o600});
    command(cli,['--workdir',root,name],undefined,name==='start'?1080000:30000);
    assert.ok(!fs.existsSync(path.join(root,'supabase/.temp/project-ref')));
    if(name==='init'){
      const config=fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8');assert.equal(/^project_id\s*=\s*"([a-z0-9-]+)"\s*$/m.exec(config)?.[1],project);
      const migrations=path.join(root,'supabase/migrations');assert.ok(!fs.existsSync(migrations)||!fs.readdirSync(migrations).some(x=>x.endsWith('.sql')));
    }
  }
  notify('status');
  for(const service of ['db','auth','rest','kong']){
    const labels=JSON.parse(command('docker',['inspect','--format','{{json .Config.Labels}}','supabase_'+service+'_'+project]));assert.equal(labels['com.supabase.cli.project'],project);
  }
  const credentials=localStatus(JSON.parse(command(cli,['--workdir',root,'status','-o','json'])));
  sealOutbound();return {source,credentials,project};
}
export async function shutdown(workdir){
  // Preparation may reject an existing/foreign workdir before acquiring it.
  // Never clean somebody else's run merely because preflight failed.
  if(!acquired)return !fs.existsSync(workdir);
  let stopped=false;try{stopped=await stopSessions();}catch{/* Always try independent resource cleanup. */}
  let removed=false;try{removed=cleanup(workdir);}catch{/* Caller records an explicit cleanup failure. */}
  return stopped&&removed;
}

const sessions=new Set();
export class Session {
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
    const marker='amanah009_done_'+(++this.serial);
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
export async function waitForBlock(waiter,blocker){
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

export async function waitForBlockedCount(blocker,count=1){
  const deadline=Date.now()+6000;
  while(Date.now()<deadline){
    const seen=jsonSQL("with recursive blocked(pid) as (select pid from pg_stat_activity where wait_event_type='Lock' and "+blocker+
      "=any(pg_blocking_pids(pid)) union select a.pid from pg_stat_activity a join blocked b on b.pid=any(pg_blocking_pids(a.pid)) where a.wait_event_type='Lock') select to_jsonb(count(distinct pid)::int) from blocked where pid<>pg_backend_pid();");
    if(seen>=count)return;await delay(50);
  }
  throw new Failure('required_lock_not_observed');
}
