import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.log(JSON.stringify({ requestId, method: req.method, url: req.url }));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  try {
    // Action: subscribe - save push subscription
    if (action === 'subscribe') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { subscription } = body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return new Response(JSON.stringify({ error: 'Invalid subscription data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: upsertError } = await supabase
        .from('app_11941c8fec_push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,endpoint' });

      if (upsertError) {
        console.error(JSON.stringify({ requestId, error: upsertError }));
        return new Response(JSON.stringify({ error: 'Failed to save subscription' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also create default notification preferences if not exists
      await supabase
        .from('app_11941c8fec_notification_preferences')
        .upsert({
          user_id: user.id,
          prayer_reminders: true,
          bill_reminders: true,
          habit_reminders: true,
          fasting_reminders: true,
          savings_reminders: true,
          general_activity: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: unsubscribe - remove push subscription
    if (action === 'unsubscribe') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { endpoint } = body;
      if (endpoint) {
        await supabase
          .from('app_11941c8fec_push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint);
      } else {
        await supabase
          .from('app_11941c8fec_push_subscriptions')
          .delete()
          .eq('user_id', user.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: update_preferences - update notification preferences
    if (action === 'update_preferences') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { preferences } = body;
      if (!preferences) {
        return new Response(JSON.stringify({ error: 'Missing preferences' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: upsertError } = await supabase
        .from('app_11941c8fec_notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error(JSON.stringify({ requestId, error: upsertError }));
        return new Response(JSON.stringify({ error: 'Failed to update preferences' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get_preferences - get notification preferences
    if (action === 'get_preferences') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('app_11941c8fec_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(JSON.stringify({ requestId, error }));
        return new Response(JSON.stringify({ error: 'Failed to get preferences' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const preferences = data || {
        prayer_reminders: true,
        bill_reminders: true,
        habit_reminders: true,
        fasting_reminders: true,
        savings_reminders: true,
        general_activity: true,
      };

      return new Response(JSON.stringify({ preferences }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: send_notification - send push to specific user(s) by notification type
    if (action === 'send_notification') {
      const { user_id, notification_type, title, body: notifBody, icon, url } = body;

      if (!user_id || !notification_type || !title || !notifBody) {
        return new Response(JSON.stringify({ error: 'Missing required fields: user_id, notification_type, title, body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // This function has verify_jwt disabled (called directly from the
      // browser for other actions) and this action previously had NO
      // authorization check at all - any caller could POST an arbitrary
      // user_id and send that user a fake notification. Now that this is
      // called from two real places - the client itself (Savings milestone
      // celebrations, on behalf of the signed-in user only) and the
      // server-side push_scheduler function (on behalf of any user, since
      // it's the trusted cron sweep) - both need a real check: either the
      // caller is the trusted scheduler (a shared internal secret only it
      // knows), or the caller is a signed-in user sending to themselves.
      const internalSecret = req.headers.get('X-Internal-Push-Secret');
      const expectedInternalSecret = Deno.env.get('INTERNAL_PUSH_SECRET');
      const isInternalCaller = !!internalSecret && !!expectedInternalSecret && internalSecret === expectedInternalSecret;

      if (!isInternalCaller) {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user || user.id !== user_id) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Check user preferences for this notification type
      const prefColumn = `${notification_type}_reminders` === 'general_activity_reminders' 
        ? 'general_activity' 
        : `${notification_type}`;
      
      const { data: prefs } = await supabase
        .from('app_11941c8fec_notification_preferences')
        .select(prefColumn)
        .eq('user_id', user_id)
        .single();

      // If user has disabled this type, skip
      if (prefs && prefs[prefColumn] === false) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'User disabled this notification type' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user's push subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('app_11941c8fec_push_subscriptions')
        .select('*')
        .eq('user_id', user_id);

      if (subError || !subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0, reason: 'No subscriptions found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Send push to all of the user's subscriptions via real Web Push
      // (VAPID JWT auth + AES128GCM payload encryption, RFC 8291/8292).
      // The previous implementation here POSTed the raw JSON payload
      // straight to the push service's endpoint with no encryption and no
      // VAPID Authorization header - real push services (FCM, Mozilla
      // autopush) reject that outright, so this action never actually
      // delivered anything. web-push is the maintained, spec-correct
      // implementation of that crypto - not hand-rolled here, since a
      // subtle bug in AES128GCM/ECDH framing fails silently rather than
      // loudly, which is exactly the kind of thing worth not reinventing.
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@amanahlife.com';

      if (!vapidPublicKey || !vapidPrivateKey) {
        console.warn(JSON.stringify({ requestId, warning: 'VAPID keys not configured' }));
        return new Response(JSON.stringify({ success: true, sent: 0, reason: 'VAPID keys not configured' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      const payload = JSON.stringify({
        title,
        body: notifBody,
        icon: icon || '/assets/amanah-logo.png',
        url: url || '/',
        notification_type,
      });

      let sent = 0;
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
            payload,
            { TTL: 86400 }
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            // Subscription expired or the browser unregistered it - remove it.
            await supabase
              .from('app_11941c8fec_push_subscriptions')
              .delete()
              .eq('id', sub.id);
          } else {
            console.error(JSON.stringify({ requestId, action: 'send_error', endpoint: sub.endpoint, statusCode: err?.statusCode, message: err?.message }));
          }
        }
      }

      return new Response(JSON.stringify({ success: true, sent }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Valid actions: subscribe, unsubscribe, update_preferences, get_preferences, send_notification' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(JSON.stringify({ requestId, error: err }));
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});