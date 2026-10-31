import { createClient } from 'npm:@supabase/supabase-js@2.106.0';
import { checkout, configuration, webhook, type Mode } from './lemonPayments.ts';
import { assertPaymentProject } from './paymentRuntimePolicy.ts';

export function servePayments(kind: 'checkout' | 'webhook', mode: Mode) {
  Deno.serve(async (req: Request) => {
    try {
      const c = configuration(key => Deno.env.get(key), mode);
      const project = assertPaymentProject(mode, Deno.env.get('SUPABASE_URL'));
      const client = createClient(project, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
      const dependencies = {
        rpc: async (name: string, args: Record<string, unknown>) => client.rpc(name, args),
        user: async (token: string) => {
          const { data, error } = await client.auth.getUser(token);
          return error ? null : data.user;
        },
        fetch,
      };
      return await (kind === 'checkout' ? checkout : webhook)(req, c, dependencies);
    } catch {
      // Never log API keys, signatures, opaque bindings, checkout URLs or customer payloads.
      return new Response(JSON.stringify({ error: 'Payments disabled or not configured' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  });
}
