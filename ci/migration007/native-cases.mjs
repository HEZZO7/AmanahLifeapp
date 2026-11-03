// This is a PostgreSQL authorization supplement, not hosted GoTrue/Edge evidence.
// The fixture comes verbatim from the unchanged nineteen-case PGlite profile.
export const A = '10000000-0000-4000-8000-000000000031';
export const B = '10000000-0000-4000-8000-000000000032';
export const prefs = 'app_11941c8fec_notification_preferences';
export const push = 'app_11941c8fec_push_subscriptions';
export function fixtureFromProfile(profile) {
  const match = /const fixture = `([\s\S]*?)`;/u.exec(profile);
  if (!match) throw Error('Fixture literal missing');
  const values = { A, B, prefs, push };
  return match[1].replace(/\$\{([^}]+)\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw Error('Unexpected fixture interpolation');
    return values[key];
  });
}
const check = sql => `select public.fixture007_assert((${sql}));`;
const deny = sql => `select public.fixture007_denied($query$${sql}$query$);`;
const actor = role => `reset role; set request.jwt.claim.sub='${A}'; set role ${role};`;
export const helpers = `
create function public.fixture007_assert(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'fixture assertion failed'; end if; end$$;
create function public.fixture007_denied(command text) returns void language plpgsql as $$
begin
 begin execute command; exception when insufficient_privilege then return; end;
 raise exception 'expected SQLSTATE42501';
end$$;`;
export const cases = [
  { id: 'baseline', beforeOnly: true, sql: actor('anon') + check(`select count(*)=2 from public.${prefs}`) + check(`select count(*)=2 from public.${push}`) + actor('postgres') + check(`select count(*)=8 from pg_policy`) + check(`select bool_and(has_table_privilege(r,t,p)) from unnest(array['anon','authenticated']) r cross join unnest(array['public.${prefs}','public.${push}']) t cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p`) },
  { id: 'anon-denied', sql: actor('anon') + [prefs,push].flatMap(t => [`select user_id from public.${t}`, `insert into public.${t}(user_id) values('${A}')`, `update public.${t} set user_id=user_id`, `delete from public.${t}`]).map(deny).join('\n') },
  { id: 'user-isolation', sql: actor('authenticated') + check(`select count(user_id)=1 from public.${prefs}`) + check(`select count(user_id)=0 from public.${prefs} where user_id='${B}'`) + `update public.${prefs} set language='ar' where user_id='${A}'; update public.${prefs} set language='ar' where user_id='${B}';` + actor('postgres') + check(`select language='ar' from public.${prefs} where user_id='${A}'`) + check(`select language='en' from public.${prefs} where user_id='${B}'`) },
  { id: 'identity-and-push-secrets', sql: actor('authenticated') + ['user_id','updated_at','last_suhoor_sent_date','last_iftar_sent_date'].map(c => deny(`update public.${prefs} set ${c}=${c} where user_id='${A}'`)).join('\n') + [`select * from public.${prefs}`,`delete from public.${prefs}`,`select endpoint,p256dh,auth_key from public.${push}`,`insert into public.${push}(user_id,endpoint,p256dh,auth_key) values('${A}','synthetic','synthetic','synthetic')`,`update public.${push} set endpoint=endpoint`,`delete from public.${push}`].map(deny).join('\n') },
  { id: 'own-insert-foreign-denied', sql: actor('postgres') + `delete from public.${prefs} where user_id='${A}';` + actor('authenticated') + `insert into public.${prefs}(user_id,language) values('${A}','ar');` + deny(`insert into public.${prefs}(user_id,language) values('${B}','ar')`) + check(`select count(user_id)=1 from public.${prefs}`) },
  { id: 'all-effective-acls', sql: check(`select bool_and(not has_table_privilege(r,t,p)) from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['public.${prefs}','public.${push}']) t cross join unnest(array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p`) + check(`select bool_and(not has_table_privilege(r,t,p||' WITH GRANT OPTION')) from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['public.${prefs}','public.${push}']) t cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p`) + check(`select bool_and(not has_column_privilege(r,c.oid,a.attname,p||' WITH GRANT OPTION')) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid cross join unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p where n.nspname='public' and c.relname in ('${prefs}','${push}') and a.attnum>0 and not a.attisdropped`) },
  { id: 'truncate-trigger-reference-maintain', setup: `create schema fixture007 authorization anon; create function public.fixture007_trigger() returns trigger language plpgsql as $$begin return new; end$$;`, sql: actor('anon') + deny(`truncate public.${push}`) + deny(`create trigger fixture007_custom after insert on public.${prefs} for each row execute function public.fixture007_trigger()`) + deny(`create table fixture007.reference_probe(user_id uuid references public.${prefs}(user_id))`) + check(`select not has_table_privilege(current_user,'public.${prefs}','MAINTAIN')`) },
  { id: 'service-registration-scheduler', sql: actor('service_role') + `insert into public.${push}(user_id,endpoint,p256dh,auth_key) values('${A}','https://fixture.invalid/shared','synthetic','synthetic'),('${B}','https://fixture.invalid/shared','synthetic','synthetic') on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh; delete from public.${push} where user_id='${A}'; update public.${prefs} set last_suhoor_sent_date='2026-02-01' where user_id='${A}';` + check(`select count(*)=2 from public.${push} where user_id='${B}'`) + check(`select last_suhoor_sent_date='2026-02-01'::date from public.${prefs} where user_id='${A}'`) },
  { id: 'idempotence-preservation', repeat: true, sql: check(`select count(*)=2 from public.${prefs}`) + check(`select count(*)=2 from public.${push}`) + check(`select bool_and(confdeltype='a') from pg_constraint where contype='f' and conrelid in ('public.${prefs}'::regclass,'public.${push}'::regclass)`) },
  { id: 'direct-column-acl-removal', setup: `grant select(p256dh,auth_key) on public.${push} to anon with grant option; grant update(user_id) on public.${prefs} to authenticated with grant option;`, sql: actor('anon') + deny(`select p256dh,auth_key from public.${push}`) + actor('authenticated') + deny(`update public.${prefs} set user_id=user_id`) + actor('postgres') + check(`select not has_column_privilege('anon','public.${push}','p256dh','SELECT WITH GRANT OPTION')`) + check(`select not has_column_privilege('authenticated','public.${prefs}','user_id','UPDATE WITH GRANT OPTION')`) },
  ...[
    ['inherited-select',`grant select on public.${prefs} to fixture_carrier`],
    ['inherited-identity-update',`grant update(user_id) on public.${prefs} to fixture_carrier`],
    ['inherited-column-grant-option',`grant select(language) on public.${prefs} to fixture_carrier with grant option`],
    ['inherited-maintain',`grant maintain on public.${prefs} to fixture_carrier`],
    ['predefined-maintain-membership','grant pg_maintain to authenticated'],
  ].map(([id,grant]) => ({ id, failure: true, setup: 'create role fixture_carrier nologin; grant fixture_carrier to authenticated; ' + grant + ';' })),
];
