// Currency conversion utilities for subscription pricing
// Base prices are in USD

export const BASE_PRICES = {
  monthly: { balanced: 6.99, family: 12.99 },
  yearly: { balanced: 4.99, family: 9.99 },
};

// Approximate exchange rates: how many units of currency = 1 USD
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  SAR: 3.75,
  AED: 3.67,
  KWD: 0.31,
  BHD: 0.38,
  OMR: 0.385,
  QAR: 3.64,
  EGP: 49,
  JOD: 0.71,
  IQD: 1310,
  LBP: 89500,
  SYP: 13000,
  TRY: 38,
  MYR: 4.7,
  IDR: 16500,
  PKR: 278,
  BDT: 121,
  INR: 84,
  CAD: 1.38,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.88,
  AUD: 1.55,
  NZD: 1.7,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  SAR: '﷼',
  AED: 'د.إ',
  KWD: 'د.ك',
  BHD: '.د.ب',
  OMR: 'ر.ع',
  QAR: 'ر.ق',
  EGP: 'ج.م',
  JOD: 'د.أ',
  IQD: 'ع.د',
  LBP: 'ل.ل',
  SYP: 'ل.س',
  TRY: '₺',
  MYR: 'RM',
  IDR: 'Rp',
  PKR: '₨',
  BDT: '৳',
  INR: '₹',
  CAD: 'C$',
  EUR: '€',
  GBP: '£',
  CHF: 'Fr',
  AUD: 'A$',
  NZD: 'NZ$',
};

// Currencies with large rates where decimals don't make sense
const WHOLE_NUMBER_CURRENCIES = new Set(['IQD', 'LBP', 'SYP', 'IDR', 'PKR', 'BDT']);

/**
 * Convert a USD price to the target currency.
 * Rounds to 2 decimal places for most currencies, 0 for high-rate currencies.
 */
export function convertPrice(priceUSD: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES[targetCurrency] ?? 1;
  const converted = priceUSD * rate;
  if (WHOLE_NUMBER_CURRENCIES.has(targetCurrency)) {
    return Math.round(converted);
  }
  return Math.round(converted * 100) / 100;
}

/**
 * Format a USD price into the target currency with its symbol.
 * e.g. formatPrice(6.99, 'SAR') => '﷼ 26.21'
 */
export function formatPrice(priceUSD: number, targetCurrency: string): string {
  const converted = convertPrice(priceUSD, targetCurrency);
  const symbol = CURRENCY_SYMBOLS[targetCurrency] ?? targetCurrency;

  if (WHOLE_NUMBER_CURRENCIES.has(targetCurrency)) {
    return `${symbol} ${converted.toLocaleString()}`;
  }
  return `${symbol} ${converted.toFixed(2)}`;
}

/**
 * Read the user's preferred currency from localStorage.
 * Defaults to 'USD' if not set.
 */
export function getUserCurrency(): string {
  try {
    const stored = localStorage.getItem('amanah-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.currency && EXCHANGE_RATES[parsed.currency] !== undefined) {
        return parsed.currency;
      }
    }
  } catch {
    // ignore parse errors
  }
  return 'USD';
}