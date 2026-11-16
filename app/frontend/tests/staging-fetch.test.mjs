import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingFetch } from '../src/lib/stagingFetch.ts';
test('staging guard blocks production, lookalikes and external origins before transport', async () => {
 let calls=0;
 const guarded=stagingFetch('https://stagingfixture.supabase.co',async (input,init)=>{calls++;assert.equal(init.redirect,'error');return new Response('ok')});
 for(const url of ['https://nyhsnvjdgifphwkqzwel.supabase.co/rest/v1/a','https://stagingfixture.supabase.co.evil.example','https://amanahlife.lemonsqueezy.com','http://stagingfixture.supabase.co']) assert.throws(()=>guarded(url),/Blocked/);
 assert.equal(calls,0);
 await guarded('https://stagingfixture.supabase.co/rest/v1/a',{redirect:'follow'});
 assert.equal(calls,1);
});
