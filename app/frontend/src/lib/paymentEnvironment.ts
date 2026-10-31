type Settings = { mode?: string; project?: string; anonKey?: string };
export function projectOrigin(project: string | undefined, mode?: string): string | null {
  if (!project) return null;
  try {
    const url = new URL(project);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (mode === 'test' && url.hostname === 'nyhsnvjdgifphwkqzwel.supabase.co') return null;
    return url.origin;
  } catch { return null; }
}
export function paymentEnvironment({ mode, project, anonKey }: Settings) {
  if (!['test', 'live'].includes(mode ?? '') || !project || !anonKey) return null;
  const origin = projectOrigin(project, mode);
  return origin ? { mode, project: origin, endpoint: `${origin}/functions/v1/app_11941c8fec_lemonsqueezy_checkout${mode === 'test' ? '_test' : ''}` } : null;
}
