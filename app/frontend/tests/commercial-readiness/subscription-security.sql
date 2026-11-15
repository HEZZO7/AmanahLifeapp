\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.app_11941c8fec_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE NOT NULL,
 tier text NOT NULL DEFAULT 'free', status text NOT NULL DEFAULT 'active',
 trial_started_at timestamptz, trial_used boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_11941c8fec_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_insert_own_subscription ON public.app_11941c8fec_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY allow_read_own_subscription ON public.app_11941c8fec_subscriptions FOR SELECT USING (auth.uid()=user_id);
GRANT ALL ON public.app_11941c8fec_subscriptions TO anon, authenticated, service_role;
\ir ../../supabase/review-migrations/20261115_subscription_security.sql
INSERT INTO public.app_11941c8fec_subscriptions(user_id,tier) VALUES ('00000000-0000-0000-0000-000000000002','balanced');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$
BEGIN
 IF has_table_privilege(current_user,'public.app_11941c8fec_subscriptions','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'unexpected write privilege'; END IF;
 IF has_any_column_privilege(current_user,'public.app_11941c8fec_subscriptions','INSERT,UPDATE') THEN RAISE EXCEPTION 'unexpected column privilege'; END IF;
 IF public.amanahlife_start_trial() <> 'ok' THEN RAISE EXCEPTION 'first trial failed'; END IF;
 IF public.amanahlife_start_trial() <> 'trial_already_used' THEN RAISE EXCEPTION 'repeat trial accepted'; END IF;
 IF (SELECT count(*) FROM public.app_11941c8fec_subscriptions) <> 1 THEN RAISE EXCEPTION 'cross user read'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.app_11941c8fec_subscriptions WHERE tier='free' AND trial_used AND trial_started_at BETWEEN now()-interval '1 minute' AND now()) THEN RAISE EXCEPTION 'invalid trial state'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
 IF public.amanahlife_start_trial() <> 'ok' THEN RAISE EXCEPTION 'existing row trial failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.app_11941c8fec_subscriptions WHERE tier='balanced' AND trial_used) THEN RAISE EXCEPTION 'paid tier overwritten'; END IF;
END $$;
RESET ROLE;
SET ROLE service_role;
UPDATE public.app_11941c8fec_subscriptions SET tier='family' WHERE user_id='00000000-0000-0000-0000-000000000001';
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
 IF has_function_privilege(current_user,'public.amanahlife_start_trial()','EXECUTE') OR has_table_privilege(current_user,'public.app_11941c8fec_subscriptions','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'anonymous access'; END IF;
END $$;
RESET ROLE;
SELECT 'subscription security assertions passed' AS result;
