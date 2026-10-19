// Test-only local function. No Auth, database access, environment reads or writes.
Deno.serve(() => Response.json({ deno: Deno.version.deno, os: Deno.build.os, arch: Deno.build.arch }));
