// Real request handlers + fake auth/RPC/provider. Network guard is mandatory in CI.
// Real database verdicts and privileges are checked separately in ai-entitlement-security.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler as coach } from '../supabase/functions/app_11941c8fec_ai_life_coach/handler.ts';
import { createHandler as search } from '../supabase/functions/app_11941c8fec_ai_search/handler.ts';
import { createHandler as receipt } from '../supabase/functions/app_11941c8fec_receipt_scan/handler.ts';
import { createHandler as savings } from '../supabase/functions/app_11941c8fec_savings_tips/handler.ts';

const sensitive='PRIVATE_KEY_FINANCIAL_DATA_DO_NOT_LOG';
const cases=[
  {name:'coach',create:coach,body:{message:'Help with my goal',goals:[]},reply:'A short helpful tip.',field:'reply'},
  {name:'search',create:search,body:{query:'groceries',data:{}},reply:JSON.stringify({results:[{type:'Finance',title:'Groceries',description:'An own item',icon:'x'}]}),field:'results'},
  {name:'receipt',create:receipt,body:{imageBase64:'Zml4dHVyZQ==',mimeType:'image/png'},reply:JSON.stringify({isReceipt:true,storeName:'Fixture shop',date:null,items:[{name:'Item',amount:1}],total:1}),field:'storeName'},
  {name:'savings',create:savings,body:{challenges:[{title:'Fixture goal',progress:10,savedAmount:1,targetAmount:10}]},reply:'A short saving tip.',field:'tip'},
];
function fixture(c) {
  const calls=[],logs=[];
  const d={
    user:async token=>{calls.push(['auth',token]);return token==='user-token'?{id:'own-user'}:null;},
    entitled:async token=>{calls.push(['rpc',token]);return true;},
    key:()=>{calls.push(['key']);return sensitive;},
    fetch:async(url,init)=>{calls.push(['provider',url,JSON.parse(init.body)]);return Response.json({content:[{text:c.reply}]});},
    log:entry=>logs.push(entry),
  };
  return {d,calls,logs};
}
function request(c,extra={},authorization='Bearer user-token') {
  return new Request('https://isolated.invalid/ai',{method:'POST',headers:{...(authorization?{Authorization:authorization}:{}),'Content-Type':'application/json'},body:JSON.stringify({...c.body,...extra})});
}
const providerCalls=f=>f.calls.filter(x=>x[0]==='provider').length;
const assertNoProvider=f=>{assert.equal(providerCalls(f),0);assert.equal(f.calls.some(x=>x[0]==='key'),false);};

