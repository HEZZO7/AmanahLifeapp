-- DRAFT ONLY. No production authorization. Standalone notification boundary;
-- no dependency on billing 001-006. Ship compatible BackupRestore first.
-- Idempotent ACL/policy replacement; never updates/deletes application rows.
begin;
do $$
declare target text; rel oid; col text; auth_role oid := 'authenticated'::regrole;
begin
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls or rolcreaterole))
  or exists(select 1 from pg_roles a cross join pg_roles privileged
   where a.rolname in ('anon','authenticated') and
   (privileged.rolsuper or privileged.rolbypassrls or privileged.rolname in ('postgres','service_role'))
   and pg_has_role(a.oid,privileged.oid,'MEMBER')) then
  raise exception 'Privileged API role attributes/membership require separate review';
 end if;
 foreach target in array array['app_11941c8fec_notification_preferences','app_11941c8fec_push_subscriptions'] loop
  rel := to_regclass('public.'||target);
  if rel is null then raise exception 'Missing audited table: %',target; end if;
  if not exists(select 1 from pg_class where oid=rel and relkind='r' and relowner='postgres'::regrole)
   or exists(select 1 from pg_inherits where inhparent=rel or inhrelid=rel) then
   raise exception 'Unexpected owner/table/partition topology: %',target;
  end if;
  if exists(select 1 from pg_trigger where tgrelid=rel and not tgisinternal) then
   raise exception 'Unreviewed notification trigger: %',target;
  end if;
  if not exists(select 1 from pg_attribute where attrelid=rel and attname='user_id' and atttypid='uuid'::regtype and not attisdropped) then
   raise exception 'Unexpected identity column: %',target;
  end if;
  if exists(select 1 from pg_policy p cross join lateral unnest(p.polroles) r(id)
   where p.polrelid=rel and r.id not in (0,auth_role,'anon'::regrole,'service_role'::regrole)) then
   raise exception 'Additional notification policy role needs review: %',target;
  end if;
 end loop;
 foreach col in array array['prayer_reminders','bill_reminders','habit_reminders','fasting_reminders','savings_reminders','general_activity'] loop
  if not exists(select 1 from pg_attribute where attrelid='public.app_11941c8fec_notification_preferences'::regclass
   and attname=col and atttypid='boolean'::regtype and not attisdropped) then
   raise exception 'Unexpected boolean preference column: %',col;
  end if;
 end loop;
 foreach col in array array['timezone','language','prayer_calc_method','prayer_location_mode','prayer_manual_city'] loop
  if not exists(select 1 from pg_attribute where attrelid='public.app_11941c8fec_notification_preferences'::regclass and attname=col and not attisdropped) then
   raise exception 'Required location column missing: %',col;
  end if;
 end loop;
 if not exists(select 1 from pg_index i where i.indrelid='public.app_11941c8fec_notification_preferences'::regclass
   and i.indisunique and i.indisvalid and i.indpred is null and i.indexprs is null and i.indnkeyatts=1
   and (select a.attname from pg_attribute a where a.attrelid=i.indrelid and a.attnum=i.indkey[0])='user_id') then
  raise exception 'Expected unique preference identity index missing';
 end if;
end $$;

do $$
declare target text; columns_list text; p record;
begin
 foreach target in array array['app_11941c8fec_notification_preferences','app_11941c8fec_push_subscriptions'] loop
  execute format('alter table public.%I enable row level security',target);
  execute format('revoke all privileges on table public.%I from public,anon,authenticated,service_role',target);
  select string_agg(format('%I',attname),',') into columns_list from pg_attribute
   where attrelid=to_regclass('public.'||target) and attnum>0 and not attisdropped;
  execute format('revoke all privileges (%s) on table public.%I from public,anon,authenticated,service_role',columns_list,target);
  for p in select polname from pg_policy where polrelid=to_regclass('public.'||target) loop
   execute format('drop policy %I on public.%I',p.polname,target);
  end loop;
  -- Required by scoped Edge preferences, push registration/sending, scheduler
  -- markers and authenticated account deletion. No TRUNCATE/TRIGGER/REFERENCES.
  execute format('grant select,insert,update,delete on table public.%I to service_role',target);
  execute format('create policy amanah_notification_service on public.%I for all to service_role using(true) with check(true)',target);
 end loop;
