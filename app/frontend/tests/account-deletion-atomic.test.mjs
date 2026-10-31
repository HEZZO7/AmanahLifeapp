// OFFLINE: the actual Edge adapter/handler with a fake SDK and transaction model.
// The model is NOT PostgreSQL/Auth execution or proof of database rollback.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const tables=['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions'];
const entry=new URL('../supabase/functions/app_11941c8fec_delete_account/index.ts',import.meta.url).href;
const previous={Deno:globalThis.Deno,sdk:globalThis.__atomicDeletionSDK};
let active,handler;
globalThis.__atomicDeletionSDK=(...args)=>active.client(...args);
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_ANON_KEY:'offline-anon',SUPABASE_SERVICE_ROLE_KEY:'offline-service'}[key])},serve:fn=>{assert.equal(handler,undefined);handler=fn;}};
const fake='data:text/javascript,'+encodeURIComponent('export const createClient=(...args)=>globalThis.__atomicDeletionSDK(...args);');
const hook=registerHooks({resolve(specifier,context,next){
  if(context.parentURL===entry&&specifier==='https://esm.sh/@supabase/supabase-js@2')return{url:fake,shortCircuit:true};
  if(/^https?:/.test(specifier))throw Error('Offline module download prohibited');
  return next(specifier,context);
}});
try{await import(entry);}finally{hook.deregister();}
after(()=>{
  if(previous.Deno===undefined)delete globalThis.Deno;else globalThis.Deno=previous.Deno;
  if(previous.sdk===undefined)delete globalThis.__atomicDeletionSDK;else globalThis.__atomicDeletionSDK=previous.sdk;
});

function fixture(options={}){
  let db={users:{[A]:true,[B]:true},rows:Object.fromEntries(tables.map(t=>[t,{
    [A]:t==='subscriptions'?{user_id:A,trial_used:true,trial_started_at:'2026-10-01T00:00:00Z',tier:'free',id:'original-trial'}:{user_id:A,value:'original'},
    [B]:{user_id:B,value:'other-account'},
  }])),billing:{[B]:{paid:true,proof:'untouched'}}};
  const calls=[],visited=[];
  if(options.billed)db.billing[A]={paid:true,proof:'retained-paid-period'};
  const f={calls,visited,snapshot:()=>structuredClone(db),
    client(url,key){
      assert.equal(url,'http://127.0.0.1:54321');assert.ok(['offline-anon','offline-service'].includes(key));
      return {
        from(){calls.push('forbidden-pre-cleanup');throw Error('HTTP data cleanup must not execute');},
        rpc:async(name,args)=>{
          assert.equal(key,'offline-service');
          calls.push(name);
          if(name.endsWith('_deletion_ready'))return{data:options.ready??true,error:null};
          if(name.endsWith('_deletion_allowed')){assert.equal(args.p_user,A);return{data:!db.billing[A],error:null};}
          throw Error('Unexpected RPC');
        },
        auth:{getUser:async token=>{assert.equal(key,'offline-anon');calls.push('authenticate');return{data:{user:token==='synthetic-token'?{id:A}:null},error:token==='synthetic-token'?null:{message:'invalid'}};},
          admin:{getUserById:async user=>{
            assert.equal(user,A);calls.push('confirm-absence');
            return db.users[user]?{data:{user:{id:user}},error:null}
              :{data:{user:null},error:{status:404,code:'user_not_found'}};
          },deleteUser:async(user,soft)=>{
            assert.equal(key,'offline-service');
            calls.push('auth-delete');assert.equal(user,A);assert.equal(soft,false);
            if(options.billingRace)db.billing[A]={paid:false,pendingCheckout:true};
            if(db.billing[A])return{error:{message:'SIMULATED_BILLING_GUARD'}};
            const draft=structuredClone(db);
            try{
              if(options.fail==='before-cleanup')throw Error('SIMULATED_PRIVATE_DETAIL');
              for(const t of tables){delete draft.rows[t][A];visited.push(t);if(options.fail===t)throw Error('SIMULATED_PRIVATE_DETAIL');}
              delete draft.users[A];
              if(options.fail==='after-auth')throw Error('SIMULATED_PRIVATE_DETAIL');
              db=draft;
              if(options.fail==='response-after-commit')throw Error('SIMULATED_PRIVATE_DETAIL');
              return{data:{},error:null};
            }catch{return{error:{message:'SIMULATED_PRIVATE_DETAIL'}};}
          }},
        },
      };
    },
    // Contract-only trial model. The separate SQL regression calls the real RPC.
    trialAgain(){return db.rows.subscriptions[A]?.trial_used?{error:'trial_already_used'}:{error:null};},
  };
  active=f;return f;
}
const request=(body={},token='synthetic-token')=>new Request('http://127.0.0.1:54321/functions/v1/delete',{
  method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body),
});

