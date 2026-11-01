// The Edge writer is privileged: never forward arbitrary client fields to SQL.
export const NOTIFICATION_FLAGS = [
  'prayer_reminders', 'bill_reminders', 'habit_reminders',
  'fasting_reminders', 'savings_reminders', 'general_activity',
] as const;
type Flag = typeof NOTIFICATION_FLAGS[number];

export function preferencePatch(value: unknown): Partial<Record<Flag, boolean>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([key, flag]) =>
    !NOTIFICATION_FLAGS.some(allowed => allowed === key) || typeof flag !== 'boolean')) return null;
  return Object.fromEntries(entries);
}

export function preferenceDisabled(value: unknown, flag: Flag): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getOwnPropertyDescriptor(value, flag)?.value === false;
}

export function publicPreferences(value: unknown): Record<Flag, boolean> {
  return Object.fromEntries(NOTIFICATION_FLAGS.map(key => [key, !preferenceDisabled(value, key)])) as Record<Flag, boolean>;
}
