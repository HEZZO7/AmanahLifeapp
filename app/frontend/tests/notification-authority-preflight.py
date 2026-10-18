"""Isolated-only regression: inherited grants must abort migration atomically."""
import os
from pathlib import Path
import subprocess
assert os.environ.get("PGHOST") == "localhost"
def sql(text, ok=True):
 r=subprocess.run(["psql","-X","-At","-v","ON_ERROR_STOP=1","-f","-"],input=text,text=True,capture_output=True,timeout=45)
 if ok and r.returncode: raise AssertionError(r.stderr)
 return r
assert sql("select current_setting('amanahlife.security_fixture',true);").stdout.strip()=="isolated"
source=Path("supabase/migrations/202610180007_notification_table_authority.sql").read_text()
snapshot="""select md5(jsonb_agg(jsonb_build_object('name',c.relname,'acl',c.relacl::text,
 'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p where p.polrelid=c.oid)) order by c.relname)::text)
 from pg_class c where c.oid in ('public.app_11941c8fec_notification_preferences'::regclass,'public.app_11941c8fec_push_subscriptions'::regclass);"""
sql("create role fixture_notification_legacy nologin; grant select on public.app_11941c8fec_push_subscriptions to fixture_notification_legacy; grant fixture_notification_legacy to authenticated;")
try:
 before=sql(snapshot).stdout
 failed=sql(source,ok=False)
 assert failed.returncode and "Inherited/excess table permission" in failed.stderr,failed.stderr
 assert sql(snapshot).stdout==before,"Failed migration left partial ACL/policy changes"
 print("PASS: unreviewed inherited grant aborts and rolls back the complete migration")
finally:
 sql("revoke fixture_notification_legacy from authenticated; revoke all on public.app_11941c8fec_push_subscriptions from fixture_notification_legacy; drop role fixture_notification_legacy;")
sql(source)
print("PASS: migration remains repeatable after isolated fault cleanup")

