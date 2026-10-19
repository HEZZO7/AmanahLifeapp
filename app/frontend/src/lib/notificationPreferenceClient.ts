// Mirrored verbatim in web and RN. Source of truth: push_notify's
// _shared/notificationPreferences.ts preferenceKeys. Never spread API/cache rows.
export const preferenceKeys = [
  'prayer_reminders', 'bill_reminders', 'habit_reminders',
  'fasting_reminders', 'savings_reminders', 'general_activity',
] as const;
export type PreferenceKey = typeof preferenceKeys[number];
export type NotificationPreferences = Record<PreferenceKey, boolean>;
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  prayer_reminders: true, bill_reminders: true, habit_reminders: true,
  fasting_reminders: true, savings_reminders: true, general_activity: true,
};

export function sanitizePreferences(raw: unknown): NotificationPreferences {
  const clean = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  for (const key of preferenceKeys) {
    if (Object.prototype.hasOwnProperty.call(raw, key) &&
        typeof (raw as Record<string, unknown>)[key] === 'boolean') {
      clean[key] = (raw as NotificationPreferences)[key];
    }
  }
  return clean;
}
export function sanitizePatch(raw: unknown): Partial<NotificationPreferences> {
  const clean: Partial<NotificationPreferences> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of preferenceKeys) {
      if (Object.prototype.hasOwnProperty.call(raw, key) &&
          typeof (raw as Record<string, unknown>)[key] === 'boolean') {
        clean[key] = (raw as NotificationPreferences)[key];
      }
    }
  }
  if (!Object.keys(clean).length) throw new Error('Invalid preferences');
  return clean;
}
type Session = { access_token: string; user: { id: string } } | null;
type Dependencies = {
  url: string;
  getSession: () => Promise<Session>;
  request: typeof fetch;
  readCache: () => Promise<string | null>;
  writeCache: (value: string) => Promise<void>;
};
export type PreferenceResult = {
  preferences: NotificationPreferences;
  synced: boolean;
  cacheSaved: boolean;
};
export function createPreferenceClient(accountId: string | null, deps: Dependencies) {
  let confirmed = sanitizePreferences(null);
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = queue.then(operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const sessionForAccount = async () => {
    const session = await deps.getSession();
    if (!accountId || !session?.access_token || session.user.id !== accountId) {
      throw new Error('Authentication required');
    }
    return session;
  };
  const request = async (action: string, patch?: Partial<NotificationPreferences>) => {
    const session = await sessionForAccount();
    const response = await deps.request(deps.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(patch ? { action, preferences: patch } : { action }),
    });
    if (!response.ok) throw new Error('Preference request rejected');
    const data = await response.json();
    // Check the SDK session again: an old response cannot confirm a new account.
    await sessionForAccount();
    if (!data || typeof data !== 'object') throw new Error('Invalid preference response');
    return data;
  };
  const cache = async () => {
    try { await deps.writeCache(JSON.stringify(confirmed)); return true; }
    catch { return false; } // A cache failure cannot undo a confirmed server save.
  };
  return {
    load: () => serial(async (): Promise<PreferenceResult> => {
      try {
        const raw = await deps.readCache();
        confirmed = sanitizePreferences(raw ? JSON.parse(raw) : null);
        await cache(); // Clean old metadata before any use or later send.
      } catch { /* Retain the six last-known values when storage is unavailable. */ }
      try {
        const data = await request('get_preferences');
        if (!data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) {
          throw new Error('Invalid preference response');
        }
        confirmed = sanitizePreferences(data.preferences);
        return { preferences: { ...confirmed }, synced: true, cacheSaved: await cache() };
      } catch {
        return { preferences: { ...confirmed }, synced: false, cacheSaved: true };
      }
    }),
    save: (input: unknown) => {
      // Only a patch is sent: old cached defaults cannot overwrite unrelated flags.
      const patch = sanitizePatch(input);
      return serial(async (): Promise<PreferenceResult> => {
        const data = await request('update_preferences', patch);
        if (data.success !== true) throw new Error('Preference save not confirmed');
        confirmed = sanitizePreferences({ ...confirmed, ...patch });
        return { preferences: { ...confirmed }, synced: true, cacheSaved: await cache() };
      });
    },
  };
}
export type PreferenceClient = ReturnType<typeof createPreferenceClient>;

