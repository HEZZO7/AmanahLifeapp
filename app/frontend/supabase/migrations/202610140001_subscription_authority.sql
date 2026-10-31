-- PREPARATION ONLY. Apply to isolated staging first; production is not authorized.
-- Coordinate with the frontend RPC change. No users or subscription rows are removed.
begin;

do $$
begin
  if to_regclass('public.app_11941c8fec_subscriptions') is null then
    raise exception 'Subscription table missing; do not infer a schema';
  end if;
  if exists (select 1 from pg_trigger
             where tgrelid = 'public.app_11941c8fec_subscriptions'::regclass
               and not tgisinternal) then
    raise exception 'Unexpected subscription trigger; review before migration';
  end if;
  if exists (select 1 from pg_policies
             where schemaname = 'public'
               and tablename = 'app_11941c8fec_subscriptions'
               and policyname not in ('allow_insert_own_subscription',
                                      'allow_read_own_subscription',
                                      'allow_service_role_all')) then
    raise exception 'Unexpected subscription policy; review before migration';
  end if;
  if to_regprocedure('public.app_11941c8fec_start_trial()') is not null then
    raise exception 'Existing trial RPC requires review before replacement';
  end if;
end $$;

alter table public.app_11941c8fec_subscriptions enable row level security;
revoke all privileges on table public.app_11941c8fec_subscriptions
  from public, anon, authenticated, service_role;

-- Also remove any column grants introduced since the evidence snapshot.
do $$
declare column_names text;
begin
  select string_agg(format('%I', attname), ', ' order by attnum)
    into column_names from pg_attribute
    where attrelid = 'public.app_11941c8fec_subscriptions'::regclass
      and attnum > 0 and not attisdropped;
  execute format(
    'revoke all privileges (%s) on table public.app_11941c8fec_subscriptions from public, anon, authenticated, service_role',
    column_names);
end $$;

grant select on public.app_11941c8fec_subscriptions to authenticated;
-- DELETE is required by the existing authenticated account-deletion server function.
grant select, insert, update, delete
  on public.app_11941c8fec_subscriptions to service_role;

drop policy if exists allow_insert_own_subscription on public.app_11941c8fec_subscriptions;
drop policy if exists allow_read_own_subscription on public.app_11941c8fec_subscriptions;
drop policy if exists allow_service_role_all on public.app_11941c8fec_subscriptions;
create policy allow_read_own_subscription
  on public.app_11941c8fec_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy allow_service_role_all
  on public.app_11941c8fec_subscriptions for all to service_role
  using (true) with check (true);

create function public.app_11941c8fec_start_trial()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  started_at timestamptz := statement_timestamp();
  saved_start timestamptz;
begin
  if account_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- A unique user_id serializes concurrent attempts. The condition is evaluated
  -- on the locked conflicting row, preventing a second or restarted trial.
  -- Existing paid fields and existing trial dates are never overwritten.
  insert into public.app_11941c8fec_subscriptions
    (user_id, trial_started_at, trial_used)
  values (account_id, started_at, true)
  on conflict (user_id) do update
    set trial_started_at = excluded.trial_started_at,
        trial_used = true,
        updated_at = started_at
    where not public.app_11941c8fec_subscriptions.trial_used
      and public.app_11941c8fec_subscriptions.trial_started_at is null
  returning trial_started_at into saved_start;

  if saved_start is null then
    return jsonb_build_object('error', 'trial_already_used');
  end if;
  return jsonb_build_object('error', null, 'trial_started_at', saved_start);
end $$;
alter function public.app_11941c8fec_start_trial() owner to postgres;
revoke all privileges on function public.app_11941c8fec_start_trial()
  from public, anon, authenticated, service_role;
grant execute on function public.app_11941c8fec_start_trial() to authenticated;
notify pgrst, 'reload schema';
commit;
