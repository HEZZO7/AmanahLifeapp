// Currency conversion utilities for subscription pricing
// Base prices are in USD

export const BASE_PRICES = {
  monthly: { balanced: 6.99, family: 12.99 },
  yearly: { balanced: 4.99, family: 9.99 },
};

// Fallback exchange rates (hardcoded): how many units of currency = 1 USD
export const FALLBACK_RATES: Record<string, number> = {
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

// Backward-compatible alias
export const EXCHANGE_RATES = FALLBACK_RATES;

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

// --- Live exchange rate fetching ---

const EXCHANGE_RATE_ENDPOINT =
  'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_exchange_rates';

// Module-level client-side cache
let cachedRates: Record<string, number> | null = null;
let cacheTimestamp = 0;
let cachedSource: string = 'fallback';
let cachedUpdatedAt: string = '';

const CLIENT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ExchangeRateResult {
  rates: Record<string, number>;
  source: 'cache' | 'live' | 'fallback';
  updated_at: string;
}

/**
 * Fetch live exchange rates from the edge function.
 * Returns cached rates if less than 1 hour old (client-side).
 * Falls back to FALLBACK_RATES on failure.
 */
export async function fetchExchangeRates(): Promise<ExchangeRateResult> {
  const now = Date.now();

  // Return client-side cache if fresh
  if (cachedRates && now - cacheTimestamp < CLIENT_CACHE_TTL_MS) {
    return { rates: cachedRates, source: cachedSource as 'cache' | 'live' | 'fallback', updated_at: cachedUpdatedAt };
  }

  try {
    const response = await fetch(EXCHANGE_RATE_ENDPOINT, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.rates && typeof data.rates === 'object') {
      cachedRates = data.rates;
      cacheTimestamp = now;
      cachedSource = data.source || 'live';
      cachedUpdatedAt = data.updated_at || new Date().toISOString();
      return { rates: cachedRates, source: cachedSource as 'cache' | 'live' | 'fallback', updated_at: cachedUpdatedAt };
    }

    throw new Error('Invalid response format');
  } catch {
    // On failure, use fallback rates
    cachedRates = FALLBACK_RATES;
    cacheTimestamp = now;
    cachedSource = 'fallback';
    cachedUpdatedAt = '';
    return { rates: FALLBACK_RATES, source: 'fallback', updated_at: '' };
  }
}

/**
 * Convert a USD price to the target currency.
 * Rounds to 2 decimal places for most currencies, 0 for high-rate currencies.
 * Optionally accepts live rates; defaults to FALLBACK_RATES.
 */
export function convertPrice(
  priceUSD: number,
  targetCurrency: string,
  rates?: Record<string, number>
): number {
  const rateMap = rates ?? FALLBACK_RATES;
  const rate = rateMap[targetCurrency] ?? 1;
  const converted = priceUSD * rate;
  if (WHOLE_NUMBER_CURRENCIES.has(targetCurrency)) {
    return Math.round(converted);
  }
  return Math.round(converted * 100) / 100;
}

/**
 * Format a USD price into the target currency with its symbol.
 * e.g. formatPrice(6.99, 'SAR') => '﷼ 26.21'
 * Optionally accepts live rates; defaults to FALLBACK_RATES.
 */
export function formatPrice(
  priceUSD: number,
  targetCurrency: string,
  rates?: Record<string, number>
): string {
  const converted = convertPrice(priceUSD, targetCurrency, rates);
  const symbol = CURRENCY_SYMBOLS[targetCurrency] ?? targetCurrency;

  if (WHOLE_NUMBER_CURRENCIES.has(targetCurrency)) {
    return `${symbol} ${converted.toLocaleString()}`;
  }
  return `${symbol} ${converted.toFixed(2)}`;
}

/**
 * Async version: fetches live rates then formats the price.
 */
export async function formatPriceLive(
  priceUSD: number,
  targetCurrency: string
): Promise<string> {
  const { rates } = await fetchExchangeRates();
  return formatPrice(priceUSD, targetCurrency, rates);
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
      if (parsed.currency && FALLBACK_RATES[parsed.currency] !== undefined) {
        return parsed.currency;
      }
    }
  } catch {
    // ignore parse errors
  }
  return 'USD';
}