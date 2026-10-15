-- REVIEW ONLY. Depends on 202610140001, 202610140002 and 202610150003.
-- No environment is enabled, no legacy rows are certified, and no data is deleted.
begin;
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='app_11941c8fec_subscriptions' and column_name='paid_access_until') then
    raise exception 'Apply the reviewed family-authority migration first';
  end if;
end $$;

alter table public.app_11941c8fec_subscriptions add column paid_access_from timestamptz;

create table public.app_11941c8fec_payment_environment (
  singleton boolean primary key default true check(singleton),
  mode text not null check(mode in ('test','live'))
);
-- One Supabase project = one mode. Intentionally empty until approved setup.
create table public.app_11941c8fec_payment_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null check(mode in ('test','live')),
  revision bigint not null default 0,
  subscription_id text,
  customer_id text,
  order_id text,
  product_id text,
  variant_id text,
  tier text,
  billing text,
  provider_updated_at timestamptz,
  invoice_id text,
  review_required boolean not null default false,
  unique(mode, subscription_id),
  unique(mode, order_id)
);
create table public.app_11941c8fec_payment_intents (
  intent_hash text primary key check(intent_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check(mode in ('test','live')),
  store_id text not null,
  product_id text not null,
  variant_id text not null,
  tier text not null check(tier in ('balanced','family')),
  billing text not null check(billing in ('monthly','yearly')),
  checkout_id text,
  subscription_id text,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default statement_timestamp()+interval '1 hour',
  unique(mode, checkout_id)
);
create table public.app_11941c8fec_payment_events (
  mode text not null check(mode in ('test','live')),
  event_key text not null check(event_key ~ '^[a-f0-9]{64}$'),
  event_name text not null,
  object_id text not null,
  outcome text not null,
  received_at timestamptz not null default statement_timestamp(),
  primary key(mode,event_key)
);

do $$ declare t text; begin
  foreach t in array array['payment_environment','payment_accounts','payment_intents','payment_events'] loop
    execute format('alter table public.app_11941c8fec_%I enable row level security',t);
    execute format('revoke all on public.app_11941c8fec_%I from public,anon,authenticated,service_role',t);
    -- No direct API writes: mutations occur in the narrow service RPCs below.
  end loop;
end $$;

create function public.app_11941c8fec_payment_require_mode(p_mode text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_mode not in ('test','live') or not exists(select 1 from public.app_11941c8fec_payment_environment where mode=p_mode) then
    raise exception 'Payment environment is disabled or mismatched' using errcode='42501';
  end if;
end $$;

-- Paid family access now requires both the verified access window and its private ledger binding.
-- Keep the same signature/dependencies/ACL and the independently server-issued seven-day trial.
create or replace function public.app_11941c8fec_account_family_entitled(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.app_11941c8fec_subscriptions s
    where s.user_id=p_user_id and s.entitlement_revoked_at is null and (
      (s.trial_started_at<=statement_timestamp() and s.trial_started_at>statement_timestamp()-interval '7 days')
      or (s.tier='family' and s.status in ('active','past_due','canceled')
        and s.paid_access_from<=statement_timestamp() and s.paid_access_until>statement_timestamp()
        and (s.status<>'canceled' or s.current_period_end is null or s.current_period_end>statement_timestamp())
        and exists(select 1 from public.app_11941c8fec_payment_accounts a
          join public.app_11941c8fec_payment_environment e on e.mode=a.mode
          where a.user_id=s.user_id and a.subscription_id=s.lemonsqueezy_subscription_id
            and a.tier='family' and a.invoice_id is not null)))
  )
$$;

create function public.app_11941c8fec_payment_create_intent(p_mode text,p_user uuid,p_hash text,p_store text,p_product text,p_variant text,p_tier text,p_billing text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.app_11941c8fec_payment_accounts;
begin
  perform public.app_11941c8fec_payment_require_mode(p_mode);
  insert into public.app_11941c8fec_payment_accounts(user_id,mode) values(p_user,p_mode) on conflict(user_id) do nothing;
  select * into strict a from public.app_11941c8fec_payment_accounts where user_id=p_user for update;
  if a.mode<>p_mode then raise exception 'Account environment mismatch' using errcode='42501'; end if;
  -- Re-subscribing/replacement needs a separate reviewed transition: do not charge twice.
  if a.subscription_id is not null then raise exception 'Manage existing subscription instead' using errcode='42501'; end if;
  if exists(select 1 from public.app_11941c8fec_payment_intents where user_id=p_user and mode=p_mode and expires_at>statement_timestamp()) then
    raise exception 'A checkout is already pending' using errcode='42501';
  end if;
  insert into public.app_11941c8fec_payment_intents(intent_hash,user_id,mode,store_id,product_id,variant_id,tier,billing)
  values(p_hash,p_user,p_mode,p_store,p_product,p_variant,p_tier,p_billing);
  return jsonb_build_object('created',true);
end $$;

create function public.app_11941c8fec_payment_ready_intent(p_mode text,p_hash text,p_checkout text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.app_11941c8fec_payment_require_mode(p_mode);
  update public.app_11941c8fec_payment_intents set checkout_id=p_checkout
    where intent_hash=p_hash and mode=p_mode and checkout_id is null and expires_at>statement_timestamp();
  if not found then raise exception 'Invalid checkout intent' using errcode='42501'; end if;
  return jsonb_build_object('ready',true);
end $$;

create function public.app_11941c8fec_payment_snapshot(p_mode text,p_subscription text,p_order text,p_intent_hash text,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.app_11941c8fec_payment_accounts; i public.app_11941c8fec_payment_intents; s public.app_11941c8fec_subscriptions;
begin
  perform public.app_11941c8fec_payment_require_mode(p_mode);
  -- Subscription/order bindings take precedence over metadata; client user_id is never consulted.
  if p_subscription is not null then select * into a from public.app_11941c8fec_payment_accounts where mode=p_mode and subscription_id=p_subscription;
  elsif p_order is not null then select * into a from public.app_11941c8fec_payment_accounts where mode=p_mode and order_id=p_order;
  elsif p_user is not null then select * into a from public.app_11941c8fec_payment_accounts where mode=p_mode and user_id=p_user;
  end if;
  if a.user_id is null and p_intent_hash is not null then
    select * into i from public.app_11941c8fec_payment_intents where mode=p_mode and intent_hash=p_intent_hash and checkout_id is not null;
    -- A delayed purchase remains attributable after the one-hour checkout expiry.
    -- Proof is the signed, canonical subscription; never a browser-supplied account identifier.
    if i.user_id is not null then select * into a from public.app_11941c8fec_payment_accounts where user_id=i.user_id and mode=p_mode; end if;
  end if;
  select * into s from public.app_11941c8fec_subscriptions where user_id=coalesce(a.user_id,p_user);
  return jsonb_build_object('user_id',a.user_id,'revision',a.revision,'subscription_id',a.subscription_id,'customer_id',a.customer_id,
    'store_id',i.store_id,'product_id',coalesce(a.product_id,i.product_id),'variant_id',coalesce(a.variant_id,i.variant_id),
    'tier',a.tier,'billing',a.billing,'intent_created_at',i.created_at,'provider_updated_at',a.provider_updated_at,
    'invoice_id',a.invoice_id,'paid_access_from',s.paid_access_from,'paid_access_until',s.paid_access_until,
    'entitlement_revoked_at',s.entitlement_revoked_at,'trial_used',coalesce(s.trial_used,false));
end $$;

create function public.app_11941c8fec_payment_unbound(p_mode text,p_key text,p_event text,p_object text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.app_11941c8fec_payment_require_mode(p_mode);
  insert into public.app_11941c8fec_payment_events(mode,event_key,event_name,object_id,outcome) values(p_mode,p_key,p_event,p_object,p_reason)
    on conflict(mode,event_key) do nothing;
  return jsonb_build_object('recorded',true);
end $$;

create function public.app_11941c8fec_payment_apply(p_mode text,p_key text,p_event text,p_object text,p_user uuid,p_revision bigint,p_intent_hash text,
 p_subscription text,p_customer text,p_order text,p_store text,p_product text,p_variant text,p_tier text,p_billing text,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.app_11941c8fec_payment_accounts; i public.app_11941c8fec_payment_intents; e text;
begin
  perform public.app_11941c8fec_payment_require_mode(p_mode);
  select * into strict a from public.app_11941c8fec_payment_accounts where user_id=p_user and mode=p_mode for update;
  select outcome into e from public.app_11941c8fec_payment_events where mode=p_mode and event_key=p_key;
  if e='applied' then return jsonb_build_object('duplicate',true); end if;
  if a.revision<>p_revision then return jsonb_build_object('retry',true); end if;
  if a.subscription_id is null then
    select * into strict i from public.app_11941c8fec_payment_intents where intent_hash=p_intent_hash and mode=p_mode for update;
    if i.user_id<>p_user or i.checkout_id is null or i.store_id<>p_store or i.product_id<>p_product or i.variant_id<>p_variant
      or i.tier<>p_tier or i.billing<>p_billing or (i.subscription_id is not null and i.subscription_id<>p_subscription) then
      raise exception 'Untrusted checkout binding' using errcode='42501';
    end if;
    update public.app_11941c8fec_payment_intents set subscription_id=p_subscription where intent_hash=p_intent_hash;
  elsif a.subscription_id<>p_subscription or a.customer_id<>p_customer or a.order_id<>p_order then
    raise exception 'Immutable subscription binding mismatch' using errcode='42501';
  end if;
  if a.subscription_id is not null and (a.variant_id<>p_variant or a.product_id<>p_product or a.tier<>p_tier or a.billing<>p_billing) then
    raise exception 'Plan replacement requires separately verified billing evidence' using errcode='42501';
  end if;
  if a.provider_updated_at is not null and (p_state->>'provider_updated_at')::timestamptz<a.provider_updated_at then
    return jsonb_build_object('retry',true);
  end if;
  if (p_state->>'paid_access_until')::timestamptz is not null and
    ((p_state->>'invoice_id') is null or (p_state->>'paid_access_from')::timestamptz is null or
     (p_state->>'paid_access_from')::timestamptz >= (p_state->>'paid_access_until')::timestamptz) then
    raise exception 'Paid period needs invoice evidence';
  end if;
  -- Preserve trial state, account ID, historical provider IDs and all customer data.
  insert into public.app_11941c8fec_subscriptions(user_id,tier,billing_cycle,status,payment_provider,lemonsqueezy_customer_id,lemonsqueezy_subscription_id,
    current_period_start,current_period_end,paid_access_from,paid_access_until,entitlement_revoked_at)
  values(p_user,p_tier,p_billing,p_state->>'status','lemonsqueezy',p_customer,p_subscription,
    (p_state->>'paid_access_from')::timestamptz,coalesce((p_state->>'ends_at')::timestamptz,(p_state->>'paid_access_until')::timestamptz),
    (p_state->>'paid_access_from')::timestamptz,(p_state->>'paid_access_until')::timestamptz,(p_state->>'entitlement_revoked_at')::timestamptz)
  on conflict(user_id) do update set tier=excluded.tier,billing_cycle=excluded.billing_cycle,status=excluded.status,
    payment_provider=excluded.payment_provider,lemonsqueezy_customer_id=excluded.lemonsqueezy_customer_id,lemonsqueezy_subscription_id=excluded.lemonsqueezy_subscription_id,
    current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
    paid_access_from=excluded.paid_access_from,paid_access_until=excluded.paid_access_until,entitlement_revoked_at=excluded.entitlement_revoked_at,updated_at=statement_timestamp();
  update public.app_11941c8fec_payment_accounts set subscription_id=p_subscription,customer_id=p_customer,order_id=p_order,
    product_id=p_product,variant_id=p_variant,tier=p_tier,billing=p_billing,
    provider_updated_at=(p_state->>'provider_updated_at')::timestamptz,invoice_id=p_state->>'invoice_id',review_required=coalesce((p_state->>'review_required')::boolean,false),revision=revision+1 where user_id=p_user;
  insert into public.app_11941c8fec_payment_events(mode,event_key,event_name,object_id,outcome) values(p_mode,p_key,p_event,p_object,'applied')
    on conflict(mode,event_key) do update set outcome='applied';
  return jsonb_build_object('applied',true);
end $$;

-- Revoke default PUBLIC EXECUTE as well as explicit anon/auth grants on EVERY new function.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'app\_11941c8fec\_payment\_%' escape '\' loop
    execute format('alter function %s owner to postgres',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.signature::text not like '%payment_require_mode(%' then execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end $$;
commit;
