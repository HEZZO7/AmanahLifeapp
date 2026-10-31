-- Synthetic CI data only; never use against hosted projects.
\set ON_ERROR_STOP on
do $$ begin
 if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then raise exception 'Isolated fixture required'; end if;
end $$;
create table public.app_11941c8fec_notification_preferences(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id),
 prayer_reminders boolean default true,bill_reminders boolean default true,habit_reminders boolean default true,
 fasting_reminders boolean default true,savings_reminders boolean default true,general_activity boolean default true,
 timezone text not null default 'UTC',language text not null default 'en',
 prayer_calc_method text,prayer_location_mode text,prayer_manual_city jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 last_suhoor_sent_date date,last_iftar_sent_date date
);
create table public.app_11941c8fec_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 endpoint text not null,p256dh text not null,auth_key text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint)
);
alter table public.app_11941c8fec_notification_preferences enable row level security;
alter table public.app_11941c8fec_push_subscriptions enable row level security;
grant all on public.app_11941c8fec_notification_preferences,public.app_11941c8fec_push_subscriptions to anon,authenticated,service_role;
create policy service_role_all_prefs on public.app_11941c8fec_notification_preferences for all to public using(true) with check(true);
create policy service_role_all_subscriptions on public.app_11941c8fec_push_subscriptions for all to public using(true) with check(true);
-- Match the other six policies in the production metadata as well: the
-- permissive PUBLIC ALL policies above override these ownership restrictions.
create policy users_insert_own_prefs on public.app_11941c8fec_notification_preferences for insert to authenticated with check(auth.uid()=user_id);
create policy users_read_own_prefs on public.app_11941c8fec_notification_preferences for select to public using(auth.uid()=user_id);
create policy users_update_own_prefs on public.app_11941c8fec_notification_preferences for update to public using(auth.uid()=user_id);
create policy users_delete_own_subscriptions on public.app_11941c8fec_push_subscriptions for delete to public using(auth.uid()=user_id);
create policy users_insert_own_subscriptions on public.app_11941c8fec_push_subscriptions for insert to authenticated with check(auth.uid()=user_id);
create policy users_read_own_subscriptions on public.app_11941c8fec_push_subscriptions for select to public using(auth.uid()=user_id);
-- Default VALUES are representative test inputs: the CSV redacts actual
-- default expressions. Constraints/types/PK/UNIQUE/FKs match the evidence.
insert into public.app_11941c8fec_notification_preferences(user_id,bill_reminders,language,last_suhoor_sent_date) values
 ('11111111-1111-4111-8111-111111111111',false,'ar','2026-01-01'),
 ('22222222-2222-4222-8222-222222222222',true,'en','2026-01-02');
insert into public.app_11941c8fec_push_subscriptions(user_id,endpoint,p256dh,auth_key) values
 ('11111111-1111-4111-8111-111111111111','https://fixture.invalid/A','fixture-key-A','fixture-auth-A'),
 ('22222222-2222-4222-8222-222222222222','https://fixture.invalid/B','fixture-key-B','fixture-auth-B');
create temp table notification_before as select
 (select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_notification_preferences p) as preferences,
 (select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_push_subscriptions p) as registrations;
create index notification_preferences_user_idx on public.app_11941c8fec_notification_preferences(user_id);
create index push_subscriptions_user_idx on public.app_11941c8fec_push_subscriptions(user_id);
-- Reproduce PUBLIC-policy bypass and TRUNCATE despite enabled RLS.
begin;
set local role anon;
select public.fixture_assert((select count(*)=2 from public.app_11941c8fec_notification_preferences),'PUBLIC policy baseline not reproduced');
update public.app_11941c8fec_notification_preferences set general_activity=false;
truncate public.app_11941c8fec_push_subscriptions;
select public.fixture_assert((select count(*)=0 from public.app_11941c8fec_push_subscriptions),'TRUNCATE baseline not reproduced');
rollback;
