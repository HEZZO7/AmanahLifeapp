-- REVIEW ONLY: do not apply to production before coordinated client rollout.
BEGIN;
ALTER TABLE public.app_11941c8fec_subscriptions ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;
-- Conservative legacy preservation: no platform provenance exists. Only valid past starts.
UPDATE public.app_11941c8fec_subscriptions SET trial_expires_at = trial_started_at + interval '14 days' WHERE trial_used AND trial_started_at <= statement_timestamp() AND trial_expires_at IS NULL;
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
    (user_id, trial_started_at, trial_used, trial_expires_at)
  VALUES (uid, statement_timestamp(), true, statement_timestamp() + interval '7 days')
  ON CONFLICT (user_id) DO UPDATE
    SET trial_started_at = statement_timestamp(), trial_used = true,
        trial_expires_at = statement_timestamp() + interval '7 days',
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
