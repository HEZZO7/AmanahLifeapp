-- Isolated CI database ONLY, after the reviewed migration.
\set ON_ERROR_STOP on
do $$ begin
  if current_setting('amanahlife.security_fixture', true) is distinct from 'isolated' then
    raise exception 'Explicit isolated-fixture marker required';
  end if;
end $$;
begin;
select public.fixture_assert(
  (select count(*) = 4 from auth.users), 'Migration removed existing users');
select public.fixture_assert(
  (select tier='family' and lemonsqueezy_subscription_id='fixture-paid-sub'
   from public.app_11941c8fec_subscriptions
   where user_id='22222222-2222-4222-8222-222222222222'), 'Existing paid fields changed');
select public.fixture_assert(
  (select trial_used and trial_started_at < now()
   from public.app_11941c8fec_subscriptions
   where user_id='33333333-3333-4333-8333-333333333333'), 'Existing trial changed');
select public.fixture_assert(
  not has_table_privilege('authenticated','public.app_11941c8fec_subscriptions','TRUNCATE')
  and not has_table_privilege('anon','public.app_11941c8fec_subscriptions','TRUNCATE')
  and not has_table_privilege('service_role','public.app_11941c8fec_subscriptions','TRUNCATE'),
  'TRUNCATE remains available');
select public.fixture_assert(
  not exists (
    select 1 from aclexplode((select proacl from pg_proc
      where oid='public.app_11941c8fec_start_trial()'::regprocedure)) a
    where a.grantee=0), 'PUBLIC may execute trial RPC');
select public.fixture_assert(
  not has_function_privilege('anon','public.app_11941c8fec_start_trial()','EXECUTE'),
  'Anonymous trial RPC permitted');

set local role anon;
select public.fixture_expect_denied('select * from public.app_11941c8fec_subscriptions');
select public.fixture_expect_denied('truncate public.app_11941c8fec_subscriptions');
select public.fixture_expect_denied('select public.app_11941c8fec_start_trial()');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.fixture_assert(
  (select count(*)=0 from public.app_11941c8fec_subscriptions), 'Other accounts visible');
select public.fixture_expect_denied(
  'insert into public.app_11941c8fec_subscriptions(user_id,tier,status)
   values (auth.uid(),''family'',''active'')');
select public.fixture_expect_denied(
  'insert into public.app_11941c8fec_subscriptions(user_id,trial_started_at,trial_used)
   values (auth.uid(), now() + interval ''1 year'',true)');
select public.fixture_expect_denied('truncate public.app_11941c8fec_subscriptions');

select public.fixture_assert(
  (public.app_11941c8fec_start_trial()->>'trial_started_at')::timestamptz
    between transaction_timestamp() and clock_timestamp(),
  'Trial does not use server time');
select public.fixture_assert(
  (select tier='free' and trial_used and lemonsqueezy_subscription_id is null
   from public.app_11941c8fec_subscriptions where user_id=auth.uid()),
  'Trial incorrectly generated paid entitlement metadata');
select public.fixture_assert(
  public.app_11941c8fec_start_trial()->>'error'='trial_already_used', 'Trial restarted');
select public.fixture_expect_denied(
  'update public.app_11941c8fec_subscriptions set tier=''family'' where user_id=auth.uid()');
select public.fixture_expect_denied(
  'update public.app_11941c8fec_subscriptions set trial_used=false,trial_started_at=null');
select public.fixture_expect_denied('delete from public.app_11941c8fec_subscriptions');

-- Existing paid fields survive starting the one allowed app trial.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.app_11941c8fec_start_trial();
select public.fixture_assert(
  (select tier='family' and lemonsqueezy_subscription_id='fixture-paid-sub'
   from public.app_11941c8fec_subscriptions where user_id=auth.uid()), 'Paid fields overwritten');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.fixture_assert(
  public.app_11941c8fec_start_trial()->>'error'='trial_already_used', 'Prior trial reset');
select set_config('request.jwt.claim.sub','',true);
select public.fixture_expect_denied('select public.app_11941c8fec_start_trial()');

-- Valid server writer remains functional and is still the only direct writer.
set local role service_role;
insert into public.app_11941c8fec_subscriptions(user_id,tier,status)
values ('44444444-4444-4444-8444-444444444444','balanced','active');
update public.app_11941c8fec_subscriptions set status='canceled'
where user_id='44444444-4444-4444-8444-444444444444';
select public.fixture_assert(
  (select status='canceled' from public.app_11941c8fec_subscriptions
   where user_id='44444444-4444-4444-8444-444444444444'), 'Trusted writer blocked');
delete from public.app_11941c8fec_subscriptions
where user_id='44444444-4444-4444-8444-444444444444';
rollback;
