// Server-owned expiry; never trust client platform.
export function effectiveTier(row: {tier?: string; status?: string; trial_used?: boolean; trial_started_at?: string | null; trial_expires_at?: string | null} | null, now = Date.now()): 'free' | 'balanced' | 'family' {
  if (!row) return 'free';
  const start = Date.parse(row.trial_started_at ?? '');
  if (row.trial_used && Number.isFinite(start) && start <= now && Number.isFinite(Date.parse(row.trial_expires_at ?? '')) && now < Date.parse(row.trial_expires_at ?? '')) return 'family';
  if (row.status !== 'active' && row.status !== 'past_due') return 'free';
  return row.tier === 'family' || row.tier === 'balanced' ? row.tier : 'free';
}
export async function hasEntitlement(client: any, userId: string, required: 'balanced' | 'family'): Promise<boolean> {
  const {data,error} = await client.from('app_11941c8fec_subscriptions').select('tier,status,trial_used,trial_started_at,trial_expires_at').eq('user_id',userId).maybeSingle();
  if (error) return false;
  const tier = effectiveTier(data);
  return tier === 'family' || (required === 'balanced' && tier === 'balanced');
}
