-- REVIEW / DISPOSABLE TEST ONLY. Apply after unchanged 001--009.
-- No environment is enabled. Never expire an ambiguous external POST locally.
begin;
alter table public.app_11941c8fec_payment_environment
  add column checkouts_enabled boolean not null default false;

create function public.app_11941c8fec_guard_checkout_reservation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.app_11941c8fec_payment_require_mode(new.mode);
  if not exists(select 1 from public.app_11941c8fec_payment_environment
    where mode=new.mode and checkouts_enabled) then
    raise exception 'New checkouts are disabled' using errcode='42501';
  end if;
  -- Same row lock as reserve_checkout. A timeout/expired local TTL is NOT proof
  -- the provider did not create or complete a checkout. No automated release.
  perform 1 from public.app_11941c8fec_payment_accounts
    where user_id=new.user_id and mode=new.mode for update;
  if not found then raise exception 'Missing checkout account' using errcode='42501'; end if;
  -- An old paid claim without provider IDs is ambiguous, not proof that there
  -- is no existing subscription. Never create a second financial obligation.
  if not exists(select 1 from public.app_11941c8fec_payment_bindings where user_id=new.user_id)
    and exists(select 1 from public.app_11941c8fec_subscriptions where user_id=new.user_id
      and (tier in ('balanced','family') or paid_access_from is not null or paid_access_until is not null)) then
    raise exception 'Legacy billing requires review' using errcode='42501';
  end if;
  if exists(select 1 from public.app_11941c8fec_payment_intents
    where user_id=new.user_id and mode=new.mode and subscription_id is null) then
    raise exception 'Unresolved checkout requires reconciliation' using errcode='42501';
  end if;
  return new;
end $$;
alter function public.app_11941c8fec_guard_checkout_reservation() owner to postgres;
revoke all on function public.app_11941c8fec_guard_checkout_reservation()
  from public,anon,authenticated,service_role;
create trigger app_11941c8fec_checkout_reservation before insert
  on public.app_11941c8fec_payment_intents for each row
  execute function public.app_11941c8fec_guard_checkout_reservation();

-- No new auth.users trigger, FK change, table-delete grant, or 008/009 replacement.
-- A reservation is still retained by 008, and its existing FK serializes deletion.
notify pgrst,'reload schema';
commit;
