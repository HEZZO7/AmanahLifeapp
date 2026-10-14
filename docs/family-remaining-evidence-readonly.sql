-- ONE read-only statement. Run once, export ALL numbered results privately.
-- No family rows or auth.users records are read. Review definitions for secrets.
with family_tables as (
 select c.oid,n.nspname,c.relname,c.relrowsecurity,c.relacl,c.relowner
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p')
 and (c.relname like 'app_11941c8fec_family%' or c.relname='app_11941c8fec_families')
), structures as (
 select t.relname, t.relrowsecurity,
 (select jsonb_agg(to_jsonb(x)) from (
   select column_name,data_type,is_nullable,column_default from information_schema.columns
   where table_schema=t.nspname and table_name=t.relname order by ordinal_position
 ) x) as columns,
 (select jsonb_agg(to_jsonb(x)) from (
   select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=t.oid
 ) x) as constraints,
 (select jsonb_agg(to_jsonb(x)) from (
   select indexname,indexdef from pg_indexes where schemaname=t.nspname and tablename=t.relname
 ) x) as indexes
 from family_tables t
), policies as (
 select policyname,tablename,roles,cmd,permissive,qual,with_check
 from pg_policies where schemaname='public'
 and tablename in (select relname from family_tables)
), triggers as (
 select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
 from pg_trigger t join pg_class c on c.oid=t.tgrelid
 where t.tgrelid in (select oid from family_tables) and not t.tgisinternal
), missing_functions as (
 select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 pg_get_functiondef(p.oid) as definition, p.prosecdef,
 (select jsonb_agg(to_jsonb(x)) from (
   select case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
   a.privilege_type from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 ) x) as grants
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f'
 and (p.proname in ('app_11941c8fec_join_family_with_code','app_11941c8fec_generate_join_code')
      or p.proname like 'app_11941c8fec%join%family%')
), sections as (
 select 1 as check_no,'Family structures/constraints/indexes' as topic,
 coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) as evidence from structures x
 union all select 2,'Family RLS policies',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from policies x
 union all select 3,'Actual family triggers',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from triggers x
 union all select 4,'Join/generator definitions (without parameter-name filter)',
 coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from missing_functions x
)
select check_no,topic,jsonb_pretty(evidence) as evidence from sections order by check_no;
