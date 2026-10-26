// PREPARED ONLY. Importing this file does not run SQL, start services or load SDKs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
import {API_ORIGIN,APPROVAL,CHECKS,CLEANUP_TABLES,SOURCE_COMMIT,SDK_VERSION,
  trafficGuard,uuid,summarize,workspace,failureLatch,expectSQLFailure,throwIfDatabaseInfrastructure,localStatus,commandFailureDetails,
  workerStageFailure,workerFailureDetails,workerStageSignal} from './safety.mjs';
import {Failure,prepare,cleanup,shutdown,sql,jsonSQL,withSessions,waitForBlock,waitForBlockedCount,runIsolatedWorker,initializeWorker,verifySource,verifyPackage,stopSessions} from './local-runtime.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('./source-manifest.json',import.meta.url)));
const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
const sub='public.app_11941c8fec_subscriptions',prefix='app_11941c8fec_';
const q=id=>"'"+uuid(id)+"'";
const results=[],observations={};let phase='preflight',cleanupPassed=false,workingDirectory;
const assertSQLState=(error,expected)=>{throwIfDatabaseInfrastructure(error);assert.equal(error?.code,expected);};
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
let workerMode=false,activeWorkerStage=null;
function notifyWorkerStage(stage){
  const signal=workerStageSignal(stage);activeWorkerStage=stage;
  if(workerMode)process.stdout.write(signal);
}
export function options(args){
  const out={};
  for(let i=0;i<args.length;i++){
    const key=args[i];assert.ok(['--source','--workdir','--cli-archive','--cleanup','--worker'].includes(key));
    assert.equal(out[key],undefined);out[key]=['--cleanup','--worker'].includes(key)?true:args[++i];assert.ok(out[key]);
  }
  assert.equal(typeof out['--workdir'],'string');
  assert.ok(!(out['--cleanup']&&out['--worker']));
  if(!out['--cleanup'])assert.equal(typeof out['--source'],'string');
  if(!out['--cleanup']&&!out['--worker'])assert.equal(typeof out['--cli-archive'],'string');
  return out;
}
async function check(id,fn,fatal=false){
  assert.ok(CHECKS.includes(id)&&!results.some(x=>x.id===id));phase=id;
  emit({check:id,result:'started'});
  try{await fn();results.push({id,result:'passed'});}
  catch(error){
    const infrastructure=error instanceof Failure;
    results.push({id,result:infrastructure?'infrastructure_failed':'failed',
      ...(infrastructure?{category:error.category,exit:error.exitCode}:{category:'assertion_failed'})});
    if(fatal)throw new Failure('prerequisite_failed');
  }
  emit(results.at(-1));
}
export function reserveSQL(user,digit){
  assert.match(digit,/^[a-f]$/);
  return "select public."+prefix+"payment_reserve_checkout('test',"+q(user)+",repeat('"+digit+"',64),'8001','8002','8003','balanced','monthly',0,null);";
}
function accountRows(user){
  const entries=CLEANUP_TABLES.map(t=>"'"+t+"',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public."+prefix+t+" t where user_id="+q(user)+"),'[]'::jsonb)");
  return jsonSQL("select jsonb_build_object('auth',(select to_jsonb(u) from auth.users u where id="+q(user)+"),"+entries.join(',')+");");
}
function authLinkCounts(user){
  return jsonSQL('select jsonb_build_object('+['identities','sessions','refresh_tokens'].map(t=>
    "'"+t+"',(select count(*) from auth."+t+' where user_id::text='+q(user)+')').join(',')+');');
}
function familyRows(id){
  return jsonSQL('select jsonb_build_object('+['families','family_members','family_budget_settings','family_budget_categories','family_income','family_expenses'].map(t=>
    "'"+t+"',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public."+prefix+t+' t where '+(t==='families'?'id':'family_id')+'='+q(id)+"),'[]'::jsonb)").join(',')+');');
}
function billingRows(user){
  return jsonSQL('select jsonb_build_object('+['accounts','intents','bindings','periods','plan_changes'].map(t=>
    "'"+t+"',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public."+prefix+'payment_'+t+' t where user_id='+q(user)+"),'[]'::jsonb)").join(',')+');');
}
function witness(){return jsonSQL("select to_jsonb(case when is_called then last_value else 0 end) from public.fixture_009_witness;");}
function fault(target,stage){assert.ok([...CLEANUP_TABLES,'auth'].includes(stage));sql("insert into public.fixture_009_faults values("+q(target)+",'"+stage+"') on conflict(target) do update set phase=excluded.phase;");}
function clearFault(target){sql('delete from public.fixture_009_faults where target='+q(target)+';');}
function attachFaults(){
  for(const table of [...CLEANUP_TABLES,'auth']){
    const relation=table==='auth'?'auth.users':'public.'+prefix+table;
    sql('create trigger zz_fixture_009_failure after delete on '+relation+' for each row execute function public.fixture_009_after_cleanup_failure();');
  }
}
export function nullTriggerSQL(target,timing){
  uuid(target);assert.ok(['BEFORE','AFTER'].includes(timing));
  return `create function public.fixture_009_null_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.id=${q(target)} then perform nextval('public.fixture_009_witness');return null;end if;
 return old;
end $$;
alter function public.fixture_009_null_delete() owner to postgres;
revoke all on function public.fixture_009_null_delete() from public,anon,authenticated,service_role;
create trigger zz_fixture_009_null_delete ${timing} delete on auth.users for each row execute function public.fixture_009_null_delete();`;
}
function dropNullTrigger(){sql('drop trigger zz_fixture_009_null_delete on auth.users;drop function public.fixture_009_null_delete();');}
function assertDeleted(user){
  const rows=accountRows(user);assert.equal(rows.auth,null);for(const t of CLEANUP_TABLES)assert.deepEqual(rows[t],[]);
  for(const rows of Object.values(billingRows(user)))assert.deepEqual(rows,[]);
  assert.deepEqual(authLinkCounts(user),{identities:0,sessions:0,refresh_tokens:0});
}
function verifyMetadata(m){
  const tables=['subscriptions','payment_accounts','payment_intents','payment_bindings','payment_periods'];
  const roles=['anon','authenticated','service_role'];
  assert.ok(Number.isInteger(m.serverVersion)&&m.serverVersion>=150000);
  const privileges=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER',...(m.serverVersion>=170000?['MAINTAIN']:[])];
  assert.equal(m.functions.length,4);
  assert.deepEqual(m.functions.map(f=>f.name).sort(),['account_deletion_allowed','guard_account_deletion','account_deletion_ready','cleanup_account_on_delete'].map(n=>prefix+n).sort());
  for(const f of m.functions){
    assert.equal(f.owner,'postgres');assert.equal(f.definer,true);assert.equal(f.config.length,1);assert.match(f.config[0],/^search_path=(?:""|)$/);
    const callable=[prefix+'account_deletion_allowed',prefix+'account_deletion_ready'].includes(f.name);
    assert.deepEqual(f.rights.map(r=>r[0]),roles);
    for(const [role,execute,grant]of f.rights){assert.equal(execute,callable&&role==='service_role');assert.equal(grant,false);}
  }
  assert.equal(m.triggers.length,3);
  const targets=m.triggers.map(t=>[t.schema,t.table,t.name,t.function]);
  assert.deepEqual(targets,[['auth','users',prefix+'billing_retention',prefix+'guard_account_deletion'],
    ['auth','users',prefix+'transactional_account_cleanup',prefix+'cleanup_account_on_delete'],
    ['public',prefix+'subscriptions',prefix+'billing_retention',prefix+'guard_account_deletion']]);
  for(const t of m.triggers){assert.equal(t.type,11);assert.equal(t.enabled,'O');assert.equal(t.condition,null);assert.match(t.definition,/BEFORE DELETE/);}
  assert.equal(m.foreignKeys.length,5);
  assert.deepEqual(m.foreignKeys.map(f=>f.table).sort(),tables.map(t=>prefix+t).sort());
  for(const f of m.foreignKeys){assert.equal(f.valid,true);assert.equal(f.deferred,false);assert.match(f.definition,/FOREIGN KEY \(user_id\) REFERENCES auth\.users\(id\)/);assert.equal(f.delete,f.table===prefix+'subscriptions'?'a':'c');}
  assert.deepEqual(m.acl.map(row=>row.slice(0,3).join(':')).sort(),roles.flatMap(r=>tables.flatMap(t=>privileges.map(p=>[r,t,p].join(':')))).sort());
  for(const [role,table,priv,allow]of m.acl){
    assert.equal(allow,table==='subscriptions'&&((role==='authenticated'&&priv==='SELECT')||(role==='service_role'&&['SELECT','INSERT','UPDATE'].includes(priv))));
  }
  assert.deepEqual(m.columnAcl.map(row=>row.slice(0,3).join(':')).sort(),roles.slice(0,2).flatMap(r=>m.columns.flatMap(c=>['INSERT','UPDATE','REFERENCES'].map(p=>[r,c[0],p].join(':')))).sort());
  for(const row of m.columnAcl)assert.equal(row[3],false);
  assert.deepEqual(m.rls.map(row=>row[0]).sort(),tables.map(t=>prefix+t).sort());
  for(const row of m.rls)assert.equal(row[1],true);
  assert.deepEqual(m.roles,[['anon',false,false],['authenticated',false,false],['service_role',false,true]]);
  assert.equal(m.policies.length,2);
  const policies=Object.fromEntries(m.policies.map(([name,roles,command,using,withCheck])=>[name,{roles,command,using,withCheck}]));
  assert.deepEqual(policies.allow_read_own_subscription.roles,['authenticated']);
  assert.equal(policies.allow_read_own_subscription.command,'SELECT');
  assert.equal(policies.allow_read_own_subscription.using.replace(/[\s()]/g,''),'SELECTauth.uidASuid=user_id');
  assert.equal(policies.allow_read_own_subscription.withCheck,null);
  assert.deepEqual(policies.allow_service_role_all,{roles:['service_role'],command:'ALL',using:'true',withCheck:'true'});
  assert.ok(m.constraints.some(x=>/UNIQUE \(user_id\)/.test(x[1])));
  assert.ok(m.columns.some(x=>x[0]==='trial_used'&&x[2]===true&&x[3]==='false'));
}

