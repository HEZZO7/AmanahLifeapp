-- REVIEW ONLY: after compatible clients and approved cutover.
BEGIN;
REVOKE ALL ON TABLE public.app_11941c8fec_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.app_11941c8fec_subscriptions TO authenticated;
DROP POLICY IF EXISTS allow_insert_own_subscription ON public.app_11941c8fec_subscriptions;
-- Existing own-row SELECT policy and service_role access are retained.
COMMIT;
