-- Isolated CI only. Every mutation below is rolled back.
\set ON_ERROR_STOP on
begin;
do $$ begin if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then raise exception 'Isolated fixture required'; end if; end $$;
select public.fixture_assert(
 (select preferences=(select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_notification_preferences p)
 and registrations=(select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_push_subscriptions p) from notification_before),
 'Migration changed existing notification data');
select public.fixture_assert(not exists(select 1 from pg_policy where polrelid in
 ('public.app_11941c8fec_notification_preferences'::regclass,'public.app_11941c8fec_push_subscriptions'::regclass)
 and 0=any(polroles)),'PUBLIC RLS policy remains');
-- Check the production-shaped schema rather than a user_id-primary-key model.
select public.fixture_assert((select a.attname='id' from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
 where i.indrelid='public.app_11941c8fec_notification_preferences'::regclass and i.indisprimary),'Preferences PK differs from production');
select public.fixture_assert((select count(*)=2 from pg_attribute where attrelid='public.app_11941c8fec_notification_preferences'::regclass
 and attname in ('last_suhoor_sent_date','last_iftar_sent_date') and atttypid='date'::regtype),'Reminder markers must be dates');
do $$ declare actor text; target text; begin
 if current_setting('server_version_num')::int >= 170000 then
  foreach actor in array array['anon','authenticated','service_role'] loop
   foreach target in array array['app_11941c8fec_notification_preferences','app_11941c8fec_push_subscriptions'] loop
    perform public.fixture_assert(not has_table_privilege(actor,'public.'||target,'MAINTAIN')
      and not has_table_privilege(actor,'public.'||target,'MAINTAIN WITH GRANT OPTION'),'Effective MAINTAIN remains');
   end loop;
  end loop;
 end if;
end $$;
set local role anon;
select public.fixture_expect_denied('select user_id from public.app_11941c8fec_notification_preferences');
select public.fixture_expect_denied('select endpoint,auth_key from public.app_11941c8fec_push_subscriptions');
select public.fixture_expect_denied('update public.app_11941c8fec_notification_preferences set bill_reminders=true');
select public.fixture_expect_denied('delete from public.app_11941c8fec_notification_preferences');
select public.fixture_expect_denied('truncate public.app_11941c8fec_notification_preferences');
select public.fixture_expect_denied('truncate public.app_11941c8fec_push_subscriptions');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select public.fixture_assert((select count(*)=0 from public.app_11941c8fec_notification_preferences),'Missing identity exposed rows');
select public.fixture_expect_denied('insert into public.app_11941c8fec_notification_preferences(user_id,bill_reminders) values(''11111111-1111-4111-8111-111111111111'',false)');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.fixture_assert((select count(*)=1 from public.app_11941c8fec_notification_preferences),'Own-only read failed');
select public.fixture_assert((select bill_reminders=false from public.app_11941c8fec_notification_preferences where user_id=auth.uid()),'Existing false flag lost');
select public.fixture_expect_denied('select last_suhoor_sent_date from public.app_11941c8fec_notification_preferences');
select public.fixture_expect_denied('select auth_key from public.app_11941c8fec_push_subscriptions');
select public.fixture_expect_denied('delete from public.app_11941c8fec_notification_preferences');
select public.fixture_expect_denied('truncate public.app_11941c8fec_notification_preferences');
select public.fixture_expect_denied('truncate public.app_11941c8fec_push_subscriptions');
select public.fixture_expect_denied('update public.app_11941c8fec_notification_preferences set user_id=''22222222-2222-4222-8222-222222222222''');
select public.fixture_expect_denied('update public.app_11941c8fec_notification_preferences set last_suhoor_sent_date=''2099-01-01''');
select public.fixture_expect_denied('update public.app_11941c8fec_notification_preferences set updated_at=now()');
select public.fixture_expect_denied('insert into public.app_11941c8fec_notification_preferences(user_id,bill_reminders) values(''22222222-2222-4222-8222-222222222222'',false)');
with changed as (update public.app_11941c8fec_notification_preferences set bill_reminders=false
 where user_id='22222222-2222-4222-8222-222222222222' returning user_id)
 select public.fixture_assert((select count(*)=0 from changed),'Foreign row was updated');
-- Exact location-sync upsert shape; no preference reset or internal-field write.
insert into public.app_11941c8fec_notification_preferences(user_id,timezone,language,prayer_calc_method,prayer_location_mode,prayer_manual_city)
 values(auth.uid(),'UTC','ar','UmmAlQura','manual','{"name":"Fixture","nameAr":"Fixture","country":"Fixture","countryCode":"XX","lat":21,"lon":39}')
 on conflict(user_id) do update set timezone=excluded.timezone,language=excluded.language,prayer_calc_method=excluded.prayer_calc_method,
 prayer_location_mode=excluded.prayer_location_mode,prayer_manual_city=excluded.prayer_manual_city;
-- Exact sanitized restore shape: own partial upsert; no DELETE and no metadata.
insert into public.app_11941c8fec_notification_preferences(user_id,bill_reminders) values(auth.uid(),true)
 on conflict(user_id) do update set bill_reminders=excluded.bill_reminders;
select public.fixture_assert((select bill_reminders=true and timezone='UTC' from public.app_11941c8fec_notification_preferences where user_id=auth.uid()),'Legitimate restore/location sync failed');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
insert into public.app_11941c8fec_notification_preferences(user_id,habit_reminders) values(auth.uid(),false);
select public.fixture_assert((select habit_reminders=false from public.app_11941c8fec_notification_preferences where user_id=auth.uid()),'First preference insert failed');
set local role service_role;
select public.fixture_assert((select count(*)=3 from public.app_11941c8fec_notification_preferences),'Service scheduler read failed');
select public.fixture_assert((select last_suhoor_sent_date='2026-01-01' from public.app_11941c8fec_notification_preferences where user_id='11111111-1111-4111-8111-111111111111'),'Client restore overwrote scheduler marker');
update public.app_11941c8fec_notification_preferences set last_iftar_sent_date='2026-01-03',updated_at=now() where user_id='11111111-1111-4111-8111-111111111111';
insert into public.app_11941c8fec_push_subscriptions(user_id,endpoint,p256dh,auth_key)
 values('33333333-3333-4333-8333-333333333333','https://fixture.invalid/C','fixture-key-C','fixture-auth-C')
 on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh;
update public.app_11941c8fec_push_subscriptions set updated_at=now() where user_id='11111111-1111-4111-8111-111111111111';
-- Existing unsubscribe/account-deletion capabilities remain server-only.
delete from public.app_11941c8fec_push_subscriptions where user_id='33333333-3333-4333-8333-333333333333';
delete from public.app_11941c8fec_notification_preferences where user_id='33333333-3333-4333-8333-333333333333';
select public.fixture_expect_denied('truncate public.app_11941c8fec_push_subscriptions');
rollback;

