import { createClient } from "npm:@supabase/supabase-js@2";

// NOTE (Round 3, 2026-07): this Edge Function is intentionally duplicated
// verbatim in both repos - amanahlife-rn (the original) and this web repo
// (AmanahLifeapp, here) at app/frontend/supabase/functions/app_11941c8fec_ai_life_coach/.
// It's one project-level Supabase Edge Function serving both clients, not
// something owned by either platform, but each repo needs its own committed
// copy for contributors to actually find it. If you fix a bug or change
// behavior here, apply the same change to the other repo's copy too - they
// must stay identical. Don't rediscover "why are there two copies" from
// scratch; this is why.

// Phase 4 (critical-audit-2026-07): the "AI Life Coach" screen previously
// picked a random string out of a fixed, hardcoded array per category -
// there was no AI involved at all, despite the name and UI implying a real,
// personalized assistant. This endpoint replaces that with an actual call to
// Anthropic's API, grounded in the user's own goals.
//
// Called from both the RN app (no Origin header - not a browser, so the
// allowlist below doesn't apply) and potentially the web app later.
const ALLOWED_ORIGINS = new Set([
  "https://app.amanahlife.com",
  "https://amanahlife.com",
]);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  // No Origin header means this isn't a browser cross-origin request (native
  // app, server-to-server) - CORS restrictions are meaningless there, so
  // there's nothing to scope. When an Origin IS present, only allow it back
  // if it's one of our own first-party web origins.
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

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 6;

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

  const { message, language, goals, history } = body;
  if (typeof message !== "string" || !message.trim()) {
    return json({ error: "Missing message" }, 400, corsHeaders);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return json({ error: "Message too long" }, 400, corsHeaders);
  }
  const isAr = language === "ar";

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return json({ error: "AI coach not configured" }, 500, corsHeaders);
  }

  const goalsSummary = Array.isArray(goals) && goals.length > 0
    ? goals.slice(0, 5).map((g: { title?: string; progress?: number }) =>
        `- ${g.title || "Untitled"} (${typeof g.progress === "number" ? g.progress : 0}% complete)`
      ).join("\n")
    : (isAr ? "لم يحدد المستخدم أهدافاً بعد." : "The user hasn't set any goals yet.");

  const systemPrompt = isAr
    ? `أنت "المدرب الذكي" في تطبيق أمانة، رفيق حياة إسلامي. قدّم نصيحة عملية وموجزة (3-5 جمل) حول النمو الروحي أو الصحة أو الحكمة المالية أو العلاقات، مستندة إلى القرآن والسنة عند الاقتضاء، بأسلوب دافئ وغير وعظي. لا تُصدر فتاوى قطعية في مسائل خلافية؛ أحل المستخدم إلى عالم موثوق عند الحاجة إلى ذلك. أهداف المستخدم الحالية:\n${goalsSummary}`
    : `You are the "AI Life Coach" inside AmanahLife, an Islamic life-companion app. Give practical, concise advice (3-5 sentences) on spiritual growth, health, financial wisdom, or relationships, grounded in Quran and Sunnah where relevant, in a warm, non-preachy tone. Do not issue definitive rulings (fatwas) on disputed matters - point the user to a qualified scholar instead. The user's current goals:\n${goalsSummary}`;

  const conversationHistory = Array.isArray(history)
    ? history
        .slice(-MAX_HISTORY_MESSAGES)
        .filter((m: { type?: string; text?: string }) => m && typeof m.text === "string" && (m.type === "user" || m.type === "coach"))
        .map((m: { type: string; text: string }) => ({
          role: m.type === "user" ? "user" : "assistant",
          content: m.text.slice(0, MAX_MESSAGE_LENGTH),
        }))
    : [];

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
        max_tokens: 400,
        system: systemPrompt,
        messages: [...conversationHistory, { role: "user", content: message.slice(0, MAX_MESSAGE_LENGTH) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error(JSON.stringify({ requestId, userId: user.id, action: "anthropic_error", status: anthropicRes.status, error: errText }));
      return json({ error: "AI coach is temporarily unavailable" }, 502, corsHeaders);
    }

    const data = await anthropicRes.json();
    const reply = data.content?.[0]?.text?.trim();
    if (!reply) {
      return json({ error: "Empty response from AI coach" }, 502, corsHeaders);
    }

    console.log(JSON.stringify({ requestId, userId: user.id, action: "coach_reply", messageLength: message.length }));
    return json({ reply }, 200, corsHeaders);
  } catch (error) {
    console.error(JSON.stringify({ requestId, userId: user.id, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
});
