-- Disposable SQL fixture ONLY, not native Auth/JWT integration. Everything rolls back.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_setting('amanahlife.security_fixture',true) is distinct from 'isolated'
     or current_setting('amanahlife.local_test',true) is distinct from 'approved'
     or current_user<>'postgres' then raise exception 'Isolated fixture required'; end if;
end $$;
insert into auth.users(id,email) values
 ('90000000-0000-4000-8000-000000000009','veto-009@example.invalid'),
 ('90000000-0000-4000-8000-000000000010','control-009@example.invalid');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000009',true);
set local role authenticated;
select public.app_11941c8fec_start_trial();
reset role;
do $$ declare t text; begin
  foreach t in array array['search_history','email_digest','notification_preferences','push_subscriptions'] loop
    execute format('insert into public.app_11941c8fec_%I(user_id) values($1),($2)',t)
      using '90000000-0000-4000-8000-000000000009'::uuid,'90000000-0000-4000-8000-000000000010'::uuid;
  end loop;
end $$;
create function public.fixture_009_snapshot() returns jsonb language plpgsql as $$
declare result jsonb; t text; rows jsonb; begin
  select jsonb_agg(to_jsonb(u) order by id) into result from auth.users u;
  result:=jsonb_build_object('auth',result);
  foreach t in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) order by id),''[]'') from public.app_11941c8fec_%I x',t) into rows;
    result:=result||jsonb_build_object(t,rows);
  end loop;
  return result;
end $$;
create function public.fixture_009_veto() returns trigger language plpgsql as $$
begin perform nextval('public.fixture_009_witness'); return null; end $$;

-- Early veto, late veto, statement veto and replica trigger all veto readiness.
-- Late veto must be rejected inside DELETE, not merely at HTTP preflight.
do $$ declare name text; saved jsonb; hit bigint; outcome jsonb; denied boolean; begin
  saved:=public.fixture_009_snapshot();
  foreach name in array array['aa_veto','zz_veto','statement_veto','replica_veto'] loop
    if public.app_11941c8fec_account_deletion_ready() is distinct from true then raise exception 'Baseline not ready'; end if;
    execute format('create trigger %I before delete on auth.users for each %s execute function public.fixture_009_veto()',name,
      case when name='statement_veto' then 'statement' else 'row' end);
    if name='replica_veto' then execute format('alter table auth.users enable replica trigger %I',name); end if;
    if public.app_11941c8fec_account_deletion_ready() is distinct from false then raise exception 'Unreviewed veto considered ready: %',name; end if;
    denied:=false;
    begin
      delete from auth.users where id='90000000-0000-4000-8000-000000000009';
    exception when insufficient_privilege then denied:=true;
    end;
    if name in ('zz_veto','replica_veto') and not denied then raise exception 'Statement-time readiness guard missing'; end if;
    if public.fixture_009_snapshot() is distinct from saved then raise exception 'Veto lost account/trial rows: %',name; end if;
    execute 'set local role authenticated';
    outcome:=public.app_11941c8fec_start_trial();
    execute 'reset role';
    if outcome->>'error' is distinct from 'trial_already_used' then raise exception 'Veto permitted second trial'; end if;
    if public.fixture_009_snapshot() is distinct from saved then raise exception 'Denied trial mutated history'; end if;
    execute format('drop trigger %I on auth.users',name);
    raise notice 'PASS veto_%',name;
  end loop;
end $$;

-- Real rollback after each of the five cleanup phases and after Auth DELETE.
do $$ declare t text; stage text; saved jsonb; hit bigint; caught boolean; begin
  foreach t in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions','auth'] loop
    execute format('create trigger zz_fixture_009_failure after delete on %s for each row execute function public.fixture_009_after_cleanup_failure()',
      case when t='auth' then 'auth.users' else 'public.app_11941c8fec_'||t end);
  end loop;
  saved:=public.fixture_009_snapshot();
  foreach stage in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions','auth'] loop
    insert into public.fixture_009_faults values('90000000-0000-4000-8000-000000000009',stage)
      on conflict(target) do update set phase=excluded.phase;
    select case when is_called then last_value else 0 end into hit from public.fixture_009_witness;
    caught:=false;
    begin
      delete from auth.users where id='90000000-0000-4000-8000-000000000009';
    exception when sqlstate 'ZX009' then caught:=true;
    end;
    if not caught or (select last_value from public.fixture_009_witness)<>hit+1 then raise exception 'Unwitnessed cleanup failure'; end if;
    if public.fixture_009_snapshot() is distinct from saved then raise exception 'Cleanup failure lost trial/account'; end if;
    raise notice 'PASS rollback_%',stage;
  end loop;
  delete from public.fixture_009_faults;
end $$;

-- AFTER RETURN NULL cannot veto. A disabled BEFORE trigger is inert.
create trigger zz_after_null after delete on auth.users for each row execute function public.fixture_009_veto();
create trigger zz_disabled before delete on auth.users for each row execute function public.fixture_009_veto();
alter table auth.users disable trigger zz_disabled;
do $$ declare t text; begin
  if public.app_11941c8fec_account_deletion_ready() is distinct from true then raise exception 'Inert triggers blocked readiness'; end if;
  delete from auth.users where id='90000000-0000-4000-8000-000000000009';
  if exists(select 1 from auth.users where id='90000000-0000-4000-8000-000000000009') then raise exception 'Auth deletion failed'; end if;
  foreach t in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions'] loop
    if exists(select 1 from jsonb_array_elements(public.fixture_009_snapshot()->t) x where x->>'user_id'='90000000-0000-4000-8000-000000000009') then raise exception 'Cleanup missing'; end if;
  end loop;
  if not exists(select 1 from auth.users where id='90000000-0000-4000-8000-000000000010') then raise exception 'Control lost'; end if;
  raise notice 'PASS after_null_and_disabled_before';
end $$;
rollback;
