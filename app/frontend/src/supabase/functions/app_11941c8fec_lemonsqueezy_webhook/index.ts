import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === signature;
}

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
    const rawBody = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get("APP_11941c8fec_LEMONSQUEEZY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error(JSON.stringify({ requestId, error: "Webhook secret not configured" }));
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signature = req.headers.get("X-Signature") || req.headers.get("x-signature") || "";
    const isValid = await verifySignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error(JSON.stringify({ requestId, error: "Invalid webhook signature" }));
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;
    console.log(JSON.stringify({ requestId, event: eventName }));

    const handledEvents = ["subscription_created", "subscription_updated", "subscription_cancelled", "subscription_expired"];
    if (!handledEvents.includes(eventName)) {
      return new Response(
        JSON.stringify({ received: true, message: "Event not handled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract data from payload
    const customData = payload.meta?.custom_data || {};
    const userId = customData.user_id;
    const appId = customData.app_id;
    const tier = customData.tier;
    const billing = customData.billing;

    if (!userId) {
      console.error(JSON.stringify({ requestId, error: "No user_id in custom_data" }));
      return new Response(
        JSON.stringify({ error: "Missing user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (appId !== "11941c8fec") {
      console.error(JSON.stringify({ requestId, error: "App ID mismatch", appId }));
      return new Response(
        JSON.stringify({ error: "App ID mismatch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscriptionData = payload.data?.attributes || {};
    const lsCustomerId = String(subscriptionData.customer_id || "");
    const lsSubscriptionId = String(payload.data?.id || "");

    // Map Lemon Squeezy status to our status
    let status = "active";
    if (eventName === "subscription_cancelled") {
      status = "canceled";
    } else if (eventName === "subscription_expired") {
      status = "expired";
    } else if (subscriptionData.status === "paused") {
      status = "paused";
    } else if (subscriptionData.status === "past_due") {
      status = "past_due";
    } else if (subscriptionData.status === "expired") {
      status = "expired";
    }

    // Upsert subscription record
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: upsertError } = await supabase
      .from("app_11941c8fec_subscriptions")
      .upsert(
        {
          user_id: userId,
          payment_provider: "lemonsqueezy",
          tier: tier || "balanced",
          billing_cycle: billing || "monthly",
          status,
          lemonsqueezy_customer_id: lsCustomerId,
          lemonsqueezy_subscription_id: lsSubscriptionId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error(JSON.stringify({ requestId, error: "Upsert failed", details: upsertError.message }));
      return new Response(
        JSON.stringify({ error: "Database update failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(JSON.stringify({ requestId, action: "subscription_upserted", userId, status, tier }));

    return new Response(
      JSON.stringify({ received: true }),
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