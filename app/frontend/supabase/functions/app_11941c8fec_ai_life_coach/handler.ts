import { createAiHandler, type AiDependencies } from "../_shared/aiAccess.ts";

// Shared project endpoint: coordinate this protected handler and shared files with the RN repository before any approved deployment. This PR changes only AmanahLifeapp.

// Phase 4 (critical-audit-2026-07): the "AI Life Coach" screen previously
// picked a random string out of a fixed, hardcoded array per category -
// there was no AI involved at all, despite the name and UI implying a real,
// personalized assistant. This endpoint replaces that with an actual call to
// Anthropic's API, grounded in the user's own goals.
//
// Called from both the RN app (no Origin header - not a browser, so the
// allowlist below doesn't apply) and potentially the web app later.
function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 6;

export function createHandler(deps: AiDependencies) {
  return createAiHandler(async (req, { corsHeaders, log }) => {
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

  const anthropicKey = deps.key();
  if (!anthropicKey) {
    return json({ error: "Service temporarily unavailable" }, 503, corsHeaders);
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
    const anthropicRes = await deps.fetch("https://api.anthropic.com/v1/messages", {
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
      log("provider_error", anthropicRes.status);
      return json({ error: "AI coach is temporarily unavailable" }, 502, corsHeaders);
    }

    const data = await anthropicRes.json();
    const reply = data.content?.[0]?.text?.trim();
    if (!reply) {
      return json({ error: "Empty response from AI coach" }, 502, corsHeaders);
    }

    log("coach_reply");
    return json({ reply }, 200, corsHeaders);
  } catch {
    log("provider_exception");
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
  }, deps);
}

