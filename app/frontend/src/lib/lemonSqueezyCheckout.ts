// Authentication uses the same Supabase project as payments. No browser-built buy-links.
import { paymentEnvironment } from './paymentEnvironment';
const environment = paymentEnvironment({ mode: import.meta.env.VITE_AMANAHLIFE_PAYMENT_MODE,
  project: import.meta.env.VITE_SUPABASE_URL, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY });
export const LEMONSQUEEZY_CHECKOUT_ENDPOINT = environment?.endpoint ?? '';

export async function createAppCheckout(token: string, offer: string, discountCode?: string): Promise<{ url?: string; scheduled?: boolean; reviewRequired?: boolean }> {
  if (!LEMONSQUEEZY_CHECKOUT_ENDPOINT) throw new Error('Payments not configured');
  const response = await fetch(LEMONSQUEEZY_CHECKOUT_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ offer, ...(discountCode ? { discountCode } : {}) }),
  });
  const result = await response.json();
  if (!response.ok || (typeof result.url !== 'string' && result.scheduled !== true)) throw new Error('Checkout unavailable');
  return result;
}
