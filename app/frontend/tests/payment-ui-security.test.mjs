import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { readdirSync } from 'node:fs';
import { paymentEnvironment } from '../src/lib/paymentEnvironment.ts';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../public/landing.html');
const catalog=JSON.parse(read('../public/payment-catalog.json'));
for(const settings of [{},{mode:'test'},{mode:'invalid',project:'https://test.example',anonKey:'offline'},
  {mode:'test',project:'https://nyhsnvjdgifphwkqzwel.supabase.co',anonKey:'offline'},
  {mode:'test',project:'http://test.example',anonKey:'offline'},
  {mode:'test',project:'https://user:pass@test.example',anonKey:'offline'}]) {
  test('frontend fails closed on incomplete or mixed environment: '+JSON.stringify(Object.keys(settings)),()=>{
    assert.equal(paymentEnvironment(settings),null);
  });
}
test('frontend uses the explicit authentication project and test-only function',()=>{
  const env=paymentEnvironment({mode:'test',project:'https://isolated.example',anonKey:'offline'});
  assert.equal(env.endpoint,'https://isolated.example/functions/v1/app_11941c8fec_lemonsqueezy_checkout_test');
  assert.equal(env.project,'https://isolated.example');
});
test('landing paid CTAs only navigate to bounded app offers, never provider checkout',()=>{
  assert.doesNotMatch(html,/PASTE_URL_HERE|checkout\/buy|checkout\[custom\]|window\.LemonSqueezy/);
  const fn=/function handleCheckout\(plan\) \{[\s\S]*?\n\}/.exec(html)?.[0];assert.ok(fn);
  for(const plan of ['balanced','family'])for(const isYearly of [false,true]) {
    const location={href:''};
    const context=vm.createContext({window:{top:{location}},isYearly});
    vm.runInContext(fn,context);context.handleCheckout(plan);
    assert.equal(location.href,'/subscription?offer='+plan+'_'+(isYearly?'yearly':'monthly'));
    location.href='';context.handleCheckout('https://attacker.invalid');assert.equal(location.href,'');
  }
});
test('all inline landing scripts remain syntactically valid',()=>{
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if(!/application\/ld\+json/.test(match[1]))assert.doesNotThrow(()=>new vm.Script(match[2]));
  }
});
test('one indicative catalog supplies annual totals; unverified promotion stays hidden',()=>{
  assert.equal(catalog.verification,'UNVERIFIED');assert.equal(catalog.promotion.verified,false);
  for(const offer of ['balanced','family'])for(const interval of ['monthly','yearly'])assert.ok(Number.isSafeInteger(catalog.prices[offer][interval])&&catalog.prices[offer][interval]>0);
  for(const p of ['../src/pages/Subscription.tsx','../src/pages/PricingPage.tsx','../src/components/PromoBanner.tsx'])assert.match(read(p),/lib\/paymentCatalog/);
  assert.match(html,/fetch\('\/payment-catalog.json'/);
  assert.match(read('../src/components/PromoBanner.tsx'),/!catalog.promotion.verified/);
});
test('frontend function requests have no implicit hosted-project endpoint',()=>{
  const src=new URL('../src/',import.meta.url);
  for(const name of readdirSync(src,{recursive:true}))if(/\.tsx?$/.test(name)) {
    assert.doesNotMatch(readFileSync(new URL(name,src),'utf8'),/https:\/\/nyhsnvjdgifphwkqzwel\.supabase\.co\/functions\//,name);
  }
});
