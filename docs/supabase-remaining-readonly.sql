-- AmanahLife: remaining security evidence, ONE read-only statement.
-- Select the intended Supabase project, paste ALL of this file, press Run once.
-- Output: seven numbered rows. Copy each evidence cell completely.
-- [] means no matching metadata found, not proof of overall system safety.
-- No customer rows, function bodies, credentials, writes, or migrations.
-- Catalog access is required. If denied, send the exact error; do not change grants.

WITH RECURSIVE
target AS (
  SELECT c.oid, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity,
         n.nspname, c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = to_regclass('public.app_11941c8fec_subscriptions')
),
api_roles AS (
  SELECT oid, rolname, rolsuper, rolbypassrls, rolinherit
  FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
),
-- Traverse indirect role memberships, not just the first level.
role_chain(root_oid, role_oid) AS (
  SELECT oid, oid FROM api_roles
  UNION
  SELECT rc.root_oid, m.roleid
  FROM role_chain rc JOIN pg_auth_members m ON m.member = rc.role_oid
),
structure AS (
  SELECT t.nspname AS schema_name, t.relname AS table_name,
         pg_get_userbyid(t.relowner) AS owner,
         t.relrowsecurity AS rls_enabled, t.relforcerowsecurity AS rls_forced,
         (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.ordinal_position), '[]'::jsonb)
          FROM (SELECT ordinal_position, column_name, data_type, udt_name,
                       is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = t.nspname AND table_name = t.relname) x) AS columns,
         (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.name), '[]'::jsonb)
          FROM (SELECT conname AS name, contype AS type, convalidated AS validated,
                       pg_get_constraintdef(oid) AS definition
                FROM pg_constraint WHERE conrelid = t.oid) x) AS constraints,
         (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.indexname), '[]'::jsonb)
          FROM (SELECT indexname, indexdef FROM pg_indexes
                WHERE schemaname = t.nspname AND tablename = t.relname) x) AS indexes,
         (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.type_name, x.enumsortorder), '[]'::jsonb)
          FROM (SELECT ty.typname AS type_name, e.enumlabel, e.enumsortorder
                FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
                JOIN pg_enum e ON e.enumtypid = ty.oid
                WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped) x) AS enum_values
  FROM target t
),
policies AS (
  SELECT policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'app_11941c8fec_subscriptions'
),
table_acl AS (
  SELECT 'table'::text AS scope, NULL::text AS column_name,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'
              ELSE pg_get_userbyid(a.grantee) END AS grantee,
         pg_get_userbyid(a.grantor) AS grantor,
         a.privilege_type, a.is_grantable
  FROM target t
  CROSS JOIN LATERAL aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) a
  UNION ALL
  SELECT 'column', att.attname::text,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'
              ELSE pg_get_userbyid(a.grantee) END,
         pg_get_userbyid(a.grantor), a.privilege_type, a.is_grantable
  FROM target t JOIN pg_attribute att ON att.attrelid = t.oid
  CROSS JOIN LATERAL aclexplode(att.attacl) a
  WHERE att.attnum > 0 AND NOT att.attisdropped
),
effective_access AS (
  SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolinherit,
         has_schema_privilege(r.oid, t.nspname, 'USAGE') AS schema_usage,
         has_table_privilege(r.oid, t.oid, 'SELECT') AS can_select,
         has_table_privilege(r.oid, t.oid, 'INSERT') AS can_insert,
         has_table_privilege(r.oid, t.oid, 'UPDATE') AS can_update,
         has_table_privilege(r.oid, t.oid, 'DELETE') AS can_delete,
         has_table_privilege(r.oid, t.oid, 'TRUNCATE') AS can_truncate,
         has_table_privilege(r.oid, t.oid, 'REFERENCES') AS can_reference,
         has_table_privilege(r.oid, t.oid, 'TRIGGER') AS can_trigger,
         (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.role_name), '[]'::jsonb)
          FROM (SELECT pg_get_userbyid(rc.role_oid) AS role_name,
                       has_role.rolsuper, has_role.rolbypassrls,
                       pg_has_role(r.oid, rc.role_oid, 'USAGE') AS inherited_now
                FROM role_chain rc JOIN pg_roles has_role ON has_role.oid = rc.role_oid
                WHERE rc.root_oid = r.oid AND rc.role_oid <> r.oid) x) AS memberships
  FROM api_roles r CROSS JOIN target t
),
-- Include account-signup triggers as well as subscription-table triggers.
trigger_info AS (
  SELECT t.oid, t.tgfoid, n.nspname AS table_schema, c.relname AS table_name,
         t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition,
         fn.nspname AS function_schema, p.proname AS function_name
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace fn ON fn.oid = p.pronamespace
  WHERE t.tgrelid IN (to_regclass('public.app_11941c8fec_subscriptions'),
                      to_regclass('auth.users'))
    AND NOT t.tgisinternal
),
function_info AS (
  SELECT n.nspname AS schema_name, p.proname,
         pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         pg_get_function_result(p.oid) AS return_type,
         pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS security_definer,
         (SELECT coalesce(jsonb_agg(setting), '[]'::jsonb)
          FROM unnest(p.proconfig) setting WHERE setting LIKE 'search_path=%') AS search_path,
         (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.role_name), '[]'::jsonb)
          FROM (SELECT r.rolname AS role_name,
                       has_function_privilege(r.oid, p.oid, 'EXECUTE') AS may_execute
                FROM api_roles r) x) AS effective_execute,
         (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
          FROM (SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                            ELSE pg_get_userbyid(a.grantee) END AS grantee,
                       a.privilege_type, a.is_grantable
                FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a) x) AS direct_acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f'
    AND (p.oid IN (SELECT tgfoid FROM trigger_info)
         OR (n.nspname = 'public'
             AND (p.prosecdef OR p.prosrc ILIKE '%app_11941c8fec_subscriptions%'
                  OR p.proname ILIKE '%subscription%' OR p.proname ILIKE '%trial%'
                  OR p.proname ILIKE '%checkout%' OR p.proname ILIKE '%webhook%')))
),
default_acl AS (
  SELECT pg_get_userbyid(d.defaclrole) AS object_owner,
         coalesce(n.nspname, '(global)') AS schema_name, d.defaclobjtype AS object_type,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'
              ELSE pg_get_userbyid(a.grantee) END AS grantee,
         a.privilege_type, a.is_grantable
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclnamespace = 0 OR n.nspname IN ('public', 'auth')
),
sections AS (
  SELECT 1 AS check_no, 'Table structure, constraints, indexes and RLS flags' AS topic,
         coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) AS evidence FROM structure x
  UNION ALL
  SELECT 2, 'Exact policy commands, roles and expressions',
         coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM policies x
  UNION ALL
  SELECT 3, 'Direct table/column grants including PUBLIC',
         coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM table_acl x
  UNION ALL
  SELECT 4, 'Effective privileges, bypass flags and transitive role membership',
         coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM effective_access x
  UNION ALL
  SELECT 5, 'Subscription and account-signup triggers',
         coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM trigger_info x
  UNION ALL
  SELECT 6, 'Relevant/privileged function metadata and execution grants',
         coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM function_info x
  UNION ALL
  SELECT 7, 'Configured default grants for future objects',
         coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM default_acl x
)
SELECT check_no, topic, jsonb_pretty(evidence) AS evidence
FROM sections ORDER BY check_no;

-- Function bodies are intentionally omitted. Once functions are identified,
-- request ONLY the relevant redacted definitions in a separate review.
-- Absence of explicit default ACL does not imply absence of PostgreSQL defaults.
-- API exposed schemas, JWT settings, deployment and Lemon Squeezy require dashboard evidence.
