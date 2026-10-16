-- Fresh isolated CI database only; never run against an existing Supabase project.
\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then
   raise exception 'Isolated security fixture required';
 end if;
end $$;

-- SECURITY INVOKER: all verdict assertions run as the actual authenticated role.
create function public.fixture_ai_expect(expected boolean, message text)
returns void language sql security invoker as $$
 select public.fixture_assert(public.app_11941c8fec_ai_entitled() is not distinct from expected,message)
$$;

select public.fixture_assert(to_regprocedure('public.app_11941c8fec_ai_entitled(uuid)') is null,'AI RPC must not accept another account identity');
select public.fixture_assert((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.app_11941c8fec_ai_entitled()'::regprocedure),'AI RPC lacks scoped SECURITY DEFINER boundary');
set local role anon;
select public.fixture_expect_denied($q$ select public.app_11941c8fec_ai_entitled() $q$);
reset role;
set local role service_role;
select public.fixture_expect_denied($q$ select public.app_11941c8fec_ai_entitled() $q$);
reset role;

insert into public.app_11941c8fec_subscriptions(user_id) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') on conflict(user_id) do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select public.fixture_ai_expect(false,'Missing identity must not receive AI entitlement');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select public.fixture_ai_expect(false,'Free account received AI access');
select public.fixture_expect_denied($q$ update public.app_11941c8fec_subscriptions set tier='family',trial_started_at=statement_timestamp(),trial_used=true where user_id=auth.uid() $q$);
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_entitlement('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $q$);
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.fixture_ai_expect(true,'Correlated private paid evidence was not accepted');
reset role;

-- Raw legacy dates/status/IDs are not payment proof, even when they look active.
update public.app_11941c8fec_subscriptions set tier='family',status='active',lemonsqueezy_subscription_id='legacy-no-private-proof',
 paid_access_from=statement_timestamp()-interval '1 day',paid_access_until=statement_timestamp()+interval '30 days'
 where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select public.fixture_ai_expect(false,'Legacy tier alone certified a payment');
reset role;
update public.app_11941c8fec_subscriptions set status='trialing' where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select public.fixture_ai_expect(false,'Native provider trial status alone authorized AI');
reset role;
update public.app_11941c8fec_subscriptions set status='active' where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- Test-only setup writes below change private synthetic proof rows; never app-user grants.
update public.app_11941c8fec_payment_periods set tier='balanced' where subscription_id='110' and proof_id='130';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.fixture_ai_expect(true,'Verified balanced payment rejected');
reset role;
update public.app_11941c8fec_payment_periods set tier='family' where subscription_id='110' and proof_id='130';
update public.app_11941c8fec_payment_bindings set last_state=jsonb_set(last_state,'{provider_status}','"cancelled"') where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(true,'Cancellation lost the remaining paid period');
reset role;
update public.app_11941c8fec_payment_periods set access_end=statement_timestamp() where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(false,'Cancellation granted access at/after paid end');
reset role;

update public.app_11941c8fec_payment_periods set access_end=statement_timestamp()+interval '30 days' where subscription_id='110';
update public.app_11941c8fec_payment_bindings set last_state=jsonb_set(last_state,'{provider_status}','"past_due"') where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(true,'Past due erased an independently valid paid period');
reset role;
update public.app_11941c8fec_payment_periods set access_end=statement_timestamp()-interval '1 second' where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(false,'Past due granted an unpaid grace period');
reset role;
update public.app_11941c8fec_payment_periods set access_end=statement_timestamp()+interval '30 days',revoked_at=statement_timestamp() where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(false,'Refunded proof still authorized AI');
reset role;
update public.app_11941c8fec_payment_periods set revoked_at=null where subscription_id='110';
update public.app_11941c8fec_payment_bindings set last_state=jsonb_set(last_state,'{provider_status}','"expired"') where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(false,'Provider-expired binding retained AI access');
reset role;
update public.app_11941c8fec_payment_bindings set last_state=jsonb_set(last_state,'{provider_status}','"paused"') where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(false,'Paused binding received AI access');
reset role;
update public.app_11941c8fec_payment_bindings set last_state=jsonb_set(last_state,'{provider_status}','"active"') where subscription_id='110';
update public.app_11941c8fec_payment_periods set confirmed_at=statement_timestamp()+interval '1 minute' where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(false,'Future observation created early AI access');
reset role;
update public.app_11941c8fec_payment_periods set confirmed_at=null where subscription_id='110';
set local role authenticated;
select public.fixture_ai_expect(false,'Unconfirmed private period granted AI access');
reset role;
update public.app_11941c8fec_payment_periods set confirmed_at=statement_timestamp()-interval '1 day' where subscription_id='110';
delete from public.app_11941c8fec_payment_environment where mode='test';
set local role authenticated;
select public.fixture_ai_expect(false,'Disabled billing environment allowed paid AI');
reset role;
insert into public.app_11941c8fec_payment_environment(mode) values('test');

-- Trial is issued by the existing identity/time-bound RPC, not client-authored dates.
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select public.app_11941c8fec_start_trial();
select public.fixture_ai_expect(true,'Server-issued active trial rejected');
select public.fixture_assert(public.app_11941c8fec_start_trial()->>'error'='trial_already_used','AI check enabled restarting a trial');
reset role;
update public.app_11941c8fec_subscriptions set trial_started_at=statement_timestamp()-interval '7 days' where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select public.fixture_ai_expect(false,'Trial remained valid at exact expiry');
reset role;
update public.app_11941c8fec_subscriptions set trial_started_at=statement_timestamp()+interval '1 minute' where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select public.fixture_ai_expect(false,'Future trial granted early AI access');
reset role;
update public.app_11941c8fec_subscriptions set trial_started_at=statement_timestamp()-interval '1 day',entitlement_revoked_at=statement_timestamp() where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select public.fixture_ai_expect(false,'Revoked account regained access through trial');
reset role;
update public.app_11941c8fec_subscriptions set entitlement_revoked_at=null,trial_used=false where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
select public.fixture_ai_expect(false,'Unissued trial timestamp granted AI access');
reset role;

-- UI/ordinary roles still cannot mutate payment proof or the environment gate.
set local role authenticated;
select public.fixture_expect_denied($q$ update public.app_11941c8fec_payment_periods set access_end=statement_timestamp()+interval '100 years' $q$);
select public.fixture_expect_denied($q$ insert into public.app_11941c8fec_payment_environment(mode) values('live') $q$);
reset role;
rollback;
