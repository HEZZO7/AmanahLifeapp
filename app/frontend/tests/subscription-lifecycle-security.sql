-- Isolated PostgreSQL security/regression tests, including migration preservation.
\set ON_ERROR_STOP on
begin;
do $$ begin if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then raise exception 'Isolated fixture required'; end if; end $$;
select public.fixture_assert((select count(*)=1 from public.app_11941c8fec_payment_bindings where subscription_id='110'),'Private binding history lost');
select public.fixture_assert((select confirmed_at>access_start and service_period_start is null from public.app_11941c8fec_payment_periods where subscription_id='110' and proof_id='130'),'Private journal observation was replaced by a created date');
select public.fixture_assert(public.app_11941c8fec_account_family_entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Verified private paid access was lost during migration');
select public.fixture_assert(not public.app_11941c8fec_account_family_entitled('88888888-8888-4888-8888-888888888888'),'Raw legacy tier certified as paid');
select public.fixture_assert(not has_function_privilege('service_role','public.app_11941c8fec_payment_apply(text,text,text,text,uuid,bigint,text,text,text,text,text,text,text,text,text,jsonb)','EXECUTE'),'Legacy mutation RPC still callable');

create function public.fixture_lifecycle_state(p_sid text,p_invoice text,p_tier text default 'family',p_status text default 'active',p_refund boolean default false)
returns jsonb language plpgsql security invoker as $$
declare pp public.app_11941c8fec_payment_periods; observed timestamptz; finish timestamptz; source_time timestamptz; product text; variant text;
begin
 -- Fixture-only SECURITY DEFINER below lets the trusted fixture read restricted proof rows.
 select * into pp from public.app_11941c8fec_payment_periods where mode='test' and subscription_id=p_sid and proof_id=p_invoice;
 observed:=coalesce(pp.confirmed_at,statement_timestamp());finish:=coalesce(pp.access_end,statement_timestamp()+interval '29 days');
 source_time:=coalesce(pp.source_created_at,statement_timestamp());
 product:=case when p_tier='family' then '3' else '5' end;variant:=case when p_tier='family' then '2' else '4' end;
 return jsonb_build_object('status',case when p_status='cancelled' then 'canceled' else p_status end,'provider_status',p_status,'provider_updated_at',statement_timestamp(),
 'invoice_id',p_invoice,'latest_invoice_id',p_invoice,'paid_access_from',observed,'paid_access_until',finish,
 'entitlement_revoked_at',case when p_refund or p_status='expired' then statement_timestamp() else null end,
 'ends_at',case when p_status='expired' then statement_timestamp() else null end,'effective_tier',p_tier,'effective_billing','monthly','payment_processor','stripe',
 'service_period_start',null,'service_period_end',null,'review_required',false,
 'periods',jsonb_build_array(jsonb_build_object('proof_id',p_invoice,'kind',case when p_invoice='130' or p_invoice='140' then 'initial' else 'renewal' end,
 'start',observed,'confirmed_at',observed,'source_created_at',source_time,'end',finish,'end_source','active.renews_at','tier',p_tier,'billing','monthly','product',product,'variant',variant,
 'revoked_at',case when p_refund or p_status='expired' then statement_timestamp() else null end,'review',false)));
end $$;
-- Not a production helper or privilege test: synthetic test-state factory only.
alter function public.fixture_lifecycle_state(text,text,text,text,boolean) security definer;
create function public.fixture_lifecycle_commit(p_key int,p_revision bigint,p_sid text,p_invoice text,p_tier text default 'family',p_state jsonb default null)
returns jsonb language sql security invoker as $$ select public.app_11941c8fec_payment_commit_snapshot('test',lpad(p_key::text,64,'0'),
 'fixture_canonical','130','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_revision,case when p_sid='111' then repeat('f',64) else repeat('d',64) end,
 p_sid,'6',case when p_sid='111' then '121' else '120' end,'1',case when p_tier='family' then '3' else '5' end,
 case when p_tier='family' then '2' else '4' end,p_tier,'monthly',coalesce(p_state,public.fixture_lifecycle_state(p_sid,p_invoice,p_tier))) $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select public.fixture_expect_denied($q$ select public.fixture_lifecycle_commit(101,1,'110','130') $q$);
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_reserve_checkout('test',auth.uid(),repeat('f',64),'1','3','2','family','monthly',0,null) $q$);
select public.fixture_expect_denied($q$ truncate public.app_11941c8fec_payment_bindings $q$);
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_claim_deliveries('test',25) $q$);
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_reconcile_targets('test',null,25) $q$);
reset role;
set local role service_role;
select public.fixture_lifecycle_commit(101,1,'110','130');
select public.fixture_assert(public.app_11941c8fec_account_family_entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Fresh positive payment observation failed');
select public.fixture_expect_denied($q$ select public.app_11941c8fec_payment_reserve_checkout('test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('f',64),'1','3','2','family','monthly',2,'110') $q$);
select public.fixture_expect_denied($q$ update public.app_11941c8fec_subscriptions set payment_provider='paddle',tier='balanced' where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $q$);
reset role;
select public.fixture_assert((select current_period_start is null and paid_access_from>created_at-interval '1 minute' from public.app_11941c8fec_subscriptions where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Service-period start was invented');

set local role service_role;
select (public.app_11941c8fec_payment_request_plan('test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,'110','5','4','balanced','monthly',false)->>'id') plan_id \gset
select public.fixture_expect_denied($q$ select public.fixture_lifecycle_commit(102,3,'110','131','balanced') $q$);
select public.app_11941c8fec_payment_confirm_plan('test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'plan_id',statement_timestamp());
select public.fixture_lifecycle_commit(103,4,'110','131','balanced',public.fixture_lifecycle_state('110','131','balanced')||jsonb_build_object('plan_change_id',:'plan_id'));
select public.fixture_assert(public.app_11941c8fec_account_family_entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Paid higher tier was cut off by a downgrade');
reset role;
select public.fixture_assert((select status='activated' from public.app_11941c8fec_payment_plan_changes where id=:'plan_id'),'Paid renewal failed to activate authorized change');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.fixture_assert(public.app_11941c8fec_current_subscription()->>'tier'='family','Authenticated RPC lost higher paid floor');
select public.app_11941c8fec_start_trial();
reset role;
select public.fixture_assert((select trial_used and trial_started_at is not null from public.app_11941c8fec_subscriptions where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Payment protection broke authorized trial');
-- Time-boundary fixture mutation only: expire the higher paid floor and independent app trial.
update public.app_11941c8fec_payment_periods set access_end=statement_timestamp()-interval '1 millisecond' where subscription_id='110' and proof_id='130';
update public.app_11941c8fec_subscriptions set trial_started_at=statement_timestamp()-interval '8 days' where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select public.fixture_assert(public.app_11941c8fec_current_subscription()->>'tier'='balanced','Time expiry failed to fall through to lower valid proof');
reset role;
set local role service_role;
select public.fixture_assert(not public.app_11941c8fec_account_family_entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Expired higher paid tier retained family writes');
select public.fixture_lifecycle_commit(104,5,'110','131','balanced',public.fixture_lifecycle_state('110','131','balanced','expired')||jsonb_build_object('periods',
 (public.fixture_lifecycle_state('110','131','balanced','expired')->'periods')||(public.fixture_lifecycle_state('110','130','family','expired')->'periods')));
select public.app_11941c8fec_payment_reserve_checkout('test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('f',64),'1','3','2','family','monthly',6,'110');
select public.app_11941c8fec_payment_ready_intent('test',repeat('f',64),'replacement-checkout');
select public.fixture_lifecycle_commit(105,6,'111','140');
select public.fixture_assert((public.fixture_lifecycle_commit(106,7,'110','131','balanced',public.fixture_lifecycle_state('110','131','balanced','expired',true))->>'archived')::boolean,'Old subscription event was projected over its replacement');
select public.fixture_assert(public.app_11941c8fec_account_family_entitled('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Old refund revoked newer valid subscription');
select public.fixture_assert((public.fixture_lifecycle_commit(106,7,'110','131','balanced',public.fixture_lifecycle_state('110','131','balanced','expired',true))->>'duplicate')::boolean,'Old event replay not deduplicated');
-- Durable minimized inbox: duplication, lease ownership, retry and poison-event review.
select public.app_11941c8fec_payment_receive_delivery('test',repeat('a',64),'subscription_updated','111','111',null,null);
select public.app_11941c8fec_payment_receive_delivery('test',repeat('a',64),'subscription_updated','111','111',null,null);
select (public.app_11941c8fec_payment_claim_deliveries('test',1)->'items'->0->>'lease') delivery_lease \gset
select public.fixture_assert(not (public.app_11941c8fec_payment_finish_delivery('test',repeat('a',64),'00000000-0000-4000-8000-000000000000',true)->>'finished')::boolean,'A stale lease acknowledged another worker');
select public.app_11941c8fec_payment_finish_delivery('test',repeat('a',64),:'delivery_lease',false);
select public.fixture_assert(jsonb_array_length(public.app_11941c8fec_payment_claim_deliveries('test',1)->'items')=0,'Retry ignored backoff');
select public.fixture_assert(jsonb_array_length(public.app_11941c8fec_payment_reconcile_targets('test',null,1)->'items')=1,'Reconciliation target batch incorrect');
select public.fixture_assert(public.app_11941c8fec_payment_reconcile_targets('test',null,1)->>'next_cursor'='110','Reconciliation cursor skipped a binding');
reset role;
select public.fixture_assert((select count(*)=1 from public.app_11941c8fec_payment_deliveries where event_key=repeat('a',64)),'Duplicate delivery rows');
update public.app_11941c8fec_payment_deliveries set attempts=11,available_at=statement_timestamp()-interval '1 second' where event_key=repeat('a',64);
set local role service_role;
select (public.app_11941c8fec_payment_claim_deliveries('test',1)->'items'->0->>'lease') poison_lease \gset
select public.app_11941c8fec_payment_finish_delivery('test',repeat('a',64),:'poison_lease',false);
reset role;
select public.fixture_assert((select status='review' and attempts=12 from public.app_11941c8fec_payment_deliveries where event_key=repeat('a',64)),'Poison delivery did not enter bounded manual review');
select public.fixture_assert((select subscription_id='111' and revision=8 from public.app_11941c8fec_payment_accounts where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Current binding pointer/regression revision incorrect');
select public.fixture_assert((select count(*)=2 from public.app_11941c8fec_payment_bindings where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Previous binding was destroyed');
select public.fixture_assert(not exists(select 1 from public.app_11941c8fec_payment_periods where service_period_start is not null or service_period_end is not null),'A fabricated service-period boundary was stored');
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select public.fixture_assert(public.app_11941c8fec_current_subscription() is null,'Current-subscription RPC leaked another account');
reset role;
rollback;
