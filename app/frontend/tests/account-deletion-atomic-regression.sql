-- NOT EXECUTED. Disposable LOCAL Supabase only, after 001--005, 008 and 009.
-- A later authorized runner must create a real synthetic Auth user, start its
-- trial through its Auth JWT, and seed one row in all four cleanup fixture tables.
-- Pass that validated UUID as psql -v trial_user=...; never use production data.
-- All writes/fault-injection objects roll back. ON_ERROR_STOP + disconnect also
-- rolls back on an unexpected error. This file is not a hosted/JWT test by itself.
\set ON_ERROR_STOP on
begin;
select set_config('amanahlife.atomic_trial_user', :'trial_user', true) is not null as configured;

do $$ declare actor text; target uuid:=current_setting('amanahlife.atomic_trial_user')::uuid; t text; seeded boolean; begin
  if current_setting('amanahlife.local_test',true) is distinct from 'approved'
     or current_user<>'postgres' or current_database()<>'postgres'
     or not exists(select 1 from auth.users where id=target and email like '%@example.invalid')
     or public.app_11941c8fec_account_deletion_ready() is distinct from true
     or public.app_11941c8fec_account_deletion_allowed(target) is distinct from true then
    raise exception 'Prepared disposable synthetic trial account required';
  end if;
  if not exists(select 1 from public.app_11941c8fec_subscriptions
    where user_id=target and trial_used and trial_started_at is not null) then
    raise exception 'Previously issued trial evidence required';
  end if;
  foreach t in array array['search_history','email_digest','notification_preferences','push_subscriptions'] loop
    -- Explicitly prove each seeded cleanup table will be exercised.
    execute format('select count(*)>0 from public.app_11941c8fec_%I where user_id=$1',t) into seeded using target;
    if seeded is distinct from true then raise exception 'Seeded cleanup rows required'; end if;
  end loop;
  foreach actor in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(actor,'public.app_11941c8fec_subscriptions','DELETE')
       or has_function_privilege(actor,'public.app_11941c8fec_cleanup_account_on_delete()','EXECUTE') then
      raise exception 'Direct trial-history deletion/trigger RPC must be denied';
    end if;
  end loop;
end $$;

-- Inject a unique failure AFTER all real cleanup and Auth row DELETE work.
-- Reaching ZX009 proves the real trigger removed every seeded child row first;
-- another error/early failure cannot stand in for this regression.
create function public.fixture_009_fail_after_cleanup()
returns trigger language plpgsql security definer set search_path='' as $$
declare t text; remains boolean;
begin
  if old.id<>current_setting('amanahlife.atomic_trial_user')::uuid then
    raise exception 'Unexpected fixture identity' using errcode='ZX008';
  end if;
  foreach t in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions'] loop
    execute format('select exists(select 1 from public.app_11941c8fec_%I where user_id=$1)',t) into remains using old.id;
    if remains then raise exception 'Real atomic cleanup did not complete' using errcode='ZX008'; end if;
  end loop;
  raise exception 'Synthetic Auth failure after cleanup' using errcode='ZX009';
end $$;
alter function public.fixture_009_fail_after_cleanup() owner to postgres;
revoke all on function public.fixture_009_fail_after_cleanup() from public,anon,authenticated,service_role;
create trigger zz_fixture_009_fail_after_cleanup after delete on auth.users
  for each row execute function public.fixture_009_fail_after_cleanup();

do $$ declare target uuid:=current_setting('amanahlife.atomic_trial_user')::uuid;
  saved jsonb; restored jsonb; t text;
begin
  saved:=jsonb_build_object('auth',(select to_jsonb(u) from auth.users u where id=target));
  foreach t in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]''::jsonb) from public.app_11941c8fec_%I x where user_id=$1',t) into restored using target;
    saved:=saved||jsonb_build_object(t,restored);
  end loop;
  perform set_config('amanahlife.atomic_trial_snapshot',(saved->'subscriptions')::text,true);
  begin
    delete from auth.users where id=target;
    raise exception 'Expected Auth failure missing';
  exception when sqlstate 'ZX009' then null;
  end;
  if (select to_jsonb(u) from auth.users u where id=target) is distinct from saved->'auth' then
    raise exception 'Failed deletion changed Auth identity';
  end if;
  foreach t in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]''::jsonb) from public.app_11941c8fec_%I x where user_id=$1',t) into restored using target;
    if restored is distinct from saved->t then raise exception 'Failed deletion lost account/trial data'; end if;
  end loop;
end $$;

-- Invoke the REAL reviewed trial RPC under the authenticated database role.
-- A separate future HTTP test must additionally use the surviving real Auth JWT.
select set_config('request.jwt.claim.sub',current_setting('amanahlife.atomic_trial_user'),true) is not null as configured;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('amanahlife.atomic_trial_user'),'role','authenticated')::text,true) is not null as configured;
set local role authenticated;
do $$ declare outcome jsonb; begin
  outcome:=public.app_11941c8fec_start_trial();
  if outcome->>'error' is distinct from 'trial_already_used' then
    raise exception 'Failed deletion must not permit a second trial';
  end if;
end $$;
reset role;
do $$ declare actual jsonb; begin
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) into actual
    from public.app_11941c8fec_subscriptions s where user_id=current_setting('amanahlife.atomic_trial_user')::uuid;
  if actual is distinct from current_setting('amanahlife.atomic_trial_snapshot')::jsonb then
    raise exception 'Denied second trial changed original trial history';
  end if;
end $$;
rollback;