for(const c of cases) {
  for(const state of ['free','expired','cancelled_after_end','past_due_without_paid_proof','legacy_raw_tier']) {
    test(`${c.name}: database denies ${state} before key access, provider or savings fallback`,async()=>{
      const f=fixture(c);f.d.entitled=async token=>{f.calls.push(['rpc',token]);return false;};
      const r=await c.create(f.d)(request(c,{tier:'family',status:'active',paid_access_until:'2099-01-01',user_id:'victim',entitled:true}));
      assert.equal(r.status,403);assertNoProvider(f);assert.deepEqual(f.calls,[['auth','user-token'],['rpc','user-token']]);
      assert.equal(r.headers.get('Cache-Control'),'no-store');
    });
  }
  for(const state of ['active_trial','verified_balanced','verified_family','cancelled_with_valid_paid_period','past_due_with_independent_valid_paid_period']) {
    test(`${c.name}: database permits ${state} and invokes the authorized operation once`,async()=>{
      const f=fixture(c);const r=await c.create(f.d)(request(c));
      assert.equal(r.status,200);assert.ok((await r.json())[c.field]);assert.equal(providerCalls(f),1);
      assert.deepEqual(f.calls.slice(0,2),[['auth','user-token'],['rpc','user-token']]);
      assert.equal(f.calls[2][0],'key');assert.equal(f.calls[3][1],'https://api.anthropic.com/v1/messages');
    });
  }
  for(const bad of [null,undefined,'true',1,{allowed:true},{tier:'family'}]) {
    test(`${c.name}: malformed RPC response ${JSON.stringify(bad)} fails closed`,async()=>{
      const f=fixture(c);f.d.entitled=async()=>bad;
      const r=await c.create(f.d)(request(c));assert.equal(r.status,503);assertNoProvider(f);
    });
  }
  test(`${c.name}: unavailable database, missing RPC or RPC permission failure never calls AI`,async()=>{
    for(const detail of ['database offline','function missing','permission denied']) {
      const f=fixture(c);f.d.entitled=async()=>{throw new Error(detail+sensitive);};
      const r=await c.create(f.d)(request(c));assert.equal(r.status,503);assertNoProvider(f);
      const output=JSON.stringify([await r.json(),f.logs]);assert.equal(output.includes(sensitive),false);assert.equal(output.includes(detail),false);
    }
  });
  test(`${c.name}: missing/malformed/forged auth cannot reach the entitlement RPC`,async()=>{
    for(const authorization of ['', 'Basic user-token','Bearer forged','Bearer two tokens']) {
      const f=fixture(c);const r=await c.create(f.d)(request(c,{},authorization));
      assert.equal(r.status,401);assertNoProvider(f);assert.equal(f.calls.some(x=>x[0]==='rpc'),false);
    }
  });
  test(`${c.name}: auth outage fails closed without logging the exception`,async()=>{
    const f=fixture(c);f.d.user=async()=>{throw new Error(sensitive);};
    const r=await c.create(f.d)(request(c));assert.equal(r.status,503);assertNoProvider(f);
    assert.equal(JSON.stringify([await r.json(),f.logs]).includes(sensitive),false);
  });
  test(`${c.name}: provider failure/exception never exposes raw errors or financial data`,async()=>{
    for(const mode of ['http','exception']) {
      const f=fixture(c);f.d.fetch=async()=>{f.calls.push(['provider']);if(mode==='exception')throw new Error(sensitive);return new Response(sensitive,{status:429});};
      const r=await c.create(f.d)(request(c));assert.equal(r.status,c.name==='savings'?200:mode==='http'?502:500);
      assert.equal(providerCalls(f),1);assert.equal(JSON.stringify([await r.json(),f.logs]).includes(sensitive),false);
      assert.equal(JSON.stringify(f.logs).includes('own-user'),false);
    }
  });
  test(`${c.name}: preflight and invalid methods do not touch auth, database or AI`,async()=>{
    for(const [method,status] of [['OPTIONS',204],['GET',405]]) {
      const f=fixture(c);const r=await c.create(f.d)(new Request('https://isolated.invalid/ai',{method}));
      assert.equal(r.status,status);assert.deepEqual(f.calls,[]);
    }
  });
  test(`${c.name}: a failing log sink cannot permit an unauthorized request`,async()=>{
    const f=fixture(c);f.d.log=()=>{throw new Error(sensitive);};f.d.entitled=async()=>{throw new Error(sensitive);};
    const r=await c.create(f.d)(request(c));assert.equal(r.status,503);assertNoProvider(f);
    assert.equal((await r.text()).includes(sensitive),false);
  });
}
for(const c of cases.filter(x=>['search','receipt'].includes(x.name))) {
  test(`${c.name}: malformed provider content is never copied into error logs/responses`,async()=>{
    for(const text of [sensitive,JSON.stringify({private:sensitive})]) {
      const f=fixture(c);f.d.fetch=async()=>Response.json({content:[{text}]});
      const r=await c.create(f.d)(request(c));assert.equal(r.status,c.name==='receipt'?200:502);
      assert.equal(JSON.stringify([await r.json(),f.logs]).includes(sensitive),false);
    }
  });
}
