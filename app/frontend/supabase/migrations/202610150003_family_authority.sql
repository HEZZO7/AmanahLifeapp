-- REVIEW/STAGING ONLY. Never run on production without separate approval.
-- Existing rows and join codes are preserved. Paid dates are NOT backfilled
-- from legacy current_period_end/renews_at or client-created entitlement rows.
begin;

alter table public.app_11941c8fec_subscriptions
 add column paid_access_until timestamptz,
 add column entitlement_revoked_at timestamptz;

-- Internal primitive: callable only by trusted server and definer wrappers.
create function public.app_11941c8fec_account_family_entitled(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
  select 1 from public.app_11941c8fec_subscriptions s
  where s.user_id=p_user_id and s.entitlement_revoked_at is null
  and (
   (s.trial_started_at <= statement_timestamp()
    and s.trial_started_at > statement_timestamp()-interval '7 days')
   or
   (s.tier='family' and s.status in ('active','past_due','canceled')
    and s.lemonsqueezy_subscription_id is not null
    and s.paid_access_until > statement_timestamp()
    and (s.status <> 'canceled' or s.current_period_end is null
         or s.current_period_end > statement_timestamp()))
  )
 );
$$;
create function public.app_11941c8fec_current_user_family_entitled()
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null
 and public.app_11941c8fec_account_family_entitled(auth.uid()); $$;

create function public.app_11941c8fec_family_can_write(p_family_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.app_11941c8fec_families f
 where f.id=p_family_id
 and (f.owner_user_id=auth.uid() or
      public.app_11941c8fec_is_family_member(f.id))
 and public.app_11941c8fec_account_family_entitled(f.owner_user_id));
$$;

-- Cryptographic UUID entropy, rejection sampled into the EXISTING alphabet/length.
-- Use only UUID's first six bytes (unaffected by version/variant fixed bits).
create or replace function public.app_11941c8fec_generate_join_code()
returns text language plpgsql volatile set search_path=''
as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
 result text := ''; random_bytes bytea; n int; i int; alphabet_length int:=length(alphabet);
begin
 while length(result)<8 loop
  random_bytes:=decode(substr(replace(gen_random_uuid()::text,'-',''),1,12),'hex');
  for i in 0..5 loop
   n:=get_byte(random_bytes,i);
   if n < (256/alphabet_length)*alphabet_length then
    result:=result||substr(alphabet,(n%alphabet_length)+1,1);
    if length(result)=8 then return result; end if;
   end if;
  end loop;
 end loop;
 return result;
end $$;

create or replace function public.app_11941c8fec_set_join_code()
returns trigger language plpgsql security definer set search_path=''
as $$
declare candidate text; attempts int:=0;
begin
 -- Serialize generation through insertion/commit; UNIQUE remains the backstop.
 perform pg_advisory_xact_lock(11941,140003);
 loop
  candidate:=public.app_11941c8fec_generate_join_code();
  exit when not exists(select 1 from public.app_11941c8fec_families f
                       where f.join_code=candidate);
  attempts:=attempts+1;
  if attempts>=20 then raise exception 'join_code_generation_failed'; end if;
 end loop;
 -- Only new INSERTs change. Existing codes are never rotated.
 new.join_code:=candidate;
 return new;
end $$;

create function public.app_11941c8fec_guard_family_creation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 perform 1 from public.app_11941c8fec_subscriptions s
 where s.user_id=new.owner_user_id for share;
 if not public.app_11941c8fec_account_family_entitled(new.owner_user_id) then
  raise exception 'family_plan_required' using errcode='42501';
 end if;
 return new;
end $$;
create trigger app_11941c8fec_family_creation_entitlement
 before insert on public.app_11941c8fec_families
 for each row execute function public.app_11941c8fec_guard_family_creation();

