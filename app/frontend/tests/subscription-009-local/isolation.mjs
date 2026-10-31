// Owned network rules only. No commands run on import. No host OUTPUT rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {sha256,Failure} from './safety.mjs';

export const isolationTag=project=>'amanah009-'+sha256(Buffer.from(project)).slice(0,16);
export function isolationRules(project,identity=null){
  assert.match(project,/^amanah-009-[0-9]+-[a-f0-9]{8}$/);
  const rules=[],tag=isolationTag(project);
  const add=(scope,tool,table,chain,args)=>rules.push({scope,tool,table,chain,args:[...args,'-m','comment','--comment',tag,'-j','DROP']});
  for(const tool of ['iptables','ip6tables']){
    add('host',tool,'filter','INPUT',['!','-i','lo','-p','tcp','-m','multiport','--dports','54321:54329,8083','-m','conntrack','--ctstate','NEW']);
    for(const port of ['54321:54329','8083'])add('host',tool,'filter','FORWARD',['!','-i','lo','-p','tcp','-m','conntrack','--ctstate','NEW','--ctorigdstport',port]);
  }
  if(identity){
    const {bridge,pid,namespace,hostNamespace,uid,gid,groups,kongUid,handle}=identity;
    assert.match(bridge,/^br-[a-f0-9]{12}$/);assert.ok(Number.isInteger(pid)&&pid>1);
    for(const value of [namespace,hostNamespace])assert.match(value,/^net:\[[0-9]+\]$/);
    assert.notEqual(namespace,hostNamespace);
    assert.equal(path.basename(handle),'kong-netns');assert.equal(path.basename(path.dirname(handle)),project);assert.ok(path.isAbsolute(handle));
    assert.ok(Number.isInteger(uid)&&uid>0&&Number.isInteger(gid)&&gid>0);
    assert.ok(Number.isInteger(kongUid)&&kongUid>=0&&kongUid!==uid);
    assert.ok(Array.isArray(groups)&&groups.length&&groups.every(x=>Number.isInteger(x)&&x>0));
    for(const tool of ['iptables','ip6tables']){
      add('host',tool,'filter','FORWARD',['-i',bridge,'!','-o',bridge]);
      add('host',tool,'filter','FORWARD',['-o',bridge,'!','-i',bridge,'-m','conntrack','--ctdir','ORIGINAL']);
      add('host',tool,'filter','INPUT',['-i',bridge,'-m','conntrack','--ctdir','ORIGINAL']);
    }
    assert.match(identity.subnet,/^(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}\/(?:[89]|[12]\d|30)|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\/(?:1[6-9]|2\d|30)|192\.168\.\d{1,3}\.\d{1,3}\/(?:1[6-9]|2\d|30))$/);
    assert.ok(Array.isArray(identity.hostEntries)&&identity.hostEntries.length===identity.peers.length);
    for(const line of identity.hostEntries)assert.match(line,/^(?:[0-9]{1,3}\.){3}[0-9]{1,3} [a-zA-Z0-9_. -]+$/);
    assert.ok(Array.isArray(identity.peers)&&identity.peers.length>=4);
    assert.equal(new Set(identity.peers.map(p=>p.id)).size,identity.peers.length);
    assert.equal(new Set(identity.peers.map(p=>p.handle)).size,identity.peers.length);
    assert.equal(identity.peers.filter(p=>p.handle===handle&&p.pid===pid&&p.namespace===namespace).length,1);
    for(const peer of identity.peers){
      assert.match(peer.id,/^[a-f0-9]{64}$/);assert.ok(Number.isInteger(peer.pid)&&peer.pid>1);
      assert.match(peer.namespace,/^net:\[[0-9]+\]$/);assert.notEqual(peer.namespace,hostNamespace);
      assert.equal(path.dirname(peer.handle),path.dirname(handle));
      assert.ok(path.basename(peer.handle)==='kong-netns'||path.basename(peer.handle)==='netns-'+peer.id.slice(0,12));
      const scoped=(tool,args)=>rules.push({scope:peer.id,tool,table:'filter',chain:'OUTPUT',args:[...args.slice(0,-2),'-m','comment','--comment',tag,...args.slice(-2)]});
      // Install deny first, then exact local allowances above it. Blocking Docker
      // embedded DNS itself prevents resolver forwarding outside the namespace.
      scoped('iptables',['-j','REJECT']);
      scoped('iptables',['-d',identity.subnet,'-j','ACCEPT']);
      scoped('iptables',['-o','lo','-j','ACCEPT']);
      scoped('iptables',['-d','127.0.0.11','-j','REJECT']);
      scoped('ip6tables',['-j','REJECT']);
      scoped('ip6tables',['-d','::1','-o','lo','-j','ACCEPT']);
    }
    const owner=['-m','owner','--uid-owner',String(uid)],comment=['-m','comment','--comment',tag];
    // In the OWNED Kong netns, not the host. Insert deny before allow so partial
    // setup is closed. The later allow is inserted at position 1 above the deny.
    rules.push({scope:'kong',tool:'iptables',table:'nat',chain:'OUTPUT',args:[...owner,'-d','127.0.0.1','-p','tcp','--dport','54321',...comment,'-j','REDIRECT','--to-ports','8000']});
    rules.push({scope:'kong',tool:'iptables',table:'filter',chain:'OUTPUT',args:[...owner,...comment,'-j','REJECT']});
    rules.push({scope:'kong',tool:'iptables',table:'filter',chain:'OUTPUT',args:[...owner,'-d','127.0.0.1','-p','tcp','--dport','8000',...comment,'-j','ACCEPT']});
    rules.push({scope:'kong',tool:'ip6tables',table:'filter',chain:'OUTPUT',args:[...owner,...comment,'-j','REJECT']});
  }
  return rules;
}
export function validateIsolation(journal){
  assert.equal(journal.version,1);
  assert.deepEqual(journal.rules,isolationRules(journal.project,journal.identity));
  assert.ok(journal.rules.every(r=>r.scope!=='host'||r.chain!=='OUTPUT'));
  return journal;
}
export function ruleCommand(rule,operation,identity){
  assert.ok(['-C','-I','-D'].includes(operation));
  const ip=[rule.tool,'-w','5','-t',rule.table,operation,rule.chain,...(operation==='-I'?['1']:[]),...rule.args];
  if(rule.scope==='host')return ['-n',...ip];
  const handle=rule.scope==='kong'?identity.handle:identity.peers.find(p=>p.id===rule.scope)?.handle;assert.ok(handle);
  return ['-n','nsenter','--net='+handle,'--',...ip];
}
function exists(rule,journal,run){
  try{run('sudo',ruleCommand(rule,'-C',journal.identity));return true;}
  catch(error){if(error instanceof Failure&&error.exitCode===1)return false;throw error;}
}
const location=root=>path.join(root,'isolation.json');
function save(root,journal){
  const temporary=location(root)+'.new';fs.writeFileSync(temporary,JSON.stringify(journal),{mode:0o600});fs.renameSync(temporary,location(root));
}
export function verifyNamespaceHandle(identity){
  assert.equal(fs.statfsSync(identity.handle).type,0x6e736673); // NSFS_MAGIC
  assert.equal(String(fs.statSync(identity.handle).ino),identity.namespace.slice(5,-1));
  assert.notEqual(identity.namespace,identity.hostNamespace);
}
export function installIsolation(root,identity,run){
  let journal;
  if(identity){
    journal=validateIsolation(JSON.parse(fs.readFileSync(location(root))));assert.equal(journal.identity,null);
  }else{assert.ok(!fs.existsSync(location(root)));journal={version:1,project:path.basename(root),identity:null,rules:isolationRules(path.basename(root))};}
  const old=journal.rules.length;
  if(identity){journal.identity=identity;journal.rules=isolationRules(journal.project,identity);}
  validateIsolation(journal);
  // Write ahead: even a crash after a successful -I is independently recoverable.
  save(root,journal);
  if(identity)for(const peer of identity.peers){
    const fd=fs.openSync(peer.handle,'wx',0o600);fs.closeSync(fd);
    run('sudo',['-n','mount','--bind','/proc/'+peer.pid+'/ns/net',peer.handle]);
    verifyNamespaceHandle({...peer,hostNamespace:identity.hostNamespace});
  }

  const pending=identity?journal.rules.slice(old):journal.rules;
  for(const rule of pending){
    if(exists(rule,journal,run))throw new Failure('isolation_rule_collision');
    run('sudo',ruleCommand(rule,'-I',identity));
    if(!exists(rule,journal,run))throw new Failure('isolation_not_established');
  }
  return journal;
}
export function verifyIsolation(root,run){
  const journal=validateIsolation(JSON.parse(fs.readFileSync(location(root))));assert.ok(journal.identity);
  for(const peer of journal.identity.peers)verifyNamespaceHandle({...peer,hostNamespace:journal.identity.hostNamespace});
  for(const rule of journal.rules)if(!exists(rule,journal,run))throw new Failure('isolation_not_established');
  return journal;
}
export function removeIsolation(root,run,resourcesStopped){
  if(!fs.existsSync(location(root))){
    // An interrupted atomic journal write cannot precede any rule installation.
    assert.ok(!fs.existsSync(location(root)+'.new'));return true;
  }
  const journal=validateIsolation(JSON.parse(fs.readFileSync(location(root))));
  assert.equal(resourcesStopped,true);
  const peers=journal.identity?.peers||[];
  const pinned=peer=>fs.existsSync(peer.handle)&&fs.statfsSync(peer.handle).type===0x6e736673;
  const valid=peer=>peer&&pinned(peer)&&String(fs.statSync(peer.handle).ino)===peer.namespace.slice(5,-1)&&peer.namespace!==journal.identity.hostNamespace;
  // Invalid/partial binds are only unmounted, NEVER entered (especially not host).
  for(const rule of [...journal.rules].reverse()){
    const peer=rule.scope==='kong'?peers.find(p=>p.handle===journal.identity.handle):peers.find(p=>p.id===rule.scope);
    if((rule.scope==='host'||valid(peer))&&exists(rule,journal,run)){
      run('sudo',ruleCommand(rule,'-D',journal.identity));
      if(exists(rule,journal,run))throw new Failure('isolation_cleanup_failed');
    }
  }
  for(const peer of peers){
    if(pinned(peer)){run('sudo',['-n','umount','--',peer.handle]);assert.notEqual(fs.statfsSync(peer.handle).type,0x6e736673);}
    if(fs.existsSync(peer.handle)){
      const file=fs.lstatSync(peer.handle);assert.ok(file.isFile()&&!file.isSymbolicLink()&&file.size===0&&file.uid===process.getuid());
      fs.unlinkSync(peer.handle);
    }
  }

  return true;
}
export function assertNoHostRules(project,run){
  const tag=isolationTag(project);
  for(const tool of ['iptables','ip6tables'])for(const chain of ['INPUT','FORWARD']){
    if(run('sudo',['-n',tool,'-w','5','-t','filter','-S',chain]).includes(tag))throw new Failure('isolation_cleanup_failed');
  }
  return true;
}
