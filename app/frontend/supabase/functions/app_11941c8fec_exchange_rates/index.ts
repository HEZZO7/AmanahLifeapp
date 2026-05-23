import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPPORTED_CURRENCIES = [
  'USD', 'SAR', 'AED', 'KWD', 'BHD', 'OMR', 'QAR', 'EGP', 'JOD',
  'IQD', 'LBP', 'SYP', 'TRY', 'MYR', 'IDR', 'PKR', 'BDT', 'INR',
  'CAD', 'EUR', 'GBP', 'CHF', 'AUD', 'NZD'
];

// Fallback rates in case external API fails
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, SAR: 3.75, AED: 3.67, KWD: 0.31, BHD: 0.38, OMR: 0.385,
  QAR: 3.64, EGP: 49, JOD: 0.71, IQD: 1310, LBP: 89500, SYP: 13000,
  TRY: 38, MYR: 4.7, IDR: 16500, PKR: 278, BDT: 121, INR: 84,
  CAD: 1.38, EUR: 0.92, GBP: 0.79, CHF: 0.88, AUD: 1.55, NZD: 1.7,
};

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.log(JSON.stringify({ requestId, method: req.method, url: req.url }));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we have recent rates (less than 24 hours old)
    const { data: cachedRates } = await supabase
      .from('app_11941c8fec_exchange_rates')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (cachedRates) {
      const updatedAt = new Date(cachedRates.updated_at);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

      // If rates are less than 12 hours old, return cached
      if (hoursSinceUpdate < 12) {
        console.log(JSON.stringify({ requestId, action: 'returning_cached_rates', age_hours: hoursSinceUpdate }));
        return new Response(
          JSON.stringify({ rates: cachedRates.rates, updated_at: cachedRates.updated_at, source: 'cache' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch fresh rates from free API
    let freshRates: Record<string, number> = {};
    let fetchSuccess = false;

    try {
      // Primary: exchangerate-api.com (free, no key needed for USD base)
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result === 'success' && data.rates) {
          // Filter only supported currencies
          for (const currency of SUPPORTED_CURRENCIES) {
            if (data.rates[currency] !== undefined) {
              freshRates[currency] = data.rates[currency];
            }
          }
          fetchSuccess = Object.keys(freshRates).length >= 10;
          console.log(JSON.stringify({ requestId, action: 'fetched_fresh_rates', count: Object.keys(freshRates).length }));
        }
      }
    } catch (fetchError) {
      console.log(JSON.stringify({ requestId, action: 'primary_api_failed', error: String(fetchError) }));
    }

    // If primary API failed, try fallback API
    if (!fetchSuccess) {
      try {
        const response2 = await fetch('https://api.exchangerate.host/latest?base=USD', {
          signal: AbortSignal.timeout(8000),
        });
        if (response2.ok) {
          const data2 = await response2.json();
          if (data2.rates) {
            for (const currency of SUPPORTED_CURRENCIES) {
              if (data2.rates[currency] !== undefined) {
                freshRates[currency] = data2.rates[currency];
              }
            }
            fetchSuccess = Object.keys(freshRates).length >= 10;
            console.log(JSON.stringify({ requestId, action: 'fetched_from_fallback_api', count: Object.keys(freshRates).length }));
          }
        }
      } catch (fetchError2) {
        console.log(JSON.stringify({ requestId, action: 'fallback_api_failed', error: String(fetchError2) }));
      }
    }

    // If both APIs failed, use hardcoded fallback
    if (!fetchSuccess) {
      freshRates = { ...FALLBACK_RATES };
      console.log(JSON.stringify({ requestId, action: 'using_fallback_rates' }));
    }

    // Ensure USD is always 1
    freshRates['USD'] = 1;

    // Store the new rates in the database
    const { error: insertError } = await supabase
      .from('app_11941c8fec_exchange_rates')
      .insert({
        base_currency: 'USD',
        rates: freshRates,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.log(JSON.stringify({ requestId, action: 'insert_error', error: insertError }));
    }

    // Clean up old entries (keep only last 7)
    const { data: allRates } = await supabase
      .from('app_11941c8fec_exchange_rates')
      .select('id')
      .order('updated_at', { ascending: false });

    if (allRates && allRates.length > 7) {
      const idsToDelete = allRates.slice(7).map((r: { id: string }) => r.id);
      await supabase
        .from('app_11941c8fec_exchange_rates')
        .delete()
        .in('id', idsToDelete);
    }

    return new Response(
      JSON.stringify({ rates: freshRates, updated_at: new Date().toISOString(), source: fetchSuccess ? 'live' : 'fallback' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(JSON.stringify({ requestId, action: 'unhandled_error', error: String(error) }));
    // Return fallback rates even on error
    return new Response(
      JSON.stringify({ rates: FALLBACK_RATES, updated_at: new Date().toISOString(), source: 'fallback' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});