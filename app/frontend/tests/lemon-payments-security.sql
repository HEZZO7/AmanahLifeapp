-- Fresh isolated PostgreSQL CI fixture ONLY. All test writes roll back.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then raise exception 'Isolated fixture required'; end if;
end $$;
insert into public.app_11941c8fec_payment_environment(mode) values('test');
select public.fixture_assert((select paid_access_until is null and paid_access_from is null from public.app_11941c8fec_subscriptions
  where user_id='22222222-2222-4222-8222-222222222222'), 'Legacy active tier was automatically certified as paid');

select public.fixture_assert(not has_table_privilege('anon','public.app_11941c8fec_payment_intents','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'Anonymous payment ledger privileges');
select public.fixture_assert(not has_table_privilege('authenticated','public.app_11941c8fec_payment_accounts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'Authenticated payment ledger privileges');
select public.fixture_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname='public' and p.proname like 'app\_11941c8fec\_payment\_%' escape '\' and a.grantee=0), 'PUBLIC can execute payment functions');

create function public.fixture_payment_state(p_status text default 'active',p_invoice text default '42',p_revoked boolean default false)
returns jsonb language sql as $$ select jsonb_build_object('status',p_status,'provider_updated_at',statement_timestamp(),
 'invoice_id',p_invoice,'paid_access_from',statement_timestamp()-interval '1 day','paid_access_until',statement_timestamp()+interval '29 days',
 'entitlement_revoked_at',case when p_revoked then statement_timestamp() else null end,'ends_at',null,'review_required',false) $$;
create function public.fixture_payment_apply(p_key int,p_revision bigint,p_state jsonb,p_hash text default repeat('a',64),p_variant text default '2')
returns jsonb language sql security invoker as $$ select public.app_11941c8fec_payment_apply('test',lpad(p_key::text,64,'0'),
 'subscription_payment_success','42','33333333-3333-4333-8333-333333333333',p_revision,p_hash,'10','6','20','1','3',p_variant,'family','monthly',p_state) $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_create_intent('test',auth.uid(),repeat('a',64),'1','3','2','family','monthly') $q$);
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_snapshot('test','10',null,null,null) $q$);
select public.fixture_expect_denied($q$ select public.fixture_payment_apply(1,0,public.fixture_payment_state()) $q$);
select public.fixture_expect_denied($q$ truncate public.app_11941c8fec_payment_intents $q$);
reset role;

set local role service_role;
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_create_intent('live','33333333-3333-4333-8333-333333333333',repeat('a',64),'1','3','2','family','monthly') $q$);
select public.app_11941c8fec_payment_create_intent('test','33333333-3333-4333-8333-333333333333',repeat('a',64),'1','3','2','family','monthly');
select public.app_11941c8fec_payment_ready_intent('test',repeat('a',64),'checkout-fixture');
select public.fixture_assert((public.app_11941c8fec_payment_snapshot('test','10',null,repeat('a',64),null)->>'user_id')='33333333-3333-4333-8333-333333333333','Opaque intent binding missing');
select public.fixture_expect_denied($q$ select public.fixture_payment_apply(1,0,public.fixture_payment_state(),repeat('a',64),'999') $q$);
select public.fixture_payment_apply(1,0,public.fixture_payment_state());
select public.fixture_assert((public.fixture_payment_apply(1,0,public.fixture_payment_state())->>'duplicate')::boolean,'Duplicate event not deduplicated');
select public.fixture_assert((public.fixture_payment_apply(2,0,public.fixture_payment_state('past_due'))->>'retry')::boolean,'Old revision overwrote payment');
select public.fixture_expect_denied($q$ select public.fixture_payment_apply(3,1,public.fixture_payment_state(),repeat('a',64),'999') $q$);
reset role;
select public.fixture_assert((select revision=1 from public.app_11941c8fec_payment_accounts where subscription_id='10'),'Duplicate/stale event advanced revision');
select public.fixture_assert((select tier='family' and trial_used and trial_started_at is not null and paid_access_until>statement_timestamp()
  from public.app_11941c8fec_subscriptions where user_id='33333333-3333-4333-8333-333333333333'),'Activation changed trial or lost payment bounds');

-- A second user's opaque intent cannot be used to replace the established subscription account.
set local role service_role;
select public.app_11941c8fec_payment_create_intent('test','11111111-1111-4111-8111-111111111111',repeat('b',64),'1','3','2','family','monthly');
select public.app_11941c8fec_payment_ready_intent('test',repeat('b',64),'other-checkout-fixture');
select public.fixture_assert((public.app_11941c8fec_payment_snapshot('test','10',null,repeat('b',64),null)->>'user_id')='33333333-3333-4333-8333-333333333333','Metadata reassigned existing binding');
-- Cancellation retains the actual verified end, not an arbitrary future retry.
select public.fixture_payment_apply(4,1,public.fixture_payment_state('canceled') || jsonb_build_object('ends_at',statement_timestamp()+interval '29 days'));
select public.fixture_assert(public.app_11941c8fec_account_family_entitled('33333333-3333-4333-8333-333333333333'),'Cancellation cut off paid period');
select public.fixture_payment_apply(5,2,public.fixture_payment_state('past_due') || jsonb_build_object('paid_access_until',statement_timestamp()-interval '1 hour','paid_access_from',statement_timestamp()-interval '31 days'));
reset role;
-- Remove the independent unexpired app trial in the test fixture ONLY, so it cannot mask unpaid access.
update public.app_11941c8fec_subscriptions set trial_started_at=statement_timestamp()-interval '8 days' where user_id='33333333-3333-4333-8333-333333333333';
set local role service_role;
select public.fixture_assert(not public.app_11941c8fec_account_family_entitled('33333333-3333-4333-8333-333333333333'),'Failed payment granted unpaid grace');
select public.fixture_payment_apply(6,3,public.fixture_payment_state('active','43'));
select public.fixture_assert(public.app_11941c8fec_account_family_entitled('33333333-3333-4333-8333-333333333333'),'Recovery did not restore verified paid access');
select public.fixture_payment_apply(7,4,public.fixture_payment_state('active','43',true));
select public.fixture_assert(not public.app_11941c8fec_account_family_entitled('33333333-3333-4333-8333-333333333333'),'Refund failed to revoke family access');
reset role;
select public.fixture_assert((select count(*)=1 from public.app_11941c8fec_payment_accounts where subscription_id='10'),'Subscription bound more than once');
select public.fixture_assert((select count(*)=2 from public.app_11941c8fec_payment_intents),'Unexpected data deletion');
rollback;
