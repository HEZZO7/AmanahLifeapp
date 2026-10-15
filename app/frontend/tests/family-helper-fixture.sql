-- Isolated PostgreSQL CI ONLY. Reconstructed from supplied catalog metadata.
-- No CSV, customer rows, production credentials or production connection.
\set ON_ERROR_STOP on
do $$ begin
 if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated' then
 raise exception 'Isolated fixture marker required'; end if;
end $$;
alter table auth.users add column email text;
create table public.app_11941c8fec_families (
 id uuid default gen_random_uuid() not null,
 owner_user_id uuid not null,
 name text default 'My Family'::text not null,
 join_code text not null,
 created_at timestamp with time zone default now() not null,
 updated_at timestamp with time zone default now() not null
);
create table public.app_11941c8fec_family_members (
 id uuid default gen_random_uuid() not null,
 family_id uuid not null,
 user_id uuid,
 display_name text not null,
 member_role text default 'member'::text not null,
 household_role text,
 joined_at timestamp with time zone default now() not null,
 age_group text default 'adult'::text not null
);
create table public.app_11941c8fec_family_budget_settings (
 family_id uuid not null,
 monthly_budget numeric default 6200 not null,
 goal_hajj numeric default 20000 not null,
 goal_education numeric default 15000 not null,
 goal_emergency numeric default 10000 not null,
 goal_savings numeric default 30000 not null,
 updated_at timestamp with time zone default now() not null
);
create table public.app_11941c8fec_family_budget_categories (
 id uuid default gen_random_uuid() not null,
 family_id uuid not null,
 name text not null,
 name_ar text,
 icon text,
 budgeted numeric default 0 not null,
 sort_order integer default 0 not null
);
create table public.app_11941c8fec_family_income (
 id uuid default gen_random_uuid() not null,
 family_id uuid not null,
 source text not null,
 amount numeric not null,
 currency text default 'USD'::text not null,
 amount_base numeric not null,
 entry_date date default CURRENT_DATE not null,
 created_by uuid,
 created_at timestamp with time zone default now() not null,
 local_id text
);
create table public.app_11941c8fec_family_expenses (
 id uuid default gen_random_uuid() not null,
 family_id uuid not null,
 category text not null,
 description text default ''::text not null,
 amount numeric not null,
 currency text default 'USD'::text not null,
 amount_base numeric not null,
 entry_date date default CURRENT_DATE not null,
 created_by uuid,
 created_at timestamp with time zone default now() not null,
 local_id text
);
alter table public.app_11941c8fec_families add constraint app_11941c8fec_families_join_code_key UNIQUE (join_code);
alter table public.app_11941c8fec_families add constraint app_11941c8fec_families_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.app_11941c8fec_families add constraint app_11941c8fec_families_pkey PRIMARY KEY (id);
alter table public.app_11941c8fec_families enable row level security;
grant all on public.app_11941c8fec_families to anon,authenticated,service_role;
alter table public.app_11941c8fec_family_members add constraint app_11941c8fec_family_members_age_group_check CHECK ((age_group = ANY (ARRAY['adult'::text, 'minor'::text])));
alter table public.app_11941c8fec_family_members add constraint app_11941c8fec_family_members_family_id_fkey FOREIGN KEY (family_id) REFERENCES app_11941c8fec_families(id) ON DELETE CASCADE;
alter table public.app_11941c8fec_family_members add constraint app_11941c8fec_family_members_family_id_user_id_key UNIQUE (family_id, user_id);
alter table public.app_11941c8fec_family_members add constraint app_11941c8fec_family_members_member_role_check CHECK ((member_role = ANY (ARRAY['owner'::text, 'member'::text])));
alter table public.app_11941c8fec_family_members add constraint app_11941c8fec_family_members_pkey PRIMARY KEY (id);
alter table public.app_11941c8fec_family_members add constraint app_11941c8fec_family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX app_11941c8fec_family_members_user_idx ON public.app_11941c8fec_family_members USING btree (user_id);
CREATE INDEX app_11941c8fec_family_members_family_idx ON public.app_11941c8fec_family_members USING btree (family_id);
alter table public.app_11941c8fec_family_members enable row level security;
grant all on public.app_11941c8fec_family_members to anon,authenticated,service_role;
alter table public.app_11941c8fec_family_budget_settings add constraint app_11941c8fec_family_budget_settings_family_id_fkey FOREIGN KEY (family_id) REFERENCES app_11941c8fec_families(id) ON DELETE CASCADE;
alter table public.app_11941c8fec_family_budget_settings add constraint app_11941c8fec_family_budget_settings_pkey PRIMARY KEY (family_id);
alter table public.app_11941c8fec_family_budget_settings enable row level security;
grant all on public.app_11941c8fec_family_budget_settings to anon,authenticated,service_role;
alter table public.app_11941c8fec_family_budget_categories add constraint app_11941c8fec_family_budget_categories_family_id_fkey FOREIGN KEY (family_id) REFERENCES app_11941c8fec_families(id) ON DELETE CASCADE;
alter table public.app_11941c8fec_family_budget_categories add constraint app_11941c8fec_family_budget_categories_family_id_name_key UNIQUE (family_id, name);
alter table public.app_11941c8fec_family_budget_categories add constraint app_11941c8fec_family_budget_categories_pkey PRIMARY KEY (id);
alter table public.app_11941c8fec_family_budget_categories enable row level security;
grant all on public.app_11941c8fec_family_budget_categories to anon,authenticated,service_role;
alter table public.app_11941c8fec_family_income add constraint app_11941c8fec_family_income_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.app_11941c8fec_family_income add constraint app_11941c8fec_family_income_family_id_fkey FOREIGN KEY (family_id) REFERENCES app_11941c8fec_families(id) ON DELETE CASCADE;
alter table public.app_11941c8fec_family_income add constraint app_11941c8fec_family_income_family_local_uniq UNIQUE (family_id, local_id);
alter table public.app_11941c8fec_family_income add constraint app_11941c8fec_family_income_pkey PRIMARY KEY (id);
CREATE INDEX app_11941c8fec_family_income_family_idx ON public.app_11941c8fec_family_income USING btree (family_id, entry_date DESC);
alter table public.app_11941c8fec_family_income enable row level security;
grant all on public.app_11941c8fec_family_income to anon,authenticated,service_role;
alter table public.app_11941c8fec_family_expenses add constraint app_11941c8fec_family_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.app_11941c8fec_family_expenses add constraint app_11941c8fec_family_expenses_family_id_fkey FOREIGN KEY (family_id) REFERENCES app_11941c8fec_families(id) ON DELETE CASCADE;
alter table public.app_11941c8fec_family_expenses add constraint app_11941c8fec_family_expenses_family_local_uniq UNIQUE (family_id, local_id);
alter table public.app_11941c8fec_family_expenses add constraint app_11941c8fec_family_expenses_pkey PRIMARY KEY (id);
CREATE INDEX app_11941c8fec_family_expenses_family_idx ON public.app_11941c8fec_family_expenses USING btree (family_id, entry_date DESC);
CREATE INDEX app_11941c8fec_family_expenses_category_idx ON public.app_11941c8fec_family_expenses USING btree (family_id, category);
alter table public.app_11941c8fec_family_expenses enable row level security;
grant all on public.app_11941c8fec_family_expenses to anon,authenticated,service_role;
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