async function exercise(source,credentials){
  notifyWorkerStage('worker_client_setup');
  const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;
  const guard=trafficGuard(originalFetch);globalThis.fetch=guard.fetch;
  try{
    notifyWorkerStage('worker_sdk_import');
    const {createClient}=await import('@supabase/supabase-js');
    notifyWorkerStage('worker_sdk_version');
    assert.equal(JSON.parse(read('./node_modules/@supabase/supabase-js/package.json')).version,SDK_VERSION);
    notifyWorkerStage('worker_client_setup');
    const sdk=key=>createClient(API_ORIGIN,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const admin=sdk(credentials.service),anon=sdk(credentials.anon);
    const migrationFiles=manifest.migrationOrder;
    notifyWorkerStage('worker_migration_order');
    assert.deepEqual(migrationFiles.map(f=>f.match(/00([1-9])_/)[1]),['1','2','3','4','5','8','9']);
    notifyWorkerStage(null);
    await check('schema_dependencies',()=>{
      sql(read('./fixture.sql'));
      for(const file of migrationFiles.slice(0,6))sql(fs.readFileSync(path.join(source,file),'utf8'));
      sql("insert into public."+prefix+"payment_environment(singleton,mode) values(true,'test');");
    },true);
    async function rpc(client,name,args){
      const deadline=Date.now()+8000;
      while(true){const r=await client.rpc(prefix+name,args);throwIfDatabaseInfrastructure(r.error);if(r.error?.code!=='PGRST202')return r;if(Date.now()>deadline)throw new Failure('rpc_unavailable');await new Promise(r=>setTimeout(r,100));}
    }
    async function newAccount(trial=true){
      const email='migration009-'+randomBytes(8).toString('hex')+'@example.invalid',password=randomBytes(24).toString('base64url')+'aA1!';
      const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);
      const client=sdk(credentials.anon),signed=await client.auth.signInWithPassword({email,password});assert.equal(signed.error,null);
      const user={id:uuid(created.data.user.id),client,token:signed.data.session.access_token};
      const verified=await client.auth.getUser(user.token);assert.equal(verified.error,null);assert.equal(verified.data.user.id,user.id);
      if(trial){const r=await rpc(client,'start_trial');assert.equal(r.error,null);assert.equal(r.data.error,null);}
      else sql('insert into '+sub+'(user_id) values('+q(user.id)+');');
      for(const table of CLEANUP_TABLES.slice(1))sql('insert into public.'+prefix+table+"(user_id,marker) values("+q(user.id)+",'synthetic-private');");
      return user;
    }
    let A,B,handler,baselineA,baselineB,originalTrial;
    await check('real_auth_jwt',async()=>{
      A=await newAccount(false);B=await newAccount(true);assert.notEqual(A.id,B.id);
      assert.equal((await anon.auth.getUser('invalid-synthetic-token')).error!==null,true);
      originalTrial=accountRows(B.id).subscriptions;assert.equal(originalTrial.length,1);assert.equal(originalTrial[0].trial_used,true);
    },true);
    await check('migration_idempotency_metadata',async()=>{
      const dataBefore=[accountRows(A.id),accountRows(B.id),billingRows(A.id),billingRows(B.id)];
      const file=path.join(source,migrationFiles[6]);assert.ok(file.endsWith('202610210009_atomic_account_deletion.sql'));
      sql(fs.readFileSync(file,'utf8'));const first=jsonSQL(read('./metadata.sql'));verifyMetadata(first);
      assert.deepEqual([accountRows(A.id),accountRows(B.id),billingRows(A.id),billingRows(B.id)],dataBefore);
      sql(fs.readFileSync(file,'utf8'));assert.deepEqual(jsonSQL(read('./metadata.sql')),first);
      assert.deepEqual([accountRows(A.id),accountRows(B.id),billingRows(A.id),billingRows(B.id)],dataBefore);
      assert.equal((await rpc(admin,'account_deletion_ready')).data,true);
      // Load the REAL adapter; only its remote SDK import is mapped to the pinned
      // local SDK. Auth, PostgREST, SQL, FK locks and JWT verification are real.
      const entry=pathToFileURL(path.join(source,'app/frontend/supabase/functions/'+prefix+'delete_account/index.ts')).href;
      const sdkModule=import.meta.resolve('@supabase/supabase-js');
      const hook=registerHooks({resolve(specifier,context,next){
        if(specifier==='https://esm.sh/@supabase/supabase-js@2'&&context.parentURL===entry)return {url:sdkModule,shortCircuit:true};
        if(/^https?:/.test(specifier))throw new Failure('unexpected_module_download');return next(specifier,context);
      }});
      globalThis.Deno={env:{get:key=>({SUPABASE_URL:API_ORIGIN,SUPABASE_ANON_KEY:credentials.anon,SUPABASE_SERVICE_ROLE_KEY:credentials.service}[key])},
        serve:callback=>{assert.equal(handler,undefined);handler=callback;}};
      try{await import(entry);}finally{hook.deregister();}
      assert.equal(typeof handler,'function');attachFaults();baselineA=accountRows(A.id);baselineB=accountRows(B.id);
    },true);
    const request=(user,body={},token=user.token)=>new Request(API_ORIGIN+'/functions/v1/'+prefix+'delete_account',{
      method:'POST',headers:token?{Authorization:'Bearer '+token,'Content-Type':'application/json'}:{},body:JSON.stringify(body)});
    const remove=(user,body={},token=user.token)=>handler(request(user,body,token));
    await check('untrusted_denials',async()=>{
      for(const token of [null,'invalid-synthetic-token'])assert.equal((await remove(B,{},token)).status,401);
      for(const name of ['start_trial','account_deletion_ready']){
        const r=await anon.rpc(prefix+name);assert.ok(r.error);assert.ok([401,403,404].includes(r.status));
      }
      const parts=B.token.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
      parts[1]=Buffer.from(JSON.stringify({...claims,sub:A.id,role:'service_role'})).toString('base64url');
      assert.equal((await remove(B,{user_id:A.id},parts.join('.'))).status,401);
      for(const user of [A,B]){
        for(const [name,args]of [['account_deletion_ready',{}],['account_deletion_allowed',{p_user:A.id}],
          ['cleanup_account_on_delete',{}],['payment_reserve_checkout',{p_mode:'test',p_user:A.id,p_hash:'a'.repeat(64),p_store:'8001',p_product:'8002',p_variant:'8003',p_tier:'family',p_billing:'monthly',p_revision:0,p_supersedes:null}]]){
          const r=await user.client.rpc(prefix+name,args);assert.ok(r.error);assert.ok([401,403,404].includes(r.status));
        }
        const r=await user.client.from(prefix+'subscriptions').select('user_id');assert.equal(r.error,null);assert.deepEqual(r.data,[{user_id:user.id}]);
        for(const patch of [{tier:'family'},{trial_used:false},{user_id:A.id}])assertSQLState((await user.client.from(prefix+'subscriptions').update(patch).eq('user_id',B.id)).error,'42501');
        assertSQLState((await user.client.from(prefix+'subscriptions').insert({user_id:user.id,tier:'family'})).error,'42501');
        assertSQLState((await user.client.from(prefix+'subscriptions').delete().eq('user_id',B.id)).error,'42501');
        assertSQLState((await user.client.from(prefix+'payment_accounts').select('user_id')).error,'42501');
      }
      assert.deepEqual(accountRows(A.id),baselineA);assert.deepEqual(accountRows(B.id),baselineB);
    });
    await check('service_role_history_denial',async()=>{
      assertSQLState((await admin.from(prefix+'subscriptions').delete().eq('user_id',B.id)).error,'42501');
      assert.deepEqual(accountRows(B.id),baselineB);
      // An HTTP schema-cache denial alone is insufficient; also require SQL ACL denial.
      sql("begin;set local role service_role;do $$ begin begin delete from "+sub+' where user_id='+q(B.id)+";exception when insufficient_privilege then return;end;raise exception 'Unexpected service deletion';end $$;rollback;");
      assert.deepEqual(accountRows(B.id),baselineB);
    });
    await check('successful_auth_deletion',async()=>{
      const user=await newAccount(),start=guard.state.calls.length;
      const response=await remove(user,{user_id:A.id,status:'expired'});assert.equal(response.status,200);assert.equal((await response.json()).success,true);
      assertDeleted(user.id);assert.deepEqual(accountRows(A.id),baselineA);assert.deepEqual(accountRows(B.id),baselineB);
      const calls=guard.state.calls.slice(start);
      assert.ok(calls.some(c=>c.method==='DELETE'&&c.path==='/auth/v1/admin/users/'+user.id&&c.status===200));
      assert.equal(calls.some(c=>c.method==='DELETE'&&c.path.startsWith('/rest/v1/')),false);
      assert.ok((await user.client.auth.getUser(user.token)).error);
    });
    let faultProof=false;
    await check('rollback_each_cleanup_phase',async()=>{
      try{
        for(const stage of [...CLEANUP_TABLES,'auth']){
          fault(B.id,stage);const hit=witness(),before=accountRows(B.id),links=authLinkCounts(B.id);
          assert.equal((await remove(B,{user_id:A.id})).status,503);
          assert.equal(witness(),hit+1,'Fault must execute after verified real cleanup, not an earlier failure');
          assert.deepEqual(accountRows(B.id),before);assert.deepEqual(accountRows(A.id),baselineA);
          assert.deepEqual(authLinkCounts(B.id),links);
          const verified=await B.client.auth.getUser(B.token);assert.equal(verified.error,null);assert.equal(verified.data.user.id,B.id);
        }
        faultProof=true;
      }finally{clearFault(B.id);}
    });
    await check('failed_delete_preserves_trial',()=>{assert.equal(faultProof,true);assert.deepEqual(accountRows(B.id),baselineB);});
    await check('failed_delete_cannot_restart_trial',async()=>{
      assert.equal(faultProof,true);const r=await rpc(B.client,'start_trial');assert.equal(r.error,null);assert.equal(r.data.error,'trial_already_used');
      assert.deepEqual(accountRows(B.id),baselineB);
    });
    await check('checkout_wins_race',async()=>{
      const user=await newAccount(false);
      await withSessions(['a009-checkout-first','a009-delete-second'],async([checkout,deletion])=>{
      const [cpid,dpid]=await Promise.all([checkout.pid(),deletion.pid()]);assert.notEqual(cpid,dpid);
      await checkout.query('begin;'+reserveSQL(user.id,'a'));await deletion.query('begin;');
      const pending=deletion.query('delete from auth.users where id='+q(user.id)+';').then(()=>({ok:true}),error=>({ok:false,error}));
      await waitForBlock(dpid,cpid);await checkout.finish('commit;');
      const outcome=await pending;expectSQLFailure(outcome,'42501');
      assert.ok(accountRows(user.id).auth);assert.equal(billingRows(user.id).intents.length,1);
      });
      // Also exercise an already-locked subscription projection update. The
      // nested 008 subscription DELETE guard must see the committed paid state.
      const projected=await newAccount();
      await withSessions(['a009-paid-update','a009-paid-delete'],async([writer,blockedDelete])=>{
      const [wpid,bpid]=await Promise.all([writer.pid(),blockedDelete.pid()]);assert.notEqual(wpid,bpid);
      await writer.query("begin;select set_config('amanahlife.trusted_payment_write','yes',true);update "+sub+" set tier='balanced',paid_access_from=now()-interval '1 day',paid_access_until=now()+interval '1 day' where user_id="+q(projected.id)+";");
      await blockedDelete.query('begin;');
      const blocked=blockedDelete.query('delete from auth.users where id='+q(projected.id)+';').then(()=>({ok:true}),error=>({ok:false,error}));
      await waitForBlock(bpid,wpid);await writer.finish('commit;');
      const denied=await blocked;expectSQLFailure(denied,'42501');
      const surviving=accountRows(projected.id);assert.ok(surviving.auth);assert.equal(surviving.subscriptions[0].tier,'balanced');assert.equal(surviving.subscriptions[0].trial_used,true);
      });
    });
    await check('deletion_wins_race',async()=>{
      const user=await newAccount();
      await withSessions(['a009-delete-first','a009-checkout-second'],async([deletion,checkout])=>{
      const [dpid,cpid]=await Promise.all([deletion.pid(),checkout.pid()]);assert.notEqual(dpid,cpid);
      await deletion.query('begin;delete from auth.users where id='+q(user.id)+';');await checkout.query('begin;');
      const pending=checkout.query(reserveSQL(user.id,'b')).then(()=>({ok:true}),error=>({ok:false,error}));
      await waitForBlock(cpid,dpid);await deletion.finish('commit;');
      const outcome=await pending;expectSQLFailure(outcome,'23503');assertDeleted(user.id);
      });
    });
    await check('trial_races_deletion',async()=>{
      for(const rollback of [true,false]){
        const user=await newAccount(rollback),before=accountRows(user.id);
        await withSessions([rollback?'a009-trial-rollback':'a009-trial-commit'],async([deletion])=>{
        const pid=await deletion.pid();await deletion.query('begin;delete from auth.users where id='+q(user.id)+';');
        const pending=rpc(user.client,'start_trial');await waitForBlockedCount(pid);
        await deletion.finish(rollback?'rollback;':'commit;');const r=await pending;
        if(rollback){assert.equal(r.error,null);assert.equal(r.data.error,'trial_already_used');assert.deepEqual(accountRows(user.id),before);}
        else{assertSQLState(r.error,'23503');assertDeleted(user.id);}
        });
      }
    });
    await check('simultaneous_auth_deletions',async()=>{
      const user=await newAccount();
      await withSessions(['a009-double-delete'],async([locker])=>{const pid=await locker.pid();
      await locker.query('begin;select id from auth.users where id='+q(user.id)+' for update;');
      const start=guard.state.calls.length;
      const pending=Promise.all([remove(user),remove(user)]).then(responses=>({responses}),()=>({failure:true}));
      // Both real Auth DELETEs must be attempted while the parent row is held.
      const deadline=Date.now()+6000;
      while(guard.state.calls.slice(start).filter(c=>c.method==='DELETE'&&c.path==='/auth/v1/admin/users/'+user.id).length<2){
        if(Date.now()>deadline)throw new Failure('concurrent_auth_not_reached');await new Promise(r=>setTimeout(r,50));
      }
      await waitForBlockedCount(pid,2);await locker.finish('commit;');
      const outcome=await pending;assert.equal(outcome.failure,undefined);const responses=outcome.responses;assert.ok(responses.some(r=>r.status===200));
      for(const r of responses)assert.ok([200,503].includes(r.status));assertDeleted(user.id);
      });
    });
    let billingBefore;
    await check('billing_history_retention',async()=>{
      sql("begin;"+reserveSQL(A.id,'c')+
        "insert into public."+prefix+"payment_bindings(mode,subscription_id,user_id,customer_id,order_id,product_id,variant_id,tier,billing,last_state) values('test','8008',"+q(A.id)+",'8009','8010','8002','8003','balanced','monthly','{\"provider_status\":\"active\"}');"+
        "insert into public."+prefix+"payment_periods(mode,subscription_id,proof_id,user_id,kind,access_start,access_end,confirmed_at,tier,billing,product_id,variant_id) values('test','8008','8011',"+q(A.id)+",'renewal',now()-interval '1 day',now()+interval '14 days',now()-interval '1 day','balanced','monthly','8002','8003');commit;");
      for(const state of ['active','expired','refunded']){
        sql("update public."+prefix+"payment_bindings set last_state=jsonb_build_object('provider_status','"+state+"') where user_id="+q(A.id)+";");
        if(state!=='active')sql("update public."+prefix+"payment_intents set expires_at=now()-interval '1 second' where user_id="+q(A.id)+";update public."+prefix+"payment_periods set access_end=now()-interval '1 second',revoked_at=now()-interval '1 second' where user_id="+q(A.id)+";");
        if(state!=='active'){
          assert.equal(jsonSQL("select to_jsonb(not exists(select 1 from public."+prefix+"payment_periods where user_id="+q(A.id)+" and access_end>now() and revoked_at is null) and not exists(select 1 from public."+prefix+"payment_intents where user_id="+q(A.id)+" and expires_at>now()) and not exists(select 1 from "+sub+" where user_id="+q(A.id)+" and (tier<>'free' or paid_access_from is not null or paid_access_until is not null)) and not exists(select 1 from public."+prefix+"payment_bindings where user_id="+q(A.id)+" and last_state->>'provider_status' not in ('expired','refunded')));"),true);
        }
        const evidence=billingRows(A.id);assert.equal((await rpc(admin,'account_deletion_allowed',{p_user:A.id})).data,false);
        for(const table of ['accounts','intents','bindings','periods'])assert.ok(evidence[table].length>0);
        assert.equal((await remove(A,{user_id:B.id,cancelled:true,status:'expired'})).status,409);
        // Call GoTrue directly too: bypassing the Edge precheck must not bypass 008.
        assert.ok((await admin.auth.admin.deleteUser(A.id,false)).error);
        assert.deepEqual(billingRows(A.id),evidence);assert.deepEqual(accountRows(A.id),baselineA);
      }
      billingBefore=billingRows(A.id);
      // Legacy/current paid projections must also block even without a ledger.
      const projected=await newAccount(false);
      sql("begin;select set_config('amanahlife.trusted_payment_write','yes',true);update "+sub+" set tier='balanced',status='active',paid_access_from=now()-interval '1 day',paid_access_until=now()+interval '1 day' where user_id="+q(projected.id)+";commit;");
      const saved=accountRows(projected.id);assert.equal((await remove(projected)).status,409);
      assert.ok((await admin.auth.admin.deleteUser(projected.id,false)).error);assert.deepEqual(accountRows(projected.id),saved);
    });
    async function family(owner,member){
      const created=await owner.client.from(prefix+'families').insert({owner_user_id:owner.id,name:'Synthetic family'}).select('id,join_code').single();
      assert.equal(created.error,null);const id=uuid(created.data.id);
      if(member){const joined=await rpc(member.client,'join_family_with_code',{p_code:created.data.join_code});assert.equal(joined.error,null);assert.equal(joined.data,id);}
      sql('insert into public.'+prefix+'family_income(family_id,source,amount,amount_base,created_by) values('+q(id)+",'synthetic-income',1,1,"+q(member?.id||owner.id)+');');
      sql('insert into public.'+prefix+'family_budget_settings(family_id) values('+q(id)+');'+
        'insert into public.'+prefix+'family_budget_categories(family_id,name) values('+q(id)+",'synthetic-category');"+
        'insert into public.'+prefix+'family_expenses(family_id,category,description,amount,amount_base,created_by) values('+q(id)+",'synthetic-category','synthetic-shared-description',1,1,"+q(member?.id||owner.id)+');');
      for(const rows of Object.values(familyRows(id)))assert.ok(rows.length>0,'Every family cascade target must be seeded');
      return id;
    }
    await check('family_member_privacy',async()=>{
      const owner=await newAccount(),member=await newAccount(),id=await family(owner,member),saved=accountRows(owner.id),familyBefore=familyRows(id);
      const retained=jsonSQL('select to_jsonb(m) from public.'+prefix+'family_members m where family_id='+q(id)+' and user_id='+q(member.id)+';');
      assert.equal((await remove(member)).status,200);assertDeleted(member.id);assert.deepEqual(accountRows(owner.id),saved);
      const row=jsonSQL('select to_jsonb(m) from public.'+prefix+'family_members m where id='+q(retained.id)+';');
      assert.equal(row.user_id,null);assert.equal(row.display_name,retained.display_name);
      const income=jsonSQL('select to_jsonb(t) from public.'+prefix+'family_income t where family_id='+q(id)+';');assert.equal(income.created_by,null);
      const expected=structuredClone(familyBefore);
      for(const row of expected.family_members)if(row.user_id===member.id)row.user_id=null;
      for(const table of ['family_income','family_expenses'])for(const row of expected[table])if(row.created_by===member.id)row.created_by=null;
      assert.deepEqual(familyRows(id),expected);
      const visible=await owner.client.from(prefix+'family_members').select('id,display_name').eq('id',retained.id);assert.equal(visible.error,null);assert.equal(visible.data.length,1);
      observations.familyDisplayNameRetained=true; // Known retention, NOT proof of complete PII erasure.
    });
    await check('family_owner_deletion',async()=>{
      const owner=await newAccount(),member=await newAccount(),id=await family(owner,member),saved=accountRows(member.id);
      assert.equal((await remove(owner)).status,200);assertDeleted(owner.id);assert.deepEqual(accountRows(member.id),saved);
      for(const table of ['families','family_members','family_budget_settings','family_budget_categories','family_income','family_expenses']){
        assert.equal(jsonSQL('select to_jsonb(count(*)::int) from public.'+prefix+table+' where '+(table==='families'?'id':'family_id')+'='+q(id)+';'),0);
      }
      observations.ownerDeletionCascadesSharedFamily=true;
    });
    await check('after_delete_null_control',async()=>{
      const user=await newAccount();sql(nullTriggerSQL(user.id,'AFTER'));
      try{
        const readiness=await rpc(admin,'account_deletion_ready');assert.equal(readiness.error,null);assert.equal(typeof readiness.data,'boolean');
        observations.afterNullTriggerDetected=readiness.data===false;
        // PostgreSQL ignores AFTER ROW return values. Direct real Auth confirms
        // this control even if a future readiness guard rejects extra triggers.
        const before=witness();const response=await admin.auth.admin.deleteUser(user.id,false);assert.equal(response.error,null);
        assert.equal(witness(),before+1);assertDeleted(user.id);
      }finally{dropNullTrigger();}
    });
    // Test the actual review finding as well: BEFORE, unlike AFTER, may veto a
    // DELETE without throwing. These are ordinary mandatory FAILING assertions
    // on the approved vulnerable source, never xfail/skip/green conversions.
    const adversarial=await newAccount(),adversarialBefore=accountRows(adversarial.id);let attempted=false;
    sql(nullTriggerSQL(adversarial.id,'BEFORE'));
    try{
      await check('unreviewed_trigger_readiness',async()=>{
        const r=await rpc(admin,'account_deletion_ready');assert.equal(r.error,null);
        observations.beforeNullTriggerDetected=r.data===false;
        assert.equal(r.data,false,'Readiness must reject the unreviewed BEFORE DELETE veto');
      });
      await check('before_delete_null_preserves_trial',async()=>{
        const hit=witness(),response=await remove(adversarial);attempted=true;
        observations.beforeNullDeleteReportedSuccess=response.status===200;
        observations.beforeNullWitnessReached=witness()===hit+1;
        assert.deepEqual(accountRows(adversarial.id),adversarialBefore,'A vetoed Auth deletion must preserve the entire trial/account');
        assert.notEqual(response.status,200,'Do not report successful deletion while Auth remains');
        assert.equal(witness(),hit,'Readiness must block the adapter before Auth DELETE');
        // Bypass the HTTP readiness preflight to model DDL committed between
        // preflight and DELETE. The DB cleanup guard must fail before erasure.
        const direct=await admin.auth.admin.deleteUser(adversarial.id,false);
        assert.ok(direct.error,'Direct Auth deletion must reject a late unreviewed veto');
        assert.equal(witness(),hit,'Late veto must not run after destructive cleanup');
        assert.deepEqual(accountRows(adversarial.id),adversarialBefore);
      });
      await check('before_delete_null_cannot_restart_trial',async()=>{
        assert.equal(attempted,true);const r=await rpc(adversarial.client,'start_trial');assert.equal(r.error,null);
        assert.equal(r.data.error,'trial_already_used','A vetoed deletion must never grant a second trial');
        assert.deepEqual(accountRows(adversarial.id),adversarialBefore);
      });
    }finally{dropNullTrigger();}
    await check('isolation_and_billing_preservation',()=>{
      assert.ok(billingBefore);assert.deepEqual(billingRows(A.id),billingBefore);
      assert.deepEqual(accountRows(A.id),baselineA);assert.deepEqual(accountRows(B.id),baselineB);
      assert.ok(guard.state.attempted>0);assert.equal(guard.state.rejected,0);
      observations.localRequests=guard.state.attempted;observations.rejectedRequests=guard.state.rejected;
    });
  }finally{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;}
}

