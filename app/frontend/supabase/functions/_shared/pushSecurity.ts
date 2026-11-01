// Fixed vendor hosts prevent client-controlled URLs becoming privileged SSRF.
// A new push vendor requires an explicit allowlist review, never a wildcard URL.
export function safePushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096 || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.port &&
      (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));
  } catch { return false; }
}
function keyBytes(value: unknown, length: number): boolean {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value) || value.length > 100) return false;
  try {
    const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return decoded.length === length && (length !== 65 || decoded.charCodeAt(0) === 4);
  } catch { return false; }
}
export function validPushSubscription(value: unknown): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const subscription = value as Record<string, unknown>, keys = subscription.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return false;
  const material = keys as Record<string, unknown>;
  return safePushEndpoint(subscription.endpoint) && keyBytes(material.p256dh, 65) && keyBytes(material.auth, 16);
}
export function safeNotificationPath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 2048 && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020\u007f]/.test(value);
}
