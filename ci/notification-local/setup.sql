-- Disposable native Supabase only; never import the CI auth/users/roles fixture.
\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('amanahlife.local_test',true) is distinct from 'approved'
  or current_database()<>'postgres'
  or to_regclass('auth.users') is null
  or to_regclass('public.app_11941c8fec_notification_preferences') is not null
  or to_regclass('public.app_11941c8fec_subscriptions') is not null
 then raise exception 'Fresh approved local Supabase required'; end if;
end $$;
-- Types, nullability, PK/UNIQUE/FKs match production metadata. Default
-- expressions are REPRESENTATIVE until the owner supplies redacted metadata.
create table public.app_11941c8fec_notification_preferences(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id),
 prayer_reminders boolean default true,bill_reminders boolean default true,
 habit_reminders boolean default true,fasting_reminders boolean default true,
 savings_reminders boolean default true,general_activity boolean default true,
 timezone text not null default 'UTC',language text not null default 'en',
 prayer_calc_method text,prayer_location_mode text,prayer_manual_city jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 last_suhoor_sent_date date,last_iftar_sent_date date
);
create index notification_preferences_user_idx on public.app_11941c8fec_notification_preferences(user_id);
create table public.app_11941c8fec_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 endpoint text not null,p256dh text not null,auth_key text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint)
);
create index push_subscriptions_user_idx on public.app_11941c8fec_push_subscriptions(user_id);
alter table public.app_11941c8fec_notification_preferences enable row level security;
alter table public.app_11941c8fec_push_subscriptions enable row level security;
-- Reproduce the audited unsafe ACL/policy baseline before testing its removal.
grant all on public.app_11941c8fec_notification_preferences,public.app_11941c8fec_push_subscriptions to anon,authenticated,service_role;
create policy service_role_all_prefs on public.app_11941c8fec_notification_preferences for all to public using(true) with check(true);
create policy service_role_all_subscriptions on public.app_11941c8fec_push_subscriptions for all to public using(true) with check(true);
create policy users_insert_own_prefs on public.app_11941c8fec_notification_preferences for insert to authenticated with check(auth.uid()=user_id);
create policy users_read_own_prefs on public.app_11941c8fec_notification_preferences for select to public using(auth.uid()=user_id);
create policy users_update_own_prefs on public.app_11941c8fec_notification_preferences for update to public using(auth.uid()=user_id);
create policy users_delete_own_subscriptions on public.app_11941c8fec_push_subscriptions for delete to public using(auth.uid()=user_id);
create policy users_insert_own_subscriptions on public.app_11941c8fec_push_subscriptions for insert to authenticated with check(auth.uid()=user_id);
create policy users_read_own_subscriptions on public.app_11941c8fec_push_subscriptions for select to public using(auth.uid()=user_id);
commit;
