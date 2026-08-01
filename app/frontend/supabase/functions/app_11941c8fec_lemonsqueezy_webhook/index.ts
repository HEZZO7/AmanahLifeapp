import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

// Server-to-server webhook — Lemon Squeezy calls this directly, a browser
// never does, so CORS headers are meaningless here and have been removed
// rather than left wildcarded.
const jsonHeaders = { "Content-Type": "application/json" };

// A failed DB write here used to be a silent 500 - Lemon Squeezy would
// retry a few times per its own policy then give up, and nothing else ever
// surfaced the failure (this exact class of bug is what let the
// status-check-constraint gap go undetected since this table was created -
// see the 2026-08-01 migration). Reuses the SMTP credentials
// app_11941c8fec_weekly_digest already has configured (SMTP_HOST/PORT/
// SECURE/USER/PASSWORD/FROM) - no new secret setup required. Best-effort:
// a failure here must never affect the webhook's own response to Lemon
// Squeezy, so every step is wrapped and swallows its own errors.
async function alertOnFailure(subject: string, details: Record<string, unknown>): Promise<void> {
  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpHost || !smtpUser || !smtpPassword) return; // nothing configured - console.error is still the fallback

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
      secure: Deno.env.get("SMTP_SECURE") !== "false",
      auth: { user: smtpUser, pass: smtpPassword },
    });

    await transporter.sendMail({
      from: Deno.env.get("SMTP_FROM") || smtpUser,
      to: "support@amanahlife.com",
      subject: `[AmanahLife webhook alert] ${subject}`,
      text: JSON.stringify(details, null, 2),
    });
  } catch (alertError) {
    // Never let the alert path itself break or mask the original error.
    console.error(JSON.stringify({ error: "alertOnFailure itself failed", details: alertError instanceof Error ? alertError.message : String(alertError) }));
  }
}

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

    // subscription_refunded is deliberately absent: Lemon Squeezy has no such
    // subscription-lifecycle event (refunds are order-level - order_refunded -
    // a different object entirely, not a subscription row), so there is
    // nothing here to fabricate a handler for.
    const handledEvents = [
      "subscription_created",
      "subscription_updated",
      "subscription_cancelled",
      "subscription_expired",
      "subscription_resumed",
      "subscription_paused",
      "subscription_unpaused",
      "subscription_payment_failed",
    ];
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

    // Map Lemon Squeezy status to our status. Event-name checks come first
    // since they're unambiguous about intent; subscriptionData.status is the
    // fallback for events (created/updated) where the event itself doesn't
    // say what changed.
    let status = "active";
    if (eventName === "subscription_cancelled") {
      status = "canceled";
    } else if (eventName === "subscription_expired") {
      status = "expired";
    } else if (eventName === "subscription_paused") {
      status = "paused";
    } else if (eventName === "subscription_unpaused" || eventName === "subscription_resumed") {
      status = "active";
    } else if (eventName === "subscription_payment_failed") {
      // Matches ENTITLING_STATUSES ('active' + 'past_due') above and on the
      // web client - a failed renewal attempt doesn't cut off access
      // mid-retry, it only starts the dunning window Lemon Squeezy itself
      // tracks via this same "past_due" status on the subscription object.
      status = "past_due";
    } else if (subscriptionData.status === "paused") {
      status = "paused";
    } else if (subscriptionData.status === "past_due") {
      status = "past_due";
    } else if (subscriptionData.status === "expired") {
      status = "expired";
    }

    // current_period_end already exists on this table (populated for Stripe
    // by app_11941c8fec_stripe_webhook) but was never populated for Lemon
    // Squeezy, so the client's planned "renewal date" display would have
    // silently shown nothing for LS subscribers. Lemon Squeezy's subscription
    // object gives `ends_at` (set only once cancelled/expired - the date
    // access actually ends) and `renews_at` (the next charge date while
    // active/past_due; also present, misleadingly, on a cancelled sub as the
    // date it WOULD have renewed, which is why ends_at is checked first).
    // Verified against Lemon Squeezy's own example webhook payload before
    // writing this, not assumed from memory.
    const currentPeriodEnd = subscriptionData.ends_at || subscriptionData.renews_at || null;

    // current_period_start is deliberately left unset here. Lemon Squeezy's
    // subscription object has no equivalent field (only created_at, which is
    // when the subscription itself started, not the current billing period) -
    // writing something invented into a real column would be exactly the
    // fabricated-data problem fixed elsewhere in this app. Stripe subscribers
    // keep it populated via the Stripe webhook; LS subscribers simply have it
    // null, same as trial_started_at is null for a non-trialing account.
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
          current_period_end: currentPeriodEnd,
          lemonsqueezy_customer_id: lsCustomerId,
          lemonsqueezy_subscription_id: lsSubscriptionId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error(JSON.stringify({ requestId, error: "Upsert failed", details: upsertError.message }));
      // Awaited so the alert reliably sends before the Deno isolate can be
      // torn down after the response returns - alertOnFailure swallows its
      // own errors internally, so this can never throw past this point.
      await alertOnFailure("Subscription DB write failed", {
        requestId,
        eventName,
        userId,
        lemonsqueezyCustomerId: lsCustomerId,
        lemonsqueezySubscriptionId: lsSubscriptionId,
        attemptedStatus: status,
        attemptedTier: plan.tier,
        dbError: upsertError.message,
      });
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
