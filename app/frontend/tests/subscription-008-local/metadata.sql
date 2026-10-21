-- Metadata only; invoked by the owned local-container runner, never production.
select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object(
  'name',p.proname,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,
  'rights',(select jsonb_agg(jsonb_build_array(r,has_function_privilege(r,p.oid,'EXECUTE'),
    has_function_privilege(r,p.oid,'EXECUTE WITH GRANT OPTION')) order by r)
   from unnest(array['anon','authenticated','service_role']) r)) order by p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('app_11941c8fec_account_deletion_allowed','app_11941c8fec_guard_account_deletion')),
 'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
  'name',t.tgname,'enabled',t.tgenabled::text,'type',t.tgtype,'function',p.proname,
  'definition',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  join pg_proc p on p.oid=t.tgfoid
  where not t.tgisinternal and t.tgname='app_11941c8fec_billing_retention'),
 'foreignKeys',(select jsonb_agg(jsonb_build_object('table',c.relname,'delete',k.confdeltype::text,
  'deferred',k.condeferrable,'valid',k.convalidated,'definition',pg_get_constraintdef(k.oid)) order by c.relname)
  from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and k.contype='f' and k.confrelid='auth.users'::regclass
   and c.relname in ('app_11941c8fec_subscriptions','app_11941c8fec_payment_accounts',
    'app_11941c8fec_payment_intents','app_11941c8fec_payment_bindings','app_11941c8fec_payment_periods')),
 'acl',(select jsonb_agg(jsonb_build_array(r,t,p,has_table_privilege(r,'public.app_11941c8fec_'||t,p)) order by r,t,p)
  from unnest(array['anon','authenticated','service_role']) r
  cross join unnest(array['subscriptions','payment_accounts','payment_intents','payment_bindings','payment_periods']) t
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
   ||case when current_setting('server_version_num')::int>=170000 then array['MAINTAIN'] else array[]::text[] end) p),
 'columnAcl',(select jsonb_agg(jsonb_build_array(r,a.attname,p,
   has_column_privilege(r,'public.app_11941c8fec_subscriptions',a.attname,p)) order by r,a.attnum,p)
  from unnest(array['anon','authenticated']) r
  cross join pg_attribute a cross join unnest(array['INSERT','UPDATE','REFERENCES']) p
  where a.attrelid='public.app_11941c8fec_subscriptions'::regclass and a.attnum>0 and not a.attisdropped),
 'roles',(select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolbypassrls) order by rolname)
  from pg_roles where rolname in ('anon','authenticated','service_role')),
 'rls',(select jsonb_agg(jsonb_build_array(relname,relrowsecurity) order by relname) from pg_class
  where oid in ('public.app_11941c8fec_subscriptions'::regclass,'public.app_11941c8fec_payment_accounts'::regclass,
   'public.app_11941c8fec_payment_intents'::regclass,'public.app_11941c8fec_payment_bindings'::regclass,
   'public.app_11941c8fec_payment_periods'::regclass))
);
