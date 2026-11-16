const KEY = 'amanahlife-subscription-intent';

export function subscriptionIntent(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get('next') !== 'subscription') return null;
  const plan = params.get('plan');
  const billing = params.get('billing');
  if (plan !== 'balanced' && plan !== 'family') return '/subscription';
  return '/subscription?' + new URLSearchParams({
    plan, billing: billing === 'yearly' ? 'yearly' : 'monthly',
  }).toString();
}

export function rememberSubscriptionIntent(search: string) {
  const intent = subscriptionIntent(search);
  if (intent) {
    try { sessionStorage.setItem(KEY, intent); } catch { /* storage unavailable */ }
  }
}

export function consumeSubscriptionIntent(): string {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (value === '/subscription') return value;
    if (value?.startsWith('/subscription?')) {
      return subscriptionIntent('?next=subscription&' + value.split('?')[1]) ?? '/';
    }
  } catch { /* storage unavailable */ }
  return '/';
}
