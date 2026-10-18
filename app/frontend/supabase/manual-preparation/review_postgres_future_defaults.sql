-- PROPOSAL ONLY. NOT an automatic migration and NOT part of migration 007.
-- Project-wide future-object policy: separately approve after full creator/ACL
-- inventory and review of other applications sharing public. Existing object
-- ACLs/data remain unchanged. Other creator roles need separate reviewed rules.
begin;
do $$ begin
 if current_user<>'postgres' then raise exception 'Reviewed postgres creator context required'; end if;
 if exists(select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) x
   where d.defaclrole='postgres'::regrole and (d.defaclnamespace=0 or d.defaclnamespace='public'::regnamespace)
   and x.grantee not in (0,'postgres'::regrole,'anon'::regrole,'authenticated'::regrole,'service_role'::regrole)) then
  raise exception 'Additional future-object grantees need review';
 end if;
end $$;
-- Global function defaults include built-in PUBLIC EXECUTE even with no ACL row.
-- Schema-specific grants are additive; close BOTH global and public defaults.
alter default privileges for role postgres revoke all on tables from public,anon,authenticated,service_role;
alter default privileges for role postgres revoke all on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on tables from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public,anon,authenticated,service_role;
commit;
