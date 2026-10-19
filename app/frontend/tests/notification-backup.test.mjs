import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationBackupColumns, notificationRestoreRow } from '../src/lib/notificationBackup.ts';
const keys = ['prayer_reminders','bill_reminders','habit_reminders','fasting_reminders','savings_reminders','general_activity'];
test('legacy preference backup preserves six false values but strips identity, timestamps, markers and privileges', () => {
 const raw = { ...Object.fromEntries(keys.map(k=>[k,false])), user_id:'foreign',id:'old',updated_at:'old',last_suhoor_sent_date:'2099',role:'admin',tier:'family',auth_key:'fixture-only' };
 assert.deepEqual(notificationRestoreRow(raw,'actor'),{...Object.fromEntries(keys.map(k=>[k,false])),user_id:'actor'});
});
test('location-only backup remains compatible and city extras are removed', () => {
 const city={name:'Fixture',nameAr:'Fixture',country:'Fixture',countryCode:'XX',lat:21,lon:39,token:'not-restored'};
 assert.deepEqual(notificationRestoreRow({timezone:'UTC',language:'ar',prayer_calc_method:'UmmAlQura',prayer_location_mode:'manual',prayer_manual_city:city},'actor'),
 {timezone:'UTC',language:'ar',prayer_calc_method:'UmmAlQura',prayer_location_mode:'manual',prayer_manual_city:{name:'Fixture',nameAr:'Fixture',country:'Fixture',countryCode:'XX',lat:21,lon:39},user_id:'actor'});
});
test('invalid types cannot become preference flags or leak internal fields', () => {
 assert.deepEqual(notificationRestoreRow({bill_reminders:'false',habit_reminders:false,prayer_manual_city:{lat:999},updated_at:'old'},'actor'),{habit_reminders:false,user_id:'actor'});
});
test('empty and forbidden-only backups are rejected before any storage call', () => {
 for(const raw of [null,[],{}, {user_id:'foreign',last_iftar_sent_date:'old',endpoint:'fixture'}])assert.throws(()=>notificationRestoreRow(raw,'actor'));
 assert.throws(()=>notificationRestoreRow({bill_reminders:false},''));
});
test('two account restore rows derive different targets; old backup identity is discarded', () => {
 const raw={user_id:'A',bill_reminders:false};
 assert.equal(notificationRestoreRow(raw,'A').user_id,'A');
 assert.equal(notificationRestoreRow(raw,'B').user_id,'B');
});
test('clearing a manual location remains possible without clearing unrelated flags', () => {
 assert.deepEqual(notificationRestoreRow({prayer_location_mode:'auto',prayer_manual_city:null},'actor'),{prayer_location_mode:'auto',prayer_manual_city:null,user_id:'actor'});
});
test('export contract contains only supported flags and location, never device registrations or internal markers', () => {
 assert.equal(notificationBackupColumns.length,11);
 for(const key of ['user_id','id','updated_at','last_iftar_sent_date','last_suhoor_sent_date','endpoint','p256dh','auth_key','tier'])assert.equal(notificationBackupColumns.includes(key),false);
});

