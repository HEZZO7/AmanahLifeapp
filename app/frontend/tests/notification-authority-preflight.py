"""Isolated-only: effective privileges, idempotency and atomic ACL/data rollback."""
import os
from pathlib import Path
import subprocess

assert os.environ.get("PGHOST") == "localhost"

def sql(text, ok=True):
    result = subprocess.run(
        ["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"],
        input=text, text=True, capture_output=True, timeout=45)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    return result

assert sql("select current_setting('amanahlife.security_fixture',true);").stdout.strip() == "isolated"
source = Path("supabase/migrations/202610180007_notification_table_authority.sql").read_text()
version = int(sql("show server_version_num").stdout.strip())
tables = ["app_11941c8fec_notification_preferences", "app_11941c8fec_push_subscriptions"]
# Include row data, table and column ACLs, RLS flags, constraint/index definitions,
# and policy OIDs: a failed migration must restore even its dropped policies.
snapshot = """select md5(jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'acl',c.relacl::text,
 'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
 'columns',(select jsonb_agg(to_jsonb(a) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0),
 'constraints',(select jsonb_agg(to_jsonb(k) order by k.oid) from pg_constraint k where k.conrelid=c.oid),
 'indices',(select jsonb_agg(to_jsonb(i) order by i.indexrelid) from pg_index i where i.indrelid=c.oid),
 'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p where p.polrelid=c.oid)) order by c.relname)
 from pg_class c where c.oid in ('public.app_11941c8fec_notification_preferences'::regclass,'public.app_11941c8fec_push_subscriptions'::regclass)),
 'preferences',(select jsonb_agg(to_jsonb(p) order by user_id) from public.app_11941c8fec_notification_preferences p),
 'push',(select jsonb_agg(to_jsonb(p) order by user_id,endpoint) from public.app_11941c8fec_push_subscriptions p))::text);"""

cases = [("authenticated", tables[1], "SELECT", False)]
if version >= 170000:
    cases += [(actor, table, "MAINTAIN", grant_option)
              for actor in ("anon", "authenticated", "service_role")
              for table in tables for grant_option in (False, True)]
    # Broad direct grants are revoked, not mistakenly retained on PG17+.
    for table in tables:
        sql(f"grant MAINTAIN on public.{table} to anon,authenticated,service_role")
    sql(source)
    for actor in ("anon", "authenticated", "service_role"):
        for table in tables:
            assert sql(f"select has_table_privilege('{actor}','public.{table}','MAINTAIN')").stdout.strip() == "f"
    print("PASS: direct MAINTAIN removed for all three API roles on both tables")
else:
    print("PASS: PG<17 runs migration without querying unsupported MAINTAIN privilege")

for actor, table, privilege, grant_option in cases:
    sql(f"create role fixture_notification_legacy nologin; grant {privilege} on public.{table} to fixture_notification_legacy"
        + (" with grant option" if grant_option else "")
        + f"; grant fixture_notification_legacy to {actor};")
    try:
        assert sql(f"select has_table_privilege('{actor}','public.{table}','{privilege}')").stdout.strip() == "t"
        before = sql(snapshot).stdout
        failed = sql(source, ok=False)
        assert failed.returncode and "Inherited/excess table permission" in failed.stderr, failed.stderr
        assert privilege in failed.stderr, "Migration failed for the wrong privilege"
        assert sql(snapshot).stdout == before, "Failed migration left changed ACLs/policies/schema/data"
        print(f"PASS: inherited {privilege} / {actor} / {table} / grant_option={grant_option} aborts atomically")
    finally:
        sql(f"revoke fixture_notification_legacy from {actor}; revoke all on public.{table} from fixture_notification_legacy; drop role fixture_notification_legacy;")
    sql(source)
# Reapply after fault cleanup; preservation is independently asserted by SQL tests.
sql(source)
print("PASS: migration remains repeatable after all isolated fault cleanup")
