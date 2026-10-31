import { projectOrigin } from './paymentEnvironment';

// An unconfigured build has no hosted fallback. Port 1 is deliberately unusable.
export const PROJECT_URL = projectOrigin(import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_AMANAHLIFE_PAYMENT_MODE) ?? 'http://127.0.0.1:1';
export function edgeFunctionUrl(name: string): string {
  if (!/^app_11941c8fec_[a-z_]+$/.test(name)) throw new Error('Invalid function name');
  return `${PROJECT_URL}/functions/v1/${name}`;
}
