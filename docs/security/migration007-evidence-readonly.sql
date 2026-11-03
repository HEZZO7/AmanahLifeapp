-- Owner reports successful hosted SELECT on 2026-11-03, PostgreSQL17.6,
-- from a7c9d7ad4cc33df6afec31946909a6add8e38385. No hosted execution by this assistant.
-- See migration007-hosted-evidence.json: summary received, raw catalog absent.
-- One catalog-only SELECT; no table rows or RPC calls. Query logic is unchanged.
-- Run only with an already authorized read-only connection to the verified
-- project. Project identity/deployed Edge/Frontend versions require separate
-- Dashboard/build evidence; a database name alone does not establish identity.
-- Device-column and unrecognized default values are hashed, never disclosed.
-- Catalog routines and cast types are qualified so a custom search_path cannot
-- redirect this collector to a same-named application function or type.
with targets(name) as (values
 ('app_11941c8fec_notification_preferences'),('app_11941c8fec_push_subscriptions')
), relations as (
 select t.name,c.oid,c.relowner,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 from targets t left join pg_catalog.pg_namespace n on n.nspname='public'
 left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=t.name
), actors as (
 select a.name,r.oid,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolinherit
 from (values('anon'),('authenticated'),('service_role')) a(name)
 left join pg_catalog.pg_roles r on r.rolname=a.name
), privileges(name) as (
 select * from (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p
 union all select 'MAINTAIN' where pg_catalog.current_setting('server_version_num')::pg_catalog.int4>=170000
), default_evidence as (
 select a.attrelid,a.attnum,a.attname,d.oid,pg_catalog.pg_get_expr(d.adbin,d.adrelid) expression
 from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where a.attrelid in(select oid from relations where oid is not null) and a.attnum>0 and not a.attisdropped
), policies as (
 select p.*,pg_catalog.pg_get_expr(p.polqual,p.polrelid) using_expression,
 pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) check_expression
 from pg_catalog.pg_policy p where p.polrelid in(select oid from relations where oid is not null)
), policy_expressions as (
 select p.oid,p.polrelid,p.polname,p.polcmd,p.polpermissive,p.polroles,e.kind,e.expression,
 -- Only constants and simple own-user predicates can leave the database as
 -- text. Complex policy definitions require separate protected owner review.
 case when e.expression in ('true','false') then true
 when pg_catalog.regexp_replace(e.expression,'[[:space:]()]','','g') in
 ('auth.uid=user_id','user_id=auth.uid','SELECTauth.uid=user_id','user_id=SELECTauth.uid') then true
 else false end as text_safe
 from policies p cross join lateral (values('using',p.using_expression),('check',p.check_expression)) e(kind,expression)
)
select pg_catalog.jsonb_build_object(
 'formatVersion',1,'evidenceKind','catalog-only-partial-definitions',
 'collectedAt',pg_catalog.statement_timestamp(),'serverVersion',pg_catalog.current_setting('server_version_num')::pg_catalog.int4,
 'projectIdentity','VERIFY_EXTERNALLY','deployedVersions','NOT_COLLECTED','postgrestExposure','NOT_COLLECTED',
 'tables',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'name','public.'||t.name,'present',t.oid is not null,'kind',t.relkind,
  'owner',pg_catalog.pg_get_userbyid(t.relowner),'rls',t.relrowsecurity,'forceRls',t.relforcerowsecurity,
  'columns',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'number',a.attnum,'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
   'identity',a.attidentity,'generated',a.attgenerated,'hasDefault',d.oid is not null,
   'defaultExpression',case when a.attname not in ('endpoint','p256dh','auth_key','prayer_manual_city') and
    (d.expression in ('true','false','now()','CURRENT_TIMESTAMP','gen_random_uuid()','auth.uid()',
     '''UTC''::text','''en''::text','''ar''::text','timezone(''utc''::text, now())') or d.expression like 'NULL::%')
    then d.expression else null end,
   'defaultHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.expression,'UTF8')),'hex'),
   'defaultReviewRequired',d.oid is not null and not coalesce(a.attname not in ('endpoint','p256dh','auth_key','prayer_manual_city') and
    (d.expression in ('true','false','now()','CURRENT_TIMESTAMP','gen_random_uuid()','auth.uid()',
     '''UTC''::text','''en''::text','''ar''::text','timezone(''utc''::text, now())') or d.expression like 'NULL::%'),false)
  ) order by a.attnum),'[]'::pg_catalog.jsonb) from pg_catalog.pg_attribute a left join default_evidence d on d.attrelid=a.attrelid and d.attnum=a.attnum
  where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
  'directAcl',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'grantor',pg_catalog.pg_get_userbyid(x.grantor),'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
   'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::pg_catalog.jsonb)
   from pg_catalog.aclexplode(coalesce(t.relacl,pg_catalog.acldefault('r',t.relowner))) x),
  'columnAcl',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'column',a.attname,'grantor',pg_catalog.pg_get_userbyid(x.grantor),
   'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
   'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::pg_catalog.jsonb)
   from pg_catalog.pg_attribute a cross join lateral pg_catalog.aclexplode(a.attacl) x where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
  'effective',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'role',r.name,'present',r.oid is not null,'superuser',r.rolsuper,'bypassRls',r.rolbypassrls,'createRole',r.rolcreaterole,'inherits',r.rolinherit,
   'schemaUsage',case when r.oid is null then null else pg_catalog.has_schema_privilege(r.oid,'public','USAGE') end,
   'memberships',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',m.rolname,
    'member',pg_catalog.pg_has_role(r.oid,m.oid,'MEMBER'),'effectiveUsage',pg_catalog.pg_has_role(r.oid,m.oid,'USAGE'))),'[]'::pg_catalog.jsonb)
    from pg_catalog.pg_roles m where r.oid is not null and pg_catalog.pg_has_role(r.oid,m.oid,'MEMBER')),
   'table',(select pg_catalog.jsonb_object_agg(p.name,pg_catalog.jsonb_build_object(
    'allowed',case when r.oid is null or t.oid is null then null else pg_catalog.has_table_privilege(r.oid,t.oid,p.name) end,
    'grantable',case when r.oid is null or t.oid is null then null else pg_catalog.has_table_privilege(r.oid,t.oid,p.name||' WITH GRANT OPTION') end)) from privileges p),
   'columns',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('column',a.attname,'privilege',p.name,
    'allowed',case when r.oid is null then null else pg_catalog.has_column_privilege(r.oid,t.oid,a.attnum,p.name) end,
    'grantable',case when r.oid is null then null else pg_catalog.has_column_privilege(r.oid,t.oid,a.attnum,p.name||' WITH GRANT OPTION') end)),'[]'::pg_catalog.jsonb)
    from pg_catalog.pg_attribute a cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(name)
    where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped)
  ) order by r.name) from actors r),
  'policies',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
   'roles',(select pg_catalog.jsonb_agg(case when role_id=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_id) end) from pg_catalog.unnest(p.polroles) role_id),
   'expressions',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind',e.kind,
    'expression',case when e.text_safe then e.expression else null end,'reviewRequired',e.expression is not null and not e.text_safe,
    'hash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(e.expression,'UTF8')),'hex')) order by e.kind)
    from policy_expressions e where e.oid=p.oid)) order by p.polname),'[]'::pg_catalog.jsonb) from policies p where p.polrelid=t.oid),
  'constraints',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'name',k.conname,'type',k.contype,'validated',k.convalidated,'deferrable',k.condeferrable,'initiallyDeferred',k.condeferred,
   'columns',(select pg_catalog.jsonb_agg(a.attname order by u.position) from pg_catalog.unnest(k.conkey) with ordinality u(attnum,position) join pg_catalog.pg_attribute a on a.attrelid=k.conrelid and a.attnum=u.attnum),
   'referencedTable',case when k.confrelid=0 then null else k.confrelid::pg_catalog.regclass::pg_catalog.text end,
   'referencedColumns',(select pg_catalog.jsonb_agg(a.attname order by u.position) from pg_catalog.unnest(k.confkey) with ordinality u(attnum,position) join pg_catalog.pg_attribute a on a.attrelid=k.confrelid and a.attnum=u.attnum),
   'deleteAction',k.confdeltype,'updateAction',k.confupdtype,
   'definitionHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(k.oid),'UTF8')),'hex')) order by k.conname),'[]'::pg_catalog.jsonb)
   from pg_catalog.pg_constraint k where k.conrelid=t.oid),
  'indexes',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'name',c.relname,'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,
   'keyAttributes',i.indnkeyatts,'attributeNumbers',i.indkey::pg_catalog.text,'partial',i.indpred is not null,'expressionIndex',i.indexprs is not null,
   'definitionHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_indexdef(i.indexrelid),'UTF8')),'hex')) order by c.relname),'[]'::pg_catalog.jsonb)
   from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid where i.indrelid=t.oid),
  'triggers',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',g.tgname,'type',g.tgtype,'enabled',g.tgenabled,
   'internal',g.tgisinternal,'function',g.tgfoid::pg_catalog.regprocedure::pg_catalog.text,
   'definitionHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_triggerdef(g.oid),'UTF8')),'hex')) order by g.tgname),'[]'::pg_catalog.jsonb)
   from pg_catalog.pg_trigger g where g.tgrelid=t.oid),
  'inheritance',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('parent',i.inhparent::pg_catalog.regclass::pg_catalog.text,'child',i.inhrelid::pg_catalog.regclass::pg_catalog.text)),'[]'::pg_catalog.jsonb)
   from pg_catalog.pg_inherits i where i.inhparent=t.oid or i.inhrelid=t.oid)
 ) order by t.name) from relations t)
) as migration007_catalog_evidence;
