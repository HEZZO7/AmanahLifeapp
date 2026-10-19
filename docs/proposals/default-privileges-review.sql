-- PROPOSAL ONLY; intentionally outside automatic migration discovery.
-- Not production-authorized. Review all future public-object creation callers first.
-- The CSV shows defaults for postgres and managed supabase_admin.
-- Do NOT alter auth defaults or managed supabase_admin privileges blindly.
-- Existing objects are unaffected by ALTER DEFAULT PRIVILEGES.
-- A schema-local revoke cannot undo the built-in global PUBLIC EXECUTE default:
-- revoke PUBLIC explicitly on each new function in the reviewed migration instead.

begin;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- Grant only intended API access explicitly for every newly created object.
-- supabase_admin-created objects require a separately authorized managed-owner plan.
rollback; -- Review template: changing to COMMIT requires explicit approval.
