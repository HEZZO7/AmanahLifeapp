-- Synthetic private-ledger upgrade fixture; never execute outside fresh localhost CI.
\set ON_ERROR_STOP on
do $$ begin if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then raise exception 'Isolated fixture required'; end if; end $$;
insert into public.app_11941c8fec_payment_environment(mode) values('test');
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','lifecycle-fixture@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','other-fixture@example.invalid');
set role service_role;
select public.app_11941c8fec_payment_create_intent('test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('d',64),'1','3','2','family','monthly');
select public.app_11941c8fec_payment_ready_intent('test',repeat('d',64),'old-prepared-checkout');
select public.app_11941c8fec_payment_apply('test',repeat('1',64),'subscription_created','110','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,repeat('d',64),
 '110','6','120','1','3','2','family','monthly',jsonb_build_object('status','active','provider_updated_at',statement_timestamp()-interval '1 day',
 'invoice_id','130','paid_access_from',statement_timestamp()-interval '1 day','paid_access_until',statement_timestamp()+interval '29 days',
 'entitlement_revoked_at',null,'ends_at',null,'review_required',false,'periods',jsonb_build_array(jsonb_build_object('proof_id','130','kind','initial',
 'start',statement_timestamp()-interval '1 day','end',statement_timestamp()+interval '29 days','revoked_at',null,'review',false))));
reset role;
