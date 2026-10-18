-- Disposable CI fixture only. Never run this against a Supabase project.
\set ON_ERROR_STOP on
do $$ begin
 if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then raise exception 'Isolated fixture required'; end if;
end $$;
select public.fixture_assert((select count(*)=2 from public.app_11941c8fec_notification_preferences),'HTTP tests created/deleted preference rows');
select public.fixture_assert((select bool_and(
 last_suhoor_sent_date=case when user_id='11111111-1111-4111-8111-111111111111' then date '2026-01-01' else date '2026-01-02' end
 and last_iftar_sent_date is null and created_at=updated_at)
 from public.app_11941c8fec_notification_preferences),'HTTP tests changed server-owned markers/timestamps');
select public.fixture_assert((select bool_and(
 bill_reminders=case when user_id='11111111-1111-4111-8111-111111111111' then false else true end
 and language=case when user_id='11111111-1111-4111-8111-111111111111' then 'ar' else 'en' end
 and timezone='UTC' and prayer_location_mode is null and prayer_manual_city is null
 and prayer_reminders and habit_reminders and fasting_reminders and savings_reminders and general_activity)
 from public.app_11941c8fec_notification_preferences),'HTTP cleanup failed to restore original preferences');
select public.fixture_assert((select count(*)=2 and bool_and(
 endpoint=case when user_id='11111111-1111-4111-8111-111111111111' then 'https://fixture.invalid/A' else 'https://fixture.invalid/B' end
 and p256dh=case when user_id='11111111-1111-4111-8111-111111111111' then 'fixture-key-A' else 'fixture-key-B' end
 and auth_key=case when user_id='11111111-1111-4111-8111-111111111111' then 'fixture-auth-A' else 'fixture-auth-B' end)
 from public.app_11941c8fec_push_subscriptions),'HTTP tests changed push registrations');
