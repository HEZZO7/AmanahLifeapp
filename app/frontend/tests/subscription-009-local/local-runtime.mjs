// Local process plumbing only. Importing never starts processes or services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {SOURCE_COMMIT,SOURCE_FILES,MIGRATIONS,NODE_VERSION,CLI_VERSION,CLI_ARCHIVE_SHA256,APPROVAL,
  workspace,gitBlob,sha256,localStatus,commandCategory,commandDiagnostic,assertCleanEnvironment,Failure,PG_OPTIONS,PG_LIMITS,sessionPrefix,CHECKS,summarize,workerStageFailure,workerFailureDetails,lastWorkerPreflightStage,workerLaunchDetails,realAuthFailureDetails,validRealAuthDiagnostics,classifyAuthServerLogs,nativeFailureDetails,validNativeDiagnostics,SERVICE_FIELDS} from './safety.mjs';

export {Failure} from './safety.mjs';
import {installIsolation,verifyIsolation,removeIsolation,assertNoHostRules,validateIsolation,verifyNamespaceHandle,isolationRules} from './isolation.mjs';
const childEnv={PATH:process.env.PATH,LANG:'C.UTF-8',DO_NOT_TRACK:'1',CI:'true',DOCKER_HOST:'unix:///var/run/docker.sock'};
let root,project,cli,acquired=false;
export function command(exe,args,input,timeout=30000,execute=spawnSync){
  const r=execute(exe,args,{env:childEnv,input,encoding:'utf8',timeout,maxBuffer:32*1024*1024});
  const text=(r.stdout||'')+(r.stderr||'');
  if(r.error||r.status!==0){
    const error=new Failure(r.error?.code==='ETIMEDOUT'?'timeout':commandCategory(text),
      r.error?.code==='ETIMEDOUT'?124:(r.status>0?r.status:r.signal?128+(os.constants.signals[r.signal]||0):1));
    error.diagnostic=commandDiagnostic(exe,args,r);throw error;
  }
  return (r.stdout||'').trim();
}
export function sql(text,run=command){
  assert.ok(project&&root);
  return run('docker',['exec','-i','-e','PGAPPNAME='+sessionPrefix(project)+'control','-e','PGOPTIONS='+PG_OPTIONS+' -c amanahlife.local_test=approved -c amanahlife.security_fixture=isolated',
    'supabase_db_'+project,'psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],text);
}
export function jsonSQL(text,run=command){return JSON.parse(sql(text,run));}
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
    'metadata.sql','isolation.mjs','package-lock.json','package.json','review.test.mjs','safety.mjs'].sort());
  for(const [file,hash]of Object.entries(manifest.packageFiles)){
    const target=path.join(directory,file);assert.equal(fs.realpathSync(target),target);
    assert.ok(!fs.lstatSync(target).isSymbolicLink());assert.equal(sha256(fs.readFileSync(target)),hash);
  }
}
function context(workdir){
  root=workdir;project=path.basename(workdir);
  childEnv.HOME=root;childEnv.XDG_CONFIG_HOME=path.join(root,'.config');childEnv.DOCKER_CONFIG=path.join(root,'.docker');
}
export function ownedServiceDiagnostics(workdir,probe={}){
  const io=probe.fs??fs,run=probe.run??((exe,args)=>command(exe,args,undefined,3000));
  const verify=probe.verifyNamespaceHandle??verifyNamespaceHandle;
  const state=value=>Object.fromEntries(SERVICE_FIELDS.map(key=>[key,value]));
  try{
    workspace(workdir,path.dirname(workdir));assert.equal(io.realpathSync(workdir),workdir);
    const name=path.basename(workdir),marker=JSON.parse(io.readFileSync(path.join(workdir,'owned.json')));
    assert.equal(marker.project,name);assert.equal(marker.source,SOURCE_COMMIT);
    const journal=validateIsolation(JSON.parse(io.readFileSync(path.join(workdir,'isolation.json'))));
    assert.equal(journal.project,name);assert.ok(journal.identity);
    const services=['kong','db','auth','rest'];
    const format='{"id":{{json .Id}},"name":{{json .Name}},"project":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"pid":{{json .State.Pid}},"privileged":{{json .HostConfig.Privileged}},"oom":{{json .State.OOMKilled}},"health":{{if index .State "Health"}}{{json (index (index .State "Health") "Status")}}{{else}}null{{end}}}';
    let raw;try{raw=run('docker',['inspect','--format',format,...services.map(service=>'supabase_'+service+'_'+name)]);}catch{return state('unavailable');}
    assert.ok(Buffer.byteLength(raw)<=16384);const rows=raw.trim().split('\n').map(line=>JSON.parse(line));assert.equal(rows.length,4);assert.equal(new Set(rows.map(row=>row.id)).size,4);
    const result={};
    for(const [index,service]of services.entries()){
      const item=rows.find(row=>row.name==='/supabase_'+service+'_'+name);assert.ok(item);
      assert.equal(item.project,name);assert.equal(item.privileged,false);assert.equal(typeof item.running,'boolean');assert.equal(typeof item.oom,'boolean');assert.ok(item.health===null||['healthy','unhealthy','starting'].includes(item.health));
      const peer=journal.identity.peers.find(peer=>peer.id===item.id);assert.ok(peer);
      let code;
      if(!item.running)code=item.oom?'oom_observed':'stopped';
      else{
        assert.ok(Number.isSafeInteger(item.pid)&&item.pid>1);
        if(item.pid!==peer.pid)code=item.oom?'oom_observed':'restarted';
        else{verify({...peer,hostNamespace:journal.identity.hostNamespace});code=item.oom?'oom_observed':item.health==='unhealthy'?'unhealthy':item.health==='starting'?'starting':'running';}
      }
      result[SERVICE_FIELDS[index]]=code;
    }
    return result;
  }catch{return state('ownership_unverified');}
}
export function authServerDiagnostics(workdir,start,end,probe={}){
  const io=probe.fs??fs,run=probe.run??command,capture=probe.capture??spawnSync;
  const verify=probe.verifyNamespaceHandle??verifyNamespaceHandle,now=probe.now??Date.now;
  let failure='ownership_unverified';
  try{
    assert.ok(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&end>=start&&end-start<=60000);
    const current=now();assert.ok(start>=current-61000&&end<=current+1000);
    workspace(workdir,path.dirname(workdir));assert.equal(io.realpathSync(workdir),workdir);
    const name=path.basename(workdir),marker=JSON.parse(io.readFileSync(path.join(workdir,'owned.json')));
    assert.equal(marker.project,name);assert.equal(marker.source,SOURCE_COMMIT);
    const journal=validateIsolation(JSON.parse(io.readFileSync(path.join(workdir,'isolation.json'))));
    assert.equal(journal.project,name);assert.ok(journal.identity);
    // Inspect only fixed ownership/liveness fields, never Config.Env or logs of
    // another container. Revalidate the captured ID/PID and pinned namespace.
    const format='{"id":{{json .Id}},"name":{{json .Name}},"project":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"pid":{{json .State.Pid}},"privileged":{{json .HostConfig.Privileged}}}';
    const item=JSON.parse(run('docker',['inspect','--format',format,'supabase_auth_'+name]));
    assert.equal(item.name,'/supabase_auth_'+name);assert.equal(item.project,name);assert.equal(item.privileged,false);
    const peer=journal.identity.peers.find(peer=>peer.id===item.id);assert.ok(peer);
    if(item.running===false)return 'auth_service_not_running';
    assert.equal(item.running,true);assert.ok(Number.isInteger(item.pid)&&item.pid>1);
    if(item.pid!==peer.pid)return 'auth_service_restarted';
    verify({...peer,hostNamespace:journal.identity.hostNamespace});failure='unavailable';
    const outcome=capture('docker',['logs','--follow','--since',new Date(start).toISOString(),'--until',new Date(end+1000).toISOString(),
      '--tail','64',item.id],{env:{...childEnv},encoding:'utf8',timeout:5000,maxBuffer:512*1024});
    const text=(outcome.stdout||'')+'\n'+(outcome.stderr||'');
    if(outcome.error||outcome.signal||outcome.status!==0){
      // Some Docker log drivers keep --follow open beyond --until. A bounded
      // timeout may still contain complete evidence after the window closed.
      // Never accept truncation, another signal, partial JSON or an open window.
      if(outcome.error?.code!=='ETIMEDOUT'||outcome.signal!=='SIGTERM'||outcome.status!==null||now()<end+1000||Buffer.byteLength(text)>512*1024)return 'unavailable';
      if([outcome.stdout,outcome.stderr].some(value=>value&&!value.endsWith('\n')))return 'unavailable';
      const lines=text.split('\n').filter(line=>line.trim());
      if(!lines.length||!lines.every(line=>{try{JSON.parse(line);return true;}catch{return false;}}))return 'unavailable';
    }
    return classifyAuthServerLogs(text);
  }catch{return failure;}
}
// Docker bind-mounts this daemon-owned file as /etc/hosts. Never replace the
// mountpoint using docker cp, and do not assume utilities exist in every image.
// All input travels over stdin. Only a digest, never file bytes, is returned.
export const OWNED_HOSTS_APPEND_SCRIPT=String.raw`
import contextlib, hashlib, ipaddress, json, os, re, stat, sys
try:
    raw=sys.stdin.read(65537); assert len(raw)<=65536
    value=json.loads(raw); assert set(value)=={'dockerRoot','container','subnet','entries'}
    root=value['dockerRoot']; cid=value['container']; entries=value['entries']
    assert isinstance(root,str) and root.startswith('/') and root!='/' and os.path.normpath(root)==root and not root.startswith('//')
    assert re.fullmatch('[a-f0-9]{64}',cid) and isinstance(entries,list) and 0<len(entries)<=256
    subnet=ipaddress.IPv4Network(value['subnet']); assert subnet.is_private
    desired={}
    for line in entries:
        fields=line.split(' '); assert len(fields)>=2 and all(fields)
        address=ipaddress.IPv4Address(fields[0])
        assert address in subnet and not address.is_loopback and not address.is_multicast and not address.is_unspecified
        for name in fields[1:]:
            assert re.fullmatch('[A-Za-z0-9_.-]{1,253}',name)
            assert name not in desired or desired[name]==str(address)
            desired[name]=str(address)
    with contextlib.ExitStack() as stack:
        def own(fd): stack.callback(os.close,fd); return fd
        directory=own(os.open('/',os.O_PATH|os.O_DIRECTORY|os.O_CLOEXEC))
        for part in root.split('/')[1:]+['containers',cid]:
            assert part and part not in ('.','..')
            directory=own(os.open(part,os.O_PATH|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=directory))
        fd=own(os.open('hosts',os.O_RDWR|os.O_APPEND|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=directory))
        before=os.fstat(fd); assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_size<=1048576
        saved=os.read(fd,1048577); assert len(saved)<=1048576
        present=set()
        for line in saved.decode('utf8').splitlines():
            fields=line.split('#',1)[0].split()
            if not fields: continue
            for name in fields[1:]:
                if name in desired:
                    assert fields[0]==desired[name]
                    present.add(name)
        missing={}
        for name,address in desired.items():
            if name not in present: missing.setdefault(address,[]).append(name)
        suffix=('\n'+'\n'.join(address+' '+' '.join(names) for address,names in missing.items())+'\n').encode() if missing else b''
        remaining=suffix
        while remaining:
            written=os.write(fd,remaining); assert written>0; remaining=remaining[written:]
        os.fsync(fd); after=os.fstat(fd)
        assert (before.st_dev,before.st_ino,before.st_mode,before.st_uid,before.st_gid)==(after.st_dev,after.st_ino,after.st_mode,after.st_uid,after.st_gid)
        os.lseek(fd,0,os.SEEK_SET); actual=os.read(fd,1048577)
        assert actual==saved+suffix and len(actual)<=1048576
        print(hashlib.sha256(actual).hexdigest())
except PermissionError:
    sys.stderr.write('permission denied\n'); sys.exit(1)
except Exception:
    sys.exit(1)
`;
export function installOwnedHosts(workdir,identity,run=command,verify=verifyNamespaceHandle){
  const name=path.basename(workdir);isolationRules(name,identity);
  assert.equal(path.dirname(identity.handle),workdir);
  const dockerRoot=run('docker',['info','--format','{{.DockerRootDir}}']);
  assert.ok(path.isAbsolute(dockerRoot)&&dockerRoot!=='/'&&path.normalize(dockerRoot)===dockerRoot);
  for(const [index,peer]of identity.peers.entries()){
    verify({...peer,hostNamespace:identity.hostNamespace});
    const item=JSON.parse(run('docker',['inspect',peer.id]))[0];
    assert.equal(item.Id,peer.id);assert.equal(item.Config.Labels['com.supabase.cli.project'],name);
    assert.equal(item.State.Running,true);assert.equal(item.State.Pid,peer.pid);assert.equal(item.HostConfig.Privileged,false);
    const networks=Object.values(item.NetworkSettings.Networks);assert.equal(networks.length,1);
    assert.equal(networks[0].IPAddress,identity.hostEntries[index].split(' ')[0]);
    assert.equal(item.HostsPath,path.join(dockerRoot,'containers',peer.id,'hosts'));
    const digest=run('sudo',['-n','python3','-I','-c',OWNED_HOSTS_APPEND_SCRIPT],JSON.stringify({
      dockerRoot,container:peer.id,subnet:identity.subnet,entries:identity.hostEntries,
    }));
    assert.match(digest,/^[a-f0-9]{64}$/);
    const snapshot=path.join(workdir,'hosts-'+peer.id);assert.ok(!fs.existsSync(snapshot));
    run('docker',['cp',peer.id+':/etc/hosts',snapshot]);
    assert.ok(fs.lstatSync(snapshot).isFile()&&!fs.lstatSync(snapshot).isSymbolicLink());
    assert.equal(sha256(fs.readFileSync(snapshot)),digest);fs.unlinkSync(snapshot);
  }
}
export function reloadOwnedGateway(workdir,identity,run=command,verify=verifyNamespaceHandle){
  const name=path.basename(workdir);isolationRules(name,identity);
  assert.equal(fs.realpathSync(workdir),workdir);assert.equal(path.dirname(identity.handle),workdir);
  const marker=JSON.parse(fs.readFileSync(path.join(workdir,'owned.json')));
  assert.equal(marker.project,name);assert.equal(marker.source,SOURCE_COMMIT);
  const journal=validateIsolation(JSON.parse(fs.readFileSync(path.join(workdir,'isolation.json'))));
  assert.equal(journal.project,name);assert.deepEqual(journal.identity,identity);
  const peer=identity.peers.find(peer=>peer.handle===identity.handle);assert.ok(peer);
  const inspect=()=>{
    const format='{"id":{{json .Id}},"name":{{json .Name}},"project":{{json (index .Config.Labels "com.supabase.cli.project")}},"running":{{json .State.Running}},"pid":{{json .State.Pid}},"privileged":{{json .HostConfig.Privileged}}}';
    const item=JSON.parse(run('docker',['inspect','--format',format,peer.id]));
    assert.equal(item.id,peer.id);assert.equal(item.name,'/supabase_kong_'+name);assert.equal(item.project,name);
    assert.equal(item.running,true);assert.equal(item.pid,peer.pid);assert.equal(item.privileged,false);
    verify({...peer,hostNamespace:identity.hostNamespace});
    const uid=run('docker',['exec',peer.id,'id','-u']);assert.match(uid,/^(?:0|[1-9][0-9]*)$/);assert.equal(Number(uid),identity.kongUid);
  };
  inspect();run('docker',['exec',peer.id,'kong','reload']);inspect();
  run('docker',['exec',peer.id,'kong','health']);
}
function discoverIsolation(){
  const kong=JSON.parse(command('docker',['inspect','supabase_kong_'+project]))[0];
  assert.equal(kong.Config.Labels['com.supabase.cli.project'],project);assert.equal(kong.State.Running,true);
  const connected=Object.values(kong.NetworkSettings.Networks);assert.equal(connected.length,1);
  const network=JSON.parse(command('docker',['network','inspect',connected[0].NetworkID]))[0];
  assert.equal(network.Driver,'bridge');assert.match(network.Id,/^[a-f0-9]{64}$/);
  assert.equal(network.Labels['com.supabase.cli.project'],project);
  const bridge='br-'+network.Id.slice(0,12);
  assert.ok(!(network.Options||{})['com.docker.network.bridge.name']||(network.Options||{})['com.docker.network.bridge.name']===bridge);
  assert.ok(Object.keys(network.Containers).length>=4);
  const peers=[],hostEntries=[];
  const subnets=(network.IPAM?.Config||[]).map(x=>x.Subnet).filter(Boolean);
  assert.equal(subnets.length,1);const subnet=subnets[0];
  for(const id of Object.keys(network.Containers)){
    const item=JSON.parse(command('docker',['inspect',id]))[0];
    assert.equal(item.Config.Labels['com.supabase.cli.project'],project);assert.equal(item.HostConfig.Privileged,false);
    assert.equal(item.State.Running,true);
    const attachment=Object.values(item.NetworkSettings.Networks);assert.equal(attachment.length,1);
    const ip=attachment[0].IPAddress;assert.match(ip,/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/);
    const aliases=[item.Config.Hostname,item.Name.slice(1),...(attachment[0].Aliases||[]),...(attachment[0].DNSNames||[])];
    assert.ok(aliases.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_.-]+$/.test(x)));
    hostEntries.push(ip+' '+[...new Set(aliases)].join(' '));
    peers.push({id,pid:item.State.Pid,namespace:command('sudo',['-n','readlink','/proc/'+item.State.Pid+'/ns/net']),
      handle:path.join(root,id===kong.Id?'kong-netns':'netns-'+id.slice(0,12))});
    for(const [port,bindings]of Object.entries(item.HostConfig.PortBindings||{}))if(bindings){
      assert.ok(port.endsWith('/tcp'));
      for(const b of bindings)assert.ok(/^(?:5432[1-9]|8083)$/.test(b.HostPort));
    }
  }
  const pid=kong.State.Pid,uid=process.getuid(),gid=process.getgid();
  const namespace=command('sudo',['-n','readlink','/proc/'+pid+'/ns/net']);
  return {pid,bridge,namespace,hostNamespace:fs.readlinkSync('/proc/self/ns/net'),uid,gid,
    peers,subnet,hostEntries,groups:process.getgroups(),kongUid:Number(command('docker',['exec','supabase_kong_'+project,'id','-u'])),handle:path.join(root,'kong-netns')};
}
// This context crosses sudo over private stdin, never through inherited env.
export function workerRuntimeDirectory(workdir,expected,io=fs){
  assert.equal(typeof expected,'string');assert.ok(expected.length>1&&expected.length<=4096);
  assert.ok(path.isAbsolute(expected));assert.equal(path.resolve(expected),expected);
  assert.equal(io.realpathSync(expected),expected);assert.ok(io.statSync(expected).isDirectory());
  assert.equal(path.resolve(workdir),workdir);workspace(workdir,expected);
  return expected;
}
export function initializeWorker(workdir,runtimeTemp,notify=()=>{},probe={}){
  const io=probe.fs??fs,verify=probe.verifyNamespaceHandle??verifyNamespaceHandle;
  const uid=probe.uid??(()=>process.getuid()),gid=probe.gid??(()=>process.getgid());
  let stage='worker_runtime_temp';const at=value=>{stage=value;notify(value);};
  try{
    at('worker_runtime_temp');const base=workerRuntimeDirectory(workdir,runtimeTemp,io);
    at('worker_workspace');workspace(workdir,base);context(workdir);
    at('worker_marker');
    const marker=JSON.parse(io.readFileSync(path.join(root,'owned.json')));assert.equal(marker.project,project);assert.equal(marker.source,SOURCE_COMMIT);
    at('worker_journal');
    const journal=validateIsolation(JSON.parse(io.readFileSync(path.join(root,'isolation.json'))));
    assert.equal(journal.project,project);const identity=journal.identity;assert.ok(identity);
    at('worker_namespace_handle');verify(identity);
    at('worker_namespace_identity');assert.equal(io.readlinkSync('/proc/self/ns/net'),identity.namespace);
    at('worker_uid');assert.equal(uid(),identity.uid);
    at('worker_gid');assert.equal(gid(),identity.gid);
    at('worker_no_new_privileges');assert.match(io.readFileSync('/proc/self/status','utf8'),/^NoNewPrivs:\s+1$/m);
    at('worker_cancelled');assert.ok(!io.existsSync(path.join(root,'worker-cancel')));
    return identity;
  }catch(error){throw workerStageFailure(stage,error);}
}
export function runIsolatedWorker(prepared,entry,probe={}){
  const workdir=probe.workdir??root,verify=probe.verifyIsolation??verifyIsolation;
  const launch=probe.launch??spawnSync,readReport=probe.readReport??(file=>fs.readFileSync(file,'utf8'));
  let stage='controller_isolation',preflight=null,launchDetails={};const at=value=>{stage=value;};
  try{
    at('controller_isolation');const journal=verify(workdir,command),identity=journal.identity;
    at('controller_identity');assert.deepEqual(identity,prepared.identity);
    const args=['-n','nsenter','--net='+identity.handle,'--','setpriv','--reuid='+identity.uid,'--regid='+identity.gid,
      '--groups='+identity.groups.join(','),'--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--no-new-privs','--',
      process.execPath,entry,'--worker','--source',prepared.source,'--workdir',workdir];
    const runtimeTemp=workerRuntimeDirectory(workdir,prepared.runtimeTemp);
    const input=JSON.stringify({approval:APPROVAL,runtimeTemp,credentials:prepared.credentials});
    at('controller_launch');
    const outcome=launch('sudo',args,{input,encoding:'utf8',env:{...childEnv},timeout:480000,maxBuffer:1024*1024});
    launchDetails=workerLaunchDetails(outcome);
    preflight=lastWorkerPreflightStage(outcome.stdout);
    if(outcome.error||outcome.signal)throw new Failure(outcome.error?.code==='ETIMEDOUT'?'worker_timeout':'worker_transport_failed',outcome.error?.code==='ETIMEDOUT'?124:1);
    at('controller_report_file');const text=readReport(path.join(workdir,'worker-report.json'));
    at('controller_report_json');const report=JSON.parse(text);
    at('controller_report_source');assert.equal(report.source,SOURCE_COMMIT);
    at('controller_report_production');assert.equal(report.productionReady,false);
    at('controller_report_checks');assert.ok(Array.isArray(report.checks));
    const safeWord=value=>{assert.equal(typeof value,'string');assert.match(value,/^[a-z_]{1,80}$/);return value;};
    const checks=report.checks.map(r=>{
      assert.ok(CHECKS.includes(r.id));assert.ok(['passed','failed','infrastructure_failed'].includes(r.result));
      const authDetails=realAuthFailureDetails(r);
      assert.ok(validRealAuthDiagnostics(r));assert.ok(validNativeDiagnostics(r));
      return {id:r.id,result:r.result,...(r.category?{category:safeWord(r.category)}:{}),
        ...(r.exit!==undefined?{exit:validExit(r.exit)}:{}),...authDetails,...nativeFailureDetails(r,r.id)};
    });
    function validExit(value){assert.ok(Number.isInteger(value)&&value>=1&&value<=255);return value;}
    at('controller_report_infrastructure');
    const details=workerFailureDetails(report.infrastructureFailure);
    if(report.infrastructureFailure)assert.ok(validNativeDiagnostics({...report.infrastructureFailure,id:report.infrastructureFailure.phase,result:'infrastructure_failed'}));
    if(report.infrastructureFailure)for(const key of ['workerStage','workerPreflightStage','workerLaunchStage','workerExit']){
      if(key in report.infrastructureFailure)assert.equal(details[key],report.infrastructureFailure[key]);
    }
    const infra=report.infrastructureFailure?{phase:safeWord(report.infrastructureFailure.phase),
      category:safeWord(report.infrastructureFailure.category),exit:validExit(report.infrastructureFailure.exit),...details,...nativeFailureDetails(report.infrastructureFailure,report.infrastructureFailure.phase)}:null;
    const safe={...summarize(checks,report.cleanupPassed,infra),observations:{}};
    at('controller_report_observations');
    for(const key of ['familyDisplayNameRetained','ownerDeletionCascadesSharedFamily','afterNullTriggerDetected',
      'beforeNullTriggerDetected','beforeNullDeleteReportedSuccess','beforeNullWitnessReached'])if(key in report.observations){
      assert.equal(typeof report.observations[key],'boolean');safe.observations[key]=report.observations[key];
    }
    for(const key of ['localRequests','rejectedRequests'])if(key in report.observations){
      assert.ok(Number.isSafeInteger(report.observations[key])&&report.observations[key]>=0);safe.observations[key]=report.observations[key];
    }
    at('controller_report_result');assert.equal(report.result,safe.result);
    at('controller_exit_status');assert.ok([0,1].includes(outcome.status));
    assert.equal(outcome.status,safe.result==='passed'?0:1);
    return {report:safe,status:outcome.status};
  }catch(error){throw Object.assign(workerStageFailure(stage,error,preflight),launchDetails);}
}

