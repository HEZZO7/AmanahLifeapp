import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.log(JSON.stringify({ requestId, method: req.method, url: req.url }));

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
      const storeId = Deno.env.get("APP_11941c8fec_LEMONSQUEEZY_STORE_ID");

      if (!lsApiKey || !storeId) {
        return new Response(
          JSON.stringify({ error: "Lemon Squeezy not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find customer by email
      const customerSearchUrl = `https://api.lemonsqueezy.com/v1/customers?filter[store_id]=${storeId}&filter[email]=${encodeURIComponent(user.email || "")}`;
      const customerResponse = await fetch(customerSearchUrl, {
        method: "GET",
        headers: {
          "Accept": "application/vnd.api+json",
          "Authorization": `Bearer ${lsApiKey}`,
        },
      });

      if (!customerResponse.ok) {
        console.error(JSON.stringify({ requestId, action: "customer_search_error", status: customerResponse.status }));
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "Unable to find subscription" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const customerData = await customerResponse.json();
      const customers = customerData.data;

      if (!customers || customers.length === 0) {
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "No active subscription found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get customer portal URL from the first matching customer
      const customer = customers[0];
      const portalUrl = customer.attributes?.urls?.customer_portal;

      if (!portalUrl) {
        return new Response(
          JSON.stringify({ error: "no_subscription", message: "Customer portal not available" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(JSON.stringify({ requestId, action: "manage_portal", customerId: customer.id }));

      return new Response(
        JSON.stringify({ url: portalUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For checkout action, require tier and billing
    if (!body.tier || !body.billing) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tier, billing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tier, billing, successUrl, cancelUrl } = body;

    console.log(JSON.stringify({ requestId, userId: user.id, tier, billing }));

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
            custom: {
              user_id: user.id,
              app_id: "11941c8fec",
              tier,
              billing,
            },
          },
          product_options: {
            redirect_url: successUrl || undefined,
          },
          checkout_options: {
            embed: false,
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