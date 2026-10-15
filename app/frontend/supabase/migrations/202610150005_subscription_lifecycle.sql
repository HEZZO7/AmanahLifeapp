-- DRAFT ONLY. Apply after 0001..0004, only in an explicitly approved environment.
-- No enabled environment, backfilled payment certification, job or destructive data operation.
begin;
alter table public.app_11941c8fec_payment_periods
  add column confirmed_at timestamptz,
  add column source_created_at timestamptz,
  add column service_period_start timestamptz,
  add column service_period_end timestamptz,
  add column end_source text,
  add column tier text check(tier in ('balanced','family')),
  add column billing text check(billing in ('monthly','yearly')),
  add column product_id text,
  add column variant_id text;
-- Existing access_start remains audit history, not a certified service-period start.
alter table public.app_11941c8fec_payment_intents add column supersedes_id text;

create table public.app_11941c8fec_payment_bindings (
  mode text not null check(mode in ('test','live')),
  subscription_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  order_id text not null,
  product_id text not null,
  variant_id text not null,
  tier text not null check(tier in ('balanced','family')),
  billing text not null check(billing in ('monthly','yearly')),
  last_state jsonb not null default '{}'::jsonb,
  primary key(mode,subscription_id), unique(mode,order_id)
);
-- Preserve already-private bindings, not arbitrary legacy subscription rows. Do NOT certify dates.
insert into public.app_11941c8fec_payment_bindings(mode,subscription_id,user_id,customer_id,order_id,product_id,variant_id,tier,billing,last_state)
select a.mode,a.subscription_id,a.user_id,a.customer_id,a.order_id,a.product_id,a.variant_id,a.tier,a.billing,
  jsonb_build_object('provider_updated_at',a.provider_updated_at,'invoice_id',a.invoice_id,'review_required',true,
    'provider_status',case when s.payment_provider='lemonsqueezy' and s.lemonsqueezy_subscription_id=a.subscription_id then
      case s.status when 'canceled' then 'cancelled' when 'trialing' then 'on_trial' else s.status end else null end)
from public.app_11941c8fec_payment_accounts a left join public.app_11941c8fec_subscriptions s on s.user_id=a.user_id where a.subscription_id is not null;
-- Preserve genuine PRIVATE payment evidence without interpreting a creation timestamp as service.
-- Only a correlated applied provider event may supply its original database observation time.
-- Raw legacy subscription rows, or proof rows lacking a correlated journal, remain uncertified.
update public.app_11941c8fec_payment_periods p set confirmed_at=q.observed_at,end_source='prior_verified_paid_end',
 tier=q.tier,billing=q.billing,product_id=q.product_id,variant_id=q.variant_id
from (select pp.mode,pp.subscription_id,pp.proof_id,min(e.received_at) observed_at,a.tier,a.billing,a.product_id,a.variant_id
 from public.app_11941c8fec_payment_periods pp
 join public.app_11941c8fec_payment_accounts a on a.user_id=pp.user_id and a.mode=pp.mode and a.subscription_id=pp.subscription_id
 join public.app_11941c8fec_payment_events e on e.mode=pp.mode and e.outcome='applied' and e.received_at<pp.access_end
   and ((e.event_name in ('subscription_payment_success','subscription_payment_recovered') and e.object_id=pp.proof_id)
     or (e.event_name in ('subscription_created','subscription_updated') and e.object_id=pp.subscription_id and a.invoice_id=pp.proof_id)
     or (e.event_name='order_created' and e.object_id=a.order_id and pp.proof_id='order:'||a.order_id))
 group by pp.mode,pp.subscription_id,pp.proof_id,a.tier,a.billing,a.product_id,a.variant_id) q
where p.mode=q.mode and p.subscription_id=q.subscription_id and p.proof_id=q.proof_id;

create table public.app_11941c8fec_payment_plan_changes (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  subscription_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null, variant_id text not null,
  tier text not null check(tier in ('balanced','family')),
  billing text not null check(billing in ('monthly','yearly')),
  status text not null check(status in ('requested','confirmed','review','activated')),
  baseline_invoice text,
  requested_at timestamptz not null default statement_timestamp(),
  confirmed_after timestamptz,
  foreign key(mode,subscription_id) references public.app_11941c8fec_payment_bindings(mode,subscription_id) on delete cascade
);
create unique index payment_one_pending_plan on public.app_11941c8fec_payment_plan_changes(mode,subscription_id)
  where status in ('requested','confirmed','review');
