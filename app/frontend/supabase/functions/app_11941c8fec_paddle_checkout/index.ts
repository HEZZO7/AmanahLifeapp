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
    if (!body || !body.tier || !body.billing) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tier, billing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tier, billing, successUrl, cancelUrl } = body;

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

    console.log(JSON.stringify({ requestId, userId: user.id, tier, billing }));

    // Map tier + billing to Paddle price ID from environment variables
    const priceIdKey = `APP_11941c8fec_PADDLE_${tier.toUpperCase()}_${billing.toUpperCase()}_PRICE_ID`;
    const priceId = Deno.env.get(priceIdKey);

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Price not configured for ${tier} ${billing}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Paddle API key
    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleApiKey) {
      return new Response(
        JSON.stringify({ error: "Paddle not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Paddle transaction (checkout)
    const transactionPayload = {
      items: [
        {
          price_id: priceId,
          quantity: 1,
        },
      ],
      custom_data: {
        user_id: user.id,
        app_id: "11941c8fec",
        tier,
        billing,
      },
      checkout: {
        url: successUrl || undefined,
      },
      customer_email: user.email,
    };

    const paddleResponse = await fetch("https://api.paddle.com/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${paddleApiKey}`,
      },
      body: JSON.stringify(transactionPayload),
    });

    if (!paddleResponse.ok) {
      const errorText = await paddleResponse.text();
      console.error(JSON.stringify({ requestId, action: "paddle_checkout_error", status: paddleResponse.status, error: errorText }));
      return new Response(
        JSON.stringify({ error: "Failed to create checkout" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paddleData = await paddleResponse.json();
    const checkoutUrl = paddleData.data?.checkout?.url || null;
    const transactionId = paddleData.data?.id;

    console.log(JSON.stringify({ requestId, action: "checkout_created", transactionId }));

    return new Response(
      JSON.stringify({ url: checkoutUrl, transactionId }),
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