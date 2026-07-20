import { useState, useEffect } from 'react';

const GRAMS_PER_TROY_OUNCE = 31.1034768;
const CACHE_KEY = 'amanah_metal_prices_cache';

// Sanity bounds in USD/gram — reject a clearly broken API response (zero,
// negative, or wildly implausible) rather than silently using it to
// calculate a real zakat obligation. Wide enough to tolerate genuine
// multi-year market moves without needing a code change.
const GOLD_MIN_PER_GRAM = 20;
const GOLD_MAX_PER_GRAM = 500;
const SILVER_MIN_PER_GRAM = 0.2;
const SILVER_MAX_PER_GRAM = 10;

// Used only if no live fetch has ever succeeded on this device and there's
// no cache to fall back to either. This WILL drift stale over time — that's
// exactly why isLive/asOf exist, so the UI can disclose when a figure is a
// fallback rather than presenting it as fact.
const FALLBACK_GOLD_PER_GRAM = 125;
const FALLBACK_SILVER_PER_GRAM = 1.6;

export interface MetalPrices {
  goldPricePerGram: number;
  silverPricePerGram: number;
  isLive: boolean;
  asOf: Date | null;
  loading: boolean;
}

interface CachedPrices {
  goldPricePerGram: number;
  silverPricePerGram: number;
  asOf: string;
}

function loadCache(): CachedPrices | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(data: CachedPrices) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore — cache is a nice-to-have, not required for correctness
  }
}

/**
 * Live gold/silver spot price in USD/gram, for Zakat Nisab and holdings
 * valuation. Source: gold-api.com (free, no key, CORS-open). Falls back to
 * the last known-good cached price (still flagged non-live) or a hardcoded
 * fallback if nothing has ever been cached — never fabricates a "live"
 * price from bad or missing data.
 */
export function useMetalPrices(): MetalPrices {
  const cache = loadCache();
  const [state, setState] = useState<MetalPrices>({
    goldPricePerGram: cache?.goldPricePerGram ?? FALLBACK_GOLD_PER_GRAM,
    silverPricePerGram: cache?.silverPricePerGram ?? FALLBACK_SILVER_PER_GRAM,
    isLive: false,
    asOf: cache ? new Date(cache.asOf) : null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [goldRes, silverRes] = await Promise.all([
          fetch('https://api.gold-api.com/price/XAU'),
          fetch('https://api.gold-api.com/price/XAG'),
        ]);
        if (!goldRes.ok || !silverRes.ok) throw new Error('Metal price fetch failed');
        const [goldData, silverData] = await Promise.all([goldRes.json(), silverRes.json()]);

        const goldPerGram = Number(goldData.price) / GRAMS_PER_TROY_OUNCE;
        const silverPerGram = Number(silverData.price) / GRAMS_PER_TROY_OUNCE;

        const goldValid = Number.isFinite(goldPerGram) && goldPerGram >= GOLD_MIN_PER_GRAM && goldPerGram <= GOLD_MAX_PER_GRAM;
        const silverValid = Number.isFinite(silverPerGram) && silverPerGram >= SILVER_MIN_PER_GRAM && silverPerGram <= SILVER_MAX_PER_GRAM;
        if (!goldValid || !silverValid) {
          throw new Error('Metal price out of sane bounds, refusing to use it');
        }

        if (cancelled) return;
        const asOf = new Date();
        saveCache({ goldPricePerGram: goldPerGram, silverPricePerGram: silverPerGram, asOf: asOf.toISOString() });
        setState({ goldPricePerGram: goldPerGram, silverPricePerGram: silverPerGram, isLive: true, asOf, loading: false });
      } catch {
        if (cancelled) return;
        // Live fetch failed or returned implausible data — keep whatever
        // was already in state (cache or hardcoded fallback), just stop
        // loading and make sure isLive stays false.
        setState((prev) => ({ ...prev, isLive: false, loading: false }));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
