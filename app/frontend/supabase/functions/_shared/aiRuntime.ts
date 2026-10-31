import { createClient } from 'npm:@supabase/supabase-js@2';
import type { AiDependencies } from './aiAccess.ts';

// Public project key + verified user JWT; these functions no longer need service_role.
export function serveAi(createHandler: (deps: AiDependencies) => (req: Request) => Promise<Response>) {
  const clientFor = (token: string) => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('Access configuration unavailable');
    return createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  };
  Deno.serve(createHandler({
    origin: Deno.env.get('AMANAHLIFE_APP_ORIGIN'),
    user: async token => {
      const { data, error } = await clientFor(token).auth.getUser(token);
      if (error) {
        if (!error.status || error.status === 429 || error.status >= 500) throw new Error('Authentication unavailable');
        return null;
      }
      return data.user ? { id: data.user.id } : null;
    },
    entitled: async token => {
      const { data, error } = await clientFor(token).rpc('app_11941c8fec_ai_entitled');
      if (error) throw new Error('Access verification unavailable');
      return data;
    },
    key: () => Deno.env.get('ANTHROPIC_API_KEY'),
    fetch: (url, init) => fetch(url, init),
    log: entry => console.log(JSON.stringify(entry)),
  }));
}