function workerCandidates(workdir,identity){
  const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'integration.mjs');
  const matches=[];
  for(const name of fs.readdirSync('/proc'))if(/^[1-9][0-9]*$/.test(name)){
    let candidate=false;
    try{
      if(fs.statSync('/proc/'+name).uid!==process.getuid())continue;
      const args=fs.readFileSync('/proc/'+name+'/cmdline','utf8').split('\0');
      const at=args.indexOf('--workdir');
      if(!args.includes(entry)||!args.includes('--worker')||args[at+1]!==workdir)continue;
      candidate=true;
      if(fs.readlinkSync('/proc/'+name+'/ns/net')!==identity.namespace)throw new Failure('worker_ownership_failed');
      matches.push(Number(name));
    }catch(error){if(error instanceof Failure)throw error;if(!['ENOENT','ESRCH'].includes(error.code)&&(candidate||!['EACCES','EPERM'].includes(error.code)))throw new Failure('worker_inspection_failed');}
  }
  return matches;
}
function stopOwnedWorker(workdir){
  const location=path.join(workdir,'isolation.json');if(!fs.existsSync(location))return true;
  const journal=validateIsolation(JSON.parse(fs.readFileSync(location)));if(!journal.identity)return true;
  fs.writeFileSync(path.join(workdir,'worker-cancel'),'1',{mode:0o600});
  for(const signal of ['SIGTERM','SIGKILL']){
    for(const pid of workerCandidates(workdir,journal.identity)){try{process.kill(pid,signal);}catch(error){if(error.code!=='ESRCH')throw new Failure('worker_cleanup_failed');}}
    const end=Date.now()+1500;
    while(Date.now()<end){if(workerCandidates(workdir,journal.identity).length===0)return true;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);}
  }
  return workerCandidates(workdir,journal.identity).length===0;
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
  context(workdir);const name=path.basename(workdir);
  if(!fs.existsSync(workdir)){
    return ['container','volume','network'].every(kind=>resourceIDs(run,kind,name).length===0)&&assertNoHostRules(name,run);
  }
  assert.equal(fs.realpathSync(workdir),workdir);assert.ok(!fs.lstatSync(workdir).isSymbolicLink());
  const markerPath=path.join(workdir,'owned.json');assert.ok(!fs.lstatSync(markerPath).isSymbolicLink());
  const marker=JSON.parse(fs.readFileSync(markerPath));assert.equal(marker.project,name);assert.equal(marker.source,SOURCE_COMMIT);
  let failed=false,stopped=true;
  try{stopped=stopOwnedWorker(workdir);if(!stopped)failed=true;}catch{failed=true;stopped=false;}
  if(fs.existsSync(path.join(workdir,'start-attempted'))){
    try{
      const running=run('docker',['ps','-q','--filter','name=^/supabase_db_'+name+'$']);
      if(running){const queries=ownedSessionSQL(workdir);sql(queries.kill,run);assert.equal(jsonSQL(queries.count,run),0);}
    }catch{failed=true;}
    try{run(path.join(workdir,'bin/supabase'),['--workdir',workdir,'stop','--no-backup'],undefined,180000);}catch{failed=true;}
    for(const kind of ['container','volume','network']){try{if(resourceIDs(run,kind,name).length){failed=true;stopped=false;}}catch{failed=true;stopped=false;}}
  }
  if(stopped&&fs.existsSync(path.join(workdir,'isolation.json'))){
    try{removeIsolation(workdir,run,true);assertNoHostRules(name,run);}catch{failed=true;}
  }
  if(failed)return false; // Retain journal/marker/CLI for independent fallback.
  fs.rmSync(workdir,{recursive:true,force:true});assert.ok(!fs.existsSync(workdir));return true;
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
  cli=path.join(root,'bin/supabase');assert.equal(command(cli,['--version']),CLI_VERSION);
  // Refuse to claim ports already used by any process before installing guards.
  const listeners=command('ss',['-H','-ltn']);assert.ok(!/:(?:5432[1-9]|8083)\b/.test(listeners));
  installIsolation(root,null,command);
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
  const identity=discoverIsolation();installIsolation(root,identity,command);verifyIsolation(root,command);
  // Docker embedded DNS is blocked before the SDK loads. Preserve LOCAL service
  // resolution with owned-container aliases only; never add an external host.
  installOwnedHosts(root,identity);
  // Kong snapshots its hosts file at startup. Reload the SAME owned master
  // after aliases are verified; do not restart containers or reopen DNS.
  reloadOwnedGateway(root,identity);verifyIsolation(root,command);
  return {source,credentials,project,identity,runtimeTemp:base};
}
export async function shutdown(workdir){
  // Preparation may reject an existing/foreign workdir before acquiring it.
  // Never clean somebody else's run merely because preflight failed.
  if(!acquired)return !fs.existsSync(workdir);
  try{return cleanup(workdir);}catch{return false;} // Worker sessions are also verified by independent cleanup.
}

