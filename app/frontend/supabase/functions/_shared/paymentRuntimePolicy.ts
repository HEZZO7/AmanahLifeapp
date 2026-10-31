import type { Mode } from './lemonPayments.ts';

// A test endpoint must never attach its service-role client to the known hosted
// application project. A separate test project is a release prerequisite.
const hostedProject = 'nyhsnvjdgifphwkqzwel.supabase.co';
export function assertPaymentProject(mode: Mode, project: string | undefined): string {
  if (!project) throw new Error('Payment project unavailable');
  const url = new URL(project);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Invalid payment project');
  }
  if (mode === 'test' && url.hostname === hostedProject) throw new Error('Separate test project required');
  return url.origin;
}
