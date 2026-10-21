import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleDeleteAccount } from './handler.ts';

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
    deletionReady: async () => {
      const { data, error } = await getAdmin().rpc('app_11941c8fec_account_deletion_ready');
      return { data, error };
    },
    billingAllowed: async user => {
      const { data, error } = await getAdmin().rpc('app_11941c8fec_account_deletion_allowed', { p_user: user });
      return { data, error };
    },
    deleteUser: async user => {
      // The hard-delete statement runs Migration 009 cleanup in its own database
      // transaction. Never pre-delete trial/subscription rows over PostgREST.
      const { error } = await getAdmin().auth.admin.deleteUser(user, false);
      return error === null;
    },
  });
});
