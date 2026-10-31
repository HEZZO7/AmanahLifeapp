export interface FamilySubscription {
  tier?: string;
  status?: string;
  current_period_end?: string | null;
  trial_started_at?: string | null;
  paid_access_until?: string | null;
  entitlement_revoked_at?: string | null;
  lemonsqueezy_subscription_id?: string | null;
}

// Inputs must come from a trusted database read, never the request body.
// Zero additional dunning grace: retry dates alone do not establish paid access.
export function hasFamilyEntitlement(
  subscription: FamilySubscription | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!subscription || !Number.isFinite(nowMs) || subscription.entitlement_revoked_at) return false;
  const trialStart = Date.parse(subscription.trial_started_at ?? '');
  if (Number.isFinite(trialStart) && trialStart <= nowMs &&
      nowMs < trialStart + 7 * 24 * 60 * 60 * 1000) return true;
  if (subscription.tier !== 'family' || !subscription.lemonsqueezy_subscription_id) return false;
  const paidEnd = Date.parse(subscription.paid_access_until ?? '');
  if (!Number.isFinite(paidEnd) || nowMs >= paidEnd) return false;
  if (subscription.status === 'active' || subscription.status === 'past_due') return true;
  if (subscription.status === 'canceled') {
    if (!subscription.current_period_end) return true;
    const cancellationEnd = Date.parse(subscription.current_period_end);
    return Number.isFinite(cancellationEnd) && nowMs < cancellationEnd;
  }
  return false;
}
