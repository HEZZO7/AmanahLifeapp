export const AUTH_RETURN_KEY = 'amanahlife_auth_return';

type AuthReturn = '/' | '/subscription';
type ReturnStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// A return destination controls navigation only; it never grants access.
export function resolveAuthReturn(next: string | null, stored: string | null): AuthReturn {
  if (next !== null) return next === '/subscription' ? '/subscription' : '/';
  return stored === '/subscription' ? '/subscription' : '/';
}

export function readAuthReturn(search: string, storage: ReturnStorage): AuthReturn {
  let stored: string | null = null;
  try { stored = storage.getItem(AUTH_RETURN_KEY); } catch { /* Storage may be blocked. */ }
  return resolveAuthReturn(new URLSearchParams(search).get('next'), stored);
}

export function rememberAuthReturn(destination: string, storage: ReturnStorage): void {
  const safe = resolveAuthReturn(destination, null);
  try {
    if (safe === '/subscription') storage.setItem(AUTH_RETURN_KEY, safe);
    else storage.removeItem(AUTH_RETURN_KEY);
  } catch { /* Authentication must still be available if storage is blocked. */ }
}

export function consumeAuthReturn(search: string, storage: ReturnStorage): AuthReturn {
  const destination = readAuthReturn(search, storage);
  try { storage.removeItem(AUTH_RETURN_KEY); } catch { /* Best effort cleanup. */ }
  return destination;
}
