import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from 'npm:nodemailer';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateDigestEmail(savingsData: any): string {
  const challenges = savingsData?.challenges || [];
  const totalSaved = challenges.reduce((sum: number, c: any) => sum + (c.savedAmount || 0), 0);
  const activeChallenges = challenges.length;

  let challengeRows = '';
  for (const c of challenges) {
    const progress = c.targetAmount > 0 ? Math.min(100, Math.round((c.savedAmount / c.targetAmount) * 100)) : 0;
    const milestonesReached = c.completedMilestones?.length || 0;
    challengeRows += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${c.icon || '💰'} ${c.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${progress}%</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">$${c.savedAmount} / $${c.targetAmount}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${milestonesReached}/4</td>
      </tr>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Savings Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0a2e1f 0%, #1a4a35 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #c9a96e; margin: 0; font-size: 24px;">🏆 Your Weekly Savings Digest</h1>
      <p style="color: #a0c4b0; margin: 8px 0 0; font-size: 14px;">AmanahLife</p>
    </div>

    <!-- Summary -->
    <div style="background: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 0 20px;">
          <p style="font-size: 28px; font-weight: bold; color: #c9a96e; margin: 0;">$${totalSaved}</p>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0;">Total Saved</p>
        </div>
        <div style="display: inline-block; padding: 0 20px;">
          <p style="font-size: 28px; font-weight: bold; color: #0a2e1f; margin: 0;">${activeChallenges}</p>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0;">Active Challenges</p>
        </div>
      </div>

      <!-- Challenge Breakdown -->
      ${challenges.length > 0 ? `
      <h2 style="font-size: 16px; color: #1f2937; margin: 0 0 12px;">Challenge Breakdown</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px; text-align: left; color: #6b7280; font-weight: 600;">Challenge</th>
            <th style="padding: 10px; text-align: center; color: #6b7280; font-weight: 600;">Progress</th>
            <th style="padding: 10px; text-align: center; color: #6b7280; font-weight: 600;">Saved</th>
            <th style="padding: 10px; text-align: center; color: #6b7280; font-weight: 600;">Milestones</th>
          </tr>
        </thead>
        <tbody>
          ${challengeRows}
        </tbody>
      </table>
      ` : '<p style="color: #6b7280; text-align: center;">No active challenges yet. Join one today!</p>'}
    </div>

    <!-- Encouragement -->
    <div style="background: #f0fdf4; padding: 20px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <p style="margin: 0; text-align: center; color: #166534; font-size: 14px;">
        ✨ Keep up the great work! Every small step brings you closer to your financial goals. May your efforts be blessed. ✨
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; border-radius: 0 0 16px 16px; padding: 20px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        You're receiving this because you subscribed to weekly savings digests.<br>
        To unsubscribe, disable the email digest toggle in your Savings Challenges page.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Weekly digest function invoked`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action } = body;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (action === 'subscribe') {
      // User subscribes/updates their digest preferences
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { savings_data, enabled } = body;
      const { error: upsertError } = await supabase
        .from('app_11941c8fec_email_digest')
        .upsert({
          user_id: user.id,
          enabled: enabled !== undefined ? enabled : true,
          savings_data: savings_data || null,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error(`[${requestId}] Upsert error:`, upsertError);
        return new Response(JSON.stringify({ error: 'Failed to update preferences' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[${requestId}] User ${user.id} digest preference updated`);
      return new Response(JSON.stringify({ success: true, message: 'Digest preferences updated' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'send_digests') {
      // Send digests to all enabled subscribers
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: subscribers, error: fetchError } = await supabase
        .from('app_11941c8fec_email_digest')
        .select('*')
        .eq('enabled', true);

      if (fetchError) {
        console.error(`[${requestId}] Fetch subscribers error:`, fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch subscribers' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!subscribers || subscribers.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No subscribers to send to', sent: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Setup SMTP transport
      const smtpHost = Deno.env.get('SMTP_HOST');
      const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
      const smtpSecure = Deno.env.get('SMTP_SECURE') !== 'false';
      const smtpUser = Deno.env.get('SMTP_USER');
      const smtpPassword = Deno.env.get('SMTP_PASSWORD');
      const smtpFrom = Deno.env.get('SMTP_FROM') || smtpUser;

      if (!smtpHost || !smtpUser || !smtpPassword) {
        console.error(`[${requestId}] SMTP not configured`);
        return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPassword },
      });

      let sentCount = 0;
      let failCount = 0;

      for (const subscriber of subscribers) {
        try {
          // Get user email
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(subscriber.user_id);
          if (userError || !user?.email) {
            console.error(`[${requestId}] Could not get email for user ${subscriber.user_id}`);
            failCount++;
            continue;
          }

          const emailHtml = generateDigestEmail(subscriber.savings_data);

          await transporter.sendMail({
            from: smtpFrom,
            to: user.email,
            subject: '🏆 Your Weekly Savings Digest - AmanahLife',
            html: emailHtml,
          });

          // Update last_sent_at
          await supabase
            .from('app_11941c8fec_email_digest')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('user_id', subscriber.user_id);

          sentCount++;
          console.log(`[${requestId}] Sent digest to ${user.email}`);
        } catch (emailErr) {
          console.error(`[${requestId}] Failed to send to user ${subscriber.user_id}:`, emailErr);
          failCount++;
        }
      }

      return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failCount }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use "subscribe" or "send_digests".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error(`[${requestId}] Unexpected error:`, err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});