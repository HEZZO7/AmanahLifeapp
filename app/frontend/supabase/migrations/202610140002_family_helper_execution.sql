-- REVIEW/STAGING ONLY; do not apply to production without explicit approval.
-- Preserve all function bodies, accounts, family rows, signed-in callers and RLS.
begin;
do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    to_regprocedure('public.app_11941c8fec_is_family_member(uuid)'),
    to_regprocedure('public.app_11941c8fec_is_family_owner(uuid)'),
    to_regprocedure('public.app_11941c8fec_add_owner_as_member()'),
    to_regprocedure('public.app_11941c8fec_set_join_code()')
  ] loop
    if fn is null then raise exception 'Audited family helper missing; review schema drift'; end if;
    if not exists(select 1 from pg_proc where oid=fn and prosecdef
                  and proowner=(select oid from pg_roles where rolname='postgres')) then
      raise exception 'Family helper owner/security changed: %', fn;
    end if;
  end loop;
end $$;

-- Supplied bodies qualify auth/public references; builtins resolve in pg_catalog.
alter function public.app_11941c8fec_is_family_member(uuid) set search_path = '';
alter function public.app_11941c8fec_is_family_owner(uuid) set search_path = '';
alter function public.app_11941c8fec_add_owner_as_member() set search_path = '';
alter function public.app_11941c8fec_set_join_code() set search_path = '';

revoke execute on function public.app_11941c8fec_is_family_member(uuid),
  public.app_11941c8fec_is_family_owner(uuid),
  public.app_11941c8fec_add_owner_as_member(),
  public.app_11941c8fec_set_join_code()
from public, anon;
-- Preserve explicit authenticated/service_role grants shown by the audit.
-- Do not touch the unreviewed join-with-code or generator function.
commit;
