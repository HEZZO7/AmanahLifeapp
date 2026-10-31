-- REVIEW ONLY. Depends on 001--005 and 008. No production execution authorized.
-- Definition/ACL changes only: no existing rows or trial history are rewritten.
begin;

do $$ declare t text; begin
  if to_regprocedure('public.app_11941c8fec_account_deletion_allowed(uuid)') is null
     or to_regprocedure('public.app_11941c8fec_guard_account_deletion()') is null then
    raise exception 'Reviewed Migration 008 required';
  end if;
  foreach t in array array['subscriptions','search_history','email_digest','notification_preferences','push_subscriptions'] loop
    if not exists(select 1 from pg_attribute a where
      a.attrelid=to_regclass('public.app_11941c8fec_'||t)
      and a.attname='user_id' and a.atttypid='uuid'::regtype and a.attnum>0 and not a.attisdropped) then
      raise exception 'Reviewed account cleanup table/user_id required';
    end if;
  end loop;
end $$;

create or replace function public.app_11941c8fec_cleanup_account_on_delete()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_schema<>'auth' or tg_table_name<>'users' or tg_op<>'DELETE'
     or tg_when<>'BEFORE' or tg_level<>'ROW' then
    raise exception 'Unsupported atomic cleanup context' using errcode='42501';
  end if;
  -- A later BEFORE trigger may RETURN NULL without raising: PostgreSQL would
  -- keep auth.users but commit our child deletes. Recheck readiness under this
  -- DELETE's relation lock, not only in the earlier HTTP preflight. Concurrent
  -- trigger DDL cannot pass this lock while the statement is executing.
  if public.app_11941c8fec_account_deletion_ready() is distinct from true then
    raise exception 'Unreviewed account deletion configuration' using errcode='42501';
  end if;
  -- Recheck the unchanged 008 policy before touching any data. The parent row is
  -- already locked by DELETE; checkout FK checks serialize against this lock.
  if public.app_11941c8fec_account_deletion_allowed(old.id) is distinct from true then
    raise exception 'Billing retention review required' using errcode='42501';
  end if;
  -- Same five-table scope as the old server adapter. No payment ledger is deleted.
  -- No exception is swallowed: a failed child delete, FK, Auth operation or later
  -- trigger aborts this statement and restores ALL these rows, including trials.
  delete from public.app_11941c8fec_subscriptions where user_id=old.id;
  delete from public.app_11941c8fec_search_history where user_id=old.id;
  delete from public.app_11941c8fec_email_digest where user_id=old.id;
  delete from public.app_11941c8fec_notification_preferences where user_id=old.id;
  delete from public.app_11941c8fec_push_subscriptions where user_id=old.id;
  return old;
end $$;
alter function public.app_11941c8fec_cleanup_account_on_delete() owner to postgres;
revoke all on function public.app_11941c8fec_cleanup_account_on_delete() from public,anon,authenticated,service_role;

-- PostgreSQL orders same-kind triggers by name: 008 billing_retention runs first.
drop trigger if exists app_11941c8fec_transactional_account_cleanup on auth.users;
create trigger app_11941c8fec_transactional_account_cleanup before delete on auth.users
  for each row execute function public.app_11941c8fec_cleanup_account_on_delete();

-- Old Edge versions must fail BEFORE they can erase trial evidence. BYPASSRLS
-- does not bypass this table ACL. The postgres-owned trigger needs no such grant.
revoke delete on public.app_11941c8fec_subscriptions from service_role;

create or replace function public.app_11941c8fec_account_deletion_ready()
returns boolean language sql stable security definer set search_path='' as $$
  select
    -- Reject row AND statement BEFORE DELETE triggers, including conditional
    -- or replica-enabled ones. AFTER return values cannot veto deletion.
    not exists(select 1 from pg_trigger t where t.tgrelid='auth.users'::regclass
      and not t.tgisinternal and t.tgenabled<>'D'
      and (t.tgtype::int & 10)=10
      and t.tgname not in ('app_11941c8fec_billing_retention','app_11941c8fec_transactional_account_cleanup'))
    and
    not has_table_privilege('anon','public.app_11941c8fec_subscriptions','DELETE')
    and not has_table_privilege('authenticated','public.app_11941c8fec_subscriptions','DELETE')
    and not has_table_privilege('service_role','public.app_11941c8fec_subscriptions','DELETE')
    and not has_function_privilege('anon','public.app_11941c8fec_account_deletion_allowed(uuid)','EXECUTE')
    and not has_function_privilege('authenticated','public.app_11941c8fec_account_deletion_allowed(uuid)','EXECUTE')
    and has_function_privilege('service_role','public.app_11941c8fec_account_deletion_allowed(uuid)','EXECUTE')
    and exists(select 1 from pg_class where oid='public.app_11941c8fec_subscriptions'::regclass and relrowsecurity)
    and (select count(*)=5 from pg_constraint k
      join pg_attribute a on a.attrelid=k.conrelid and a.attname='user_id'
      join pg_attribute u on u.attrelid=k.confrelid and u.attname='id'
      where k.contype='f' and k.confrelid='auth.users'::regclass
      and k.conrelid in ('public.app_11941c8fec_subscriptions'::regclass,
        'public.app_11941c8fec_payment_accounts'::regclass,'public.app_11941c8fec_payment_intents'::regclass,
        'public.app_11941c8fec_payment_bindings'::regclass,'public.app_11941c8fec_payment_periods'::regclass)
      and k.conkey=array[a.attnum] and k.confkey=array[u.attnum] and k.convalidated and not k.condeferrable
      and k.confdeltype::text=case when k.conrelid='public.app_11941c8fec_subscriptions'::regclass then 'a' else 'c' end)
    and (select count(*)=2 from pg_trigger t where not t.tgisinternal and t.tgenabled='O' and t.tgtype=11
      and t.tgname='app_11941c8fec_billing_retention'
      and t.tgrelid in ('auth.users'::regclass,'public.app_11941c8fec_subscriptions'::regclass)
      and t.tgfoid='public.app_11941c8fec_guard_account_deletion()'::regprocedure
      and t.tgqual is null)
    and exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
      where t.tgrelid='auth.users'::regclass and t.tgname='app_11941c8fec_transactional_account_cleanup'
      and not t.tgisinternal and t.tgenabled='O' and t.tgtype=11 and t.tgqual is null
      and t.tgfoid='public.app_11941c8fec_cleanup_account_on_delete()'::regprocedure
      and p.prosecdef and p.proowner='postgres'::regrole
      and array_length(p.proconfig,1)=1 and p.proconfig[1] in ('search_path=','search_path=""'))
$$;
alter function public.app_11941c8fec_account_deletion_ready() owner to postgres;
revoke all on function public.app_11941c8fec_account_deletion_ready() from public,anon,authenticated,service_role;
grant execute on function public.app_11941c8fec_account_deletion_ready() to service_role;

do $$ declare actor text; begin
  foreach actor in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(actor,'public.app_11941c8fec_cleanup_account_on_delete()','EXECUTE')
       or (actor<>'service_role' and has_function_privilege(actor,'public.app_11941c8fec_account_deletion_ready()','EXECUTE')) then
      raise exception 'Unexpected effective atomic deletion function privileges';
    end if;
  end loop;
  if not has_function_privilege('service_role','public.app_11941c8fec_account_deletion_ready()','EXECUTE')
     or public.app_11941c8fec_account_deletion_ready() is distinct from true then
    raise exception 'Atomic account deletion prerequisite/ACL verification failed';
  end if;
end $$;

notify pgrst,'reload schema';
commit;
