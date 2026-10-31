-- REVIEW / DISPOSABLE TEST ONLY. Never infer customer ownership from email.
begin;
create table public.app_11941c8fec_payment_customer_owners (
  mode text not null check(mode in ('test','live')),
  customer_id text not null,
  user_id uuid not null references auth.users(id),
  primary key(mode,customer_id)
);
alter table public.app_11941c8fec_payment_customer_owners enable row level security;
revoke all on public.app_11941c8fec_payment_customer_owners from public,anon,authenticated,service_role;
-- A shared historical customer would expose other accounts in Customer Portal.
-- Stop for manual inventory; never choose an owner arbitrarily or delete history.
do $$ begin
  if exists(select 1 from public.app_11941c8fec_payment_bindings
    group by mode,customer_id having count(distinct user_id)>1) then
    raise exception 'Shared provider customer requires ownership review';
  end if;
end $$;
insert into public.app_11941c8fec_payment_customer_owners(mode,customer_id,user_id)
  select distinct mode,customer_id,user_id from public.app_11941c8fec_payment_bindings;

create function public.app_11941c8fec_guard_customer_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and row(new.mode,new.subscription_id,new.user_id,new.customer_id,new.order_id)
    is distinct from row(old.mode,old.subscription_id,old.user_id,old.customer_id,old.order_id) then
    raise exception 'Immutable payment ownership' using errcode='42501';
  end if;
  insert into public.app_11941c8fec_payment_customer_owners(mode,customer_id,user_id)
    values(new.mode,new.customer_id,new.user_id) on conflict(mode,customer_id) do nothing;
  -- The unique insert serializes two accounts claiming the same customer.
  if not exists(select 1 from public.app_11941c8fec_payment_customer_owners
    where mode=new.mode and customer_id=new.customer_id and user_id=new.user_id) then
    raise exception 'Provider customer already owned' using errcode='42501';
  end if;
  return new;
end $$;
alter function public.app_11941c8fec_guard_customer_owner() owner to postgres;
revoke all on function public.app_11941c8fec_guard_customer_owner() from public,anon,authenticated,service_role;
create trigger app_11941c8fec_customer_owner before insert or update
  on public.app_11941c8fec_payment_bindings for each row
  execute function public.app_11941c8fec_guard_customer_owner();
-- NO ACTION user FK retains this history if another private table is ever lost;
-- an Auth DELETE failure still rolls back 009's child cleanup atomically.
notify pgrst,'reload schema';
commit;
