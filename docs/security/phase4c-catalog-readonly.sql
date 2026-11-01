-- PREPARED / NOT EXECUTED. Catalog metadata only; never application/Auth rows.
-- Use only an already authorized database connection. No grants, migrations,
-- role changes, RPC execution, function bodies, default values or trigger args.
-- The read-only transaction and fixed search_path are session-local.
begin transaction read only;
set local search_path = pg_catalog;
with targets(name) as (values
 ('app_11941c8fec_bill_reminders_sync'),
 ('app_11941c8fec_goal_reminders_sync'),
 ('app_11941c8fec_email_digest')
), relations as (
 select t.name,c.oid,c.relowner,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 from targets t left join pg_namespace n on n.nspname='public'
 left join pg_class c on c.relnamespace=n.oid and c.relname=t.name
), api_roles(name) as (values ('anon'),('authenticated'),('service_role')),
roles as (
 select x.name,r.oid,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcreaterole
 from api_roles x left join pg_roles r on r.rolname=x.name
), privileges(name) as (
 select * from (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v
 union all select 'MAINTAIN' where current_setting('server_version_num')::int>=170000
), policy_evidence as (
 select p.*,pg_get_expr(p.polqual,p.polrelid) as using_expression,
 pg_get_expr(p.polwithcheck,p.polrelid) as check_expression
 from pg_policy p where p.polrelid in (select oid from relations where oid is not null)
)
select jsonb_build_object(
 'formatVersion',1,
 'evidenceKind','catalog-metadata-only',
 'serverVersion',current_setting('server_version_num')::int,
 'collectedAt',statement_timestamp(),
 'restExposure','NOT_COLLECTED',
 'tables',(select jsonb_agg(jsonb_build_object(
  'name','public.'||t.name,'present',t.oid is not null,'kind',t.relkind,
  'owner',pg_get_userbyid(t.relowner),'rls',t.relrowsecurity,'forceRls',t.relforcerowsecurity,
  'columns',(select coalesce(jsonb_agg(jsonb_build_object(
   'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
   'hasDefault',d.oid is not null,
   'defaultHash',encode(sha256(convert_to(pg_get_expr(d.adbin,d.adrelid),'UTF8')),'hex'),
   'identity',a.attidentity,'generated',a.attgenerated
  ) order by a.attnum),'[]'::jsonb) from pg_attribute a
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
  'directAcl',(select coalesce(jsonb_agg(jsonb_build_object(
   'scope','table','column',null,'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable
  )),'[]'::jsonb) from aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a),
  'columnAcl',(select coalesce(jsonb_agg(jsonb_build_object(
   'column',c.attname,'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable
  ) order by c.attnum,a.grantee,a.privilege_type),'[]'::jsonb)
  from pg_attribute c cross join lateral aclexplode(c.attacl) a
  where c.attrelid=t.oid and c.attnum>0 and not c.attisdropped),
  'effective',(select jsonb_agg(jsonb_build_object(
   'role',r.name,'present',r.oid is not null,'superuser',r.rolsuper,'bypassRls',r.rolbypassrls,
   'schemaUsage',case when r.oid is null or t.oid is null then null else has_schema_privilege(r.oid,'public','USAGE') end,
   'ownerMembership',case when r.oid is null or t.oid is null then null else pg_has_role(r.oid,t.relowner,'USAGE') end,
   'policyRoles',(select coalesce(jsonb_agg(member.rolname order by member.rolname),'[]'::jsonb)
    from pg_roles member where r.oid is not null and pg_has_role(r.oid,member.oid,'USAGE')),
   'table',(select jsonb_object_agg(p.name,jsonb_build_object(
    'allowed',case when r.oid is null or t.oid is null then null else has_table_privilege(r.oid,t.oid,p.name) end,
    'grantable',case when r.oid is null or t.oid is null then null else has_table_privilege(r.oid,t.oid,p.name||' WITH GRANT OPTION') end
   )) from privileges p),
   'columns',(select coalesce(jsonb_agg(jsonb_build_object(
    'column',a.attname,'privilege',p.name,
    'allowed',case when r.oid is null then null else has_column_privilege(r.oid,t.oid,a.attnum,p.name) end,
    'grantable',case when r.oid is null then null else has_column_privilege(r.oid,t.oid,a.attnum,p.name||' WITH GRANT OPTION') end
   ) order by a.attnum,p.name),'[]'::jsonb) from pg_attribute a
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(name)
   where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped)
  ) order by r.name) from roles r),
  'policies',(select coalesce(jsonb_agg(jsonb_build_object(
   'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
   'roles',(select jsonb_agg(case when role_oid=0 then 'PUBLIC' else pg_get_userbyid(role_oid) end order by role_oid) from unnest(p.polroles) role_oid),
   'usingKind',case when p.using_expression is null then 'ABSENT' when p.using_expression='true' then 'TRUE' when p.using_expression='false' then 'FALSE' else 'REVIEW_REQUIRED' end,
   'checkKind',case when p.check_expression is null then 'ABSENT' when p.check_expression='true' then 'TRUE' when p.check_expression='false' then 'FALSE' else 'REVIEW_REQUIRED' end,
   'usingHash',encode(sha256(convert_to(p.using_expression,'UTF8')),'hex'),
   'checkHash',encode(sha256(convert_to(p.check_expression,'UTF8')),'hex')
  ) order by p.polname),'[]'::jsonb) from policy_evidence p where p.polrelid=t.oid),
  'constraints',(select coalesce(jsonb_agg(jsonb_build_object(
   'name',k.conname,'type',k.contype,'validated',k.convalidated,'deferrable',k.condeferrable,'initiallyDeferred',k.condeferred,
   'columns',(select jsonb_agg(a.attname order by u.position) from unnest(k.conkey) with ordinality u(attnum,position) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=u.attnum),
   'referencedTable',case when k.confrelid=0 then null else k.confrelid::regclass::text end,
   'referencedColumns',(select jsonb_agg(a.attname order by u.position) from unnest(k.confkey) with ordinality u(attnum,position) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=u.attnum),
   'deleteAction',k.confdeltype,'updateAction',k.confupdtype,
   'definitionHash',encode(sha256(convert_to(pg_get_constraintdef(k.oid),'UTF8')),'hex')
  ) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=t.oid),
  'incomingForeignKeys',(select coalesce(jsonb_agg(jsonb_build_object(
   'name',k.conname,'table',k.conrelid::regclass::text,'deleteAction',k.confdeltype,
   'validated',k.convalidated,'deferrable',k.condeferrable,
   'definitionHash',encode(sha256(convert_to(pg_get_constraintdef(k.oid),'UTF8')),'hex')
  ) order by k.conrelid,k.conname),'[]'::jsonb) from pg_constraint k where k.contype='f' and k.confrelid=t.oid),
  'triggers',(select coalesce(jsonb_agg(jsonb_build_object(
   'name',g.tgname,'enabled',g.tgenabled,'type',g.tgtype,'internal',g.tgisinternal,
   'function',g.tgfoid::regprocedure::text,
   'definitionHash',encode(sha256(convert_to(pg_get_triggerdef(g.oid),'UTF8')),'hex')
  ) order by g.tgname),'[]'::jsonb) from pg_trigger g where g.tgrelid=t.oid),
  'dependencies',(select coalesce(jsonb_agg(jsonb_build_object('relation',d.relation,'kind',d.kind)),'[]'::jsonb) from (
   select i.inhrelid::regclass::text as relation,'child' as kind from pg_inherits i where i.inhparent=t.oid
   union all select i.inhparent::regclass::text,'parent' from pg_inherits i where i.inhrelid=t.oid
  ) d)
 ) order by t.name) from relations t),
 'dependentViews',(select coalesce(jsonb_agg(jsonb_build_object(
  'name',c.oid::regclass::text,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
  'definitionHash',encode(sha256(convert_to(pg_get_viewdef(c.oid),'UTF8')),'hex')
 ) order by c.oid),'[]'::jsonb) from pg_class c where c.relkind in ('v','m') and exists(
  select 1 from pg_rewrite w join pg_depend d on d.classid='pg_rewrite'::regclass and d.objid=w.oid
  where w.ev_class=c.oid and d.refclassid='pg_class'::regclass and d.refobjid in(select oid from relations where oid is not null))),
 'authDeleteTriggers',(select coalesce(jsonb_agg(jsonb_build_object(
  'name',g.tgname,'enabled',g.tgenabled,'type',g.tgtype,'internal',g.tgisinternal,
  'function',g.tgfoid::regprocedure::text,
  'definitionHash',encode(sha256(convert_to(pg_get_triggerdef(g.oid),'UTF8')),'hex')
 ) order by g.tgname),'[]'::jsonb) from pg_trigger g where g.tgrelid=to_regclass('auth.users')),
 'functionMetadata',(select coalesce(jsonb_agg(jsonb_build_object(
  'name',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,
  'searchPath',(select jsonb_agg(setting) from unnest(p.proconfig) setting where setting like 'search_path=%'),
  'definitionHash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
  'execute',(select jsonb_agg(jsonb_build_object('role',r.name,'allowed',case when r.oid is null then null else has_function_privilege(r.oid,p.oid,'EXECUTE') end)) from roles r)
 ) order by p.oid),'[]'::jsonb) from pg_proc p where p.prokind='f' and (
  p.oid in(select tgfoid from pg_trigger where tgrelid in(select oid from relations where oid is not null) or tgrelid=to_regclass('auth.users')) or
  p.oid in(select d.refobjid from pg_depend d where d.classid='pg_policy'::regclass and d.refclassid='pg_proc'::regclass and d.objid in(select oid from policy_evidence))))
) as phase4c_catalog_evidence;
rollback;
