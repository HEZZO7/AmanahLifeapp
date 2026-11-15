-- REVIEW ONLY: do not apply to production before coordinated client rollout.
BEGIN;
CREATE OR REPLACE FUNCTION public.amanahlife_start_trial()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  started timestamptz;
BEGIN
  IF uid IS NULL THEN RETURN 'not_signed_in'; END IF;
  INSERT INTO public.app_11941c8fec_subscriptions AS s
    (user_id, trial_started_at, trial_used)
  VALUES (uid, statement_timestamp(), true)
  ON CONFLICT (user_id) DO UPDATE
    SET trial_started_at = statement_timestamp(), trial_used = true,
        updated_at = statement_timestamp()
    WHERE s.trial_used = false AND s.trial_started_at IS NULL
  RETURNING trial_started_at INTO started;
  IF started IS NULL THEN RETURN 'trial_already_used'; END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.amanahlife_start_trial() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amanahlife_start_trial() TO authenticated;
COMMIT;
