-- Fresh disposable PostgreSQL ONLY. No Supabase project or billing objects.
\set ON_ERROR_STOP on
do $$ begin
 if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated'
  or to_regclass('auth.users') is not null then raise exception 'Fresh isolated database required'; end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- Ephemeral local gateway, not a real Supabase credential.
create role authenticator login noinherit password 'isolated-local-only';
grant anon,authenticated,service_role to authenticator;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.role() returns text language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
 nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')
$$;
grant usage on schema public,auth to anon,authenticated,service_role;
-- Match Supabase's public schema: untrusted roles do not create objects.
revoke create on schema public from public;
create function public.fixture_assert(ok boolean,message text) returns void language plpgsql as $$
 begin if ok is distinct from true then raise exception '%',message; end if; end $$;
create function public.fixture_expect_denied(command text) returns void language plpgsql security invoker as $$
 begin begin execute command; exception when insufficient_privilege then return; end;
 raise exception 'Expected permission denial: %',command; end $$;
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
-- Real Supabase postgres is not a superuser. Preserve only needed test setup
-- capabilities. Reconnecting as it still exercises ordinary owner ACLs/RLS.
alter role postgres nosuperuser bypassrls createrole;
