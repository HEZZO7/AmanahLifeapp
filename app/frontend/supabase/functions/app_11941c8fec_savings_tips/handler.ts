import { createAiHandler, type AiDependencies } from "../_shared/aiAccess.ts";

// Switched from DeepSeek to Anthropic 2026-07-23 per Huzaifa's decision:
// one paid AI provider (Anthropic) for every AI-backed function in the
// project instead of two separate API keys to manage. Reuses the same
// ANTHROPIC_API_KEY secret already set for app_11941c8fec_ai_life_coach.
// The fallback tips below are unchanged - this function still degrades
// gracefully to a canned bilingual tip if the AI call fails, same as before.
const FALLBACK_TIPS_EN = [
  "Try the 24-hour rule: wait a full day before any non-essential purchase. You'll be surprised how many impulse buys you avoid!",
  "Set up automatic transfers to your savings account right after payday. What you don't see, you won't spend.",
  "Track every expense for one week. Awareness alone can reduce spending by 10-15% without feeling deprived.",
  "Challenge yourself to find one free alternative to a paid activity this week. Nature walks, library visits, and home cooking all count!",
  "Round up your progress! If you're at 73% of your goal, push to hit 75% this week for a satisfying milestone."
];

const FALLBACK_TIPS_AR = [
  "جرّب قاعدة 24 ساعة: انتظر يوماً كاملاً قبل أي شراء غير ضروري. ستندهش من عدد المشتريات الاندفاعية التي تتجنبها!",
  "أعدّ تحويلات تلقائية لحساب التوفير فور استلام الراتب. ما لا تراه، لن تنفقه.",
  "تتبع كل مصروف لمدة أسبوع. الوعي وحده يمكن أن يقلل الإنفاق بنسبة 10-15% دون الشعور بالحرمان.",
  "تحدَّ نفسك بإيجاد بديل مجاني لنشاط مدفوع هذا الأسبوع. المشي في الطبيعة وزيارة المكتبة والطبخ المنزلي كلها تُحتسب!",
  "قرّب تقدمك! إذا كنت عند 73% من هدفك، ادفع للوصول إلى 75% هذا الأسبوع لتحقيق إنجاز مُرضٍ."
];

// Scoped CORS instead of the previous wildcard "*" - same allowlist pattern
// as app_11941c8fec_ai_life_coach. No Origin header means a non-browser
// caller (the RN app), which isn't subject to browser CORS anyway.
function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface ChallengeInfo {
  id?: string;
  title?: string;
  targetAmount?: number;
  savedAmount?: number;
  daysRemaining?: number;
  progress?: number;
}

export function createHandler(deps: AiDependencies) {
  return createAiHandler(async (req, { corsHeaders, log }) => {
  let body: { challenges?: ChallengeInfo[]; language?: string };
  try {
    body = await req.json();
  } catch {
    log("invalid_body");
    return json({ error: "Invalid request body" }, 400, corsHeaders);
  }

  const { challenges = [], language = "en" } = body;
  const isAr = language === "ar";

  const fallbackTip = (): Response => {
    const tips = isAr ? FALLBACK_TIPS_AR : FALLBACK_TIPS_EN;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const tip = tips[dayOfYear % tips.length];
    log("fallback_tip");
    return json({ tip, generatedAt: new Date().toISOString() }, 200, corsHeaders);
  };

  const anthropicKey = deps.key();
  if (!anthropicKey || challenges.length === 0) {
    return fallbackTip();
  }

  try {
    const challengesSummary = challenges.map((c) =>
      `- ${c.title || "Untitled"}: ${c.progress ?? 0}% complete, ${c.savedAmount ?? 0}/${c.targetAmount ?? 0} saved, ${c.daysRemaining ?? "?"} days remaining`
    ).join("\n");

    const prompt = isAr
      ? `تحديات الادخار النشطة للمستخدم:\n${challengesSummary}\n\nقدم نصيحة ادخار يومية مخصصة بناءً على تقدمهم. اجعل النصيحة قصيرة (2-3 جمل) وعملية ومحفزة. أجب بالعربية فقط. أجب بنص عادي فقط بدون أي تنسيق Markdown (بدون #، بدون **، بدون قوائم)، وبدون عنوان أو تكرار عبارة "نصيحة الادخار اليومية" - ابدأ مباشرة بالنصيحة نفسها.`
      : `User's active savings challenges:\n${challengesSummary}\n\nProvide a personalized daily savings tip based on their progress. Keep it short (2-3 sentences), actionable, and motivating. Reply in English only. Reply in plain text only - no Markdown formatting (no #, no **, no lists), and no title or repeated "Daily Savings Tip" heading - start directly with the tip itself.`;

    const anthropicRes = await deps.fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
    log("provider_error", anthropicRes.status);
      return fallbackTip();
    }

    const data = await anthropicRes.json();
    const tip = data.content?.[0]?.text?.trim();
    if (!tip) {
    log("empty_response");
      return fallbackTip();
    }

    log("tip_completed");
    return json({ tip, generatedAt: new Date().toISOString() }, 200, corsHeaders);
  } catch {
    log("provider_exception");
    return fallbackTip();
  }
  }, deps);
}

