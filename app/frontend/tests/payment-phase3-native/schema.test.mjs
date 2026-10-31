// Disposable PostgreSQL-WASM fixture review. NOT the native/GoTrue suite.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {statements} from './sql-statements.mjs';
import {reserveSQL} from './integration.mjs';
const db=new PGlite();
const manifest=JSON.parse(fs.readFileSync(new URL('./source-manifest.json',import.meta.url)));
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
before(async()=>{
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);grant usage on schema auth,public to anon,authenticated,service_role;");
  await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;set amanahlife.local_test='approved';");
  assert.deepEqual((await db.query("select current_setting('amanahlife.local_test',true)='approved' as configured,current_database()='template1' as database,current_user='postgres' as owner,to_regclass('auth.users') is not null as auth,to_regclass('public.app_11941c8fec_subscriptions') is null as fresh")).rows[0],{configured:true,database:true,owner:true,auth:true,fresh:true});
  await script(file('./fixture.sql'),true);await script(file('./phase3-schema.sql'),true);
  for(const name of manifest.migrationOrder)await script(file('../../../../'+name));
  await db.exec(`insert into public.${prefix}payment_environment(mode) values('test');`);
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
