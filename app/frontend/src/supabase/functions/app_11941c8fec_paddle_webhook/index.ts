import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  // Paddle signature format: ts=timestamp;h1=hash
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(";")) {
    const [key, value] = part.split("=");
    if (key && value) {
      parts[key.trim()] = value.trim();
    }
  }

  const ts = parts["ts"];
  const h1 = parts["h1"];

  if (!ts || !h1) {
    return false;
  }

  // Paddle signs: ts + ":" + rawBody
  const signedPayload = `${ts}:${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHex === h1;
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
    const webhookSecret = Deno.env.get("APP_11941c8fec_PADDLE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error(JSON.stringify({ requestId, error: "Webhook secret not configured" }));
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signatureHeader = req.headers.get("Paddle-Signature") || req.headers.get("paddle-signature") || "";
    const isValid = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);

    if (!isValid) {
      console.error(JSON.stringify({ requestId, error: "Invalid webhook signature" }));
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;
    console.log(JSON.stringify({ requestId, event: eventType }));

    const handledEvents = [
      "transaction.completed",
      "subscription.activated",
      "subscription.updated",
      "subscription.canceled",
    ];

    if (!handledEvents.includes(eventType)) {
      return new Response(
        JSON.stringify({ received: true, message: "Event not handled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract data from payload
    const eventData = payload.data || {};
    const customData = eventData.custom_data || {};
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

    // Extract Paddle customer and subscription IDs
    const paddleCustomerId = eventData.customer_id || "";
    const paddleSubscriptionId = eventData.subscription_id || eventData.id || "";

    // Map Paddle status to our status
    let status = "active";
    if (eventType === "subscription.canceled") {
      status = "canceled";
    } else if (eventData.status === "paused") {
      status = "paused";
    } else if (eventData.status === "past_due") {
      status = "past_due";
    } else if (eventType === "transaction.completed" && !eventData.subscription_id) {
      // One-time transaction, treat as active
      status = "active";
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
          payment_provider: "paddle",
          tier: tier || "balanced",
          billing_cycle: billing || "monthly",
          status,
          paddle_customer_id: paddleCustomerId,
          paddle_subscription_id: paddleSubscriptionId,
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