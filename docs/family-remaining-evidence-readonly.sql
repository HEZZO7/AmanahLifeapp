-- AmanahLife: four remaining family-security evidence checks.
-- READ ONLY: catalog metadata only; no customer/family records are selected.
-- Do not run migrations or change permissions to collect this evidence.
--
-- SUPABASE SQL EDITOR (including mobile):
-- 1. Open the intended project -> SQL Editor -> New query.
-- 2. Copy ONE numbered section below, including its complete SELECT/WITH.
-- 3. Press Run. Export that result as CSV BEFORE running the next section.
--    If Export is unavailable, copy every result cell without truncation.
-- 4. Save as family-check-1.csv, family-check-2.csv, etc.
-- 5. Repeat for all four sections. Do not execute the whole file together:
--    the editor may show/export only the final statement's result.
-- 6. If an error occurs, share its exact text; do not alter database grants.
-- Zero rows means no matching visible metadata, not proof of system safety.
-- Function definitions may contain legacy embedded secrets: inspect/redact
-- results privately before sharing. This file contains no credentials.

-- =====================================================================
-- CHECK 1: Family table structure, constraints and indexes.
-- Run ONLY this statement; export as family-check-1.csv.
-- =====================================================================
WITH family_tables AS (
  SELECT c.oid, n.nspname, c.relname, c.relowner,
         c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    AND (c.relname ~ '^app_11941c8fec_family'
         OR c.relname = 'app_11941c8fec_families')
)
SELECT t.nspname AS schema_name, t.relname AS table_name,
       pg_get_userbyid(t.relowner) AS owner,
       t.relrowsecurity AS rls_enabled, t.relforcerowsecurity AS rls_forced,
       (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.ordinal_position), '[]'::jsonb)
        FROM (
          SELECT ordinal_position, column_name, data_type, udt_name,
                 is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = t.nspname AND table_name = t.relname
        ) x) AS columns,
       (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.name), '[]'::jsonb)
        FROM (
          SELECT conname AS name, contype AS type, convalidated AS validated,
                 pg_get_constraintdef(oid) AS definition
          FROM pg_constraint WHERE conrelid = t.oid
        ) x) AS constraints,
       (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.indexname), '[]'::jsonb)
        FROM (
          SELECT indexname, indexdef FROM pg_indexes
          WHERE schemaname = t.nspname AND tablename = t.relname
        ) x) AS indexes
FROM family_tables t
ORDER BY t.relname;

-- =====================================================================
-- CHECK 2: Exact family-table RLS policies and authorization expressions.
-- Run ONLY this statement; export as family-check-2.csv.
-- =====================================================================
SELECT schemaname AS schema_name, tablename AS table_name,
       policyname, permissive, roles, cmd, qual AS using_expression,
       with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename ~ '^app_11941c8fec_family'
       OR tablename = 'app_11941c8fec_families')
ORDER BY tablename, policyname;

-- =====================================================================
-- CHECK 3: Actual non-internal family triggers and their function callers.
-- Run ONLY this statement; export as family-check-3.csv.
-- =====================================================================
SELECT n.nspname AS table_schema, c.relname AS table_name,
       t.tgname AS trigger_name, t.tgenabled AS enabled,
       pg_get_triggerdef(t.oid) AS trigger_definition,
       fn.nspname AS function_schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS function_arguments
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace fn ON fn.oid = p.pronamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND (c.relname ~ '^app_11941c8fec_family'
       OR c.relname = 'app_11941c8fec_families')
ORDER BY c.relname, t.tgname;

-- =====================================================================
-- CHECK 4: Join-family / join-code-generator definitions and EXECUTE ACLs.
-- No parameter-name filter: return every matching overload/signature.
-- Run ONLY this statement; export as family-check-4.csv.
-- This inspects definitions; it does NOT invoke any of these functions.
-- =====================================================================
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS return_type,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS definition,
       (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.grantee), '[]'::jsonb)
        FROM (
          SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                      ELSE pg_get_userbyid(a.grantee) END AS grantee,
                 a.privilege_type, a.is_grantable
          FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        ) x) AS direct_execution_grants,
       (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.role_name), '[]'::jsonb)
        FROM (
          SELECT r.rolname AS role_name,
                 has_function_privilege(r.oid, p.oid, 'EXECUTE') AS may_execute
          FROM pg_roles r
          WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
        ) x) AS effective_execution
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND (p.proname IN ('app_11941c8fec_join_family_with_code',
                    'app_11941c8fec_generate_join_code')
       OR p.proname ~ '^app_11941c8fec_.*join.*family'
       OR p.proname ~ '^app_11941c8fec_.*generate.*join.*code')
ORDER BY p.proname, identity_arguments;