create table public.app_11941c8fec_payment_deliveries (
 mode text not null check(mode in ('test','live')),event_key text not null check(event_key ~ '^[a-f0-9]{64}$'),
 event_name text not null,object_id text not null,subscription_id text,order_id text,intent_hash text check(intent_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check(status in ('pending','leased','done','review')),
 attempts integer not null default 0,available_at timestamptz not null default statement_timestamp(),
 lease uuid,lease_until timestamptz,received_at timestamptz not null default statement_timestamp(),primary key(mode,event_key)
);
alter table public.app_11941c8fec_payment_deliveries enable row level security;
revoke all on public.app_11941c8fec_payment_deliveries from public,anon,authenticated,service_role;
alter table public.app_11941c8fec_payment_bindings enable row level security;
alter table public.app_11941c8fec_payment_plan_changes enable row level security;
revoke all on public.app_11941c8fec_payment_bindings,public.app_11941c8fec_payment_plan_changes from public,anon,authenticated,service_role;

create function public.app_11941c8fec_payment_receive_delivery(p_mode text,p_key text,p_event text,p_object text,p_subscription text,p_order text,p_intent_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 insert into public.app_11941c8fec_payment_deliveries(mode,event_key,event_name,object_id,subscription_id,order_id,intent_hash)
 values(p_mode,p_key,p_event,p_object,p_subscription,p_order,p_intent_hash) on conflict(mode,event_key) do nothing;
 return jsonb_build_object('stored',true);
end $$;
create function public.app_11941c8fec_payment_complete_delivery(p_mode text,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 update public.app_11941c8fec_payment_deliveries set status='done',lease=null,lease_until=null where mode=p_mode and event_key=p_key;
 return jsonb_build_object('completed',found);
end $$;
create function public.app_11941c8fec_payment_claim_deliveries(p_mode text,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 if p_limit is null or p_limit<1 or p_limit>25 then raise exception 'Bounded recovery limit required' using errcode='22023'; end if;
 with picked as (select mode,event_key from public.app_11941c8fec_payment_deliveries
   where mode=p_mode and available_at<=statement_timestamp() and (status='pending' or (status='leased' and lease_until<statement_timestamp()))
   order by received_at,event_key for update skip locked limit p_limit),
 claimed as (update public.app_11941c8fec_payment_deliveries d set status='leased',lease=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes',attempts=d.attempts+1
   from picked p where d.mode=p.mode and d.event_key=p.event_key returning d.*)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into items from claimed;
 return jsonb_build_object('items',items);
end $$;
create function public.app_11941c8fec_payment_finish_delivery(p_mode text,p_key text,p_lease uuid,p_ok boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 update public.app_11941c8fec_payment_deliveries set status=case when p_ok then 'done' when attempts>=12 then 'review' else 'pending' end,
   available_at=statement_timestamp()+make_interval(secs=>least(900,5*power(2,least(attempts,8)))::integer),lease=null,lease_until=null
   where mode=p_mode and event_key=p_key and status='leased' and lease=p_lease;
 return jsonb_build_object('finished',found);
end $$;
create function public.app_11941c8fec_payment_reconcile_targets(p_mode text,p_after text,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb; last_id text;
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Bounded target limit required' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('subscription_id',subscription_id) order by subscription_id),'[]'::jsonb),max(subscription_id) into items,last_id
 from (select subscription_id from public.app_11941c8fec_payment_bindings where mode=p_mode and (p_after is null or subscription_id>p_after) order by subscription_id limit p_limit) q;
 return jsonb_build_object('items',items,'next_cursor',case when exists(select 1 from public.app_11941c8fec_payment_bindings where mode=p_mode and subscription_id>last_id) then last_id else null end);
end $$;

create or replace function public.app_11941c8fec_payment_snapshot(p_mode text,p_subscription text,p_order text,p_intent_hash text,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.app_11941c8fec_payment_accounts; b public.app_11941c8fec_payment_bindings;
 i public.app_11941c8fec_payment_intents; s public.app_11941c8fec_subscriptions; result jsonb;
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 if p_subscription is not null then select * into b from public.app_11941c8fec_payment_bindings where mode=p_mode and subscription_id=p_subscription;
 elsif p_order is not null then select * into b from public.app_11941c8fec_payment_bindings where mode=p_mode and order_id=p_order;
 elsif p_user is not null then
   select * into a from public.app_11941c8fec_payment_accounts where user_id=p_user and mode=p_mode;
   select * into b from public.app_11941c8fec_payment_bindings where mode=p_mode and subscription_id=a.subscription_id;
 end if;
 if b.user_id is not null then select * into strict a from public.app_11941c8fec_payment_accounts where user_id=b.user_id and mode=p_mode;
 elsif p_intent_hash is not null then
   select * into i from public.app_11941c8fec_payment_intents where intent_hash=p_intent_hash and mode=p_mode and checkout_id is not null
     and (subscription_id is null or subscription_id=p_subscription);
   if i.user_id is not null then select * into a from public.app_11941c8fec_payment_accounts where user_id=i.user_id and mode=p_mode; end if;
 end if;
 select * into s from public.app_11941c8fec_subscriptions where user_id=coalesce(a.user_id,p_user);
 result:=coalesce(b.last_state,'{}'::jsonb)||jsonb_build_object('user_id',a.user_id,'revision',coalesce(a.revision,0),
   'subscription_id',b.subscription_id,'current_subscription_id',a.subscription_id,'customer_id',b.customer_id,
   'store_id',i.store_id,'product_id',coalesce(b.product_id,i.product_id),'variant_id',coalesce(b.variant_id,i.variant_id),
   'tier',b.tier,'billing',b.billing,'intent_created_at',i.created_at,'trial_used',coalesce(s.trial_used,false),
   'legacy_provider',p_user is not null and a.subscription_id is null and (s.lemonsqueezy_subscription_id is not null or s.paddle_subscription_id is not null),
   'periods',coalesce((select jsonb_agg(jsonb_build_object('proof_id',pp.proof_id,'kind',pp.kind,'start',pp.access_start,
     'confirmed_at',pp.confirmed_at,'source_created_at',pp.source_created_at,'end',pp.access_end,'end_source',pp.end_source,
     'tier',pp.tier,'billing',pp.billing,'product',pp.product_id,'variant',pp.variant_id,'revoked_at',pp.revoked_at,'review',pp.review_required))
     from public.app_11941c8fec_payment_periods pp where pp.mode=p_mode and pp.subscription_id=b.subscription_id and pp.user_id=a.user_id),'[]'::jsonb),
   'plan_change',(select jsonb_build_object('id',pc.id,'variant_id',pc.variant_id,'status',pc.status,'baseline_invoice',pc.baseline_invoice,'confirmed_after',pc.confirmed_after)
     from public.app_11941c8fec_payment_plan_changes pc where pc.mode=p_mode and pc.subscription_id=b.subscription_id and pc.status in ('requested','confirmed','review')));
 return result;
end $$;

create function public.app_11941c8fec_payment_reserve_checkout(p_mode text,p_user uuid,p_hash text,p_store text,p_product text,p_variant text,p_tier text,p_billing text,p_revision bigint,p_supersedes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.app_11941c8fec_payment_accounts; b public.app_11941c8fec_payment_bindings;
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 insert into public.app_11941c8fec_payment_accounts(user_id,mode) values(p_user,p_mode) on conflict(user_id) do nothing;
 select * into strict a from public.app_11941c8fec_payment_accounts where user_id=p_user and mode=p_mode for update;
 if a.revision is distinct from p_revision or a.subscription_id is distinct from p_supersedes then raise exception 'Stale checkout account' using errcode='42501'; end if;
 if exists(select 1 from public.app_11941c8fec_subscriptions where user_id=p_user and
   (lemonsqueezy_subscription_id is not null or paddle_subscription_id is not null)) and a.subscription_id is null then
   raise exception 'Legacy account requires review' using errcode='42501';
 end if;
 if a.subscription_id is not null then
   select * into strict b from public.app_11941c8fec_payment_bindings where mode=p_mode and subscription_id=a.subscription_id;
   if b.last_state->>'provider_status' is distinct from 'expired' or exists(select 1 from public.app_11941c8fec_payment_periods
     where user_id=p_user and mode=p_mode and subscription_id=b.subscription_id and confirmed_at is not null and revoked_at is null and access_end>statement_timestamp()) then
     raise exception 'Manage existing paid subscription' using errcode='42501';
   end if;
 end if;
 if exists(select 1 from public.app_11941c8fec_payment_intents where user_id=p_user and mode=p_mode and subscription_id is null and expires_at>statement_timestamp()) then
   raise exception 'Checkout already pending' using errcode='42501';
 end if;
 insert into public.app_11941c8fec_payment_intents(intent_hash,user_id,mode,store_id,product_id,variant_id,tier,billing,supersedes_id)
 values(p_hash,p_user,p_mode,p_store,p_product,p_variant,p_tier,p_billing,p_supersedes);
 return jsonb_build_object('created',true);
end $$;

create function public.app_11941c8fec_payment_request_plan(p_mode text,p_user uuid,p_revision bigint,p_subscription text,p_product text,p_variant text,p_tier text,p_billing text,p_review boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.app_11941c8fec_payment_accounts; b public.app_11941c8fec_payment_bindings; pc public.app_11941c8fec_payment_plan_changes;
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 select * into strict a from public.app_11941c8fec_payment_accounts where user_id=p_user and mode=p_mode for update;
 if a.revision is distinct from p_revision or a.subscription_id is distinct from p_subscription then raise exception 'Stale plan request' using errcode='42501'; end if;
 select * into strict b from public.app_11941c8fec_payment_bindings where mode=p_mode and subscription_id=p_subscription and user_id=p_user;
 select * into pc from public.app_11941c8fec_payment_plan_changes where mode=p_mode and subscription_id=p_subscription and status in ('requested','confirmed','review');
 if pc.id is not null then
   if pc.variant_id<>p_variant then raise exception 'Another plan request is pending' using errcode='42501'; end if;
   return jsonb_build_object('created',false,'id',pc.id,'status',pc.status);
 end if;
 if not p_review and (b.billing<>p_billing or b.last_state->>'provider_status'<>'active' or b.last_state->>'payment_processor' is distinct from 'stripe') then
   raise exception 'Unsupported automatic plan transition' using errcode='42501';
 end if;
 insert into public.app_11941c8fec_payment_plan_changes(mode,subscription_id,user_id,product_id,variant_id,tier,billing,status,baseline_invoice)
 values(p_mode,p_subscription,p_user,p_product,p_variant,p_tier,p_billing,case when p_review then 'review' else 'requested' end,b.last_state->>'latest_invoice_id') returning * into pc;
 update public.app_11941c8fec_payment_accounts set revision=revision+1 where user_id=p_user;
 return jsonb_build_object('created',true,'id',pc.id,'status',pc.status);
end $$;

create function public.app_11941c8fec_payment_confirm_plan(p_mode text,p_user uuid,p_id uuid,p_provider_changed_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 perform 1 from public.app_11941c8fec_payment_accounts where user_id=p_user and mode=p_mode for update;
 update public.app_11941c8fec_payment_plan_changes set status='confirmed',
   confirmed_after=greatest(statement_timestamp(),p_provider_changed_at)
   where id=p_id and mode=p_mode and user_id=p_user and status='requested';
 if not found then raise exception 'Invalid plan confirmation' using errcode='42501'; end if;
 update public.app_11941c8fec_payment_accounts set revision=revision+1 where user_id=p_user;
 return jsonb_build_object('confirmed',true);
end $$;

create function public.app_11941c8fec_payment_commit_snapshot(p_mode text,p_key text,p_event text,p_object text,p_user uuid,p_revision bigint,p_intent_hash text,
 p_subscription text,p_customer text,p_order text,p_store text,p_product text,p_variant text,p_tier text,p_billing text,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.app_11941c8fec_payment_accounts; b public.app_11941c8fec_payment_bindings; i public.app_11941c8fec_payment_intents;
 pc public.app_11941c8fec_payment_plan_changes; pp public.app_11941c8fec_payment_periods; v jsonb; project boolean; old_guard text;
begin
 perform public.app_11941c8fec_payment_require_mode(p_mode);
 select * into strict a from public.app_11941c8fec_payment_accounts where user_id=p_user and mode=p_mode for update;
 if exists(select 1 from public.app_11941c8fec_payment_events where mode=p_mode and event_key=p_key and outcome='applied') then return jsonb_build_object('duplicate',true); end if;
 if a.revision is distinct from p_revision then return jsonb_build_object('retry',true); end if;
 select * into b from public.app_11941c8fec_payment_bindings where mode=p_mode and subscription_id=p_subscription;
 if b.subscription_id is null then
   select * into strict i from public.app_11941c8fec_payment_intents where intent_hash=p_intent_hash and mode=p_mode for update;
   if i.user_id<>p_user or i.checkout_id is null or i.store_id<>p_store or i.product_id<>p_product or i.variant_id<>p_variant or i.tier<>p_tier or i.billing<>p_billing
     or i.supersedes_id is distinct from a.subscription_id or (i.subscription_id is not null and i.subscription_id<>p_subscription) then
     raise exception 'Untrusted replacement binding' using errcode='42501';
   end if;
   if a.subscription_id is not null and not exists(select 1 from public.app_11941c8fec_payment_bindings
     where mode=p_mode and subscription_id=a.subscription_id and user_id=p_user and last_state->>'provider_status'='expired') then
     raise exception 'Previous subscription not expired' using errcode='42501';
   end if;
   insert into public.app_11941c8fec_payment_bindings(mode,subscription_id,user_id,customer_id,order_id,product_id,variant_id,tier,billing)
   values(p_mode,p_subscription,p_user,p_customer,p_order,p_product,p_variant,p_tier,p_billing) returning * into b;
   update public.app_11941c8fec_payment_intents set subscription_id=p_subscription where intent_hash=p_intent_hash;
   project:=true;
 else
   if b.user_id<>p_user or b.customer_id<>p_customer or b.order_id<>p_order then raise exception 'Immutable binding mismatch' using errcode='42501'; end if;
   project:=a.subscription_id=p_subscription;
   if b.variant_id<>p_variant or b.product_id<>p_product or b.tier<>p_tier or b.billing<>p_billing then
     select * into pc from public.app_11941c8fec_payment_plan_changes where id=(p_state->>'plan_change_id')::uuid and user_id=p_user and mode=p_mode and subscription_id=p_subscription for update;
     if pc.id is null or pc.status<>'confirmed' or pc.variant_id<>p_variant or pc.product_id<>p_product or pc.tier<>p_tier or pc.billing<>p_billing
       or not exists(select 1 from jsonb_array_elements(p_state->'periods') x where x->>'kind'='renewal' and x->>'variant'=p_variant
         and x->>'proof_id' is distinct from pc.baseline_invoice and (x->>'source_created_at')::timestamptz>pc.confirmed_after and x->>'confirmed_at' is not null and x->>'revoked_at' is null) then
       raise exception 'Plan has no independently verified later renewal' using errcode='42501';
     end if;
     update public.app_11941c8fec_payment_plan_changes set status='activated' where id=pc.id;
   end if;
 end if;
 if b.last_state->>'provider_updated_at' is not null and (p_state->>'provider_updated_at')::timestamptz<(b.last_state->>'provider_updated_at')::timestamptz then return jsonb_build_object('retry',true); end if;
 for v in select value from jsonb_array_elements(p_state->'periods') loop
   select * into pp from public.app_11941c8fec_payment_periods where mode=p_mode and subscription_id=p_subscription and proof_id=v->>'proof_id';
   if pp.confirmed_at is not null and ((v->>'confirmed_at')::timestamptz is distinct from pp.confirmed_at
     or v->>'tier' is distinct from pp.tier or v->>'billing' is distinct from pp.billing or v->>'variant' is distinct from pp.variant_id) then
     raise exception 'Verified proof is immutable' using errcode='42501';
   end if;
   insert into public.app_11941c8fec_payment_periods(mode,subscription_id,proof_id,user_id,kind,access_start,access_end,revoked_at,review_required,
     confirmed_at,source_created_at,end_source,tier,billing,product_id,variant_id)
   values(p_mode,p_subscription,v->>'proof_id',p_user,v->>'kind',(v->>'start')::timestamptz,(v->>'end')::timestamptz,(v->>'revoked_at')::timestamptz,coalesce((v->>'review')::boolean,false),
     (v->>'confirmed_at')::timestamptz,(v->>'source_created_at')::timestamptz,v->>'end_source',nullif(v->>'tier','free'),v->>'billing',v->>'product',v->>'variant')
   on conflict(mode,subscription_id,proof_id) do update set access_end=least(public.app_11941c8fec_payment_periods.access_end,excluded.access_end),
     access_start=case when public.app_11941c8fec_payment_periods.confirmed_at is null and excluded.confirmed_at is not null then excluded.confirmed_at else public.app_11941c8fec_payment_periods.access_start end,
     confirmed_at=coalesce(public.app_11941c8fec_payment_periods.confirmed_at,excluded.confirmed_at),
     source_created_at=coalesce(public.app_11941c8fec_payment_periods.source_created_at,excluded.source_created_at),
     end_source=coalesce(public.app_11941c8fec_payment_periods.end_source,excluded.end_source),
     tier=coalesce(public.app_11941c8fec_payment_periods.tier,excluded.tier),billing=coalesce(public.app_11941c8fec_payment_periods.billing,excluded.billing),
     product_id=coalesce(public.app_11941c8fec_payment_periods.product_id,excluded.product_id),variant_id=coalesce(public.app_11941c8fec_payment_periods.variant_id,excluded.variant_id),
     revoked_at=coalesce(public.app_11941c8fec_payment_periods.revoked_at,excluded.revoked_at),review_required=public.app_11941c8fec_payment_periods.review_required or excluded.review_required;
 end loop;
 if p_state->>'invoice_id' is not null then
   select * into strict pp from public.app_11941c8fec_payment_periods where mode=p_mode and subscription_id=p_subscription and user_id=p_user and proof_id=p_state->>'invoice_id';
   if pp.confirmed_at is distinct from (p_state->>'paid_access_from')::timestamptz or pp.confirmed_at is null
     or pp.access_end is distinct from (p_state->>'paid_access_until')::timestamptz
     or pp.tier is distinct from (p_state->>'effective_tier') or pp.billing is distinct from (p_state->>'effective_billing')
     or (pp.revoked_at is not null and p_state->>'entitlement_revoked_at' is null) then raise exception 'Projection disagrees with payment proof' using errcode='42501'; end if;
 elsif p_state->>'paid_access_until' is not null then raise exception 'Missing payment proof' using errcode='42501'; end if;
 update public.app_11941c8fec_payment_bindings set product_id=p_product,variant_id=p_variant,tier=p_tier,billing=p_billing,last_state=p_state-'periods' where mode=p_mode and subscription_id=p_subscription;
 if project then
   old_guard:=current_setting('amanahlife.trusted_payment_write',true);
   perform set_config('amanahlife.trusted_payment_write','yes',true);
   insert into public.app_11941c8fec_subscriptions(user_id,tier,billing_cycle,status,payment_provider,lemonsqueezy_customer_id,lemonsqueezy_subscription_id,
     current_period_start,current_period_end,paid_access_from,paid_access_until,entitlement_revoked_at)
   values(p_user,coalesce(p_state->>'effective_tier','free'),coalesce(p_state->>'effective_billing',p_billing),p_state->>'status','lemonsqueezy',p_customer,p_subscription,
     null,coalesce((p_state->>'ends_at')::timestamptz,(p_state->>'paid_access_until')::timestamptz),(p_state->>'paid_access_from')::timestamptz,(p_state->>'paid_access_until')::timestamptz,(p_state->>'entitlement_revoked_at')::timestamptz)
   on conflict(user_id) do update set tier=excluded.tier,billing_cycle=excluded.billing_cycle,status=excluded.status,payment_provider=excluded.payment_provider,
     lemonsqueezy_customer_id=excluded.lemonsqueezy_customer_id,lemonsqueezy_subscription_id=excluded.lemonsqueezy_subscription_id,
     current_period_start=null,current_period_end=excluded.current_period_end,paid_access_from=excluded.paid_access_from,paid_access_until=excluded.paid_access_until,
     entitlement_revoked_at=excluded.entitlement_revoked_at,updated_at=statement_timestamp();
   perform set_config('amanahlife.trusted_payment_write',coalesce(old_guard,''),true);
   update public.app_11941c8fec_payment_accounts set subscription_id=p_subscription,customer_id=p_customer,order_id=p_order,product_id=p_product,variant_id=p_variant,
     tier=coalesce(p_state->>'effective_tier','free'),billing=coalesce(p_state->>'effective_billing',p_billing),provider_updated_at=(p_state->>'provider_updated_at')::timestamptz,
     invoice_id=p_state->>'invoice_id',review_required=coalesce((p_state->>'review_required')::boolean,false) where user_id=p_user;
 end if;
 update public.app_11941c8fec_payment_accounts set revision=revision+1 where user_id=p_user;
 insert into public.app_11941c8fec_payment_events(mode,event_key,event_name,object_id,outcome) values(p_mode,p_key,p_event,p_object,'applied') on conflict(mode,event_key) do update set outcome='applied';
 return jsonb_build_object('applied',true,'archived',not project);
end $$;

-- Compute time-sensitive entitlement from valid period proofs; a downgrade cannot erase
-- a still-paid higher tier, and expiry automatically falls through to another valid period.
create function public.app_11941c8fec_payment_entitlement(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.app_11941c8fec_subscriptions; pp public.app_11941c8fec_payment_periods;
begin
 select * into s from public.app_11941c8fec_subscriptions where user_id=p_user;
 if not found then return null; end if;
 select p.* into pp from public.app_11941c8fec_payment_periods p
 join public.app_11941c8fec_payment_accounts a on a.user_id=p.user_id and a.mode=p.mode and a.subscription_id=p.subscription_id
 join public.app_11941c8fec_payment_bindings b on b.mode=p.mode and b.subscription_id=p.subscription_id
 join public.app_11941c8fec_payment_environment e on e.mode=p.mode
 where p.user_id=p_user and p.confirmed_at<=statement_timestamp() and p.access_end>statement_timestamp() and p.revoked_at is null
   and b.last_state->>'provider_status' in ('active','past_due','unpaid','cancelled') and p.tier in ('balanced','family')
 order by case when p.tier='family' then 2 else 1 end desc,p.access_end desc limit 1;
 return to_jsonb(s)||jsonb_build_object('tier',coalesce(pp.tier,'free'),'billing_cycle',coalesce(pp.billing,s.billing_cycle),
   'paid_access_from',pp.confirmed_at,'paid_access_until',pp.access_end,'current_period_start',null,
   'current_period_end',pp.access_end,'has_private_binding',exists(select 1 from public.app_11941c8fec_payment_accounts where user_id=p_user and subscription_id is not null),
   'entitlement_revoked_at',case when pp.proof_id is not null then null else s.entitlement_revoked_at end);
end $$;
create function public.app_11941c8fec_current_subscription()
returns jsonb language sql stable security definer set search_path='' as $$ select public.app_11941c8fec_payment_entitlement(auth.uid()) $$;
create or replace function public.app_11941c8fec_account_family_entitled(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((x->>'entitlement_revoked_at') is null and (
   ((x->>'trial_started_at')::timestamptz<=statement_timestamp() and (x->>'trial_started_at')::timestamptz>statement_timestamp()-interval '7 days')
   or (x->>'tier'='family' and (x->>'paid_access_from')::timestamptz<=statement_timestamp() and (x->>'paid_access_until')::timestamptz>statement_timestamp())),false)
 from (select public.app_11941c8fec_payment_entitlement(p_user_id) x) q
$$;

-- Legacy service-role writers (including Paddle) may not overwrite a trusted LS projection.
create function public.app_11941c8fec_guard_payment_projection()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('amanahlife.trusted_payment_write',true) is distinct from 'yes'
 and exists(select 1 from public.app_11941c8fec_payment_accounts where user_id=old.user_id and subscription_id is not null)
 and row(new.tier,new.billing_cycle,new.status,new.payment_provider,new.lemonsqueezy_subscription_id,new.lemonsqueezy_customer_id,new.paid_access_from,new.paid_access_until,new.entitlement_revoked_at,new.current_period_start,new.current_period_end)
 is distinct from row(old.tier,old.billing_cycle,old.status,old.payment_provider,old.lemonsqueezy_subscription_id,old.lemonsqueezy_customer_id,old.paid_access_from,old.paid_access_until,old.entitlement_revoked_at,old.current_period_start,old.current_period_end) then
   raise exception 'Use the trusted payment projection' using errcode='42501';
 end if;
 return new;
end $$;
create trigger app_11941c8fec_trusted_payment_projection before update on public.app_11941c8fec_subscriptions
 for each row execute function public.app_11941c8fec_guard_payment_projection();

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'app\_11941c8fec\_payment\_%' escape '\' loop
   execute format('alter function %s owner to postgres',f.signature);
   execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
   if f.proname not in ('app_11941c8fec_payment_require_mode','app_11941c8fec_payment_entitlement','app_11941c8fec_payment_apply','app_11941c8fec_payment_create_intent') then execute format('grant execute on function %s to service_role',f.signature); end if;
 end loop;
end $$;
revoke all on function public.app_11941c8fec_current_subscription(),public.app_11941c8fec_guard_payment_projection() from public,anon,authenticated,service_role;
alter function public.app_11941c8fec_current_subscription() owner to postgres;
alter function public.app_11941c8fec_guard_payment_projection() owner to postgres;
grant execute on function public.app_11941c8fec_current_subscription() to authenticated;
notify pgrst,'reload schema';
commit;
