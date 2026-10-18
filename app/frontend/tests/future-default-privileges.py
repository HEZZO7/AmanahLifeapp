"""Isolated-only proof for separately reviewed future-default proposal."""
import os
from pathlib import Path
import subprocess
assert os.environ.get("PGHOST")=="localhost"
def sql(text):
 r=subprocess.run(["psql","-X","-At","-v","ON_ERROR_STOP=1","-f","-"],input=text,text=True,capture_output=True,timeout=45)
 assert r.returncode==0,r.stderr
 return r.stdout
assert sql("select current_setting('amanahlife.security_fixture',true);").strip()=="isolated"
snapshot="""select md5(string_agg(oid::text||coalesce(relacl::text,''),'|' order by oid))
 from pg_class where relnamespace='public'::regnamespace;"""
before=sql(snapshot)
proposal=Path("supabase/manual-preparation/review_postgres_future_defaults.sql").read_text()
sql(proposal);sql(proposal)
assert sql(snapshot)==before,"Existing object ACL changed"
sql("""begin;
create table public.fixture_future_object(id integer);
create sequence public.fixture_future_sequence;
create function public.fixture_future_rpc() returns integer language sql security definer set search_path='' as $$select 1$$;
select public.fixture_assert(not has_table_privilege('anon','public.fixture_future_object','SELECT'),'Future table exposed');
select public.fixture_assert(not has_table_privilege('authenticated','public.fixture_future_object','TRUNCATE'),'Future table truncatable');
select public.fixture_assert(not has_sequence_privilege('anon','public.fixture_future_sequence','USAGE'),'Future sequence exposed');
select public.fixture_assert(not has_function_privilege('anon','public.fixture_future_rpc()','EXECUTE')
 and not has_function_privilege('authenticated','public.fixture_future_rpc()','EXECUTE')
 and not has_function_privilege('service_role','public.fixture_future_rpc()','EXECUTE'),'Future function exposed');
rollback;""")
print("PASS: future-default proposal is repeatable; existing object ACL unchanged; new objects closed")