for(const point of ['before-cleanup',...tables,'after-auth']){
  test('real adapter preserves full trial/history under a modeled transaction failure: '+point,async()=>{
    const f=fixture({fail:point}),before=f.snapshot();
    const response=await handler(request({user_id:B,trial_used:false}));
    assert.equal(response.status,503);assert.equal(f.calls.includes('forbidden-pre-cleanup'),false);
    assert.equal(f.calls.filter(x=>x==='auth-delete').length,1);
    if(tables.includes(point))assert.equal(f.visited.at(-1),point);
    if(point==='after-auth')assert.deepEqual(f.visited,tables);
    assert.deepEqual(f.snapshot(),before);
    assert.deepEqual(f.trialAgain(),{error:'trial_already_used'});
    const body=await response.json();assert.equal(body.code,'account_deletion_unconfirmed');
    assert.equal(body.error.includes('SIMULATED_PRIVATE_DETAIL'),false);
  });
}
test('actual adapter success touches only the authenticated account and hard-deletes once',async()=>{
  const f=fixture(),before=f.snapshot();const response=await handler(request({user_id:B}));
  assert.equal(response.status,200);assert.equal(f.snapshot().users[A],undefined);
  for(const t of tables)assert.deepEqual(f.snapshot().rows[t][B],before.rows[t][B]);
  assert.deepEqual(f.snapshot().billing,before.billing);assert.deepEqual(f.visited,tables);
  assert.equal(f.calls.includes('forbidden-pre-cleanup'),false);
});
test('missing readiness prevents any destructive Auth call',async()=>{
  const f=fixture({ready:false}),before=f.snapshot();assert.equal((await handler(request())).status,503);
  assert.equal(f.calls.includes('auth-delete'),false);assert.deepEqual(f.snapshot(),before);
});
test('actual adapter rejects an invalid identity before any service request',async()=>{
  const f=fixture(),before=f.snapshot();assert.equal((await handler(request({},'invalid-token'))).status,401);
  assert.deepEqual(f.calls,['authenticate']);assert.deepEqual(f.snapshot(),before);
});
test('actual adapter never deletes an account with verified billing history',async()=>{
  const f=fixture({billed:true}),before=f.snapshot();assert.equal((await handler(request())).status,409);
  assert.equal(f.calls.includes('auth-delete'),false);assert.deepEqual(f.snapshot(),before);
});
test('a modeled checkout committed after the HTTP billing check is denied by the DB boundary',async()=>{
  const f=fixture({billingRace:true}),before=f.snapshot();assert.equal((await handler(request())).status,503);
  assert.deepEqual(f.snapshot().rows,before.rows);assert.equal(f.snapshot().users[A],true);
  assert.equal(f.snapshot().billing[A].pendingCheckout,true);assert.deepEqual(f.visited,[]);
});
test('lost post-commit response does not cause an automatic retry or a false not-deleted claim',async()=>{
  const f=fixture({fail:'response-after-commit'});const r=await handler(request());const body=await r.json();
  assert.equal(r.status,503);assert.equal(f.snapshot().users[A],undefined);
  assert.equal(f.calls.filter(x=>x==='auth-delete').length,1);assert.match(body.error,/could not be confirmed/);
  assert.doesNotMatch(body.error,/Account not deleted/);
});
test('Migration 009 contract retains 008 and scopes atomic cleanup without exception swallowing',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/202610210009_atomic_account_deletion.sql',import.meta.url),'utf8');
  const cleanup=sql.split('returns trigger language')[1].split('end $$;')[0];
  assert.match(cleanup,/tg_table_schema<>'auth'/);assert.match(cleanup,/tg_op<>'DELETE'/);
  assert.ok(cleanup.indexOf('account_deletion_allowed(old.id)')<cleanup.indexOf('delete from'));
  for(const t of tables)assert.ok(cleanup.includes('delete from public.app_11941c8fec_'+t+' where user_id=old.id;'));
  assert.equal((cleanup.match(/delete from/g)||[]).length,5);
  assert.doesNotMatch(cleanup,/exception\s+when|set_config|payment_.*delete|disable/i);
  assert.match(sql,/revoke delete on public\.app_11941c8fec_subscriptions from service_role/);
  assert.match(sql,/before delete on auth\.users/);assert.match(sql,/t\.tgqual is null/);
  assert.match(sql,/select count\(\*\)=5 from pg_constraint/);
  assert.match(sql,/k\.convalidated and not k\.condeferrable/);
  assert.equal((sql.match(/security definer set search_path=''/g)||[]).length,2);
  assert.equal((sql.match(/owner to postgres/g)||[]).length,2);
  assert.deepEqual(sql.match(/grant execute[^;]+;/g),['grant execute on function public.app_11941c8fec_account_deletion_ready() to service_role;']);
});
test('prepared SQL regression requires real cleanup failure, full restoration and the real trial RPC',()=>{
  const sql=readFileSync(new URL('./account-deletion-atomic-regression.sql',import.meta.url),'utf8');
  assert.match(sql,/after delete on auth\.users/);
  assert.match(sql,/if remains then raise exception.*errcode='ZX008'/);
  assert.match(sql,/Synthetic Auth failure after cleanup.*errcode='ZX009'/);
  assert.match(sql,/exception when sqlstate 'ZX009' then null/);
  assert.match(sql,/restored is distinct from saved->t/);
  assert.match(sql,/set local role authenticated/);
  assert.match(sql,/outcome:=public\.app_11941c8fec_start_trial\(\)/);
  assert.match(sql,/is distinct from 'trial_already_used'/);
  assert.match(sql,/actual is distinct from current_setting\('amanahlife.atomic_trial_snapshot'\)::jsonb/);
  assert.ok(sql.trim().endsWith('rollback;'));
});
