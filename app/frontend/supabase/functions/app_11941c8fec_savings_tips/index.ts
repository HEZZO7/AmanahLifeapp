import OpenAI from "npm:openai";

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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Savings tips request received`);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json",
  };

  let body: { challenges?: Array<{ id: string; title: string; targetAmount: number; savedAmount: number; daysRemaining: number; progress: number }>; language?: string };
  try {
    body = await req.json();
  } catch (e) {
    console.error(`[${requestId}] Failed to parse request body:`, e);
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { challenges = [], language = "en" } = body;
  const isAr = language === "ar";

  // Try AI generation
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (apiKey && challenges.length > 0) {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: "https://api.deepseek.com",
      });

      const challengesSummary = challenges.map(c =>
        `- ${c.title}: ${c.progress}% complete, ${c.savedAmount}/${c.targetAmount} saved, ${c.daysRemaining} days remaining`
      ).join("\n");

      const systemPrompt = isAr
        ? "أنت مستشار ادخار ذكي. قدم نصيحة ادخار يومية مخصصة بناءً على تحديات المستخدم النشطة. اجعل النصيحة قصيرة (2-3 جمل) وعملية ومحفزة. أجب بالعربية فقط."
        : "You are a smart savings advisor. Provide a personalized daily savings tip based on the user's active challenges. Keep it short (2-3 sentences), actionable, and motivating. Reply in English only.";

      const userPrompt = isAr
        ? `تحديات الادخار النشطة للمستخدم:\n${challengesSummary}\n\nقدم نصيحة ادخار يومية مخصصة بناءً على تقدمهم.`
        : `User's active savings challenges:\n${challengesSummary}\n\nProvide a personalized daily savings tip based on their progress.`;

      const completion = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      const tip = completion.choices[0]?.message?.content?.trim();
      if (tip) {
        console.log(`[${requestId}] AI tip generated successfully`);
        return new Response(
          JSON.stringify({ tip, generatedAt: new Date().toISOString() }),
          { headers: corsHeaders }
        );
      }
    } catch (e) {
      console.error(`[${requestId}] AI generation failed, using fallback:`, e);
    }
  }

  // Fallback tips
  const tips = isAr ? FALLBACK_TIPS_AR : FALLBACK_TIPS_EN;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const tip = tips[dayOfYear % tips.length];

  console.log(`[${requestId}] Returning fallback tip`);
  return new Response(
    JSON.stringify({ tip, generatedAt: new Date().toISOString() }),
    { headers: corsHeaders }
  );
});