/**
 * Per-user-scoped localStorage wrapper.
 * Ported from amanahlife-rn's src/lib/userStorage.ts (same AsyncStorage
 * pattern there, applied across 16 RN screens in that repo's Phase 1 audit).
 *
 * Some web screens still read/write content under a fixed key (e.g.
 * 'routines_<date>'), with no relation to which account was signed in.
 * On a shared browser, signing out of account A and into account B would
 * show account A's data to account B (and let B silently overwrite it).
 *
 * getUserItem/setUserItem/removeUserItem scope the key to the current
 * user.id (or 'guest' when signed out), so each account's content is
 * isolated on the same browser.
 */

export function getScopedKey(baseKey: string, userId: string | null): string {
  return `${baseKey}:${userId ?? 'guest'}`;
}

export function getUserItem(baseKey: string, userId: string | null): string | null {
  return localStorage.getItem(getScopedKey(baseKey, userId));
}

export function setUserItem(baseKey: string, userId: string | null, value: string): void {
  localStorage.setItem(getScopedKey(baseKey, userId), value);
}

export function removeUserItem(baseKey: string, userId: string | null): void {
  localStorage.removeItem(getScopedKey(baseKey, userId));
}

/**
 * One-time upgrade path: if data exists under the old unscoped `baseKey`
 * and nothing yet exists under this user's scoped key, copy it over and
 * remove the legacy key. Safe to call on every screen mount - it's a no-op
 * once migrated (or if there was never legacy data to begin with).
 */
export function migrateLegacyKeyIfNeeded(baseKey: string, userId: string | null): void {
  try {
    const scopedKey = getScopedKey(baseKey, userId);
    const existingScoped = localStorage.getItem(scopedKey);
    const legacy = localStorage.getItem(baseKey);
    if (legacy !== null && existingScoped === null) {
      localStorage.setItem(scopedKey, legacy);
      localStorage.removeItem(baseKey);
    }
  } catch {
    // Best-effort - if migration fails, the screen just starts fresh under
    // the new scoped key rather than crashing.
  }
}
