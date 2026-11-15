-- REVIEW ONLY: after compatible clients and approved cutover.
BEGIN;
REVOKE ALL ON TABLE public.app_11941c8fec_subscriptions FROM PUBLIC, anon, authenticated;
-- Table revocation does not remove independently granted column privileges.
DO $lockdown$
DECLARE cols text;
BEGIN
 SELECT string_agg(quote_ident(attname), ', ') INTO cols
 FROM pg_attribute
 WHERE attrelid = 'public.app_11941c8fec_subscriptions'::regclass
 AND attnum > 0 AND NOT attisdropped;
 EXECUTE 'REVOKE ALL PRIVILEGES (' || cols || ') ON TABLE public.app_11941c8fec_subscriptions FROM PUBLIC, anon, authenticated';
END $lockdown$;
GRANT SELECT ON TABLE public.app_11941c8fec_subscriptions TO authenticated;
DROP POLICY IF EXISTS allow_insert_own_subscription ON public.app_11941c8fec_subscriptions;
DROP POLICY IF EXISTS allow_read_own_subscription ON public.app_11941c8fec_subscriptions;
CREATE POLICY allow_read_own_subscription ON public.app_11941c8fec_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Service role access is retained.
COMMIT;
