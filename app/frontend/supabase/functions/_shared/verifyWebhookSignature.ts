// Verify exactly the body received, before parsing JSON. No provider API calls.
export async function verifySignature(
  rawBody: string, signature: string, secret: string
): Promise<boolean> {
  if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' },
    false, ['verify']
  );
  const bytes = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(rawBody));
}
