-- Isolated fixture only. Real PostgreSQL RLS/column ACL assertions; not GoTrue.
-- All mutations roll back so existing payment/deletion assertions remain intact.
do $$ begin
 if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then
  raise exception 'Isolated fixture required';
 end if;
end $$;
begin;
select public.fixture_assert(
 (select preferences from notification_before) = (select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_notification_preferences p),
 '007 must preserve preference rows and scheduler markers');
select public.fixture_assert(
 (select registrations from notification_before) = (select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_push_subscriptions p),
 '007 must preserve device credentials');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.fixture_assert((select count(*)=1 from public.app_11941c8fec_notification_preferences),'own preference row only');
select public.fixture_assert((select count(*)=0 from public.app_11941c8fec_notification_preferences where user_id='22222222-2222-4222-8222-222222222222'),'cross-account SELECT denied');
update public.app_11941c8fec_notification_preferences set bill_reminders=false,timezone='Asia/Riyadh',language='ar',prayer_calc_method='UmmAlQura',prayer_location_mode='manual',
 prayer_manual_city='{"name":"Fixture","nameAr":"Fixture","country":"Fixture","countryCode":"SA","lat":21,"lon":39}'
 where user_id='11111111-1111-4111-8111-111111111111';
select public.fixture_assert((select timezone='Asia/Riyadh' and bill_reminders=false from public.app_11941c8fec_notification_preferences),'permitted field UPDATE succeeds');
update public.app_11941c8fec_notification_preferences set bill_reminders=false where user_id='22222222-2222-4222-8222-222222222222';
do $$ begin
 begin
  insert into public.app_11941c8fec_notification_preferences(user_id) values('33333333-3333-4333-8333-333333333333');
  raise exception 'Cross-account INSERT must fail';
 exception when insufficient_privilege then null; end;
 begin
  update public.app_11941c8fec_notification_preferences set user_id='11111111-1111-4111-8111-111111111111';
  raise exception 'UPDATE(user_id) must fail';
 exception when insufficient_privilege then null; end;
 begin
  update public.app_11941c8fec_notification_preferences set last_suhoor_sent_date='2099-01-01';
  raise exception 'Scheduler marker UPDATE must fail';
 exception when insufficient_privilege then null; end;
 begin
  update public.app_11941c8fec_notification_preferences set updated_at=now();
  raise exception 'Internal timestamp UPDATE must fail';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.app_11941c8fec_notification_preferences;
  raise exception 'SELECT * must fail';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.app_11941c8fec_notification_preferences;
  raise exception 'Preference DELETE must fail';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.app_11941c8fec_notification_preferences(user_id,bill_reminders)
   values('11111111-1111-4111-8111-111111111111',false)
   on conflict(user_id) do update set user_id=excluded.user_id,bill_reminders=excluded.bill_reminders;
  raise exception 'Legacy upsert requires forbidden UPDATE(user_id)';
 exception when insufficient_privilege then null; end;
 begin
  perform endpoint,p256dh,auth_key from public.app_11941c8fec_push_subscriptions;
  raise exception 'Client credential SELECT must fail';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.app_11941c8fec_push_subscriptions;
  raise exception 'Client device DELETE must fail';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select public.fixture_assert((select bill_reminders=true from public.app_11941c8fec_notification_preferences where user_id='22222222-2222-4222-8222-222222222222'),'other user remains unchanged');
select public.fixture_assert((select last_suhoor_sent_date='2026-01-01' from public.app_11941c8fec_notification_preferences where user_id='11111111-1111-4111-8111-111111111111'),'portable UPDATE preserves scheduler marker');
-- Exercise the missing-row INSERT path without changing Auth or trial history.
delete from public.app_11941c8fec_notification_preferences where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
insert into public.app_11941c8fec_notification_preferences(user_id,bill_reminders,timezone,language)
 values('11111111-1111-4111-8111-111111111111',false,'UTC','en');
select public.fixture_assert((select count(*)=1 from public.app_11941c8fec_notification_preferences),'missing own singleton INSERT succeeds');
reset role;
set local role anon;
do $$ begin
 begin
  perform bill_reminders from public.app_11941c8fec_notification_preferences;
  raise exception 'Anonymous preference SELECT must fail';
 exception when insufficient_privilege then null; end;
 begin
  perform endpoint from public.app_11941c8fec_push_subscriptions;
  raise exception 'Anonymous device SELECT must fail';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
