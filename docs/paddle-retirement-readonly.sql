-- READ ONLY. Optional evidence for the owner; do not run migrations or change settings.
-- Supabase (phone): SQL Editor > New query > paste this entire SELECT > Run.
-- Export the single result as CSV. It contains counts only; no customer IDs/email/secrets.
-- A zero count is not evidence that deployed Paddle functions or webhooks are disabled.
-- to_jsonb tolerates absent optional legacy columns; missing columns appear as no ID.
select
  coalesce(nullif(j->>'payment_provider',''),'unspecified') as recorded_provider,
  coalesce(nullif(j->>'status',''),'unspecified') as recorded_status,
  count(*) as subscription_rows,
  count(*) filter (where nullif(j->>'paddle_subscription_id','') is not null) as paddle_id_rows,
  count(*) filter (where nullif(j->>'lemonsqueezy_subscription_id','') is not null) as lemon_id_rows,
  count(*) filter (where nullif(j->>'paddle_subscription_id','') is not null
    and nullif(j->>'lemonsqueezy_subscription_id','') is not null) as mixed_provider_id_rows
from (select to_jsonb(s) as j from public.app_11941c8fec_subscriptions s) evidence
group by 1,2
order by 1,2;
