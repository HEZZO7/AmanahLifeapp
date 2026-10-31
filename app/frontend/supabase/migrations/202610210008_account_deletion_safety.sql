-- REVIEW ONLY. Requires the reviewed subscription migrations 001--005.
-- No provider/configuration changes. No data deletion or entitlement mutation.
-- Deliberately retain ALL billing history, including expired/refunded/checkouts,
-- until an explicitly approved retention/deletion process exists.
begin;

do $$ begin
  if to_regclass('public.app_11941c8fec_payment_accounts') is null
     or to_regclass('public.app_11941c8fec_payment_intents') is null
     or to_regclass('public.app_11941c8fec_payment_bindings') is null
     or to_regclass('public.app_11941c8fec_payment_periods') is null then
    raise exception 'Reviewed subscription migrations 001--005 required';
  end if;
end $$;

create or replace function public.app_11941c8fec_account_deletion_allowed(p_user uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
  if p_user is null then return false; end if;
  -- No mode filter: test/live history and unresolved checkout reservations count.
  -- payment_provider alone is not evidence: legacy free rows default to LS.
  return not (
    exists(select 1 from public.app_11941c8fec_payment_accounts where user_id=p_user)
    or exists(select 1 from public.app_11941c8fec_payment_intents where user_id=p_user)
    or exists(select 1 from public.app_11941c8fec_payment_bindings where user_id=p_user)
    or exists(select 1 from public.app_11941c8fec_payment_periods where user_id=p_user)
    or exists(select 1 from public.app_11941c8fec_subscriptions where user_id=p_user and (
      tier in ('balanced','family') or paid_access_from is not null or paid_access_until is not null
      or lemonsqueezy_subscription_id is not null or lemonsqueezy_customer_id is not null
      or paddle_subscription_id is not null or paddle_customer_id is not null))
  );
end $$;
alter function public.app_11941c8fec_account_deletion_allowed(uuid) owner to postgres;
revoke all on function public.app_11941c8fec_account_deletion_allowed(uuid) from public,anon,authenticated,service_role;
grant execute on function public.app_11941c8fec_account_deletion_allowed(uuid) to service_role;

create or replace function public.app_11941c8fec_guard_account_deletion()
returns trigger language plpgsql security definer set search_path='' as $$
declare account_id uuid;
begin
  if tg_table_schema='auth' and tg_table_name='users' then account_id:=old.id;
  elsif tg_table_schema='public' and tg_table_name='app_11941c8fec_subscriptions' then account_id:=old.user_id;
  else raise exception 'Unsupported deletion guard target' using errcode='42501';
  end if;
  if public.app_11941c8fec_account_deletion_allowed(account_id) is distinct from true then
    raise exception 'Billing retention review required' using errcode='42501';
  end if;
  return old;
end $$;
alter function public.app_11941c8fec_guard_account_deletion() owner to postgres;
revoke all on function public.app_11941c8fec_guard_account_deletion() from public,anon,authenticated,service_role;

-- The auth.users row lock plus existing payment-table FK checks serialize a
-- concurrent new checkout: a committed reservation blocks DELETE; a completed
-- user DELETE makes the subsequent reservation fail before provider checkout.
drop trigger if exists app_11941c8fec_billing_retention on auth.users;
create trigger app_11941c8fec_billing_retention before delete on auth.users
  for each row execute function public.app_11941c8fec_guard_account_deletion();
drop trigger if exists app_11941c8fec_billing_retention on public.app_11941c8fec_subscriptions;
create trigger app_11941c8fec_billing_retention before delete on public.app_11941c8fec_subscriptions
  for each row execute function public.app_11941c8fec_guard_account_deletion();

-- Fail the migration on inherited/default grants that direct REVOKE cannot fix.
do $$ declare actor text; begin
  foreach actor in array array['anon','authenticated'] loop
    if has_function_privilege(actor,'public.app_11941c8fec_account_deletion_allowed(uuid)','EXECUTE') then
      raise exception 'Unexpected effective deletion RPC privileges';
    end if;
  end loop;
  foreach actor in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(actor,'public.app_11941c8fec_guard_account_deletion()','EXECUTE') then
      raise exception 'Unexpected effective deletion trigger-function privileges';
    end if;
  end loop;
  if not has_function_privilege('service_role','public.app_11941c8fec_account_deletion_allowed(uuid)','EXECUTE') then
    raise exception 'Missing service-only deletion RPC privilege';
  end if;
end $$;

notify pgrst,'reload schema';
commit;
