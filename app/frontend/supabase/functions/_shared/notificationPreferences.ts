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

export function publicPreferences(value: Record<string, unknown> | null): Record<Flag, boolean> {
  return Object.fromEntries(NOTIFICATION_FLAGS.map(key => [key, value?.[key] !== false])) as Record<Flag, boolean>;
}
