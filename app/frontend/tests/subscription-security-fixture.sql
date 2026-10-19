-- Isolated CI database ONLY; never load into production.
\set ON_ERROR_STOP on
do $$ begin
  if current_setting('amanahlife.security_fixture', true) is distinct from 'isolated' then
    raise exception 'Explicit isolated-fixture marker required';
  end if;
  if to_regclass('public.app_11941c8fec_subscriptions') is not null
     or to_regclass('auth.users') is not null then
    raise exception 'Fixture requires a fresh database';
  end if;
end $$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
$$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema auth, public to anon, authenticated, service_role;

create table public.app_11941c8fec_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id),
  tier text not null default 'free' check (tier in ('free','balanced','family')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
  status text not null default 'active' check (status in ('active','canceled','past_due','trialing','expired','paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  payment_provider text not null default 'lemonsqueezy',
  lemonsqueezy_customer_id text,
  lemonsqueezy_subscription_id text,
  paddle_customer_id text,
  paddle_subscription_id text,
  trial_started_at timestamptz,
  trial_used boolean not null default false
);
create index subscriptions_user_idx on public.app_11941c8fec_subscriptions(user_id);
alter table public.app_11941c8fec_subscriptions enable row level security;
grant all on public.app_11941c8fec_subscriptions to anon, authenticated, service_role;
create policy allow_insert_own_subscription on public.app_11941c8fec_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy allow_read_own_subscription on public.app_11941c8fec_subscriptions
  for select to public using (auth.uid() = user_id);
create policy allow_service_role_all on public.app_11941c8fec_subscriptions
  for all to public using (auth.role() = 'service_role');

create function public.fixture_assert(ok boolean, message text)
returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%', message; end if; end $$;
-- SECURITY INVOKER: exercises caller's grants/RLS, not the fixture administrator.
create function public.fixture_expect_denied(command text)
returns void language plpgsql security invoker as $$
begin
  begin execute command;
  exception when insufficient_privilege then return;
  end;
  raise exception 'Expected permission denial: %', command;
end $$;

insert into auth.users values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222'),
('33333333-3333-4333-8333-333333333333'),
('44444444-4444-4444-8444-444444444444');
insert into public.app_11941c8fec_subscriptions(user_id, tier, lemonsqueezy_subscription_id)
values ('22222222-2222-4222-8222-222222222222', 'family', 'fixture-paid-sub');
insert into public.app_11941c8fec_subscriptions(user_id, trial_started_at, trial_used)
values ('33333333-3333-4333-8333-333333333333', now() - interval '1 day', true);

-- Baseline regression proof against the representative audited schema.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
insert into public.app_11941c8fec_subscriptions(user_id, tier, status)
values ('44444444-4444-4444-8444-444444444444','family','active');
select public.fixture_assert(
  (select tier = 'family' from public.app_11941c8fec_subscriptions
   where user_id = auth.uid()), 'Audited INSERT escalation baseline not reproduced');
rollback;
