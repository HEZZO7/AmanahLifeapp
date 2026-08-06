import { createClient } from "npm:@supabase/supabase-js@2";

// NOTE: this Edge Function is web-only for now (see Phase J.3 in PROJECT.md
// for why RN doesn't get a copy in this pass) - same auth/CORS convention as
// app_11941c8fec_ai_life_coach and app_11941c8fec_receipt_scan.

// Phase J (Phase-D decision, 2026-08): AI Search previously returned a
// hardcoded static array of 5 sample results, identical for every query and
// every user - it never read the query text meaningfully and never touched
// any real data. This endpoint replaces that with a real call to Claude,
// grounded in the user's own tasks/goals/finance/adhkar/Quran data.
//
// Design note: the originally-approved plan assumed this function would
// query "RLS-scoped tasks/goals/transactions" from Postgres. Checking the
// live schema during implementation found no server-side tables for any of
// that - tasks/goals/transactions/adhkar/Quran progress are all
// localStorage-only on web. So this function receives the client's own
// local data directly in the request body (already inherently scoped to
// the requesting user, since it's their own device data) rather than
// querying a database - Claude still does the natural-language
// interpretation against real data, only the data's origin differs from
// the original plan.
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

const MAX_QUERY_LENGTH = 300;
// Rough cap on the serialized data blob so a pathological localStorage dump
// can't balloon the request/prompt - normal usage is well under this.
const MAX_DATA_JSON_LENGTH = 60_000;

interface SearchResult {
  type: string;
  title: string;
  description: string;
  icon: string;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

function isValidResults(data: unknown): data is { results: SearchResult[] } {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.results)) return false;
  return d.results.every(
    (r) =>
      r && typeof r === "object" &&
      typeof (r as Record<string, unknown>).type === "string" &&
      typeof (r as Record<string, unknown>).title === "string" &&
      typeof (r as Record<string, unknown>).description === "string" &&
      typeof (r as Record<string, unknown>).icon === "string"
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

  const { query, language, data } = body;
  if (typeof query !== "string" || !query.trim()) {
    return json({ error: "Missing query" }, 400, corsHeaders);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return json({ error: "Query too long" }, 400, corsHeaders);
  }
  const isAr = language === "ar";

  const dataJson = JSON.stringify(data ?? {});
  if (dataJson.length > MAX_DATA_JSON_LENGTH) {
    return json({ error: "Data payload too large" }, 400, corsHeaders);
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return json({ error: "Search not configured" }, 500, corsHeaders);
  }

  const systemPrompt = `You are a search assistant for AmanahLife, an Islamic life-companion app. You are given a user's own app data as JSON (their tasks, goals, finance transactions, today's adhkar progress, and Quran bookmarks/last-read position) and a natural-language search query. Find the items in the data that are actually relevant to the query and return them as search results.

Respond with ONLY a single JSON object, no markdown fences, no explanation, no extra text, in exactly this shape:
{"results": [{"type": string, "title": string, "description": string, "icon": string}]}

Rules:
- "type" must be one of: "${isAr ? "المهام" : "Tasks"}", "${isAr ? "الأهداف" : "Goals"}", "${isAr ? "المالية" : "Finance"}", "${isAr ? "القرآن" : "Quran"}", "${isAr ? "الأذكار" : "Adhkar"}" - matching the category the source item belongs to.
- "icon" must match its type: tasks="✅", goals="🎯", finance="💰", quran="📖", adhkar="📿".
- "title" and "description" must be built from the ACTUAL data given to you - never invent a task, goal, transaction, or progress number that isn't present in the data.
- Only include items genuinely relevant to the query. If nothing in the data matches, return {"results": []} - do not force irrelevant items in just to have something to show.
- Write titles/descriptions in ${isAr ? "Arabic" : "English"}.
- Return at most 15 results, most relevant first.

The user's data:
${dataJson}`;

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
        max_tokens: 1536,
        system: systemPrompt,
        messages: [{ role: "user", content: query.slice(0, MAX_QUERY_LENGTH) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error(JSON.stringify({ requestId, userId: user.id, action: "anthropic_error", status: anthropicRes.status, error: errText }));
      return json({ error: "Search is temporarily unavailable" }, 502, corsHeaders);
    }

    const resData = await anthropicRes.json();
    const replyText = resData.content?.[0]?.text?.trim();
    if (!replyText) {
      return json({ error: "Empty response from search" }, 502, corsHeaders);
    }

    let parsed: unknown;
    try {
      parsed = extractJson(replyText);
    } catch {
      console.error(JSON.stringify({ requestId, userId: user.id, action: "parse_error", raw: replyText.slice(0, 500) }));
      return json({ error: "Search returned an unreadable response" }, 502, corsHeaders);
    }

    if (!isValidResults(parsed)) {
      console.error(JSON.stringify({ requestId, userId: user.id, action: "invalid_shape", raw: replyText.slice(0, 500) }));
      return json({ error: "Search returned an unreadable response" }, 502, corsHeaders);
    }

    console.log(JSON.stringify({ requestId, userId: user.id, action: "search_completed", resultCount: parsed.results.length }));
    return json({ results: parsed.results.slice(0, 15) }, 200, corsHeaders);
  } catch (error) {
    console.error(JSON.stringify({ requestId, userId: user.id, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
});
