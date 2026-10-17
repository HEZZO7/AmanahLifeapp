-- Read-only metadata only. Select the intended Supabase project first.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'app_11941c8fec_subscriptions'
order by ordinal_position;

select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = to_regclass('public.app_11941c8fec_subscriptions');

select relrowsecurity, relforcerowsecurity
from pg_class where oid = to_regclass('public.app_11941c8fec_subscriptions');

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'app_11941c8fec_subscriptions';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'app_11941c8fec_subscriptions';

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'app_11941c8fec_subscriptions';

select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = to_regclass('public.app_11941c8fec_subscriptions')
and not tgisinternal;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'app_11941c8fec_subscriptions';
