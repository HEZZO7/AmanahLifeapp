-- READ ONLY: optional owner-collected metadata, never customer/preference row data.
-- Supabase SQL Editor: run this single SELECT; export the one result as CSV.
-- Do not open/share Cron commands, Vault values, API keys or customer records.
-- Absence of a table returns null/empty metadata; do not create anything.
with target as (
 select c.oid,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='app_11941c8fec_notification_preferences'
), roles as (
 select oid,rolname from pg_roles where rolname in ('anon','authenticated','service_role')
)
select jsonb_build_object(
 'table', 'public.app_11941c8fec_notification_preferences',
 'security', (select jsonb_build_object('owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'force_rls',relforcerowsecurity,'acl',relacl::text) from target),
 'columns', (select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
   'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum),'[]'::jsonb)
   from target t join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
   left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum),
 'policies', (select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from pg_policies p
   where p.schemaname='public' and p.tablename='app_11941c8fec_notification_preferences'),
 'effective_table_privileges', (select coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'privilege',p.privilege,'allowed',has_table_privilege(r.oid,t.oid,p.privilege))),'[]'::jsonb)
   from target t cross join roles r cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)),
 'effective_column_privileges', (select coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'column',a.attname,'privilege',p.privilege,
   'allowed',has_column_privilege(r.oid,t.oid,a.attnum,p.privilege))),'[]'::jsonb)
   from target t cross join roles r join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
   cross join (values('SELECT'),('INSERT'),('UPDATE')) p(privilege)),
 'constraints', (select coalesce(jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid))),'[]'::jsonb)
   from target t join pg_constraint c on c.conrelid=t.oid),
 'triggers', (select coalesce(jsonb_agg(jsonb_build_object('name',g.tgname,'definition',pg_get_triggerdef(g.oid))),'[]'::jsonb)
   from target t join pg_trigger g on g.tgrelid=t.oid and not g.tgisinternal)
) as preference_table_evidence;
