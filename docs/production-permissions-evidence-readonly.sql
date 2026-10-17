-- PREPARED FOR REVIEW ONLY. Run manually only after the owner's approval.
-- One statement / one CSV. System catalogs only: no application rows, RPC
-- invocation, secrets, Vault, Cron commands, Webhooks or migration execution.
-- Baseline: AmanahLifeapp PR #2 at 2c133fbfda2a5af4427fafc9a26054b801ffb3b4.
-- Missing objects are reported, not created. This is NOT a migration.
-- Sections: 00 context; 01 tables; 02 effective table/column access; 03 RLS;
-- 04 RPC metadata/ACL; 05 role inheritance; 06 schema/default ACL; 07 views.
-- Policy string literals are redacted. Function bodies/default values,
-- constraint expressions and trigger arguments are deliberately NOT exported.
with recursive
wanted_roles(name) as (values ('anon'),('authenticated'),('service_role'),('authenticator')),
actors as (select r.oid,r.rolname from pg_catalog.pg_roles r join wanted_roles w on w.name=r.rolname),
expected_tables(name,source) as (values
 ('app_11941c8fec_subscriptions','existing + 001/003/004/005'),
 ('app_11941c8fec_notification_preferences','existing; not hardened by 001-006'),
 ('app_11941c8fec_payment_environment','004'),
 ('app_11941c8fec_payment_accounts','004'),
 ('app_11941c8fec_payment_intents','004/005'),
 ('app_11941c8fec_payment_events','004'),
 ('app_11941c8fec_payment_periods','004/005'),
 ('app_11941c8fec_payment_bindings','005'),
 ('app_11941c8fec_payment_plan_changes','005'),
 ('app_11941c8fec_payment_deliveries','005')
),
roots as (
 select c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and (c.relname in (select name from expected_tables)
 or (pg_catalog.left(c.relname,pg_catalog.length('app_11941c8fec_'))='app_11941c8fec_' and c.relname ~ '(subscription|payment|notification_preferences)'))
 and c.relkind in ('r','p','v','m','f')
),
relation_tree(oid) as (
 select oid from roots union
 select i.inhrelid from pg_catalog.pg_inherits i join relation_tree t on t.oid=i.inhparent
),
relations as (
 select c.*,n.nspname,pg_catalog.format('%I.%I',n.nspname,c.relname) as qualified_name
 from relation_tree t join pg_catalog.pg_class c on c.oid=t.oid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
),
expected_functions(signature,source_sha256,definer,allowed_api_roles,reference_migration) as (values
 ('public.app_11941c8fec_accept_family_invite(text, text, text, text)','85faf66de63d39dad9ed65dd1380178f71a1a47dfb402d26e35ad44d3b4c7ee2',true,array['authenticated']::text[],'202610150003'),
 ('public.app_11941c8fec_account_family_entitled(uuid)','8d7c45198a43269296728501cbd5adfe36cb2e0af1fbd35e36552fcf5364ede4',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_add_owner_as_member()',null,true,array['authenticated','service_role']::text[],'202610140002'),
 ('public.app_11941c8fec_ai_entitled()','d0e0380e87d95e96781ff6f658b44dd4159c883a9686e70ecc1101f60d1fe064',true,array['authenticated']::text[],'202610160006'),
 ('public.app_11941c8fec_current_subscription()','433658cdcd73175d42605015b59e3169dbf4166afa45c951ff1e6d407c67ea60',true,array['authenticated']::text[],'202610150005'),
 ('public.app_11941c8fec_current_user_family_entitled()','1eae80b8f80c32aa52424c5c96c1a09bffb7e8fab14f9d72596b662baa8aac0c',true,array['authenticated']::text[],'202610150003'),
 ('public.app_11941c8fec_family_can_write(uuid)','c9f4bc101c88eb928049cffd28955f89419714a3b09e4f7835438badd3977322',true,array['authenticated']::text[],'202610150003'),
 ('public.app_11941c8fec_generate_join_code()','30c2e7c9b01d3307ead3de1241b5e108ee28b7bf3978482a31fba808444f50cb',false,array['authenticated','service_role']::text[],'202610150003'),
 ('public.app_11941c8fec_guard_family_creation()','5f8de283fc4ee3f5bc5113434d1dee416ddcad55602d40a935850b6d506d0514',true,array[]::text[],'202610150003'),
 ('public.app_11941c8fec_guard_family_finance()','94df15f7afb4cade64bc42bcff1975dc288c52cba83f31cd7ce007bd1638d394',true,array[]::text[],'202610150003'),
 ('public.app_11941c8fec_guard_family_member()','5af87fcf2c29b88b8928cb7adced5d4be7014ad11cb081336bae716dbe2f6f08',true,array[]::text[],'202610150003'),
 ('public.app_11941c8fec_guard_payment_projection()','db599f61e1f84c41d0a3551ba37aaa87a457ffc4f5791f39f31761e4113f197e',true,array[]::text[],'202610150005'),
 ('public.app_11941c8fec_is_family_member(uuid)',null,true,array['authenticated','service_role']::text[],'202610140002'),
 ('public.app_11941c8fec_is_family_owner(uuid)',null,true,array['authenticated','service_role']::text[],'202610140002'),
 ('public.app_11941c8fec_join_family_with_code(text)','02b08f294b774cb076c8568a09dc3f5b072897658c123424f26c421970decdb0',true,array['authenticated']::text[],'202610150003'),
 ('public.app_11941c8fec_payment_apply(text, text, text, text, uuid, bigint, text, text, text, text, text, text, text, text, text, jsonb)','91d5a2130f71664eae61ff5097de8b9cb463f7e8ad35d464bd20d47aaa14356d',true,array[]::text[],'202610150004'),
 ('public.app_11941c8fec_payment_claim_deliveries(text, integer)','500d1c031a1b64f4f57ff0fa0ea89da3a9dd4cf0d833292a4346986218f8f8e7',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_commit_snapshot(text, text, text, text, uuid, bigint, text, text, text, text, text, text, text, text, text, jsonb)','a1f5a509e005eb4b70d10d63626f30bfe3d14a3b09c7ceadb855bcb39f1894dd',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_complete_delivery(text, text)','703b681846de00f0daecbbe7d517405d6a192f360e72a94152a1b54fd1c2837a',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_confirm_plan(text, uuid, uuid, timestamptz)','51cd64afebd9271c80362ddbf684e548e823003dac3a9ae6608e3e5cdb6f5ec3',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_create_intent(text, uuid, text, text, text, text, text, text)','a698ad4fd7a4fd7aca345731546ef62f34c876922afd276de0afc25acaa5592d',true,array[]::text[],'202610150004'),
 ('public.app_11941c8fec_payment_entitlement(uuid)','83975781aa79a21759dd4555a2c78009858f48f26581e76d35162ea0089ffad7',true,array[]::text[],'202610150005'),
 ('public.app_11941c8fec_payment_finish_delivery(text, text, uuid, boolean)','c1be91a7e012c51580b36906e2447896679969a9a0e46de982ce48072b3c3d80',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_ready_intent(text, text, text)','a57a4c4bc49a0f70d009cd587f4a815b62c1397b8a0a18d356cb4d9b04218043',true,array['service_role']::text[],'202610150004'),
 ('public.app_11941c8fec_payment_receive_delivery(text, text, text, text, text, text, text)','01da2385ba2b7de84076734e6b926a51426218f665b50b889526244737d4d89a',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_reconcile_targets(text, text, integer)','7d75ea931aa4221db2924be2f6acefd541f26cc9fcfae30c9a264a2057d08bc3',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_request_plan(text, uuid, bigint, text, text, text, text, text, boolean)','ebafff557454a487611c48097ee3938e102ec835f8e275dddba8f24b0f7e97a8',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_require_mode(text)','328951bde64ded9c793030d394c72874e0c24b992a8567485176db58ce40acaa',true,array[]::text[],'202610150004'),
 ('public.app_11941c8fec_payment_reserve_checkout(text, uuid, text, text, text, text, text, text, bigint, text)','ba240a99410d93b20853401e946b806cc5db2167f148c886c3ee63ebaf142bc4',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_snapshot(text, text, text, text, uuid)','355ee73753817f6c695e65f68bc0bf868036a4f9724f9eb3cd779720a811c50e',true,array['service_role']::text[],'202610150005'),
 ('public.app_11941c8fec_payment_unbound(text, text, text, text, text)','e42ee3ca174f110a1cd874737648a1e3661a8ca937970e0156514acdafc80b5d',true,array['service_role']::text[],'202610150004'),
 ('public.app_11941c8fec_set_join_code()','10df3cdb1f5be61914849a246dcfd1ce6a547d1715b7e38bb1f2ce30954f3aed',true,array['authenticated','service_role']::text[],'202610150003'),
 ('public.app_11941c8fec_start_trial()','42e5a8918275631e0c1202c1e1ff5f2dfebb2145d6d36fe77ca91fd71c87f3c4',true,array['authenticated']::text[],'202610140001')
),
resolved_functions as (
 select e.*,pg_catalog.to_regprocedure(e.signature)::oid as oid from expected_functions e
),
routine_ids as (
 select p.oid from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where pg_catalog.left(p.proname,pg_catalog.length('app_11941c8fec_'))='app_11941c8fec_' and n.nspname not in ('pg_catalog','information_schema')
 union select oid from resolved_functions where oid is not null
 union select g.tgfoid from pg_catalog.pg_trigger g join relations t on t.oid=g.tgrelid where not g.tgisinternal
 union select d.refobjid from pg_catalog.pg_depend d
 join pg_catalog.pg_policy pol on d.classid='pg_catalog.pg_policy'::regclass and d.objid=pol.oid
 join relations t on t.oid=pol.polrelid
 where d.refclassid='pg_catalog.pg_proc'::regclass
),
routines as (
 select p.*,n.nspname,pg_catalog.format('%I.%I(%s)',n.nspname,p.proname,pg_catalog.oidvectortypes(p.proargtypes)) as signature
 from routine_ids i join pg_catalog.pg_proc p on p.oid=i.oid
 join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where p.prokind in ('f','p','w')
),
scope_namespaces(oid) as (
 select oid from pg_catalog.pg_namespace where nspname='public'
 union select relnamespace from relations union select pronamespace from routines
),
role_tree(oid) as (
 select oid from actors union
 select m.roleid from pg_catalog.pg_auth_members m join role_tree t on m.member=t.oid
),
relevant_owners(oid) as (
 select relowner from relations union select proowner from routines
 union select oid from pg_catalog.pg_roles where rolname='postgres'
 union select defaclrole from pg_catalog.pg_default_acl
 where defaclnamespace=0 or defaclnamespace in (select oid from scope_namespaces)
),
view_tree(oid) as (
 select v.oid from pg_catalog.pg_class v join pg_catalog.pg_rewrite rw on rw.ev_class=v.oid
 join pg_catalog.pg_depend d on d.classid='pg_catalog.pg_rewrite'::regclass and d.objid=rw.oid
 where v.relkind in ('v','m') and d.refclassid='pg_catalog.pg_class'::regclass
 and d.refobjid in (select oid from relations) and d.refobjid<>v.oid
 union
 select v.oid from view_tree x join pg_catalog.pg_depend d on d.refobjid=x.oid
 and d.refclassid='pg_catalog.pg_class'::regclass and d.classid='pg_catalog.pg_rewrite'::regclass
 join pg_catalog.pg_rewrite rw on rw.oid=d.objid
 join pg_catalog.pg_class v on v.oid=rw.ev_class
 where v.relkind in ('v','m') and v.oid<>x.oid
),
report(section,object,evidence) as (
 select '00_context','audit_scope',pg_catalog.jsonb_build_object(
   'captured_at',pg_catalog.statement_timestamp(),'reader_role',current_user,
   'server_version',pg_catalog.current_setting('server_version'),
   'baseline_commit','2c133fbfda2a5af4427fafc9a26054b801ffb3b4',
   'missing_roles',(select coalesce(pg_catalog.jsonb_agg(w.name),'[]'::jsonb) from wanted_roles w
     where not exists(select 1 from actors a where a.rolname=w.name)),
   'notice','Catalog snapshot only. Existence/body match is not proof that a migration was fully applied.')
 union all
 select '01_tables',pg_catalog.format('public.%I',e.name),pg_catalog.jsonb_build_object(
   'expected_from',e.source,'present',t.oid is not null,
   'observed',(select pg_catalog.jsonb_build_object('kind',t.relkind,'owner',pg_catalog.pg_get_userbyid(t.relowner),
     'rls_enabled',t.relrowsecurity,'force_rls',t.relforcerowsecurity) where t.oid is not null))
 from expected_tables e left join relations t on t.nspname='public' and t.relname=e.name
 union all
 select '01_structure',t.qualified_name,pg_catalog.jsonb_build_object(
   'kind',t.relkind,'owner',pg_catalog.pg_get_userbyid(t.relowner),'rls_enabled',t.relrowsecurity,
   'force_rls',t.relforcerowsecurity,
   'rls_policy_count',(select pg_catalog.count(*) from pg_catalog.pg_policy pol where pol.polrelid=t.oid),
   'columns',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',a.attname,
     'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
     'has_default',a.atthasdef,'identity',a.attidentity,'generated',a.attgenerated,
     'explicit_acl',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
       'grantor',pg_catalog.pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb)
       from pg_catalog.aclexplode(a.attacl) x)) order by a.attnum),'[]'::jsonb)
     from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
   'table_acl',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
     'grantor',pg_catalog.pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb)
     from pg_catalog.aclexplode(coalesce(t.relacl,pg_catalog.acldefault('r',t.relowner))) x),
   'constraints',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',c.conname,'type',c.contype,
     'validated',c.convalidated,'deferrable',c.condeferrable,
     'columns',(select pg_catalog.jsonb_agg(a.attname order by k.ord) from pg_catalog.unnest(c.conkey) with ordinality k(attnum,ord)
       join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum),
     'references',case when c.confrelid<>0 then c.confrelid::regclass::text end,
     'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(c.oid),'UTF8')),'hex'))),'[]'::jsonb)
     from pg_catalog.pg_constraint c where c.conrelid=t.oid),
   'indexes',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',ic.relname,'unique',ix.indisunique,
     'valid',ix.indisvalid,'ready',ix.indisready,'partial',ix.indpred is not null,
     'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_indexdef(ix.indexrelid),'UTF8')),'hex'))),'[]'::jsonb)
     from pg_catalog.pg_index ix join pg_catalog.pg_class ic on ic.oid=ix.indexrelid where ix.indrelid=t.oid),
   'triggers',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',g.tgname,'enabled',g.tgenabled,
     'function',g.tgfoid::regprocedure::text,'event_mask',g.tgtype,
     'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_triggerdef(g.oid),'UTF8')),'hex'))),'[]'::jsonb)
     from pg_catalog.pg_trigger g where g.tgrelid=t.oid and not g.tgisinternal))
 from relations t
 union all
 select '02_effective_access',t.qualified_name||' / '||r.rolname,pg_catalog.jsonb_build_object(
   'schema_usage',pg_catalog.has_schema_privilege(r.oid,t.relnamespace,'USAGE'),
   'table',(select pg_catalog.jsonb_object_agg(p.privilege,pg_catalog.jsonb_build_object(
     'allowed',pg_catalog.has_table_privilege(r.oid,t.oid,p.privilege),
     'grantable',pg_catalog.has_table_privilege(r.oid,t.oid,p.privilege||' WITH GRANT OPTION')))
     from (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)),
   'columns',(select pg_catalog.jsonb_object_agg(p.privilege,pg_catalog.jsonb_build_object(
     'allowed_columns',(select coalesce(pg_catalog.jsonb_agg(a.attname order by a.attnum),'[]'::jsonb)
       from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
       and pg_catalog.has_column_privilege(r.oid,t.oid,a.attnum,p.privilege)),
     'grantable_columns',(select coalesce(pg_catalog.jsonb_agg(a.attname order by a.attnum),'[]'::jsonb)
       from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
       and pg_catalog.has_column_privilege(r.oid,t.oid,a.attnum,p.privilege||' WITH GRANT OPTION'))))
     from (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)))
 from relations t cross join actors r
 union all
 select '03_rls',t.qualified_name||' / '||pol.polname,pg_catalog.jsonb_build_object(
   'command',pol.polcmd,'permissive',pol.polpermissive,
   'roles',(select pg_catalog.jsonb_agg(case when id=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(id) end)
     from pg_catalog.unnest(pol.polroles) role_ids(id)),
   'using_redacted',pg_catalog.regexp_replace(pg_catalog.pg_get_expr(pol.polqual,pol.polrelid),$rx$'(?:[^'\\]|\\.|'')*'$rx$,$v$'[literal]'$v$,'g'),
   'check_redacted',pg_catalog.regexp_replace(pg_catalog.pg_get_expr(pol.polwithcheck,pol.polrelid),$rx$'(?:[^'\\]|\\.|'')*'$rx$,$v$'[literal]'$v$,'g'),
   'using_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_expr(pol.polqual,pol.polrelid),'UTF8')),'hex'),
   'check_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_expr(pol.polwithcheck,pol.polrelid),'UTF8')),'hex'))
 from relations t join pg_catalog.pg_policy pol on pol.polrelid=t.oid
 union all
 select '04_expected_rpc',e.signature,pg_catalog.jsonb_build_object('present',e.oid is not null,
   'expected_security_definer',e.definer,'expected_api_execute_roles',pg_catalog.to_jsonb(e.allowed_api_roles),
   'reference_migration',e.reference_migration,'expected_source_sha256',e.source_sha256,
   'source_matches_pr',case when e.source_sha256 is not null and p.oid is not null then
     e.source_sha256=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex') end)
 from resolved_functions e left join pg_catalog.pg_proc p on p.oid=e.oid
 union all
 select '04_observed_rpc',p.signature,pg_catalog.jsonb_build_object(
   'schema',p.nspname,'owner',pg_catalog.pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
   'language',(select lanname from pg_catalog.pg_language where oid=p.prolang),
   'return_type',pg_catalog.format_type(p.prorettype,null),'leakproof',p.proleakproof,
   'search_path',(select value from pg_catalog.unnest(p.proconfig) settings(value) where pg_catalog.split_part(value,'=',1)='search_path' limit 1),
   'other_setting_names',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.split_part(value,'=',1)),'[]'::jsonb)
     from pg_catalog.unnest(p.proconfig) settings(value) where pg_catalog.split_part(value,'=',1)<>'search_path'),
   'source_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex'),
   'acl',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
     'grantor',pg_catalog.pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb)
     from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x),
   'effective_execute',(select pg_catalog.jsonb_object_agg(r.rolname,pg_catalog.jsonb_build_object(
     'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),
     'grantable',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION'),
     'schema_usage',pg_catalog.has_schema_privilege(r.oid,p.pronamespace,'USAGE'))) from actors r))
 from routines p
 union all
 select '05_roles',r.rolname,pg_catalog.jsonb_build_object('superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,
   'create_role',r.rolcreaterole,'inherit',r.rolinherit,'login',r.rolcanlogin,
   'reachable_from',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('actor',a.rolname,
     'member',pg_catalog.pg_has_role(a.oid,r.oid,'MEMBER'),'privileges_inherited',pg_catalog.pg_has_role(a.oid,r.oid,'USAGE'),
     'can_set_role',case when pg_catalog.current_setting('server_version_num')::integer>=160000
       then pg_catalog.pg_has_role(a.oid,r.oid,'SET') else pg_catalog.pg_has_role(a.oid,r.oid,'MEMBER') end)),'[]'::jsonb)
     from actors a where a.oid=r.oid or pg_catalog.pg_has_role(a.oid,r.oid,'MEMBER')))
 from pg_catalog.pg_roles r where r.oid in (select oid from role_tree union select oid from relevant_owners)
 union all
 select '05_membership_edges',pg_catalog.pg_get_userbyid(m.member)||' -> '||pg_catalog.pg_get_userbyid(m.roleid),pg_catalog.jsonb_build_object(
   'admin_option',m.admin_option,
   'inherit_option',pg_catalog.to_jsonb(m)->'inherit_option','set_option',pg_catalog.to_jsonb(m)->'set_option',
   'grantor',pg_catalog.pg_get_userbyid(m.grantor))
 from pg_catalog.pg_auth_members m where m.member in (select oid from role_tree)
 union all
 select '06_schema',n.nspname,pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(n.nspowner),
   'acl',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
     'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb)
     from pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) x),
   'effective',(select pg_catalog.jsonb_object_agg(a.rolname,pg_catalog.jsonb_build_object('usage',pg_catalog.has_schema_privilege(a.oid,n.oid,'USAGE'),
     'create',pg_catalog.has_schema_privilege(a.oid,n.oid,'CREATE'))) from actors a))
 from pg_catalog.pg_namespace n where n.oid in (select oid from scope_namespaces)
 union all
 select '06_default_acl',pg_catalog.pg_get_userbyid(d.defaclrole)||' / '||coalesce(n.nspname,'GLOBAL')||' / '||d.defaclobjtype,
   pg_catalog.jsonb_build_object('creator',pg_catalog.pg_get_userbyid(d.defaclrole),'scope',coalesce(n.nspname,'GLOBAL'),
     'object_type',d.defaclobjtype,'grants',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
       'grantor',pg_catalog.pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb)
       from pg_catalog.aclexplode(d.defaclacl) x))
 from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
 where d.defaclnamespace=0 or d.defaclnamespace in (select oid from scope_namespaces)
 union all
 select '06_global_default_base',pg_catalog.pg_get_userbyid(o.oid)||' / '||k.kind,pg_catalog.jsonb_build_object(
   'creator',pg_catalog.pg_get_userbyid(o.oid),'object_type',k.kind,
   'explicit_global_override',d.oid is not null,
   'grants',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'grantee',case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end,
     'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb)
     from pg_catalog.aclexplode(coalesce(d.defaclacl,pg_catalog.acldefault(k.kind::"char",o.oid))) x))
 from relevant_owners o cross join (values('r'),('f'),('S'),('n')) k(kind)
 left join pg_catalog.pg_default_acl d on d.defaclrole=o.oid and d.defaclnamespace=0 and d.defaclobjtype=k.kind::"char"
 union all
 select '07_dependent_views',pg_catalog.format('%I.%I',n.nspname,c.relname),pg_catalog.jsonb_build_object(
   'kind',c.relkind,'owner',pg_catalog.pg_get_userbyid(c.relowner),
   'security_invoker',(select value from pg_catalog.unnest(c.reloptions) settings(value) where pg_catalog.split_part(value,'=',1)='security_invoker' limit 1),
   'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_viewdef(c.oid),'UTF8')),'hex'),
   'effective_select',(select pg_catalog.jsonb_object_agg(r.rolname,pg_catalog.jsonb_build_object(
     'select',pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT'),
     'schema_usage',pg_catalog.has_schema_privilege(r.oid,c.relnamespace,'USAGE'))) from actors r))
 from view_tree v join pg_catalog.pg_class c on c.oid=v.oid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
)
select section,object,evidence from report order by section,object;
