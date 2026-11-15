BEGIN TRANSACTION READ ONLY;
SELECT payment_provider, status, tier, count(*) AS accounts,
 count(*) FILTER (WHERE paddle_subscription_id IS NOT NULL) AS paddle_ids,
 count(*) FILTER (WHERE lemonsqueezy_subscription_id IS NOT NULL) AS lemon_ids
FROM public.app_11941c8fec_subscriptions GROUP BY 1,2,3 ORDER BY 1,2,3;
SELECT count(*) FILTER (WHERE trial_used) AS used_trials,
 count(*) FILTER (WHERE trial_used AND trial_started_at <= now() AND trial_started_at > now()-interval '7 days') AS within_7_days,
 count(*) FILTER (WHERE trial_used AND trial_started_at <= now()-interval '7 days' AND trial_started_at > now()-interval '14 days') AS days_7_to_14,
 count(*) FILTER (WHERE trial_started_at > now()) AS future_starts,
 count(*) FILTER (WHERE trial_used AND trial_started_at IS NULL) AS missing_starts,
 count(*) FILTER (WHERE NOT trial_used AND trial_started_at IS NOT NULL) AS inconsistent_flags,
 count(*) FILTER (WHERE tier IN ('balanced','family') AND status IN ('active','past_due') AND lemonsqueezy_subscription_id IS NULL AND paddle_subscription_id IS NULL) AS paid_without_provider_id
FROM public.app_11941c8fec_subscriptions;
ROLLBACK;
