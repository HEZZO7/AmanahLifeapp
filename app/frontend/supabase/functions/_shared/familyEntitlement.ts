export interface FamilySubscription {
  tier?: string;
  status?: string;
  current_period_end?: string | null;
  trial_started_at?: string | null;
}

// Server callers must fetch this row for the authenticated sender or verified
// family's owner. Never accept subscription fields from the request body.
export function hasFamilyEntitlement(
  subscription: FamilySubscription | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!subscription || !Number.isFinite(nowMs)) return false;
  const trialStart = Date.parse(subscription.trial_started_at ?? '');
  const trialEnd = trialStart + 7 * 24 * 60 * 60 * 1000;
  if (Number.isFinite(trialStart) && trialStart <= nowMs && nowMs < trialEnd) return true;
  if (subscription.tier !== 'family') return false;
  // Preserve the app's current past_due retry access. A new grace duration
  // is not introduced here; its policy remains a separate launch blocker.
  if (subscription.status === 'active' || subscription.status === 'past_due') return true;
  if (subscription.status === 'canceled') {
    const paidEnd = Date.parse(subscription.current_period_end ?? '');
    return Number.isFinite(paidEnd) && nowMs < paidEnd;
  }
  return false;
}
