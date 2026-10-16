// Request authorization is shared by all four AI handlers. No browser entitlement is read.
export type AiLog = { requestId: string; event: string; status?: number };
export type AiDependencies = {
  user: (token: string) => Promise<{ id: string } | null>;
  entitled: (token: string) => Promise<unknown>;
  key: () => string | undefined;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  log?: (entry: AiLog) => void;
};
export type AiContext = {
  requestId: string;
  corsHeaders: Record<string, string>;
  log: (event: string, status?: number) => void;
};
const origins = new Set(['https://app.amanahlife.com', 'https://amanahlife.com']);
const json = (error: string, status: number, headers: Record<string,string>) =>
  Response.json({ error }, { status, headers: { ...headers, 'Cache-Control': 'no-store' } });
export function createAiHandler(
  process: (req: Request, context: AiContext) => Promise<Response>,
  deps: AiDependencies,
): (req: Request) => Promise<Response> {
  return async req => {
    const origin = req.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': !origin ? '*' : origins.has(origin) ? origin : 'https://app.amanahlife.com',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    };
    const requestId = crypto.randomUUID();
    // Entries contain only a server request ID, a static event and optional numeric status.
    // A failing log sink must not change access or expose the original exception.
    const log = (event: string, status?: number) => {
      try { deps.log?.({ requestId, event, ...(status === undefined ? {} : { status }) }); } catch { /* no raw error */ }
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return json('Method not allowed', 405, corsHeaders);
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.get('Authorization') || '');
    if (!match) return json('Unauthorized', 401, corsHeaders);
    let allowed: unknown;
    try {
      const user = await deps.user(match[1]);
      if (!user?.id) return json('Unauthorized', 401, corsHeaders);
      // No user ID/plan/status arguments. The RPC derives auth.uid() from this same JWT.
      allowed = await deps.entitled(match[1]);
      if (allowed !== true && allowed !== false) throw new Error('Invalid authorization response');
    } catch {
      log('access_unavailable');
      return json('Access verification unavailable', 503, corsHeaders);
    }
    if (allowed !== true) return json('Subscription or active trial required', 403, corsHeaders);
    try {
      return await process(req, { requestId, corsHeaders, log });
    } catch {
      log('handler_error');
      return json('Service temporarily unavailable', 503, corsHeaders);
    }
  };
}