export async function execute(opts){
  assert.equal(process.env.AMANAHLIFE_009_APPROVAL,APPROVAL);
  workingDirectory=path.resolve(opts['--workdir']);
  workspace(workingDirectory,fs.realpathSync(process.env.RUNNER_TEMP));
  if(opts['--cleanup']){phase='cleanup';cleanupPassed=cleanup(workingDirectory);assert.equal(cleanupPassed,true);return;}
  try{
    const prepared=await prepare(opts,manifest,name=>{phase=name;emit({phase:name,result:'started'});});
    phase='isolated_worker';const {report}=runIsolatedWorker(prepared,new URL(import.meta.url).pathname);
    results.push(...report.checks);Object.assign(observations,report.observations);
    if(report.infrastructureFailure){
      const failure=new Failure(report.infrastructureFailure.category,report.infrastructureFailure.exit);
      Object.assign(failure,workerFailureDetails(report.infrastructureFailure));throw failure;
    }
    if(!report.cleanupPassed)throw new Failure('session_cleanup_failed');
  }finally{
    const previous=phase;phase='cleanup';cleanupPassed=await shutdown(workingDirectory);
    emit({phase:'cleanup',result:cleanupPassed?'passed':'failed'});phase=previous;
  }
}
async function worker(opts){
  workerMode=true;phase='worker_preflight';workingDirectory=path.resolve(opts['--workdir']);
  initializeWorker(workingDirectory,notifyWorkerStage);
  notifyWorkerStage('worker_source_path');const source=fs.realpathSync(opts['--source']);
  notifyWorkerStage('worker_source_workspace');
  workspace(workingDirectory,fs.realpathSync(process.env.RUNNER_TEMP),source);
  notifyWorkerStage('worker_package_integrity');verifyPackage(path.dirname(new URL(import.meta.url).pathname),manifest);
  notifyWorkerStage('worker_source_integrity');verifySource(source,manifest);
  // Private stdin only: no local JWT/key in argv, environment, or console.
  notifyWorkerStage('worker_private_input');const raw=fs.readFileSync(0,'utf8');assert.ok(raw.length<65536);
  const input=JSON.parse(raw);
  notifyWorkerStage('worker_approval');assert.equal(input.approval,APPROVAL);
  notifyWorkerStage('worker_credentials');
  const credentials=localStatus({API_URL:input.credentials.url,
    DB_URL:'postgresql://postgres:postgres@127.0.0.1:54322/postgres',ANON_KEY:input.credentials.anon,SERVICE_ROLE_KEY:input.credentials.service});
  try{await exercise(source,credentials);}
  finally{cleanupPassed=await stopSessions();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  for(const method of ['log','info','warn','error','debug','trace','dir','table'])console[method]=()=>{};
  let opts;
  const publish=report=>{
    // A late rejection rewrites the already-published report as FAILED.
    if(workingDirectory){
      const base=fs.realpathSync(process.env.RUNNER_TEMP);workspace(workingDirectory,base);
      const file=opts?.['--worker']?path.join(workingDirectory,'worker-report.json'):
        path.join(base,path.basename(workingDirectory)+'-report.json');
      fs.writeFileSync(file,JSON.stringify(report)+'\n',{mode:0o600});
    }
    emit(report);
  };
  const latch=failureLatch(process,publish);
  process.on('unhandledRejection',latch.reject);
  process.setUncaughtExceptionCaptureCallback(()=>{
    process.exitCode=1;latch.reject();
    void (async()=>{
      let removed=false;
      if(workingDirectory)try{removed=opts?.['--worker']?await stopSessions():await shutdown(workingDirectory);}catch{}
      latch.publish(summarize(results,removed,{phase:'uncaught',category:'uncaught_failure',exit:1}));process.exit(1);
    })();
  });
  let infrastructureFailure=null;
  try{opts=options(process.argv.slice(2));if(opts['--worker'])await worker(opts);else await execute(opts);}
  catch(error){
    const failure=activeWorkerStage?workerStageFailure(activeWorkerStage,error):error;
    infrastructureFailure={phase,category:failure instanceof Failure?failure.category:'assertion_failed',exit:failure instanceof Failure?failure.exitCode:1,
      ...commandFailureDetails(failure),...workerFailureDetails(failure)};
  }
  if(opts?.['--cleanup']){
    latch.publish({mode:'cleanup',result:cleanupPassed&&!infrastructureFailure?'passed':'failed',
      cleanupPassed:cleanupPassed&&!infrastructureFailure,productionReady:false,infrastructureFailure});
  }else latch.publish({...summarize(results,cleanupPassed,infrastructureFailure),observations});
}
