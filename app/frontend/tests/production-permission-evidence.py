"""Run only in isolated CI; all SQL issued here is catalog SELECT.
No schema setup, application RPCs, writes, migrations or production access.
"""
import csv
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys

assert os.environ.get("PGHOST") in {"localhost", "127.0.0.1"}, "Isolated localhost only"
assert os.environ.get("PGDATABASE") == "postgres", "Unexpected fixture database"
mode = sys.argv[1] if len(sys.argv) > 1 else "populated"
assert mode in {"populated", "empty"}
env = dict(os.environ)
env["PGOPTIONS"] = env.get("PGOPTIONS", "") + " -c default_transaction_read_only=on -c statement_timeout=30000 -c search_path=pg_catalog"
sql = Path("../../docs/production-permissions-evidence-readonly.sql").read_text()
def run(text, success=True):
    result = subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "--csv", "-f", "-"],
        input=text, text=True, capture_output=True, env=env, timeout=45)
    if success and result.returncode:
        raise AssertionError(result.stderr)
    return result

assert list(csv.DictReader(io.StringIO(run("select current_setting('transaction_read_only') as value;").stdout)))[0]["value"] == "on"
assert "||d.defaclobjtype::text," in sql
# Reproduce the precise production parse error without changing any catalog.
old = sql.replace("||d.defaclobjtype::text,", "||d.defaclobjtype,")
failure = run(old, success=False)
assert failure.returncode != 0 and "42725" in failure.stderr, failure.stderr
print("PASS: original full query reproduces SQLSTATE 42725")

rows = list(csv.DictReader(io.StringIO(run(sql).stdout)))
assert rows and set(rows[0]) == {"section", "object", "evidence"}
for row in rows:
    row["evidence"] = json.loads(row["evidence"])
sections = {r["section"] for r in rows}
assert {"00_context", "01_tables", "04_expected_rpc", "05_roles", "06_global_default_base"} <= sections
expected = [r for r in rows if r["section"] == "04_expected_rpc"]
assert len(expected) == 33
if mode == "populated":
    assert {"01_structure", "02_effective_access", "03_rls", "04_observed_rpc"} <= sections
    assert all(r["evidence"]["present"] for r in expected)
    matched = [r for r in expected if r["evidence"]["expected_source_sha256"] is not None]
    assert len(matched) == 30
    assert all(r["evidence"]["source_matches_pr"] for r in matched)
else:
    assert not any(r["evidence"]["present"] for r in expected)
print(f"PASS: exact corrected file parses and executes, {len(rows)} rows; mode={mode}; expected RPCs=33")

# Exercise global AND schema default ACL rows even on a fresh database.
# This is a read-only CTE substitute for pg_default_acl in a test COPY of the
# query, never a database object or catalog mutation. Exact file ran above.
catalog_fixture = """audit_default_acl_fixture as (
 select (900000000 + k.number + scope.number)::oid as oid,
 r.oid as defaclrole, scope.namespace as defaclnamespace,
 k.kind::"char" as defaclobjtype,
 pg_catalog.acldefault(k.kind::"char",r.oid) as defaclacl
 from pg_catalog.pg_roles r
 cross join (values ('r',1),('f',2),('S',3),('n',4)) k(kind,number)
 cross join (
  select 0::oid as namespace,0 as number
  union all select oid,10 from pg_catalog.pg_namespace where nspname='public'
 ) scope
 where r.rolname='postgres'
),
"""
variant = sql.replace("pg_catalog.pg_default_acl", "audit_default_acl_fixture")
variant = variant.replace("with recursive\n", "with recursive\n" + catalog_fixture, 1)
assert variant != sql
fixture_rows = list(csv.DictReader(io.StringIO(run(variant).stdout)))
defaults = [json.loads(r["evidence"]) for r in fixture_rows if r["section"] == "06_default_acl"]
assert len(defaults) == 8
assert {r["object_type"] for r in defaults} == {"r", "f", "S", "n"}
assert {r["scope"] for r in defaults} == {"GLOBAL", "public"}
print("PASS: full read-only CTE variant exercises 8 default-ACL rows, all four internal-char object types")

# Catalog source audit; no unqualified application relations or RPC calls.
assert not re.search(r"\b(?:from|join)\s+(?:public|auth|vault|cron|net)\.", sql, re.I)
assert not re.search(r"\b(?:select|perform|call)\s+(?:public|auth)\.", sql, re.I)
print("PASS: read-only transaction enforced throughout; no production connection or application RPC")
