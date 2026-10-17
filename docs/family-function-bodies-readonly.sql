-- Read-only. Run once in SQL Editor and export CSV privately.
-- Review/redact any embedded secrets before sharing. Do not invoke these functions.
select n.nspname as schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and ((p.proname in ('app_11941c8fec_set_join_code',
                     'app_11941c8fec_add_owner_as_member')
        and pg_get_function_identity_arguments(p.oid) = '')
       or (p.proname in ('app_11941c8fec_is_family_member',
                        'app_11941c8fec_is_family_owner')
           and pg_get_function_identity_arguments(p.oid) = 'p_family_id uuid')
       or (p.proname = 'app_11941c8fec_join_family_with_code'
           and pg_get_function_identity_arguments(p.oid) = 'p_code text'))
order by p.proname;

-- Family triggers/policies outside the two tables audited earlier:
-- Run this SELECT separately; it returns metadata, not family/customer records.
select 'policy' as kind, schemaname as schema_name, tablename as object_name,
       policyname as name,
       jsonb_build_object('roles', roles, 'cmd', cmd, 'using', qual,
                          'with_check', with_check) as details
from pg_policies
where schemaname = 'public'
  and (tablename like 'app_11941c8fec_family%' or tablename = 'app_11941c8fec_families')
union all
select 'trigger', n.nspname, c.relname, t.tgname,
       jsonb_build_object('definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled)
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (c.relname like 'app_11941c8fec_family%' or c.relname = 'app_11941c8fec_families')
  and not t.tgisinternal;

-- Run separately: family table access and writable-schema metadata (no rows).
select c.relname as table_name, c.relrowsecurity as rls_enabled, r.rolname,
       has_table_privilege(r.oid, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') as can_delete,
       has_schema_privilege(r.oid, 'public', 'CREATE') as can_create_in_public
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
where n.nspname='public' and c.relkind in ('r','p')
  and (c.relname like 'app_11941c8fec_family%' or c.relname='app_11941c8fec_families')
  and r.rolname in ('anon','authenticated','service_role')
order by c.relname,r.rolname;
