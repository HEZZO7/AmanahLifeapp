import {
  allowedPreferencePatch, preferenceKeys, projectPreferences,
  type PreferencePatch, type PreferenceStore,
} from './notificationPreferences.ts';

const table = 'app_11941c8fec_notification_preferences';
type Result = { data?: unknown; error: unknown };
export type PreferenceClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<Result> };
    };
    upsert: (row: Record<string, unknown>, options: { onConflict: string }) => PromiseLike<Result>;
  };
};

// No caller-selected table, columns, filter or target can enter this capability.
export function scopedPreferenceStore(client: PreferenceClient, verifiedUserId: string): PreferenceStore {
  if (!verifiedUserId) throw new Error('Verified identity required');
  return {
    read: async () => {
      const { data, error } = await client.from(table)
        .select(['user_id', ...preferenceKeys].join(','))
        .eq('user_id', verifiedUserId).maybeSingle();
      if (error) throw new Error('Preference read failed');
      return projectPreferences(data ?? null, verifiedUserId);
    },
    write: async (patch: PreferencePatch) => {
      const allowed = allowedPreferencePatch(patch);
      if (!allowed) throw new Error('Invalid preference patch');
      const { error } = await client.from(table).upsert({
        ...allowed,
        user_id: verifiedUserId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw new Error('Preference write failed');
    },
  };
}
