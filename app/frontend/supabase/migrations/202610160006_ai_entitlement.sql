-- DRAFT ONLY. Requires migrations 001..005; no production execution is authorized.
-- This adds a read-only, identity-bound capability check; it grants no entitlement.
begin;
do $$ begin
 if to_regprocedure('public.app_11941c8fec_payment_entitlement(uuid)') is null then
   raise exception 'Trusted payment lifecycle migration 005 is required';
 end if;
end $$;

create function public.app_11941c8fec_ai_entitled()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.uid() is not null and x->>'entitlement_revoked_at' is null and (
   ((x->>'trial_used')::boolean is true
     and (x->>'trial_started_at')::timestamptz<=statement_timestamp()
     and (x->>'trial_started_at')::timestamptz>statement_timestamp()-interval '7 days')
   or (x->>'tier' in ('balanced','family')
     and (x->>'has_private_binding')::boolean is true
     and (x->>'paid_access_from')::timestamptz<=statement_timestamp()
     and (x->>'paid_access_until')::timestamptz>statement_timestamp())
 ),false)
 from (select public.app_11941c8fec_payment_entitlement(auth.uid()) x) q
$$;
alter function public.app_11941c8fec_ai_entitled() owner to postgres;
revoke all on function public.app_11941c8fec_ai_entitled() from public,anon,authenticated,service_role;
grant execute on function public.app_11941c8fec_ai_entitled() to authenticated;
-- paid entitlement is already filtered by private proof/status/environment in 005.
-- past_due/unpaid alone never grants time; an independent still-valid paid proof may.
notify pgrst,'reload schema';
commit;
