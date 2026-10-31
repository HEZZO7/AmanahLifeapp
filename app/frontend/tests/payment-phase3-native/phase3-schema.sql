-- Disposable fixture extension only. Never a production migration.
-- The original fixture and every original native assertion remain intact.
do $$ begin
  if current_setting('amanahlife.local_test',true) is distinct from 'approved'
    or current_user<>'postgres' or current_database()<>'postgres'
    or to_regclass('public.fixture_009_faults') is null then
    raise exception 'Owned native fixture required';
  end if;
end $$;
alter table public.app_11941c8fec_notification_preferences
  add constraint fixture_phase3_unique_preferences unique(user_id),
  add column prayer_reminders boolean default true,
  add column bill_reminders boolean default true,
  add column habit_reminders boolean default true,
  add column fasting_reminders boolean default true,
  add column savings_reminders boolean default true,
  add column general_activity boolean default true,
  add column timezone text not null default 'UTC',
  add column language text not null default 'en',
  add column prayer_calc_method text,
  add column prayer_location_mode text,
  add column prayer_manual_city jsonb,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add column last_suhoor_sent_date date,
  add column last_iftar_sent_date date;
alter table public.app_11941c8fec_push_subscriptions
  add column endpoint text not null default 'fixture-only:not-a-network-endpoint',
  add column p256dh text not null default 'synthetic-not-a-key',
  add column auth_key text not null default 'synthetic-not-a-key',
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint fixture_phase3_unique_push unique(user_id,endpoint);
