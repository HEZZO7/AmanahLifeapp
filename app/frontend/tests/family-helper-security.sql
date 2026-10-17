-- Isolated CI only. Never execute write-based regression tests against production.
\set ON_ERROR_STOP on
begin;
select public.fixture_assert(
 not has_function_privilege('anon','public.app_11941c8fec_is_family_member(uuid)','EXECUTE')
 and not has_function_privilege('anon','public.app_11941c8fec_is_family_owner(uuid)','EXECUTE'),
 'Anonymous helper execution remains permitted');
select public.fixture_assert(
 not exists(select 1 from pg_proc p
 cross join lateral aclexplode(p.proacl) a
 where p.proname in ('app_11941c8fec_is_family_member','app_11941c8fec_is_family_owner',
                     'app_11941c8fec_add_owner_as_member','app_11941c8fec_set_join_code')
 and a.grantee=0), 'PUBLIC helper execution remains permitted');

insert into public.app_11941c8fec_families(id,owner_user_id,join_code,name)
 values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
         '22222222-2222-4222-8222-222222222222','EXISTING-CODE','Existing Family');
select public.fixture_assert(
 (select join_code='EXISTING-CODE' from public.app_11941c8fec_families
  where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'Existing join code changed');
select public.fixture_assert(
 (select count(*)=1 from public.app_11941c8fec_family_members
  where family_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and member_role='owner'),
 'Owner trigger behavior changed');

insert into public.app_11941c8fec_families(id,owner_user_id)
 values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333');
select public.fixture_assert(
 (select join_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' from public.app_11941c8fec_families
  where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Qualified generator call broke');

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.fixture_assert(
 public.app_11941c8fec_is_family_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 and public.app_11941c8fec_is_family_owner('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 'Legitimate owner identity broken');
select public.fixture_assert(
 not public.app_11941c8fec_is_family_member('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 and not public.app_11941c8fec_is_family_owner('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 'Cross-family authorization leak');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.fixture_assert(
 not public.app_11941c8fec_is_family_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 and not public.app_11941c8fec_is_family_owner('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 'Nonmember became an owner/member');
select set_config('request.jwt.claim.sub','',true);
select public.fixture_assert(
 not public.app_11941c8fec_is_family_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 and not public.app_11941c8fec_is_family_owner('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 'Missing identity accepted');

set local role anon;
select public.fixture_expect_denied(
 'select public.app_11941c8fec_is_family_member(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'')');
select public.fixture_expect_denied(
 'select public.app_11941c8fec_is_family_owner(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'')');
rollback;
