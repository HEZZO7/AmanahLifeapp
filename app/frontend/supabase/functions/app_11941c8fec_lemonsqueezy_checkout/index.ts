import { createClient } from "npm:@supabase/supabase-js@2";

// This endpoint is called directly from the browser (unlike the webhook),
// so it does need real CORS handling — but scoped to our own first-party
// origins, not a wildcard, and only the headers this function actually uses.
const ALLOWED_ORIGINS = new Set([
  "https://app.amanahlife.com",
  "https://amanahlife.com",
]);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://app.amanahlife.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Same allowlist governs where a post-checkout redirect is allowed to send
// the user — client-supplied successUrl was previously passed straight
// through to Lemon Squeezy unvalidated, which is an open redirect a phishing
// page could exploit (Lemon Squeezy would happily bounce a paying user to
// any attacker-controlled URL after checkout completes).
function isAllowedRedirect(url: unknown): url is string {
  if (typeof url !== "string" || !url) return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

const VALID_TIERS = new Set(["balanced", "family"]);
const VALID_BILLING = new Set(["monthly", "yearly"]);

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.log(JSON.stringify({ requestId, method: req.method, url: req.url }));
  const corsHeaders = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ error: "Missing request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle "manage" action — return Lemon Squeezy customer portal URL
    if (body.action === "manage") {
      console.log(JSON.stringify({ requestId, userId: user.id, action: "manage" }));

      const lsApiKey = Deno.env.get("LEMONSQUEEZY_API_KEY");

      if (!lsApiKey) {
        console.error(JSON.stringify({ requestId, action: "manage_error", reason: "not_configured" }));
        return new Response(
          JSON.stringify({ error: "Lemon Squeezy not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up the customer by the lemonsqueezy_customer_id our own
      // webhook already stored for this user, NOT by searching Lemon
      // Squeezy for a customer whose email matches the signed-in account.
      // The email search this used to do (filter[email]=user.email)
      // silently failed for any subscriber whose Lemon Squeezy checkout
      // email didn't exactly match their app account's email - which
      // nothing guaranteed, since the checkout payload below never told
      // Lemon Squeezy what email to use, leaving their hosted checkout
      // page's email field open for the customer to fill in freely. An ID
      // lookup keyed off data we already own and trust removes that
      // dependency entirely - it's also how the old Stripe portal button
      // worked (stripe_customer_id, not an email search) before this
      // "manage" action replaced it.
      const { data: subRow, error: subError } = await supabase
        .from("app_11941c8fec_subscriptions")
        .select("lemonsqueezy_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (subError) {
        console.error(JSON.stringify({ requestId, action: "manage_error", reason: "subscription_lookup_failed", details: subError.message }));
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "Unable to find subscription" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const customerId = subRow?.lemonsqueezy_customer_id;
      if (!customerId) {
        console.log(JSON.stringify({ requestId, action: "manage_no_customer_id", userId: user.id }));
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "No active subscription found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const customerResponse = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}`, {
        method: "GET",
        headers: {
          "Accept": "application/vnd.api+json",
          "Authorization": `Bearer ${lsApiKey}`,
        },
      });

      if (!customerResponse.ok) {
        console.error(JSON.stringify({ requestId, action: "manage_error", reason: "customer_fetch_failed", status: customerResponse.status, customerId }));
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "Unable to find subscription" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const customerData = await customerResponse.json();
      const portalUrl = customerData.data?.attributes?.urls?.customer_portal;

      if (!portalUrl) {
        console.error(JSON.stringify({ requestId, action: "manage_error", reason: "no_portal_url_on_customer", customerId }));
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "Customer portal not available" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(JSON.stringify({ requestId, action: "manage_portal", customerId }));

      return new Response(
        JSON.stringify({ url: portalUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For checkout action, require tier and billing to be real, known
    // string values before they're interpolated into an env var lookup key
    // below — the previous `!body.tier || !body.billing` check let any
    // truthy value through (including non-strings), so a malformed body
    // threw inside .toUpperCase() and surfaced as an opaque 500 instead of
    // a 400.
    const { tier, billing, successUrl, discountCode } = body;
    if (!VALID_TIERS.has(tier) || !VALID_BILLING.has(billing)) {
      return new Response(
        JSON.stringify({ error: "Invalid tier or billing cycle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lemon Squeezy discount codes are uppercase letters/numbers, 3-256
    // chars (per their own validation) - reject anything else here rather
    // than forwarding a malformed value to their API for an opaque error.
    const DISCOUNT_CODE_RE = /^[A-Z0-9]{3,256}$/;
    if (discountCode !== undefined && (typeof discountCode !== "string" || !DISCOUNT_CODE_RE.test(discountCode))) {
      return new Response(
        JSON.stringify({ error: "Invalid discount code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(JSON.stringify({ requestId, userId: user.id, tier, billing }));

    // Whether Lemon Squeezy's own native trial should be suppressed on this
    // checkout. This function is only reached (per the client) for a user
    // whose app-level trial is already used - Lemon Squeezy's hosted
    // buy-links have no way to suppress their own trial offer (skip_trial is
    // only settable via this API, confirmed against Lemon Squeezy's own
    // docs), which is the whole reason this API-based path still exists
    // instead of retiring it in favour of buy-links entirely.
    //
    // Derived here from the database, NOT trusted from the request body -
    // same discipline the webhook already applies to tier/billing (derive
    // from variant_id, never trust client-supplied custom_data). A client
    // could reach this endpoint directly and claim anything; it cannot make
    // this query return something other than the truth.
    const { data: existingSub } = await supabase
      .from("app_11941c8fec_subscriptions")
      .select("trial_used")
      .eq("user_id", user.id)
      .maybeSingle();
    const skipTrial = !!existingSub?.trial_used;
    console.log(JSON.stringify({ requestId, userId: user.id, skipTrial }));

    // Map tier + billing to variant ID from environment variables
    const variantIdKey = `APP_11941c8fec_LEMONSQUEEZY_${tier.toUpperCase()}_${billing.toUpperCase()}_VARIANT_ID`;
    const variantId = Deno.env.get(variantIdKey);

    if (!variantId) {
      return new Response(
        JSON.stringify({ error: `Variant not configured for ${tier} ${billing}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Lemon Squeezy API key and store ID
    const lsApiKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    const storeId = Deno.env.get("APP_11941c8fec_LEMONSQUEEZY_STORE_ID");

    if (!lsApiKey || !storeId) {
      return new Response(
        JSON.stringify({ error: "Lemon Squeezy not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Lemon Squeezy checkout
    const checkoutPayload = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            // Prefills (and Lemon Squeezy's hosted checkout lets the buyer
            // edit) the checkout's email - without this, nothing ties the
            // Lemon Squeezy customer's email to the signed-in app account,
            // which is exactly what broke the email-based "manage" lookup
            // this used to have. The "manage" action no longer depends on
            // this (it now looks up by the stored customer_id), but setting
            // it keeps Lemon Squeezy's own records/receipts consistent with
            // the app account by default.
            email: user.email || undefined,
            custom: {
              user_id: user.id,
              app_id: "11941c8fec",
              tier,
              billing,
            },
            ...(discountCode ? { discount_code: discountCode } : {}),
          },
          product_options: {
            redirect_url: isAllowedRedirect(successUrl) ? successUrl : undefined,
          },
          checkout_options: {
            embed: false,
            skip_trial: skipTrial,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: variantId,
            },
          },
        },
      },
    };

    const lsResponse = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${lsApiKey}`,
      },
      body: JSON.stringify(checkoutPayload),
    });

    if (!lsResponse.ok) {
      const errorText = await lsResponse.text();
      console.error(JSON.stringify({ requestId, action: "ls_checkout_error", status: lsResponse.status, error: errorText }));
      return new Response(
        JSON.stringify({ error: "Failed to create checkout" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lsData = await lsResponse.json();
    const checkoutUrl = lsData.data?.attributes?.url;

    console.log(JSON.stringify({ requestId, action: "checkout_created", checkoutId: lsData.data?.id }));

    return new Response(
      JSON.stringify({ url: checkoutUrl, checkoutId: lsData.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(JSON.stringify({ requestId, error: error.message, stack: error.stack }));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});