create function public.app_11941c8fec_guard_family_member()
returns trigger language plpgsql security definer set search_path=''
as $$
declare owner_id uuid;
begin
 select f.owner_user_id into owner_id from public.app_11941c8fec_families f
 where f.id=new.family_id for share;
 perform 1 from public.app_11941c8fec_subscriptions s where s.user_id=owner_id for share;
 if not public.app_11941c8fec_account_family_entitled(owner_id) then
  raise exception 'family_plan_required' using errcode='42501';
 end if;
 if (new.member_role='owner') is distinct from (new.user_id=owner_id) then
  -- NULL user_id is allowed for dependent/non-account member records.
  if new.member_role='owner' or new.user_id=owner_id then
   raise exception 'invalid_owner_membership' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
create trigger app_11941c8fec_family_member_entitlement
 before insert or update on public.app_11941c8fec_family_members
 for each row execute function public.app_11941c8fec_guard_family_member();

-- Original RPC name/signature is preserved for authorized native/legacy callers.
create or replace function public.app_11941c8fec_join_family_with_code(p_code text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_family_id uuid; owner_id uuid; account_id uuid:=auth.uid(); v_name text;
begin
 if account_id is null then raise exception 'not_authenticated' using errcode='42501'; end if;
 if p_code is null or length(btrim(p_code))=0 or length(p_code)>128 then
  raise exception 'invalid_code' using errcode='22023';
 end if;
 select f.id,f.owner_user_id into v_family_id,owner_id
 from public.app_11941c8fec_families f
 where f.join_code=upper(btrim(p_code)) for share;
 if v_family_id is null then raise exception 'invalid_code' using errcode='22023'; end if;
 perform 1 from public.app_11941c8fec_subscriptions s where s.user_id=owner_id for share;
 if not public.app_11941c8fec_account_family_entitled(owner_id) then
  raise exception 'family_plan_required' using errcode='42501';
 end if;
 select coalesce(nullif(split_part(u.email,'@',1),''),'Member') into v_name
 from auth.users u where u.id=account_id;
 insert into public.app_11941c8fec_family_members
 (family_id,user_id,display_name,member_role)
 values(v_family_id,account_id,coalesce(v_name,'Member'),
        case when account_id=owner_id then 'owner' else 'member' end)
 on conflict (family_id,user_id) do nothing;
 return v_family_id;
end $$;

create function public.app_11941c8fec_accept_family_invite(
 p_code text,p_display_name text,p_age_group text,p_household_role text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare family_id_result uuid;
begin
 if p_age_group is null or p_age_group not in ('adult','minor') then
  raise exception 'invalid_age_group' using errcode='22023';
 end if;
 family_id_result:=public.app_11941c8fec_join_family_with_code(p_code);
 update public.app_11941c8fec_family_members
 set display_name=coalesce(nullif(left(btrim(p_display_name),100),''),display_name),
     age_group=p_age_group,household_role=nullif(left(p_household_role,50),'')
 where family_id=family_id_result and user_id=auth.uid();
 return family_id_result;
end $$;

-- Leave is a DELETE of one's own membership. Existing identity-based SELECT
-- policies remain unchanged for retained read/export access after expiry.
drop policy families_insert_own on public.app_11941c8fec_families;
create policy families_insert_own on public.app_11941c8fec_families
 for insert to authenticated with check(auth.uid()=owner_user_id
 and public.app_11941c8fec_current_user_family_entitled());
drop policy families_update_if_owner on public.app_11941c8fec_families;
create policy families_update_if_owner on public.app_11941c8fec_families
 for update to authenticated using(auth.uid()=owner_user_id
 and public.app_11941c8fec_family_can_write(id))
 with check(auth.uid()=owner_user_id and public.app_11941c8fec_family_can_write(id));
drop policy families_delete_if_owner on public.app_11941c8fec_families;
create policy families_delete_if_owner on public.app_11941c8fec_families
 for delete to authenticated using(auth.uid()=owner_user_id
 and public.app_11941c8fec_family_can_write(id));

drop policy family_members_insert_if_owner on public.app_11941c8fec_family_members;
create policy family_members_insert_if_owner on public.app_11941c8fec_family_members
 for insert to authenticated with check(
 public.app_11941c8fec_is_family_owner(family_id)
 and public.app_11941c8fec_family_can_write(family_id));
drop policy family_members_update_if_owner on public.app_11941c8fec_family_members;
create policy family_members_update_if_owner on public.app_11941c8fec_family_members
 for update to authenticated using(public.app_11941c8fec_is_family_owner(family_id)
 and public.app_11941c8fec_family_can_write(family_id))
 with check(public.app_11941c8fec_is_family_owner(family_id)
 and public.app_11941c8fec_family_can_write(family_id));
drop policy family_members_delete_if_owner_or_self on public.app_11941c8fec_family_members;
create policy family_members_delete_if_owner_or_self on public.app_11941c8fec_family_members
 for delete to authenticated using(
 user_id=auth.uid() or (public.app_11941c8fec_is_family_owner(family_id)
 and public.app_11941c8fec_family_can_write(family_id)));

do $$
declare table_name text; prefix text; column_names text;
begin
 foreach table_name in array array['app_11941c8fec_families','app_11941c8fec_family_members',
 'app_11941c8fec_family_budget_settings','app_11941c8fec_family_budget_categories',
 'app_11941c8fec_family_income','app_11941c8fec_family_expenses'] loop
  execute format('revoke all privileges on public.%I from public,anon,authenticated,service_role',table_name);
  select string_agg(format('%I',attname),',') into column_names from pg_attribute
   where attrelid=('public.'||table_name)::regclass and attnum>0 and not attisdropped;
  execute format('revoke all privileges (%s) on public.%I from public,anon,authenticated,service_role',
                 column_names,table_name);
  execute format('grant select,insert,update,delete on public.%I to service_role',table_name);
  execute format('grant select,insert,delete on public.%I to authenticated',table_name);
  if table_name not in ('app_11941c8fec_families','app_11941c8fec_family_members') then
   execute format('grant update on public.%I to authenticated',table_name);
   prefix:=replace(table_name,'app_11941c8fec_','');
   execute format('drop policy %I on public.%I',prefix||'_all_if_member',table_name);
   execute format('create policy %I on public.%I for select to authenticated using
    (public.app_11941c8fec_is_family_member(family_id))',prefix||'_read_if_member',table_name);
   execute format('create policy %I on public.%I for all to authenticated using
    (public.app_11941c8fec_is_family_member(family_id) and public.app_11941c8fec_family_can_write(family_id))
    with check(public.app_11941c8fec_is_family_member(family_id) and public.app_11941c8fec_family_can_write(family_id))',
    prefix||'_write_if_entitled',table_name);
  end if;
 end loop;
end $$;
grant update(name,updated_at) on public.app_11941c8fec_families to authenticated;
grant update(display_name,age_group,household_role) on public.app_11941c8fec_family_members to authenticated;

-- New objects inherit unsafe defaults until explicitly closed within this transaction.
revoke all on function public.app_11941c8fec_account_family_entitled(uuid),
 public.app_11941c8fec_current_user_family_entitled(),
 public.app_11941c8fec_family_can_write(uuid),
 public.app_11941c8fec_guard_family_creation(),
 public.app_11941c8fec_guard_family_member(),
 public.app_11941c8fec_generate_join_code(),
 public.app_11941c8fec_join_family_with_code(text),
 public.app_11941c8fec_accept_family_invite(text,text,text,text)
from public,anon,authenticated,service_role;
grant execute on function public.app_11941c8fec_account_family_entitled(uuid) to service_role;
grant execute on function public.app_11941c8fec_current_user_family_entitled(),
 public.app_11941c8fec_family_can_write(uuid),
 public.app_11941c8fec_join_family_with_code(text),
 public.app_11941c8fec_accept_family_invite(text,text,text,text)
to authenticated;
-- Preserve existing trusted server generator access, without anonymous RPC exposure.
grant execute on function public.app_11941c8fec_generate_join_code() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
