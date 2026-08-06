import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

// Family Dashboard invite/accept flow (2026-08, Phase-D decision follow-up).
// The families/family_members RLS policies only let the family OWNER insert
// new member rows (family_members_insert_if_owner) - by design, so a
// stranger can't add themselves to someone else's family by guessing a row
// shape. That means "a joining user adds themselves via a join code" has to
// happen server-side with the service role, which is what this function's
// "accept" action does. "send" emails the family's existing join_code
// (already a column on app_11941c8fec_families - a stopgap noted in that
// table's own comment, now wired to a real email instead of manual sharing)
// reusing the same SMTP setup as app_11941c8fec_weekly_digest.
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

function generateJoinCode(): string {
  // Short, human-typeable, avoids visually-ambiguous characters (0/O, 1/I/L).
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
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
  if (!body || typeof body.action !== "string") {
    return json({ error: "Missing action" }, 400, corsHeaders);
  }

  const FAMILIES = "app_11941c8fec_families";
  const MEMBERS = "app_11941c8fec_family_members";
  const isAr = body.language === "ar";

  if (body.action === "send") {
    const { email } = body;
    if (typeof email !== "string" || !email.includes("@")) {
      return json({ error: "Missing or invalid email" }, 400, corsHeaders);
    }

    const { data: sub } = await supabase
      .from("app_11941c8fec_subscriptions")
      .select("tier")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.tier !== "family") {
      return json({ error: "family_plan_required" }, 403, corsHeaders);
    }

    let { data: family } = await supabase
      .from(FAMILIES)
      .select("id, name, join_code")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!family) {
      const { data: created, error: createError } = await supabase
        .from(FAMILIES)
        .insert({ owner_user_id: user.id, join_code: generateJoinCode() })
        .select("id, name, join_code")
        .single();
      if (createError || !created) {
        console.error(JSON.stringify({ requestId, userId: user.id, action: "create_family_error", error: createError?.message }));
        return json({ error: "Could not create family" }, 500, corsHeaders);
      }
      family = created;

      // The owner is a member of their own family too - matching what the
      // pre-migration local screen always showed ("You" / "Admin").
      await supabase.from(MEMBERS).insert({
        family_id: family.id,
        user_id: user.id,
        display_name: user.email?.split("@")[0] || "Owner",
        member_role: "owner",
        age_group: "adult",
      });
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpSecure = Deno.env.get("SMTP_SECURE") !== "false";
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error(JSON.stringify({ requestId, userId: user.id, action: "smtp_not_configured" }));
      // The family/code still exists even if email delivery isn't configured -
      // return it so the UI can fall back to "share this code" manually.
      return json({ familyId: family.id, joinCode: family.join_code, emailSent: false }, 200, corsHeaders);
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPassword },
      });

      const subject = isAr ? "دعوة للانضمام إلى عائلتك على أمانة لايف" : "You're invited to join a family on AmanahLife";
      const html = `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0a2e1f;">${isAr ? "دعوة عائلية" : "Family Invite"}</h2>
          <p>${isAr ? "دعاك أحد أفراد العائلة للانضمام إلى لوحة العائلة على أمانة لايف." : "You've been invited to join a family on AmanahLife's Family Dashboard."}</p>
          <p>${isAr ? "افتح لوحة العائلة في التطبيق وأدخل الرمز التالي:" : "Open the Family Dashboard in the app and enter this code:"}</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; background: #f3f4f6; padding: 16px; text-align: center; border-radius: 8px;">${family.join_code}</p>
        </div>`;

      await transporter.sendMail({ from: smtpFrom, to: email, subject, html });
      console.log(JSON.stringify({ requestId, userId: user.id, action: "invite_sent", familyId: family.id }));
      return json({ familyId: family.id, joinCode: family.join_code, emailSent: true }, 200, corsHeaders);
    } catch (error) {
      console.error(JSON.stringify({ requestId, userId: user.id, action: "smtp_send_error", error: error instanceof Error ? error.message : String(error) }));
      return json({ familyId: family.id, joinCode: family.join_code, emailSent: false }, 200, corsHeaders);
    }
  }

  if (body.action === "accept") {
    const { joinCode, displayName, ageGroup, householdRole } = body;
    if (typeof joinCode !== "string" || !joinCode.trim()) {
      return json({ error: "Missing join code" }, 400, corsHeaders);
    }
    if (ageGroup !== "adult" && ageGroup !== "minor") {
      return json({ error: "Missing or invalid age group" }, 400, corsHeaders);
    }

    const { data: family } = await supabase
      .from(FAMILIES)
      .select("id, name")
      .eq("join_code", joinCode.trim().toUpperCase())
      .maybeSingle();
    if (!family) {
      return json({ error: "invalid_code" }, 200, corsHeaders);
    }

    const { data: existing } = await supabase
      .from(MEMBERS)
      .select("id")
      .eq("family_id", family.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      return json({ error: "already_member" }, 200, corsHeaders);
    }

    const { error: insertError } = await supabase.from(MEMBERS).insert({
      family_id: family.id,
      user_id: user.id,
      display_name: typeof displayName === "string" && displayName.trim() ? displayName.trim().slice(0, 100) : (user.email?.split("@")[0] || "Member"),
      member_role: "member",
      age_group: ageGroup,
      household_role: typeof householdRole === "string" ? householdRole.slice(0, 50) : null,
    });
    if (insertError) {
      console.error(JSON.stringify({ requestId, userId: user.id, action: "accept_insert_error", error: insertError.message }));
      return json({ error: "Could not join family" }, 500, corsHeaders);
    }

    console.log(JSON.stringify({ requestId, userId: user.id, action: "invite_accepted", familyId: family.id }));
    return json({ familyId: family.id, familyName: family.name }, 200, corsHeaders);
  }

  return json({ error: "Unknown action" }, 400, corsHeaders);
});
