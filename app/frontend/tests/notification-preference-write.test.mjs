import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createNotificationPreferenceWriter} from '../src/lib/notificationPreferenceWrite.ts';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const settings={method:'UmmAlQura',mode:'manual',city:{name:'Fixture',nameAr:'Fixture',country:'Fixture',countryCode:'XX',lat:21,lon:39},timezone:'UTC',language:'ar'};
const success=count=>({count,error:null});
function fixture(updates=[success(1)], inserts=[success(null)]) {
 const calls=[];let account=A;let authError=null;let afterUpdate=()=>{};
 const client={auth:{getSession:async()=>({data:{session:account?{access_token:'fixture-only',user:{id:account}}:null},error:authError})},
  from:table=>({
   update:(patch,options)=>({eq:async(column,value)=>{calls.push({method:'PATCH',table,patch,options,column,value});const r=updates.shift();afterUpdate();if(r instanceof Error)throw r;return r;}}),
   insert:async row=>{calls.push({method:'POST',table,row});const r=inserts.shift();if(r instanceof Error)throw r;return r;},
  })};
 return {writer:createNotificationPreferenceWriter(client),calls,setAccount:value=>{account=value;},setAuthError:value=>{authError=value;},afterUpdate:fn=>{afterUpdate=fn;}};
}
test('location PATCH has exact count, actor filter, five fields and no identity or RETURNING dependency',async()=>{
 const f=fixture();await f.writer.syncLocation(A,settings);assert.equal(f.calls.length,1);
 assert.deepEqual(f.calls[0],{method:'PATCH',table:'app_11941c8fec_notification_preferences',options:{count:'exact'},column:'user_id',value:A,
 patch:{prayer_calc_method:'UmmAlQura',prayer_location_mode:'manual',prayer_manual_city:settings.city,timezone:'UTC',language:'ar'}});
});
test('sanitized restore updates false flags and location without writing metadata or backup identity',async()=>{
 const f=fixture();await f.writer.restore(A,{user_id:B,id:'old',last_suhoor_sent_date:'2099',updated_at:'old',bill_reminders:false,timezone:'UTC',role:'admin'});
 assert.deepEqual(f.calls[0].patch,{bill_reminders:false,timezone:'UTC'});assert.equal(f.calls[0].value,A);
});
for(const flow of ['location','restore'])test(`${flow} first save uses plain own INSERT after a confirmed zero-row PATCH`,async()=>{
 const f=fixture([success(0)]);await (flow==='location'?f.writer.syncLocation(A,settings):f.writer.restore(A,{bill_reminders:false}));
 assert.deepEqual(f.calls.map(c=>c.method),['PATCH','POST']);assert.equal(f.calls[1].row.user_id,A);assert.equal('user_id' in f.calls[0].patch,false);
});
test('unique-insert race retries only the original partial PATCH once',async()=>{
 const f=fixture([success(0),success(1)],[{error:{code:'23505'}}]);await f.writer.restore(A,{habit_reminders:false});
 assert.deepEqual(f.calls.map(c=>c.method),['PATCH','POST','PATCH']);assert.deepEqual(f.calls[2].patch,{habit_reminders:false});
});
test('a second missing row after a unique race is failure, not silent success or an unbounded loop',async()=>{
 const f=fixture([success(0),success(0)],[{error:{code:'23505'}}]);await assert.rejects(f.writer.restore(A,{habit_reminders:false}));assert.equal(f.calls.length,3);
});
for(const count of [null,undefined,2])test(`unconfirmed update count ${count} fails without inserting`,async()=>{
 const f=fixture([success(count)]);await assert.rejects(f.writer.restore(A,{bill_reminders:false}));assert.equal(f.calls.length,1);
});
for(const code of ['42501','PGRST301','08006'])test(`PATCH ${code} does not fall through to INSERT`,async()=>{
 const f=fixture([{error:{code}}]);await assert.rejects(f.writer.syncLocation(A,settings));assert.equal(f.calls.length,1);
});
test('non-unique insert error rejects without retry or success',async()=>{
 const f=fixture([success(0)],[{error:{code:'42501'}}]);await assert.rejects(f.writer.restore(A,{bill_reminders:false}));assert.equal(f.calls.length,2);
});
for(const id of [null,B])test(`missing/mismatched SDK account ${id} blocks all writes`,async()=>{
 const f=fixture();f.setAccount(id);await assert.rejects(f.writer.restore(A,{bill_reminders:false}));assert.equal(f.calls.length,0);
});
test('Auth failure blocks all writes',async()=>{
 const f=fixture();f.setAuthError(new Error('private detail'));await assert.rejects(f.writer.restore(A,{bill_reminders:false}));assert.equal(f.calls.length,0);
});
test('account switch after a zero-row PATCH prevents INSERT under the new account',async()=>{
 const f=fixture([success(0)]);f.afterUpdate(()=>f.setAccount(B));await assert.rejects(f.writer.restore(A,{bill_reminders:false}));assert.equal(f.calls.length,1);
});
test('account switch after a successful PATCH cannot confirm a save for another account',async()=>{
 const f=fixture();f.afterUpdate(()=>f.setAccount(B));await assert.rejects(f.writer.syncLocation(A,settings));assert.equal(f.calls.length,1);
});
test('network/storage exceptions are redacted',async()=>{
 const f=fixture([new Error('PRIVATE_TOKEN_OR_FINANCIAL_DATA')]);await assert.rejects(f.writer.restore(A,{bill_reminders:false}),error=>!error.message.includes('PRIVATE_'));
});
test('invalid or forbidden-only backup cannot write',async()=>{
 const f=fixture();for(const raw of [{id:'old'},null,[],{bill_reminders:'false'}])await assert.rejects(f.writer.restore(A,raw));assert.equal(f.calls.length,0);
});
test('auto location clears only manual city and leaves reminder flags untouched',async()=>{
 const f=fixture();await f.writer.syncLocation(A,{...settings,mode:'auto'});assert.equal(f.calls[0].patch.prayer_manual_city,null);assert.equal('prayer_reminders' in f.calls[0].patch,false);
});
test('a rejected queued save does not poison a later retry; order remains stable',async()=>{
 const f=fixture([{error:{code:'08006'}},success(1)]);
 const first=f.writer.restore(A,{bill_reminders:false});const second=f.writer.restore(A,{bill_reminders:true});
 const r=await Promise.allSettled([first,second]);assert.equal(r[0].status,'rejected');assert.equal(r[1].status,'fulfilled');assert.deepEqual(f.calls.map(c=>c.patch.bill_reminders),[false,true]);
});
test('two SDK accounts have distinct filters and cannot replay backup identity',async()=>{
 const f=fixture([success(1),success(1)]);await f.writer.restore(A,{user_id:B,bill_reminders:false});f.setAccount(B);await f.writer.restore(B,{user_id:A,habit_reminders:false});
 assert.deepEqual(f.calls.map(c=>c.value),[A,B]);assert.deepEqual(f.calls.map(c=>c.patch),[{bill_reminders:false},{habit_reminders:false}]);
});