const sessions=new Set();let sessionCleanupFailed=false;
export function ownedSessionSQL(workdir,name=null){
  const projectName=path.basename(workdir),prefix=sessionPrefix(projectName);
  if(name)assert.ok(name.startsWith(prefix)&&/^[a-z0-9-]+$/.test(name));
  const condition="datname=current_database() and usename='postgres' and pid<>pg_backend_pid() and "+
    (name?"application_name='"+name+"'":"application_name like '"+prefix+"%'");
  return {kill:"select coalesce(bool_and(pg_terminate_backend(pid)),true) from pg_stat_activity where "+condition+';',
    count:'select to_jsonb(count(*)::int) from pg_stat_activity where '+condition+';'};
}
export async function closeRaceSessions(items,close=session=>session.close()){
  let ok=true;for(const item of items){try{if(await close(item)!==true)ok=false;}catch{ok=false;}}
  if(!ok)sessionCleanupFailed=true;return ok;
}
export async function withSessions(names,body,create=name=>new Session(name)){
  const items=[];let primary;
  try{for(const name of names)items.push(create(name));return await body(items);}
  catch(error){primary=error;throw error;}
  finally{if(!await closeRaceSessions(items)&&!primary)throw new Failure('session_cleanup_failed');}
}
export class Session {
  constructor(name){
    assert.ok(/^[a-z0-9-]+$/.test(name));this.name=sessionPrefix(project)+randomBytes(6).toString('hex');
    this.buffer='';this.output='';this.errorText='';this.serial=0;this.pending=null;
    this.child=spawn('docker',['exec','-i','-e','PGAPPNAME='+this.name,'-e','PGOPTIONS='+PG_OPTIONS,'supabase_db_'+project,
      'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],
      {env:childEnv,stdio:['pipe','pipe','pipe']});
    this.closed=new Promise(resolve=>{
      this.child.on('error',()=>{this.ended=true;this.pending?.reject(new Failure('session_transport_failed'));resolve(false);});
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
        if(this.pending&&line===this.pending.marker){const p=this.pending;this.pending=null;const out=this.output.trim();this.output='';p.resolve(out);}
        else this.output+=line+'\n';
      }
    });
    this.child.stdin.on('error',()=>{this.pending?.reject(new Failure('session_transport_failed'));});sessions.add(this);
  }
  async query(text){
    assert.ok(!this.pending&&!this.ended);const marker='amanah009_done_'+(++this.serial);let timer;
    try{return await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>{
        reject(new Failure('session_timeout',124));
        // Cancel the OWNED backend too; killing only the Docker client is not proof.
        try{sql(ownedSessionSQL(root,this.name).kill);}catch{sessionCleanupFailed=true;}
        this.child.kill('SIGTERM');
      },PG_LIMITS.client);
      this.pending={marker,resolve,reject};this.child.stdin.write(text+'\n\\echo '+marker+'\n');
    });}finally{clearTimeout(timer);}
  }
  async pid(){const value=Number(await this.query('select pg_backend_pid();'));assert.ok(Number.isSafeInteger(value)&&value>0);this.backendPid=value;return value;}
  async finish(text='rollback;'){await this.query(text);this.child.stdin.end();assert.equal(await this.closed,true);}
  async close(){
    const queries=ownedSessionSQL(root,this.name);let ok=true;
    try{sql(queries.kill);}catch{ok=false;}
    try{this.child.stdin.destroy();}catch{}
    if(!this.ended)this.child.kill('SIGTERM');
    await Promise.race([this.closed,delay(1500)]);
    if(!this.ended)this.child.kill('SIGKILL');
    await Promise.race([this.closed,delay(1500)]);
    const deadline=Date.now()+3000;let absent=false;
    while(Date.now()<deadline){try{if(jsonSQL(queries.count)===0){absent=true;break;}}catch{ok=false;break;}await delay(50);}
    return ok&&absent&&this.ended===true;
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
export async function stopSessions(){
  const closed=await closeRaceSessions([...sessions]);
  let absent=false;
  try{sql(ownedSessionSQL(root).kill);absent=jsonSQL(ownedSessionSQL(root).count)===0;}catch{}
  return closed&&absent&&!sessionCleanupFailed;
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
