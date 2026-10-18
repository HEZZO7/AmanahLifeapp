// Client compatibility only: database RLS and verified JWTs remain authoritative.
import { notificationBackupColumns, notificationRestoreRow } from './notificationBackup';

type Session = { access_token: string; user: { id: string } } | null;
type Result = { error: { code?: string } | null; count?: number | null };
type Update = PromiseLike<Result> & { eq(column: string, value: string): PromiseLike<Result> };
export type PreferenceWriteClient = {
  auth: { getSession(): Promise<{ data: { session: Session }; error: unknown }> };
  from(table: string): {
    update(patch: Record<string, unknown>, options: { count: 'exact' }): Update;
    insert(row: Record<string, unknown>): PromiseLike<Result>;
  };
};
type Location = { method: string; mode: 'auto' | 'manual'; city: unknown; timezone: string; language: string };
const table = 'app_11941c8fec_notification_preferences';
const saveError = () => new Error('Notification preference save not confirmed');

export function createNotificationPreferenceWriter(client: PreferenceWriteClient) {
  const queues = new Map<string, Promise<void>>();
  const requireAccount = async (account: string) => {
    const { data, error } = await client.auth.getSession();
    if (error || !account || !data.session?.access_token || data.session.user.id !== account) throw saveError();
  };
  const write = async (account: string, patch: Record<string, unknown>) => {
    await requireAccount(account);
    // Never call .select() on mutations: PostgREST can add the ungranted PK
    // to RETURNING, even when the requested response projection omits it.
    const update = async () => {
      await requireAccount(account);
      const result = await client.from(table).update(patch, { count: 'exact' }).eq('user_id', account);
      await requireAccount(account);
      if (result.error || (result.count !== 0 && result.count !== 1)) throw saveError();
      return result.count;
    };
    if (await update() === 1) return;
    await requireAccount(account);
    // Plain INSERT only: no merge-duplicates/ON CONFLICT UPDATE(user_id).
    const inserted = await client.from(table).insert({ ...patch, user_id: account });
    await requireAccount(account);
    if (!inserted.error) return;
    // Another device/Edge action may have created our unique user row after
    // the zero-row PATCH. Bounded retry writes only the originally requested
    // fields; it never resets the winner's unrelated flags or server metadata.
    if (inserted.error.code !== '23505' || await update() !== 1) throw saveError();
  };
  const save = async (account: string, input: Record<string, unknown>) => {
    if (Object.keys(input).some(key => !(notificationBackupColumns as readonly string[]).includes(key))) throw saveError();
    const { user_id: _identity, ...patch } = notificationRestoreRow(input, account);
    if (Object.keys(patch).length !== Object.keys(input).length) throw saveError();
    const previous = queues.get(account) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => write(account, patch));
    queues.set(account, next);
    try { await next; }
    catch { throw saveError(); }
    finally { if (queues.get(account) === next) queues.delete(account); }
  };
  return {
    syncLocation: async (account: string, settings: Location) => save(account, {
      prayer_calc_method: settings.method,
      prayer_location_mode: settings.mode,
      prayer_manual_city: settings.mode === 'manual' && settings.city ? settings.city : null,
      timezone: settings.timezone,
      language: settings.language,
    }),
    restore: async (account: string, raw: unknown) => {
      // Old backups may contain another account's ID/internal fields. Only the
      // sanitized portable fields survive; the SDK session binds the target.
      const { user_id: _identity, ...patch } = notificationRestoreRow(raw, account);
      await save(account, patch);
    },
  };
}