CREATE OR REPLACE FUNCTION public.app_11941c8fec_generate_join_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.app_11941c8fec_join_family_with_code(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_family_id uuid;
  v_name      text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select f.id into v_family_id
  from public.app_11941c8fec_families f
  where f.join_code = upper(btrim(p_code));

  if v_family_id is null then
    raise exception 'invalid join code';
  end if;

  -- Idempotent: joining a family you are already in is a no-op, not an error.
  if exists (
    select 1 from public.app_11941c8fec_family_members m
    where m.family_id = v_family_id and m.user_id = auth.uid()
  ) then
    return v_family_id;
  end if;

  select coalesce(nullif(split_part(u.email, '@', 1), ''), 'Member')
    into v_name
  from auth.users u
  where u.id = auth.uid();

  insert into public.app_11941c8fec_family_members
    (family_id, user_id, display_name, member_role)
  values
    (v_family_id, auth.uid(), coalesce(v_name, 'Member'), 'member');

  return v_family_id;
end;
$function$
;
create policy family_expenses_all_if_member on public.app_11941c8fec_family_expenses as PERMISSIVE for ALL to authenticated using (app_11941c8fec_is_family_member(family_id)) with check (app_11941c8fec_is_family_member(family_id));
create policy family_income_all_if_member on public.app_11941c8fec_family_income as PERMISSIVE for ALL to authenticated using (app_11941c8fec_is_family_member(family_id)) with check (app_11941c8fec_is_family_member(family_id));
create policy families_delete_if_owner on public.app_11941c8fec_families as PERMISSIVE for DELETE to authenticated using ((auth.uid() = owner_user_id));
create policy families_insert_own on public.app_11941c8fec_families as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = owner_user_id));
create policy families_select_if_member on public.app_11941c8fec_families as PERMISSIVE for SELECT to authenticated using (((owner_user_id = auth.uid()) OR app_11941c8fec_is_family_member(id)));
create policy families_update_if_owner on public.app_11941c8fec_families as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = owner_user_id)) with check ((auth.uid() = owner_user_id));
create policy family_budget_categories_all_if_member on public.app_11941c8fec_family_budget_categories as PERMISSIVE for ALL to authenticated using (app_11941c8fec_is_family_member(family_id)) with check (app_11941c8fec_is_family_member(family_id));
create policy family_members_delete_if_owner_or_self on public.app_11941c8fec_family_members as PERMISSIVE for DELETE to authenticated using ((app_11941c8fec_is_family_owner(family_id) OR (user_id = auth.uid())));
create policy family_members_insert_if_owner on public.app_11941c8fec_family_members as PERMISSIVE for INSERT to authenticated with check (app_11941c8fec_is_family_owner(family_id));
create policy family_members_select_if_member on public.app_11941c8fec_family_members as PERMISSIVE for SELECT to authenticated using (app_11941c8fec_is_family_member(family_id));
create policy family_members_update_if_owner on public.app_11941c8fec_family_members as PERMISSIVE for UPDATE to authenticated using (app_11941c8fec_is_family_owner(family_id)) with check (app_11941c8fec_is_family_owner(family_id));
create policy family_budget_settings_all_if_member on public.app_11941c8fec_family_budget_settings as PERMISSIVE for ALL to authenticated using (app_11941c8fec_is_family_member(family_id)) with check (app_11941c8fec_is_family_member(family_id));
CREATE TRIGGER app_11941c8fec_families_add_owner AFTER INSERT ON public.app_11941c8fec_families FOR EACH ROW EXECUTE FUNCTION app_11941c8fec_add_owner_as_member();
CREATE TRIGGER app_11941c8fec_families_set_join_code BEFORE INSERT ON public.app_11941c8fec_families FOR EACH ROW EXECUTE FUNCTION app_11941c8fec_set_join_code();
grant execute on function public.app_11941c8fec_is_family_member(uuid),
public.app_11941c8fec_is_family_owner(uuid),public.app_11941c8fec_add_owner_as_member(),
public.app_11941c8fec_set_join_code(),public.app_11941c8fec_generate_join_code(),
public.app_11941c8fec_join_family_with_code(text) to anon,authenticated,service_role;
insert into auth.users(id) values
('55555555-5555-4555-8555-555555555555'),('66666666-6666-4666-8666-666666666666'),
('77777777-7777-4777-8777-777777777777');
-- Prove the audited create/join bypass before hardening. Roll back test rows.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
insert into public.app_11941c8fec_families(owner_user_id,join_code)
values(auth.uid(),'BASELINE');
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select public.app_11941c8fec_join_family_with_code('BASELINE');
select public.fixture_assert(
 public.app_11941c8fec_is_family_member(
 (select id from public.app_11941c8fec_families where join_code='BASELINE')),
 'Audited join bypass was not reproduced');
rollback;
