// Disposable PostgreSQL-WASM fixture review. NOT the native/GoTrue suite.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {statements} from './sql-statements.mjs';
import {reserveSQL,verifySchemaDependencies,verifyPhase3Schema,CHECKOUT_DISABLED_SQL} from './integration.mjs';
import {fileURLToPath} from 'node:url';
import {NATIVE_CHECK_STAGES,nativeFailureDetails,validNativeDiagnostics,summarize,CHECKS} from './safety.mjs';
const db=new PGlite();
const manifest=JSON.parse(fs.readFileSync(new URL('./source-manifest.json',import.meta.url)));
const source=fileURLToPath(new URL('../../../../',import.meta.url));
const metadataQueries=[];
const prefix='app_11941c8fec_',A='10000000-0000-4000-8000-000000000001';
async function script(sql,fixtureModel=false){
  // PGlite0.3.14 opens template1 even with database:'postgres'. Adapt ONLY
  // the fixture's exact database identity to this explicitly offline model.
  // Native files on disk and every application migration remain unchanged.
  if(fixtureModel){
    assert.equal(sql.split("current_database()<>'postgres'").length,2);
    sql=sql.replace("current_database()<>'postgres'","current_database()<>'template1'");
  }
  for(const statement of statements(sql.replace(/^\\set ON_ERROR_STOP on\r?$/gm,'')))await db.exec(statement);
}
const file=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8');
async function scalar(sql,params=[]){return (await db.query(sql,params)).rows[0]?.value;}
// Exercise the native SQL strings through PostgreSQL's text boundary. The old
// WASM checks returned JS booleans directly and missed psql boolout (t/f).
async function metadataJSON(sql){
  const {rows,fields}=await db.query(sql);
  assert.equal(rows.length,1);assert.equal(fields.length,1);
  const value=rows[0][fields[0].name],type=fields[0].dataTypeID;
  let text;
  if(type===16)text=await scalar('select boolout($1)::text as value',[value]);
  else {assert.ok([114,3802].includes(type));text=JSON.stringify(value);}
  metadataQueries.push({type});
  return JSON.parse(text);
}
before(async()=>{
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);grant usage on schema auth,public to anon,authenticated,service_role;");
  await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;set amanahlife.local_test='approved';");
  assert.deepEqual((await db.query("select current_setting('amanahlife.local_test',true)='approved' as configured,current_database()='template1' as database,current_user='postgres' as owner,to_regclass('auth.users') is not null as auth,to_regclass('public.app_11941c8fec_subscriptions') is null as fresh")).rows[0],{configured:true,database:true,owner:true,auth:true,fresh:true});
  await verifySchemaDependencies(source,{runSQL:sql=>script(sql,sql.includes("current_database()<>'postgres'")),query:metadataJSON});
  await db.query('insert into auth.users(id,email) values($1,$2)',[A,'synthetic@example.invalid']);
});
after(async()=>{await db.close();assert.equal(db.closed,true);});
test('all eleven migrations compile on the extended owned fixture',async()=>{
  assert.equal(manifest.migrationOrder.length,11);
  assert.equal(await scalar(`select public.${prefix}account_deletion_ready() as value`),true);
  for(let i=0;i<2;i++)await script(file('../../../../'+manifest.migrationOrder[8]));
  assert.equal(await scalar(`select public.${prefix}account_deletion_ready() as value`),true);
});
test('notification RLS and internal fields remain protected after007',async()=>{
  assert.equal(await scalar(`select has_table_privilege('authenticated','public.${prefix}notification_preferences','DELETE') as value`),false);
  assert.equal(await scalar(`select has_column_privilege('authenticated','public.${prefix}notification_preferences','last_suhoor_sent_date','UPDATE') as value`),false);
  assert.equal(await scalar(`select has_column_privilege('authenticated','public.${prefix}notification_preferences','bill_reminders','UPDATE') as value`),true);
  assert.equal(await scalar(`select has_table_privilege('authenticated','public.${prefix}push_subscriptions','SELECT') as value`),false);
});
test('normal reservation is disabled; original SQL fixture reservation never commits enablement',async()=>{
  await assert.rejects(db.query(`select public.${prefix}payment_reserve_checkout('test',$1,repeat('f',64),'8001','8002','8003','balanced','monthly',0,null)`,[A]),e=>e.code==='42501');
  await db.exec('begin');
  try {
    await script(reserveSQL(A,'a'));
    assert.equal(await scalar(`select checkouts_enabled as value from public.${prefix}payment_environment`),false);
    await db.exec('commit');
  }catch(error){await db.exec('rollback');throw error;}
  assert.equal(await scalar(`select checkouts_enabled as value from public.${prefix}payment_environment`),false);
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_intents where user_id=$1`,[A]),1);
});
test('a failed reservation rolls its temporary flag back and preserves the first intent',async()=>{
  await db.exec('begin');
  try{await assert.rejects(script(reserveSQL(A,'b')),e=>e.code==='42501');}finally{await db.exec('rollback');}
  assert.equal(await scalar(`select checkouts_enabled as value from public.${prefix}payment_environment`),false);
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_intents where user_id=$1`,[A]),1);
});
test('new customer history is private and protected by a retaining FK',async()=>{
  for(const role of ['anon','authenticated','service_role'])assert.equal(await scalar(`select has_table_privilege($1,'public.${prefix}payment_customer_owners','SELECT') as value`,[role]),false);
  assert.equal(await scalar(`select count(*)=1 as value from pg_constraint where conrelid='public.${prefix}payment_customer_owners'::regclass and contype='f' and confdeltype='a'`),true);
});
test('orphaned customer ownership retains history and atomically rolls trial cleanup back',async()=>{
  const B='10000000-0000-4000-8000-000000000002';
  await db.query('insert into auth.users(id) values($1)',[B]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
  await db.exec('set role authenticated');
  try{assert.equal((await scalar(`select public.${prefix}start_trial() as value`)).error,null);}finally{await db.exec('reset role');}
  await db.query(`insert into public.${prefix}payment_customer_owners(mode,customer_id,user_id) values('test','orphan-fixture',$1)`,[B]);
  const before=await scalar(`select to_jsonb(s) as value from public.${prefix}subscriptions s where user_id=$1`,[B]);
  // Record the older preflight's coverage gap; do not change008 to conceal it.
  assert.equal(await scalar(`select public.${prefix}account_deletion_allowed($1) as value`,[B]),true);
  await assert.rejects(db.query('delete from auth.users where id=$1',[B]),e=>e.code==='23503');
  assert.deepEqual(await scalar(`select to_jsonb(s) as value from public.${prefix}subscriptions s where user_id=$1`,[B]),before);
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_customer_owners where user_id=$1`,[B]),1);
});

test('native schema prerequisite uses real JSON for every permission query',async()=>{
  metadataQueries.length=0;
  await verifyPhase3Schema(metadataJSON);
  assert.equal(metadataQueries.length,32);
  assert.equal(metadataQueries.filter(row=>row.type===3802).length,1);
  assert.equal(metadataQueries.filter(row=>row.type===114).length,31);
});
test('legacy PostgreSQL boolout reproduces the strict JSON failure without changing the parser',async()=>{
  const old="select has_table_privilege('anon','public."+prefix+"payment_customer_owners','SELECT');";
  const r=await db.query(old);assert.equal(r.fields[0].dataTypeID,16);
  assert.equal(await scalar('select boolout(false)::text as value'),'f');
  assert.equal(await scalar('select boolout(true)::text as value'),'t');
  await assert.rejects(metadataJSON(old),SyntaxError);
  await assert.rejects(metadataJSON('select true;'),SyntaxError);
  assert.equal(await metadataJSON("select to_json(has_table_privilege('anon','public."+prefix+"payment_customer_owners','SELECT'));"),false);
  // Same serialization defect existed in the final isolation assertion.
  await assert.rejects(metadataJSON("select coalesce(bool_and(mode='test' and not checkouts_enabled),false) from public."+prefix+"payment_environment;"),SyntaxError);
  assert.equal(await metadataJSON(CHECKOUT_DISABLED_SQL),true);
});
test('schema ACL assertions still reject real unwanted grants and missing allowed access',async()=>{
  for(const [grant,revoke,stage]of [
    [`grant select on public.${prefix}payment_customer_owners to anon`,`revoke select on public.${prefix}payment_customer_owners from anon`,'schema_customer_acl'],
    [`grant execute on function public.${prefix}guard_customer_owner() to authenticated`,`revoke execute on function public.${prefix}guard_customer_owner() from authenticated`,'schema_guard_acl'],
    [`revoke update(bill_reminders) on public.${prefix}notification_preferences from authenticated`,`grant update(bill_reminders) on public.${prefix}notification_preferences to authenticated`,'schema_notification_acl'],
  ]){
    await db.exec(grant);
    try{await assert.rejects(verifyPhase3Schema(metadataJSON),error=>{
      assert.deepEqual(nativeFailureDetails(error,'schema_dependencies'),{nativeStage:stage});return true;
    });}finally{await db.exec(revoke);}
  }
  await verifyPhase3Schema(metadataJSON);
});
test('schema values remain strict booleans, not strings or missing evidence',async()=>{
  for(const wrong of [null,'false',0])await assert.rejects(verifyPhase3Schema(async sql=>
    sql.includes("payment_customer_owners','SELECT'")?wrong:metadataJSON(sql)),error=>{
    assert.deepEqual(nativeFailureDetails(error,'schema_dependencies'),{nativeStage:'schema_customer_acl'});return true;
  });
});
test('every initialization boundary identifies only its fixed stage and fails closed',async()=>{
  const stages=NATIVE_CHECK_STAGES.schema_dependencies.slice(0,14);
  assert.equal(stages.length,14);
  for(const [target,stage]of stages.entries()){
    let calls=0,queried=false;
    await assert.rejects(verifySchemaDependencies(source,{
      runSQL:()=>{if(calls++===target)throw new Error('PRIVATE_SENTINEL');},
      query:()=>{queried=true;throw new Error('UNREACHED');},
    }),error=>{
      assert.equal(calls,target+1);assert.equal(queried,false);
      const details=nativeFailureDetails(error,'schema_dependencies');
      assert.deepEqual(details,{nativeStage:stage});
      const row={id:'schema_dependencies',result:'failed',category:'assertion_failed',...details};
      assert.equal(validNativeDiagnostics(row),true);
      assert.equal(validNativeDiagnostics({...row,nativeStage:'PRIVATE_SENTINEL'}),false);
      assert.equal(validNativeDiagnostics({...row,cleanupPhase:'PRIVATE_SENTINEL'}),false);
      const report=summarize([row],true,{phase:'isolated_worker',category:'prerequisite_failed',exit:1});
      assert.equal(report.result,'failed');assert.equal(report.missing.length,CHECKS.length-1);assert.equal(report.completed,1);assert.equal(report.invalid,false);
      assert.doesNotMatch(JSON.stringify(report),/PRIVATE_SENTINEL|UNREACHED/);
      return true;
    });
  }
});