end $$;

-- The browser still synchronizes location directly; both flags and location
-- can be safely restored to the actor's own row. Identity/internal fields cannot
-- be updated, exported by this client, or replayed from legacy backups.
grant select(user_id,prayer_reminders,bill_reminders,habit_reminders,fasting_reminders,savings_reminders,general_activity,
 timezone,language,prayer_calc_method,prayer_location_mode,prayer_manual_city)
 on public.app_11941c8fec_notification_preferences to authenticated;
grant insert(user_id,prayer_reminders,bill_reminders,habit_reminders,fasting_reminders,savings_reminders,general_activity,
 timezone,language,prayer_calc_method,prayer_location_mode,prayer_manual_city)
 on public.app_11941c8fec_notification_preferences to authenticated;
grant update(prayer_reminders,bill_reminders,habit_reminders,fasting_reminders,savings_reminders,general_activity,
 timezone,language,prayer_calc_method,prayer_location_mode,prayer_manual_city)
 on public.app_11941c8fec_notification_preferences to authenticated;
create policy amanah_preferences_read on public.app_11941c8fec_notification_preferences
 for select to authenticated using((select auth.uid())=user_id);
create policy amanah_preferences_insert on public.app_11941c8fec_notification_preferences
 for insert to authenticated with check((select auth.uid())=user_id);
create policy amanah_preferences_update on public.app_11941c8fec_notification_preferences
 for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
-- Push registration is device-bound and managed only by verified Edge actions.
-- No browser table access or copying registration secrets through backups.

do $$
declare target text; actor text; privilege text; col record;
 table_privileges text[] := array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
 allowed text[] := array[
 'user_id','prayer_reminders','bill_reminders','habit_reminders','fasting_reminders','savings_reminders','general_activity',
 'timezone','language','prayer_calc_method','prayer_location_mode','prayer_manual_city'];
begin
 -- MAINTAIN was added in PostgreSQL 17. Never pass an unsupported privilege
 -- name to has_table_privilege on older supported servers (e.g. PG15).
 if current_setting('server_version_num')::integer >= 170000 then
  table_privileges := array_append(table_privileges,'MAINTAIN');
 end if;
 foreach target in array array['app_11941c8fec_notification_preferences','app_11941c8fec_push_subscriptions'] loop
  foreach actor in array array['anon','authenticated','service_role'] loop
   -- Effective access includes PUBLIC, inherited memberships and grant options;
   -- inspecting relacl alone would miss a custom-role MAINTAIN grant.
   foreach privilege in array table_privileges loop
    if has_table_privilege(actor,'public.'||target,privilege||' WITH GRANT OPTION')
     or (has_table_privilege(actor,'public.'||target,privilege)
      and (actor<>'service_role' or privilege not in ('SELECT','INSERT','UPDATE','DELETE'))) then
     raise exception 'Inherited/excess table permission requires separate review: % / % / %',target,actor,privilege;
    end if;
   end loop;
   for col in select attnum,attname from pg_attribute where attrelid=to_regclass('public.'||target) and attnum>0 and not attisdropped loop
    foreach privilege in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
     if has_column_privilege(actor,'public.'||target,col.attname,privilege||' WITH GRANT OPTION')
      or (has_column_privilege(actor,'public.'||target,col.attname,privilege) and actor<>'service_role'
       and not (actor='authenticated' and target='app_11941c8fec_notification_preferences'
        and col.attname=any(allowed) and privilege in ('SELECT','INSERT','UPDATE')
        and not (col.attname='user_id' and privilege='UPDATE'))) then
      raise exception 'Inherited/excess column permission requires separate review: % / % / % / %',target,actor,col.attname,privilege;
     end if;
    end loop;
   end loop;
  end loop;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;

