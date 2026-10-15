-- Fresh localhost CI fixture only. Changes are rolled back.
\set ON_ERROR_STOP on
begin;
select public.fixture_assert(
 (select join_code='LEGACY88' from public.app_11941c8fec_families
 where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'Migration rotated an existing code');
select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_family_expenses),'Migration deleted financial data');
select public.fixture_assert(
 (select paid_access_until is null from public.app_11941c8fec_subscriptions
 where user_id='22222222-2222-4222-8222-222222222222'),'Legacy row was certified as paid');
-- Only a trusted writer establishes the fixture's paid period.
update public.app_11941c8fec_subscriptions
 set paid_access_until=statement_timestamp()+interval '1 day',
 current_period_end=statement_timestamp()+interval '1 day'
 where user_id='22222222-2222-4222-8222-222222222222';

set local role anon;
select public.fixture_expect_denied('select public.app_11941c8fec_join_family_with_code(''LEGACY88'')');
select public.fixture_expect_denied('select public.app_11941c8fec_generate_join_code()');

set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select public.fixture_expect_denied(
 'select public.app_11941c8fec_account_family_entitled(''22222222-2222-4222-8222-222222222222'')');
select public.fixture_expect_denied(
 'insert into public.app_11941c8fec_families(owner_user_id) values(auth.uid())');
select public.fixture_assert(
 (select count(*)=0 from public.app_11941c8fec_family_expenses),'Outsider saw financial rows');
select public.fixture_expect_denied(
 'insert into public.app_11941c8fec_family_expenses(family_id,category,amount,amount_base)
 values(''cccccccc-cccc-4ccc-8ccc-cccccccccccc'',''Food'',20,20)');

-- Active owner's subscription covers a joining member who has no paid plan.
select public.app_11941c8fec_accept_family_invite(' legacy88 ','Test Member','adult','Sibling');
select public.app_11941c8fec_join_family_with_code('LEGACY88');
select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_family_members
 where family_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and user_id=auth.uid()),
 'Repeated join duplicated membership');
select public.fixture_assert(
 public.app_11941c8fec_family_can_write('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 'Invited member did not inherit owner entitlement');
insert into public.app_11941c8fec_family_budget_settings(family_id)
values('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
update public.app_11941c8fec_family_budget_settings set monthly_budget=100
where family_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

-- Owner cannot forge canonical ownership metadata or rewrite family tokens.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.fixture_expect_denied(
 'update public.app_11941c8fec_families set join_code=''GUESSABLE''
 where id=''cccccccc-cccc-4ccc-8ccc-cccccccccccc''');
select public.fixture_expect_denied(
 'insert into public.app_11941c8fec_family_members(family_id,user_id,display_name,member_role)
 values(''cccccccc-cccc-4ccc-8ccc-cccccccccccc'',
 ''66666666-6666-4666-8666-666666666666'',''Forged owner'',''owner'')');
insert into public.app_11941c8fec_families(id,owner_user_id,join_code)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),'CLIENT-CODE');
select public.fixture_assert(
 (select join_code<>'CLIENT-CODE' and join_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'
 from public.app_11941c8fec_families where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 'New code did not come from server generator');
select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_family_members
 where family_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and member_role='owner'),
 'Owner trigger inserted duplicate membership');

reset role;
-- A cancellation before paid end retains write access.
update public.app_11941c8fec_subscriptions set status='canceled'
where user_id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
select public.fixture_assert(
 public.app_11941c8fec_family_can_write('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 'Cancellation cut off the paid period');
reset role;
-- past_due gets zero extra time: retry dates cannot extend a proved paid period.
update public.app_11941c8fec_subscriptions set status='past_due',
 paid_access_until=statement_timestamp()-interval '1 second',
 current_period_end=statement_timestamp()+interval '1 year'
where user_id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
select public.fixture_assert(
 not public.app_11941c8fec_family_can_write('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 'Retry date granted unpaid access');

-- Existing members retain read/export but cannot mutate ANY protected finance table.
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_family_expenses),'Expired member lost read/export');
update public.app_11941c8fec_family_expenses set amount=999;
delete from public.app_11941c8fec_family_expenses;
select public.fixture_assert(
 (select amount=10 from public.app_11941c8fec_family_expenses
 where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'Expired member changed/deleted expenses');
select public.fixture_expect_denied(
 'insert into public.app_11941c8fec_family_income(family_id,source,amount,amount_base)
 values(''cccccccc-cccc-4ccc-8ccc-cccccccccccc'',''Fake'',1,1)');
select public.fixture_expect_denied(
 'insert into public.app_11941c8fec_family_budget_categories(family_id,name)
 values(''cccccccc-cccc-4ccc-8ccc-cccccccccccc'',''Fake'')');
update public.app_11941c8fec_family_budget_settings set monthly_budget=999;
select public.fixture_assert(
 (select monthly_budget=100 from public.app_11941c8fec_family_budget_settings),
 'Expired member changed budget settings');
select public.fixture_expect_denied(
 'update public.app_11941c8fec_subscriptions set paid_access_until=now()+interval ''1 year''');

select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select public.fixture_expect_denied('select public.app_11941c8fec_join_family_with_code(''LEGACY88'')');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.fixture_expect_denied(
 'insert into public.app_11941c8fec_families(owner_user_id) values(auth.uid())');
delete from public.app_11941c8fec_families where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_families
 where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'Expired owner deleted family');

-- Immediate revocation overrides even a still-valid trial or paid period.
reset role;
update public.app_11941c8fec_subscriptions
set status='active',paid_access_until=statement_timestamp()+interval '1 day',
trial_started_at=statement_timestamp(),entitlement_revoked_at=statement_timestamp()
where user_id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
select public.fixture_assert(
 not public.app_11941c8fec_family_can_write('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 'Revocation was bypassed by trial or paid period');

-- A member may leave after expiry and loses access; nobody else's data is deleted.
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
delete from public.app_11941c8fec_family_members
where family_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and user_id=auth.uid();
select public.fixture_assert(
 (select count(*)=0 from public.app_11941c8fec_family_expenses),'Leaving did not remove access');
reset role;
select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_family_expenses),'Leaving deleted family data');

-- Deterministic collision/retry and bounded exhaustion, inside rollback-only CI.
reset role;
update public.app_11941c8fec_subscriptions
set entitlement_revoked_at=null,trial_started_at=null,status='active',
paid_access_until=statement_timestamp()+interval '1 day'
where user_id='22222222-2222-4222-8222-222222222222';
create sequence public.fixture_code_sequence;
create or replace function public.app_11941c8fec_generate_join_code()
returns text language sql volatile set search_path=''
as $ select case when nextval('public.fixture_code_sequence')=1
 then 'LEGACY88' else 'RETRY888' end $;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.app_11941c8fec_families(id,owner_user_id)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',auth.uid());
select public.fixture_assert(
 (select join_code='RETRY888' from public.app_11941c8fec_families
 where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'Collision was not retried');
reset role;
create or replace function public.app_11941c8fec_generate_join_code()
returns text language sql volatile set search_path=''
as $ select 'LEGACY88'::text $;
do $
begin
 begin
  insert into public.app_11941c8fec_families(owner_user_id)
  values('22222222-2222-4222-8222-222222222222');
 exception when raise_exception then
  if sqlerrm='join_code_generation_failed' then return; end if;
  raise;
 end;
 raise exception 'Collision exhaustion was not bounded';
end $;
select public.fixture_assert(
 (select count(*)=3 from public.app_11941c8fec_families),
 'Failed collision attempt inserted family rows');
rollback;
