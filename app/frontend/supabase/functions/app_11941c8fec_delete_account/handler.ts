// No provider calls. Billing history requires a separate retention/deletion review.
export type DeletionDependencies = {
  authenticate: (token: string) => Promise<string | null>;
  billingAllowed: (user: string) => Promise<{ data: unknown; error: unknown }>;
  deleteData: (user: string) => Promise<void>;
  deleteUser: (user: string) => Promise<boolean>;
  legacyBillingConfigured: boolean;
};

export class BillingDeletionBlocked extends Error {}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });
const blocked = () => reply(409, {
  code: 'billing_review_required',
  error: 'Account not deleted. Open /subscription to manage or cancel renewal, then contact support@amanahlife.com for billing-record retention review. No cancellation has been performed; paid access is unchanged.',
  manage_path: '/subscription',
});
const unavailable = () => reply(503, {
  code: 'billing_verification_unavailable',
  error: 'Account not deleted: billing safety could not be verified. Manage billing at /subscription or contact support@amanahlife.com. No cancellation has been performed.',
  manage_path: '/subscription',
});

export async function handleDeleteAccount(req: Request, d: DeletionDependencies): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.get('Authorization') || '');
  if (!match) return reply(401, { error: 'Authentication required' });
  try {
    // Never consume a target identity, billing status or cancellation claim from JSON.
    const user = await d.authenticate(match[1]);
    if (!user) return reply(401, { error: 'Invalid or expired token' });
    // Legacy Paddle checkout can create an obligation before a local binding exists.
    // Its presence requires an inventory/retention review, not an absence assumption.
    if (d.legacyBillingConfigured) return unavailable();
    const permission = await d.billingAllowed(user);
    if (permission.error || typeof permission.data !== 'boolean') return unavailable();
    if (!permission.data) return blocked();
    // Migration 008 also checks in BEFORE DELETE triggers, closing the check/delete
    // race with checkout reservations and preventing auth.users cascading evidence.
    await d.deleteData(user);
    if (!await d.deleteUser(user)) return unavailable();
    return reply(200, { success: true, message: 'Account deleted successfully' });
  } catch (error) {
    if (error instanceof BillingDeletionBlocked) return blocked();
    // Never return/log SDK errors, tokens, database details or provider payloads.
    return unavailable();
  }
}
