import { createClient } from "npm:@supabase/supabase-js@2";

// Server-to-server webhook — Lemon Squeezy calls this directly, a browser
// never does, so CORS headers are meaningless here and have been removed
// rather than left wildcarded.
const jsonHeaders = { "Content-Type": "application/json" };

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

  // Constant-time comparison. The previous `computedHex === signature`
  // short-circuits at the first mismatched character, leaking timing
  // information an attacker could exploit to forge a valid signature one
  // byte at a time. Always walk the full string and XOR every character.
  if (computedHex.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// Maps a Lemon Squeezy variant_id (what was actually paid for) to the tier
// and billing cycle we grant. Values come from env vars set to the real
// variant IDs configured in Lemon Squeezy — never trust tier/billing from
// the webhook payload's custom_data, since that's client-supplied at
// checkout time and simply echoed back by Lemon Squeezy unverified.
function buildVariantMap(): Record<string, { tier: string; billing: string }> {
  const map: Record<string, { tier: string; billing: string }> = {};
  const entries: [string, string, string][] = [
    ["APP_11941c8fec_LEMONSQUEEZY_BALANCED_MONTHLY_VARIANT_ID", "balanced", "monthly"],
    ["APP_11941c8fec_LEMONSQUEEZY_BALANCED_YEARLY_VARIANT_ID", "balanced", "yearly"],
    ["APP_11941c8fec_LEMONSQUEEZY_FAMILY_MONTHLY_VARIANT_ID", "family", "monthly"],
    ["APP_11941c8fec_LEMONSQUEEZY_FAMILY_YEARLY_VARIANT_ID", "family", "yearly"],
  ];
  for (const [envKey, tier, billing] of entries) {
    const variantId = Deno.env.get(envKey);
    if (variantId) map[variantId] = { tier, billing };
  }
  return map;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.log(JSON.stringify({ requestId, method: req.method, url: req.url }));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
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
        { status: 500, headers: jsonHeaders }
      );
    }

    const signature = req.headers.get("X-Signature") || req.headers.get("x-signature") || "";
    const isValid = await verifySignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error(JSON.stringify({ requestId, error: "Invalid webhook signature" }));
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;
    console.log(JSON.stringify({ requestId, event: eventName }));

    const handledEvents = ["subscription_created", "subscription_updated", "subscription_cancelled", "subscription_expired"];
    if (!handledEvents.includes(eventName)) {
      return new Response(
        JSON.stringify({ received: true, message: "Event not handled" }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // Extract data from payload
    const customData = payload.meta?.custom_data || {};
    const userId = customData.user_id;
    const appId = customData.app_id;

    if (!userId) {
      console.error(JSON.stringify({ requestId, error: "No user_id in custom_data" }));
      return new Response(
        JSON.stringify({ error: "Missing user_id" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (appId !== "11941c8fec") {
      console.error(JSON.stringify({ requestId, error: "App ID mismatch", appId }));
      return new Response(
        JSON.stringify({ error: "App ID mismatch" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const subscriptionData = payload.data?.attributes || {};
    const lsCustomerId = String(subscriptionData.customer_id || "");
    const lsSubscriptionId = String(payload.data?.id || "");

    // Derive tier + billing cycle from the variant that was actually paid
    // for, never from custom_data — a forged custom_data.tier would
    // previously have been trusted outright and upserted as-is.
    const variantId = String(subscriptionData.variant_id || "");
    const plan = buildVariantMap()[variantId];
    if (!plan) {
      console.error(JSON.stringify({ requestId, error: "Unknown variant_id, refusing to guess a tier", variantId }));
      return new Response(
        JSON.stringify({ error: "Unknown variant" }),
        { status: 400, headers: jsonHeaders }
      );
    }

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
          tier: plan.tier,
          billing_cycle: plan.billing,
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
        { status: 500, headers: jsonHeaders }
      );
    }

    console.log(JSON.stringify({ requestId, action: "subscription_upserted", userId, status, tier: plan.tier }));

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    console.error(JSON.stringify({ requestId, error: error.message, stack: error.stack }));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
