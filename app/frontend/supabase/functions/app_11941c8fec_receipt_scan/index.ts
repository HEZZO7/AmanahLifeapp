import { createClient } from "npm:@supabase/supabase-js@2";

// NOTE: this Edge Function is intentionally duplicated verbatim in both
// repos - amanahlife-rn and this web repo (AmanahLifeapp), at
// app/frontend/supabase/functions/app_11941c8fec_receipt_scan/ - same
// convention as app_11941c8fec_ai_life_coach. One project-level function
// serving both clients; keep both copies identical if you change this.

// Phase I (Phase-D decision, 2026-08): Receipt Scanner previously ignored
// the uploaded photo entirely and returned a random pick from 4 hardcoded
// mock receipts after a fake 2-second "scanning" delay - it never called
// any AI or OCR service despite the UI saying "AI analyzing receipt". This
// endpoint replaces that with a real call to Claude's vision API, grounded
// in the actual uploaded image.
const ALLOWED_ORIGINS = new Set([
  "https://app.amanahlife.com",
  "https://amanahlife.com",
]);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowOrigin = !origin ? "*" : (ALLOWED_ORIGINS.has(origin) ? origin : "https://app.amanahlife.com");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Claude's vision endpoint only accepts these four source media types.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Base64 is ~4/3 the size of the raw bytes; 8MB of base64 is roughly a 6MB photo -
// generous for a phone camera receipt shot while keeping the request body sane.
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

interface ParsedReceipt {
  storeName: string;
  date: string | null;
  items: Array<{ name: string; amount: number }>;
  total: number;
}

function extractJson(text: string): unknown {
  // Claude is asked to return raw JSON, but strip a markdown fence defensively
  // in case it wraps the answer anyway.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

function isValidReceipt(data: unknown): data is ParsedReceipt {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.storeName !== "string" || !d.storeName.trim()) return false;
  if (!Array.isArray(d.items)) return false;
  if (typeof d.total !== "number" || !Number.isFinite(d.total)) return false;
  return d.items.every(
    (item) =>
      item && typeof item === "object" &&
      typeof (item as Record<string, unknown>).name === "string" &&
      typeof (item as Record<string, unknown>).amount === "number" &&
      Number.isFinite((item as Record<string, unknown>).amount as number)
  );
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const corsHeaders = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return json({ error: "Invalid token" }, 401, corsHeaders);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return json({ error: "Missing request body" }, 400, corsHeaders);
  }

  const { imageBase64, mimeType, language } = body;
  if (typeof imageBase64 !== "string" || !imageBase64) {
    return json({ error: "Missing image" }, 400, corsHeaders);
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return json({ error: "Image too large" }, 400, corsHeaders);
  }
  if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return json({ error: "Unsupported image format - use JPEG, PNG, WEBP, or GIF" }, 400, corsHeaders);
  }
  const isAr = language === "ar";

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return json({ error: "Receipt scanner not configured" }, 500, corsHeaders);
  }

  const systemPrompt = `You extract structured data from a photo of a shopping/purchase receipt. Respond with ONLY a single JSON object, no markdown fences, no explanation, no extra text.

If the image is a legible receipt, respond with exactly this shape:
{"isReceipt": true, "storeName": string, "date": string | null (ISO 8601 "YYYY-MM-DD" if a date is visible on the receipt, else null), "items": [{"name": string, "amount": number}], "total": number}

- "items" should list each distinct purchased line item with its price, in the currency shown on the receipt (numbers only, no currency symbols).
- "total" is the receipt's final total amount (numbers only).
- Use the language the receipt itself is printed in for storeName and item names - do not translate.
- If the image is unreadable, blurry, or not a receipt at all, respond with exactly: {"isReceipt": false}`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
              { type: "text", text: isAr ? "استخرج بيانات هذا الإيصال." : "Extract this receipt's data." },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error(JSON.stringify({ requestId, userId: user.id, action: "anthropic_error", status: anthropicRes.status, error: errText }));
      return json({ error: "Receipt scanner is temporarily unavailable" }, 502, corsHeaders);
    }

    const data = await anthropicRes.json();
    const replyText = data.content?.[0]?.text?.trim();
    if (!replyText) {
      return json({ error: "Empty response from receipt scanner" }, 502, corsHeaders);
    }

    let parsed: unknown;
    try {
      parsed = extractJson(replyText);
    } catch {
      console.error(JSON.stringify({ requestId, userId: user.id, action: "parse_error", raw: replyText.slice(0, 500) }));
      return json({ error: "unreadable" }, 200, corsHeaders);
    }

    const parsedObj = parsed as Record<string, unknown>;
    if (parsedObj?.isReceipt === false) {
      console.log(JSON.stringify({ requestId, userId: user.id, action: "not_a_receipt" }));
      return json({ error: "not_a_receipt" }, 200, corsHeaders);
    }

    if (!isValidReceipt(parsedObj)) {
      console.error(JSON.stringify({ requestId, userId: user.id, action: "invalid_shape", raw: replyText.slice(0, 500) }));
      return json({ error: "unreadable" }, 200, corsHeaders);
    }

    console.log(JSON.stringify({ requestId, userId: user.id, action: "receipt_parsed", itemCount: parsedObj.items.length }));
    return json({
      storeName: parsedObj.storeName,
      date: parsedObj.date ?? null,
      items: parsedObj.items,
      total: parsedObj.total,
    }, 200, corsHeaders);
  } catch (error) {
    console.error(JSON.stringify({ requestId, userId: user.id, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
});
