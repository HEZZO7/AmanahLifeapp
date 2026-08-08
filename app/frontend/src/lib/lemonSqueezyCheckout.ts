/**
 * Single source of truth for Lemon Squeezy checkout construction - shared by
 * Subscription.tsx's real "Upgrade" button and PromoBanner.tsx's discount
 * CTA, so a discount code applies through the app's one real checkout flow
 * instead of a parallel implementation. Previously PromoBanner posted to a
 * separate Stripe edge function (app_11941c8fec_stripe_coupon_checkout) that
 * had nothing to do with this app's actual Lemon Squeezy subscriptions -
 * moved here as the app consolidates onto Lemon Squeezy only.
 */
export const LEMONSQUEEZY_CHECKOUT_ENDPOINT =
  'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_lemonsqueezy_checkout';

// One buy-link per (tier, billing) variant - confirmed by live-checking each
// of the 4 URLs in a browser: each shows a single fixed price with no
// interval selector, so all 4 are genuinely required. The `?enabled=<variant_id>`
// query param restricts the buy-link to that one variant, matching what
// Lemon Squeezy itself generated when these were created.
export const BUY_LINKS: Record<'balanced' | 'family', Record<'monthly' | 'yearly', string>> = {
  balanced: {
    monthly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/648ef373-e4f9-4a53-8837-3c42306acf48?enabled=1959952',
    yearly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/134fbb9c-1a72-4cfa-a3cb-8d90d733bcf1?enabled=1959859',
  },
  family: {
    monthly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/0d44ea94-b1db-450e-bf8b-47a39fd304f0?enabled=1959970',
    yearly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/008ffbea-25d1-47dc-a1ec-8acc17e56c96?enabled=1959954',
  },
};

/**
 * Builds a Lemon Squeezy checkout URL for the given plan, pre-filled with
 * the signed-in user's email and carrying their user_id (+ this app's fixed
 * app_id) in custom_data so the webhook can attribute the resulting
 * subscription to the right account. app_id is NOT optional here - the
 * webhook rejects any payload where custom_data.app_id !== "11941c8fec" as
 * an "App ID mismatch", so a buy-link missing this would silently never
 * grant access after a real payment.
 *
 * discountCode is optional and maps to Lemon Squeezy's documented
 * `checkout[discount_code]` hosted-checkout query param - the code must
 * already exist as a real Discount in the Lemon Squeezy dashboard; this
 * param only references it by code, it cannot create one.
 */
export function buildCheckoutUrl(
  tier: 'balanced' | 'family',
  billing: 'monthly' | 'yearly',
  user: { id: string; email?: string | null },
  discountCode?: string
): string {
  if (!user?.id) {
    throw new Error('buildCheckoutUrl requires an authenticated user');
  }
  const base = BUY_LINKS[tier][billing];
  const params = new URLSearchParams();
  if (user.email) params.set('checkout[email]', user.email);
  params.set('checkout[custom][user_id]', user.id);
  params.set('checkout[custom][app_id]', '11941c8fec');
  if (discountCode) params.set('checkout[discount_code]', discountCode);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}
