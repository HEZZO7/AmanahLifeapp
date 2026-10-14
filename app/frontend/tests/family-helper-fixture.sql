-- Isolated CI only. Function bodies are the supplied definitions, without secrets.
-- Family tables/policies/triggers here are representative fixtures, NOT verified
-- production definitions; tests validate helper behavior and the scoped migration.
\set ON_ERROR_STOP on
do $$ begin
 if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then
  raise exception 'Isolated fixture marker required'; end if;
end $$;
alter table auth.users add column email text;
create table public.app_11941c8fec_families (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id),
 name text, join_code text
);
create table public.app_11941c8fec_family_members (
 id uuid primary key default gen_random_uuid(), family_id uuid references public.app_11941c8fec_families(id),
 user_id uuid references auth.users(id), display_name text, member_role text
);
-- The real generator definition is still missing; this stub only exercises call resolution.
create function public.app_11941c8fec_generate_join_code()
returns text language sql as $$ select 'FIXTURE-CODE'::text $$;

CREATE OR REPLACE FUNCTION public.app_11941c8fec_add_owner_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_name text;
begin
  select coalesce(nullif(split_part(u.email, '@', 1), ''), 'Owner')
    into v_name
  from auth.users u
  where u.id = new.owner_user_id;

  insert into public.app_11941c8fec_family_members
    (family_id, user_id, display_name, member_role)
  values
    (new.id, new.owner_user_id, coalesce(v_name, 'Owner'), 'owner');

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.app_11941c8fec_is_family_member(p_family_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.app_11941c8fec_family_members m
    where m.family_id = p_family_id
      and m.user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.app_11941c8fec_is_family_owner(p_family_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.app_11941c8fec_families f
    where f.id = p_family_id
      and f.owner_user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.app_11941c8fec_set_join_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  candidate text;
  attempts  int := 0;
begin
  if new.join_code is not null and new.join_code <> '' then
    return new;
  end if;

  loop
    candidate := public.app_11941c8fec_generate_join_code();
    exit when not exists (
      select 1 from public.app_11941c8fec_families where join_code = candidate
    );
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'could not generate a unique family join code after % attempts', attempts;
    end if;
  end loop;

  new.join_code := candidate;
  return new;
end;
$function$
;

grant execute on function public.app_11941c8fec_is_family_member(uuid),
 public.app_11941c8fec_is_family_owner(uuid),
 public.app_11941c8fec_add_owner_as_member(),
 public.app_11941c8fec_set_join_code()
to anon, authenticated, service_role;
create trigger fixture_set_code before insert on public.app_11941c8fec_families
 for each row execute function public.app_11941c8fec_set_join_code();
create trigger fixture_add_owner after insert on public.app_11941c8fec_families
 for each row execute function public.app_11941c8fec_add_owner_as_member();
alter table public.app_11941c8fec_families enable row level security;
alter table public.app_11941c8fec_family_members enable row level security;
grant select on public.app_11941c8fec_families, public.app_11941c8fec_family_members to authenticated;
grant select,insert,update,delete on public.app_11941c8fec_families, public.app_11941c8fec_family_members to service_role;
create policy fixture_family_read on public.app_11941c8fec_families
 for select to authenticated using (owner_user_id=auth.uid());
create policy fixture_member_read on public.app_11941c8fec_family_members
 for select to authenticated using (user_id=auth.uid());
