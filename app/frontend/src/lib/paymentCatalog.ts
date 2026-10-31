import catalog from '../../public/payment-catalog.json';

// Indicative existing display totals, NOT a provider price/configuration claim.
export { catalog };
export type PaidTier = 'balanced' | 'family';
export type Billing = 'monthly' | 'yearly';
export function displayedMonthly(tier: 'free' | PaidTier, billing: Billing): number {
  return catalog.prices[tier][billing] / 100 / (billing === 'yearly' ? 12 : 1);
}
export function displayedTotal(tier: 'free' | PaidTier, billing: Billing): number {
  return catalog.prices[tier][billing] / 100;
}
