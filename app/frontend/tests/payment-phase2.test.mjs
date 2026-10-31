import test from 'node:test';
import assert from 'node:assert/strict';
import { checkout, configuration } from '../supabase/functions/_shared/lemonPayments.ts';
import { assertPaymentProject } from '../supabase/functions/_shared/paymentRuntimePolicy.ts';
import { createAiHandler } from '../supabase/functions/_shared/aiAccess.ts';

const c={mode:'test',apiKey:'offline',secret:'offline',store:'1',origin:'https://test.example',offers:{},refundPolicy:'review_keep_current'};
const request=body=>new Request('https://offline.invalid',{method:'POST',headers:{Authorization:'Bearer offline'},body:JSON.stringify(body)});
function dependencies(state={}) {
  const calls=[];
  return {calls,d:{
    user:async()=>({id:'synthetic-account',email:'fixture@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z'}),
    rpc:async(name)=>{calls.push(name);return{data:state,error:null};},
    fetch:async()=>{throw Error('Unexpected provider call');},
  }};
}
for (const enabled of [undefined,false]) test('new checkout fails closed without explicit approval: '+enabled,async()=>{
  const {d,calls}=dependencies();
  const response=await checkout(request({offer:'family_monthly'}),{...c,checkoutEnabled:enabled},d);
  assert.equal(response.status,503);
  assert.equal(calls.some(n=>n.endsWith('_reserve_checkout')),false);
  assert.equal((await response.text()).includes('offline'),false);
});
test('portal is not mislabeled no_subscription by a storage failure',async()=>{
  const {d}=dependencies();d.rpc=async()=>({data:null,error:{message:'PRIVATE_STORAGE_ERROR'}});
  const r=await checkout(request({action:'manage'}),c,d);
  assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/PRIVATE_STORAGE_ERROR|no_subscription/);
});
test('verified portal access survives pausing new checkouts',async()=>{
  const {d,calls}=dependencies({subscription_id:'10',customer_id:'6'});
  d.fetch=async()=>Response.json({data:{type:'subscriptions',id:'10',attributes:{test_mode:true,store_id:1,customer_id:6,urls:{customer_portal:'https://test.lemonsqueezy.com/portal/fixture'}}}});
  const r=await checkout(request({action:'manage'}),{...c,checkoutEnabled:false},d);
  assert.equal(r.status,200);assert.equal((await r.json()).url,'https://test.lemonsqueezy.com/portal/fixture');
  assert.equal(calls.some(n=>n.endsWith('_reserve_checkout')),false);
});
test('an unverified discount is rejected before any provider operation',async()=>{
  const {d}=dependencies();
  const r=await checkout(request({offer:'family_monthly',discountCode:'AMANAH30'}),{...c,checkoutEnabled:true},d);
  assert.equal(r.status,409);
});
test('a runtime discount flag cannot override the unverified shared catalog',async()=>{
  const {d}=dependencies();
  const r=await checkout(request({offer:'balanced_monthly',discountCode:'AMANAH30'}),{...c,checkoutEnabled:true,discountVerified:true},d);
  assert.equal(r.status,409);
});
test('payment configuration has no implicit checkout or discount approval',()=>{
  const settings={API_KEY:'offline',WEBHOOK_SECRET:'offline',STORE_ID:'1',APP_ORIGIN:'https://test.example',BALANCED_PRODUCT_ID:'2',FAMILY_PRODUCT_ID:'3',BALANCED_MONTHLY_VARIANT_ID:'10',BALANCED_YEARLY_VARIANT_ID:'11',FAMILY_MONTHLY_VARIANT_ID:'12',FAMILY_YEARLY_VARIANT_ID:'13'};
  const config=configuration(k=>settings[k.replace('AMANAHLIFE_LS_TEST_','')],'test');
  assert.equal(config.checkoutEnabled,false);assert.equal(config.discountVerified,false);
});
for(const input of [undefined,'http://test.example','https://user:pass@test.example','https://test.example/path','https://test.example/?x=1','https://nyhsnvjdgifphwkqzwel.supabase.co']) {
  test('test service rejects missing/unsafe/project context '+String(input?.includes('nyhsnv')?'hosted':input?.split(':')[0]),()=>{
    assert.throws(()=>assertPaymentProject('test',input));
  });
}
test('explicit separate HTTPS test project is accepted',()=>{
  assert.equal(assertPaymentProject('test','https://isolated-test.example'),'https://isolated-test.example');
});
for(const origin of ['https://isolated.example','http://isolated.example','https://isolated.example/path']) {
  test('AI CORS admits only an explicitly configured HTTPS origin: '+origin.split(':')[0],async()=>{
    const handler=createAiHandler(async(_,ctx)=>new Response('{}',{headers:ctx.corsHeaders}),{
      origin,user:async()=>({id:'offline'}),entitled:async()=>true,key:()=>undefined,fetch:async()=>{throw Error('No network');},
    });
    const r=await handler(new Request('https://offline.invalid',{method:'POST',headers:{Origin:origin,Authorization:'Bearer offline'}}));
    assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin==='https://isolated.example'?origin:'https://app.amanahlife.com');
  });
}
