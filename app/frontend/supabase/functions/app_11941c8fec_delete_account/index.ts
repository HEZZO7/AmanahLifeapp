import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BillingDeletionBlocked, handleDeleteAccount } from './handler.ts';

Deno.serve(async (req: Request) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const createAdmin = () => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let admin: ReturnType<typeof createAdmin> | undefined;
  const getAdmin = () => admin ??= createAdmin();
  return handleDeleteAccount(req, {
    legacyBillingConfigured: Boolean(Deno.env.get('PADDLE_API_KEY') || Deno.env.get('APP_11941c8fec_PADDLE_WEBHOOK_SECRET')),
    authenticate: async token => {
      const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: 'Bearer ' + token } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await client.auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    billingAllowed: async user => {
      const { data, error } = await getAdmin().rpc('app_11941c8fec_account_deletion_allowed', { p_user: user });
      return { data, error };
    },
    deleteData: async user => {
      // Keep the existing cleanup scope. Unknown cleanup errors stop deletion.
      for (const table of ['app_11941c8fec_subscriptions', 'app_11941c8fec_search_history',
        'app_11941c8fec_email_digest', 'app_11941c8fec_notification_preferences', 'app_11941c8fec_push_subscriptions']) {
        const { error } = await getAdmin().from(table).delete().eq('user_id', user);
        if (error?.code === '42501') throw new BillingDeletionBlocked();
        if (error) throw new Error('Account cleanup unavailable');
      }
    },
    deleteUser: async user => {
      const { error } = await getAdmin().auth.admin.deleteUser(user);
      return !error;
    },
  });
});
