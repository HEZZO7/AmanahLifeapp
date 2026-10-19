// Only the six web notification toggles belong to this endpoint.
// Scheduler delivery markers, identity and location metadata are not editable here.
export const preferenceKeys = [
  'prayer_reminders', 'bill_reminders', 'habit_reminders',
  'fasting_reminders', 'savings_reminders', 'general_activity',
] as const;
export type PreferenceKey = typeof preferenceKeys[number];
export type PreferencePatch = Partial<Record<PreferenceKey, boolean>>;
export type Preferences = Record<PreferenceKey, boolean>;
export type PreferenceStore = {
  read: () => Promise<Preferences>;
  write: (patch: PreferencePatch) => Promise<void>;
};
export type PreferenceDependencies = {
  user: (token: string) => Promise<{ id: string } | null>;
  store: (verifiedUserId: string) => PreferenceStore;
};
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
export function allowedPreferencePatch(value: unknown): PreferencePatch | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (!keys.length || keys.some(key => !preferenceKeys.includes(key as PreferenceKey) || typeof value[key] !== 'boolean')) return null;
  const patch: PreferencePatch = {};
  for (const key of preferenceKeys) if (Object.hasOwn(value, key)) patch[key] = value[key] as boolean;
  return patch;
}
export function projectPreferences(value: unknown, userId: string): Preferences {
  if (value !== null && (!isRecord(value) || value.user_id !== userId)) throw new Error('Invalid preference result');
  const preferences = {} as Preferences;
  for (const key of preferenceKeys) {
    const flag = value === null ? undefined : (value as Record<string, unknown>)[key];
    if (flag !== undefined && flag !== null && typeof flag !== 'boolean') throw new Error('Invalid preference value');
    preferences[key] = flag == null ? true : flag;
  }
  return preferences;
}

// null delegates unrelated actions to the existing push handler unchanged.
export async function handlePreferenceAction(
  req: Request, body: unknown, deps: PreferenceDependencies, cors: Record<string, string>,
): Promise<Response | null> {
  if (!isRecord(body) || typeof body.action !== 'string'
    || !['update_preferences', 'get_preferences'].includes(body.action)) return null;
  const respond = (data: unknown, status: number) => Response.json(data, {
    status, headers: { ...cors, 'Cache-Control': 'no-store' },
  });
  const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.get('Authorization') || '');
  if (!bearer) return respond({ error: 'Unauthorized' }, 401);
  try {
    // The internal push secret never authorizes a user-preference operation.
    const user = await deps.user(bearer[1]);
    if (!user?.id) return respond({ error: 'Unauthorized' }, 401);
    const updating = body.action === 'update_preferences';
    const permitted = updating ? ['action', 'preferences'] : ['action'];
    if (Object.keys(body).some(key => !permitted.includes(key))) return respond({ error: 'Unsupported fields' }, 400);
    const patch = updating ? allowedPreferencePatch(body.preferences) : null;
    if (updating && !patch) return respond({ error: 'Invalid preferences' }, 400);
    // Privileged storage is constructed only after auth and complete input validation.
    const store = deps.store(user.id);
    if (updating) {
      await store.write(patch!);
      return respond({ success: true }, 200);
    }
    return respond({ preferences: await store.read() }, 200);
  } catch {
    // No SQL/Auth errors, JWT, user ID or preference contents in logs/responses.
    return respond({ error: 'Preferences temporarily unavailable' }, 503);
  }
}
