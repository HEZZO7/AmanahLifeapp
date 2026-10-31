// PostgreSQL 17 WASM in memory: real SQL/RLS/triggers, synthetic Auth schema.
// Not GoTrue, HTTP, multi-connection PostgreSQL or the 21-group native suite.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { statements } from './sql-statements.mjs';

const db=new PGlite();
const prefix='app_11941c8fec_';
const A='10000000-0000-4000-8000-000000000001';
const B='10000000-0000-4000-8000-000000000002';
const C='10000000-0000-4000-8000-000000000003';
const stagedRegressions=[];
async function file(path) {
  let sql=await readFile(new URL(path,import.meta.url),'utf8');
  // Only psql's client error-stop directive is removed; every SQL assertion runs.
  assert.ok(!sql.split('\n').some(l=>l.startsWith('\\')&&!l.startsWith('\\set ON_ERROR_STOP')));
  const collectors=[];const variables={};
  sql=sql.replace(/^([^\n]+) \\gset\r?$/gm,(_,query)=>{collectors.push(query.trim()+';');return query+';';});
  let index=0;
  try {for(const original of statements(sql.replace(/^\\set ON_ERROR_STOP on\r?$/gm,''))) {
    index++;
    const statement=original.replace(/:'([a-z_]+)'/g,(_,key)=>{
      assert.equal(typeof variables[key],'string');return "'"+variables[key].replaceAll("'","''")+"'";
    });
    if(collectors.some(q=>original.trim().endsWith(q)))Object.assign(variables,(await db.query(statement)).rows[0]);
    else await db.exec(statement);
  }}
  catch(e){await db.exec('rollback; reset role');throw Error('SQL fixture failed: '+path+' statement '+index+' ['+(e.code||'unclassified')+']');}
}
async function migration(suffix) {
  const {readdir}=await import('node:fs/promises');
  const root=new URL('../../supabase/migrations/',import.meta.url);
  const match=(await readdir(root)).filter(n=>n.endsWith(suffix));assert.equal(match.length,1);
  return file('../../supabase/migrations/'+match[0]);
}
async function scalar(sql,params=[]) { return (await db.query(sql,params)).rows[0]?.value; }
async function rpc(name,args) {
  assert.match(name,/^app_11941c8fec_payment_[a-z_]+$/);
  const keys=Object.keys(args);assert.ok(keys.every(k=>/^p_[a-z_]+$/.test(k)));
  return scalar(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as value`,Object.values(args));
}
const reserve=(user,hash)=>rpc(prefix+'payment_reserve_checkout',{p_mode:'test',p_user:user,p_hash:hash,p_store:'1',p_product:'3',p_variant:'2',p_tier:'family',p_billing:'monthly',p_revision:0,p_supersedes:null});
before(async()=>{
  await db.exec("set amanahlife.security_fixture='isolated';");
  await file('../subscription-security-fixture.sql');
  await migration('0001_subscription_authority.sql');
  await file('../subscription-security.sql');stagedRegressions.push('subscription');
  await file('../family-helper-fixture.sql');
  await file('../family-authority-seed.sql');
  await file('./notification-fixture.sql');
  await db.exec(`create table public.${prefix}search_history(user_id uuid); create table public.${prefix}email_digest(user_id uuid);`);
  await migration('0002_family_helper_execution.sql');
  await file('../family-helper-security.sql');stagedRegressions.push('family-helper');
  await migration('0003_family_authority.sql');
  await file('../family-authority-security.sql');stagedRegressions.push('family-authority');
  await file('../lemon-payments-seed.sql');
  await migration('0004_trusted_lemon_payments.sql');
  await file('../lemon-payments-security.sql');stagedRegressions.push('payment-authority');
  await file('../lifecycle-seed.sql');
  await migration('0005_subscription_lifecycle.sql');
  await migration('0006_ai_entitlement.sql');
  await migration('0007_notification_table_authority.sql');
  await migration('0008_account_deletion_safety.sql');
  await migration('0009_atomic_account_deletion.sql');
});
after(async()=>{await db.close();assert.equal(db.closed,true);});

test('original subscription/family/payment authority SQL assertions pass at their migration stages',()=>{
  assert.deepEqual(stagedRegressions,['subscription','family-helper','family-authority','payment-authority']);
});
test('original lifecycle SQL assertions pass unchanged',async()=>{
  await file('../subscription-lifecycle-security.sql');
});
test('original AI entitlement SQL assertions pass unchanged',async()=>{
  await file('../ai-entitlement-security.sql');
});
test('customer-ownership migration fails closed on a shared historic customer',async()=>{
  await db.exec('begin');
  await db.exec(`insert into public.${prefix}payment_bindings(mode,subscription_id,user_id,customer_id,order_id,product_id,variant_id,tier,billing)
    values('test','998','11111111-1111-4111-8111-111111111111','6','997','3','2','family','monthly')`);
  await assert.rejects(migration('0011_payment_customer_ownership.sql'),/\[P0001\]/);
  assert.equal(await scalar(`select to_regclass('public.${prefix}payment_customer_owners') is null as value`),true);
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_bindings where subscription_id='998'`),0);
});
test('additive checkout migration preserves Migration 009 readiness and DELETE denial',async()=>{
  assert.equal(await scalar(`select public.${prefix}account_deletion_ready() as value`),true);
  await migration('0010_payment_checkout_lock.sql');
  await migration('0011_payment_customer_ownership.sql');
  assert.equal(await scalar(`select public.${prefix}account_deletion_ready() as value`),true);
  for(const role of ['anon','authenticated','service_role']) {
    assert.equal(await scalar(`select has_table_privilege($1,'public.${prefix}subscriptions','DELETE') as value`,[role]),false);
    assert.equal(await scalar(`select has_function_privilege($1,'public.${prefix}guard_checkout_reservation()','EXECUTE') as value`,[role]),false);
  }
  await db.query('insert into auth.users(id) values($1),($2),($3)',[A,B,C]);
});
test('SQL checkout gate defaults off even when a mode exists',async()=>{
  assert.equal(await scalar(`select checkouts_enabled as value from public.${prefix}payment_environment`),false);
  await assert.rejects(reserve(A,'a'.repeat(64)),e=>e.code==='42501');
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_intents where user_id=$1`,[A]),0);
});
test('queued concurrent reservations create exactly one durable intent',async()=>{
  await db.exec(`update public.${prefix}payment_environment set checkouts_enabled=true;`);
  const results=await Promise.allSettled([reserve(A,'a'.repeat(64)),reserve(A,'b'.repeat(64))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='42501').length,1);
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_intents where user_id=$1`,[A]),1);
  await rpc(prefix+'payment_ready_intent',{p_mode:'test',p_hash:'a'.repeat(64),p_checkout:'400'});
});
test('an expired local TTL never releases an ambiguous external checkout',async()=>{
  await db.query(`update public.${prefix}payment_intents set expires_at=statement_timestamp()-interval '1 hour' where user_id=$1`,[A]);
  await assert.rejects(reserve(A,'c'.repeat(64)),e=>e.code==='42501');
});
test('a lost provider response without checkout_id also stays reserved after TTL',async()=>{
  await reserve(C,'c'.repeat(64));
  await db.query(`update public.${prefix}payment_intents set expires_at=statement_timestamp()-interval '1 hour' where user_id=$1`,[C]);
  assert.equal(await scalar(`select checkout_id is null as value from public.${prefix}payment_intents where user_id=$1`,[C]),true);
  await assert.rejects(reserve(C,'f'.repeat(64)),e=>e.code==='42501');
});
test('queued trial starts issue exactly one server-controlled trial',async()=>{
  await db.exec('set role authenticated');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[C]);
    const results=await Promise.all([scalar(`select public.${prefix}start_trial() as value`),scalar(`select public.${prefix}start_trial() as value`)]);
    assert.equal(results.filter(r=>r.error===null&&r.trial_started_at).length,1);
    assert.equal(results.filter(r=>r.error==='trial_already_used').length,1);
  } finally {await db.exec('reset role');}
});
test('another account cannot consume the reserved intent',async()=>{
  await reserve(B,'7'.repeat(64));
  await assert.rejects(rpc(prefix+'payment_commit_snapshot',{
    p_mode:'test',p_key:'e'.repeat(64),p_event:'subscription_created',p_object:'500',p_user:B,p_revision:0,p_intent_hash:'a'.repeat(64),
    p_subscription:'500',p_customer:'600',p_order:'700',p_store:'1',p_product:'3',p_variant:'2',p_tier:'family',p_billing:'monthly',p_state:{},
  }),e=>e.code==='42501');
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_bindings where subscription_id='500'`),0);
});
test('retention blocks deletion of unresolved checkout without erasing trial history',async()=>{
  await db.query(`insert into public.${prefix}subscriptions(user_id,trial_used,trial_started_at) values($1,true,statement_timestamp()-interval '1 day')`,[A]);
  await assert.rejects(db.query('delete from auth.users where id=$1',[A]),e=>e.code==='42501');
  assert.equal(await scalar(`select trial_used as value from public.${prefix}subscriptions where user_id=$1`,[A]),true);
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_intents where user_id=$1`,[A]),1);
});
test('authenticated users cannot enable billing, read private intents, or invoke reserve',async()=>{
  await db.exec('set role authenticated');
  try {
    await assert.rejects(db.exec(`update public.${prefix}payment_environment set checkouts_enabled=true`),e=>e.code==='42501');
    await assert.rejects(db.exec(`select * from public.${prefix}payment_intents`),e=>e.code==='42501');
    await assert.rejects(reserve(B,'f'.repeat(64)),e=>e.code==='42501');
  } finally {await db.exec('reset role');}
});
test('mode mismatch is denied by the database',async()=>{
  await assert.rejects(rpc(prefix+'payment_snapshot',{p_mode:'live',p_subscription:null,p_order:null,p_intent_hash:null,p_user:A}),e=>e.code==='42501');
});
test('a valid own intent cannot claim another account provider customer',async()=>{
  await rpc(prefix+'payment_ready_intent',{p_mode:'test',p_hash:'7'.repeat(64),p_checkout:'401'});
  await assert.rejects(rpc(prefix+'payment_commit_snapshot',{
    p_mode:'test',p_key:'9'.repeat(64),p_event:'subscription_created',p_object:'501',p_user:B,p_revision:0,p_intent_hash:'7'.repeat(64),
    p_subscription:'501',p_customer:'6',p_order:'701',p_store:'1',p_product:'3',p_variant:'2',p_tier:'family',p_billing:'monthly',p_state:{},
  }),e=>e.code==='42501');
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_bindings where subscription_id='501'`),0);
});
test('historical provider customer ownership stays private and immutable',async()=>{
  assert.equal(await scalar(`select user_id::text as value from public.${prefix}payment_customer_owners where mode='test' and customer_id='6'`),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await assert.rejects(db.exec(`update public.${prefix}payment_bindings set customer_id='999' where mode='test' and subscription_id='110'`),e=>e.code==='42501');
  for(const role of ['anon','authenticated','service_role']) {
    assert.equal(await scalar(`select has_table_privilege($1,'public.${prefix}payment_customer_owners','SELECT') as value`,[role]),false);
    assert.equal(await scalar(`select has_function_privilege($1,'public.${prefix}guard_customer_owner()','EXECUTE') as value`,[role]),false);
  }
});
test('an ambiguous legacy paid claim without provider IDs cannot create new checkout',async()=>{
  const legacy='10000000-0000-4000-8000-000000000004';
  await db.query('insert into auth.users(id) values($1)',[legacy]);
  await db.query(`insert into public.${prefix}subscriptions(user_id,tier,status) values($1,'family','active')`,[legacy]);
  await assert.rejects(reserve(legacy,'0'.repeat(64)),e=>e.code==='42501');
  assert.equal(await scalar(`select count(*)::int as value from public.${prefix}payment_intents where user_id=$1`,[legacy]),0);
  assert.equal(await scalar(`select tier as value from public.${prefix}subscriptions where user_id=$1`,[legacy]),'family');
});
