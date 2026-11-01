// Backup data is untrusted. Keep device credentials and billing authority out
// of both directions, including old backups that contained entire SQL rows.
export const PREFERENCES_TABLE = 'app_11941c8fec_notification_preferences';
const EMAIL_TABLE = 'app_11941c8fec_email_digest';
const SEARCH_TABLE = 'app_11941c8fec_search_history';
const FLAGS = ['prayer_reminders', 'bill_reminders', 'habit_reminders',
  'fasting_reminders', 'savings_reminders', 'general_activity'];
export const PORTABLE_TABLES: Record<string, readonly string[]> = {
  [PREFERENCES_TABLE]: [...FLAGS, 'timezone', 'language', 'prayer_calc_method', 'prayer_location_mode', 'prayer_manual_city'],
  [EMAIL_TABLE]: ['enabled', 'savings_data'],
  [SEARCH_TABLE]: ['query', 'search_type'],
};
const EXCLUDED_TABLES = ['app_11941c8fec_push_subscriptions', 'app_11941c8fec_subscriptions'];
const LOCAL_KEYS = [
  'amanah-settings', 'amanah-tasks', 'amanah-goals', 'amanah-transactions',
  'amanah-habits', 'amanah-planner', 'amanah-wellness', 'amanah-daily-routine',
  'amanah-fasting', 'amanah-adhkar-progress', 'amanah-bills',
  'amanah-family-budget', 'amanah-savings-challenges',
];
export const isPortableLocalKey = (key: string) => LOCAL_KEYS.includes(key) ||
  /^(prayer_completed_|dhikr_)[A-Za-z0-9_-]{1,100}$/.test(key);

type Row = Record<string, unknown>;
type Result = { data?: unknown; error: unknown };
// Four explicit operations keep the portable-data policy independent of the SDK.
export type BackupClient = {
  read: (table: string, columns: readonly string[], userId: string, offset: number) => PromiseLike<Result>;
  update: (table: string, row: Row, userId: string) => PromiseLike<Result>;
  insert: (table: string, rows: Row | Row[]) => PromiseLike<Result>;
  remove: (table: string, userId: string) => PromiseLike<Result>;
};
type PreparedBackup = { supabaseData: Record<string, Row[]>; localData: Row; ignored: boolean };

function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup object');
  return value as Row;
}
function hasOwn(object: object, key: string) { return Object.prototype.hasOwnProperty.call(object, key); }
function portableRow(table: string, value: unknown): Row {
  const source = record(value), row: Row = {};
  for (const key of PORTABLE_TABLES[table]) {
    if (!hasOwn(source, key)) continue;
    const value = source[key];
    if ((FLAGS.includes(key) || key === 'enabled') && typeof value !== 'boolean') throw new Error('Invalid preference');
    if (['timezone', 'language', 'query'].includes(key) && (typeof value !== 'string' || !value.trim() || value.length > 4000)) throw new Error('Invalid text');
    if (key === 'language' && !['ar', 'en'].includes(value as string)) throw new Error('Invalid language');
    if (key === 'timezone') new Intl.DateTimeFormat('en', { timeZone: value as string });
    if (key === 'search_type' && !['classic', 'ai'].includes(value as string)) throw new Error('Invalid search type');
    if (key === 'prayer_location_mode' && value !== null && !['auto', 'manual'].includes(value as string)) throw new Error('Invalid location mode');
    if (key === 'prayer_calc_method' && value !== null && ![
      'UmmAlQura', 'Egyptian', 'Karachi', 'MuslimWorldLeague', 'Dubai', 'Qatar', 'Kuwait',
      'MoonsightingCommittee', 'NorthAmerica', 'Singapore', 'Tehran', 'Turkey', 'Other',
    ].includes(value as string)) throw new Error('Invalid calculation method');
    if (key === 'prayer_manual_city' && value !== null) {
      const city = record(value);
      if (!['name', 'nameAr', 'country', 'countryCode'].every(k => typeof city[k] === 'string' && (city[k] as string).length <= 200) ||
          typeof city.lat !== 'number' || !Number.isFinite(city.lat) || Math.abs(city.lat) > 90 ||
          typeof city.lon !== 'number' || !Number.isFinite(city.lon) || Math.abs(city.lon) > 180) throw new Error('Invalid city');
      row[key] = Object.fromEntries(['name', 'nameAr', 'country', 'countryCode', 'lat', 'lon'].map(k => [k, city[k]]));
    } else row[key] = value;
  }
  if (table === SEARCH_TABLE && (!hasOwn(row, 'query') || !hasOwn(row, 'search_type'))) throw new Error('Incomplete search row');
  return row;
}

export function prepareBackup(value: unknown): PreparedBackup {
  const backup = record(value), metadata = record(backup.metadata);
  if (typeof metadata.version !== 'string' || !metadata.version) throw new Error('Invalid backup version');
  const prepared: PreparedBackup = { supabaseData: {}, localData: {}, ignored: false };
  if (backup.supabaseData !== undefined) {
    for (const [table, rows] of Object.entries(record(backup.supabaseData))) {
      if (EXCLUDED_TABLES.includes(table)) { prepared.ignored = true; continue; }
      if (!hasOwn(PORTABLE_TABLES, table) || !Array.isArray(rows) || rows.length > 10000) throw new Error('Unsupported backup table');
      if (table !== SEARCH_TABLE && rows.length > 1) throw new Error('Duplicate singleton rows');
      prepared.supabaseData[table] = rows.map(row => portableRow(table, row));
    }
  }
  if (backup.localData !== undefined) {
    for (const [key, value] of Object.entries(record(backup.localData))) {
      if (isPortableLocalKey(key)) prepared.localData[key] = value;
      else prepared.ignored = true;
    }
  }
  return prepared;
}

export async function exportPortableData(client: BackupClient, userId: string): Promise<Record<string, Row[]>> {
  if (!userId) throw new Error('Authentication required');
  const exported: Record<string, Row[]> = {};
  for (const [table, columns] of Object.entries(PORTABLE_TABLES)) {
    const rows: Row[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await client.read(table, columns, userId, offset);
      if (result.error || !Array.isArray(result.data)) throw new Error('Backup read failed');
      rows.push(...result.data.map(row => portableRow(table, row)));
      if (rows.length > 10000) throw new Error('Backup exceeds supported size');
      if (result.data.length < 1000) break;
    }
    exported[table] = rows;
  }
  return exported;
}

async function restoreSingleton(client: BackupClient, table: string, userId: string, row: Row) {
  if (!Object.keys(row).length) return;
  // INSERT ON CONFLICT would also UPDATE user_id, forbidden by migration 007.
  // UPDATE only portable columns; INSERT ownership only if the row is missing.
  const update = () => client.update(table, row, userId);
  const result = await update();
  if (result.error || !Array.isArray(result.data) || result.data.length > 1) throw new Error('Backup update failed');
  if (result.data.length === 1) return;
  const inserted = await client.insert(table, { ...row, user_id: userId });
  if (!inserted.error) return;
  // One bounded retry if another writer inserted this singleton concurrently.
  if ((inserted.error as { code?: string }).code === '23505') {
    const retry = await update();
    if (!retry.error && Array.isArray(retry.data) && retry.data.length === 1) return;
  }
  throw new Error('Backup insert failed');
}

// Live writers reject unknown fields; legacy backups deliberately strip them.
export async function saveNotificationPreferences(client: BackupClient, userId: string, value: unknown): Promise<void> {
  const source = record(value);
  if (!userId || !Object.keys(source).length || Object.keys(source).some(key => !PORTABLE_TABLES[PREFERENCES_TABLE].includes(key))) {
    throw new Error('Invalid notification preferences');
  }
  await restoreSingleton(client, PREFERENCES_TABLE, userId, portableRow(PREFERENCES_TABLE, source));
}

export async function restorePortableData(client: BackupClient, userId: string, input: unknown, storage: Pick<Storage, 'setItem'>): Promise<{ ignored: boolean }> {
  if (!userId) throw new Error('Authentication required');
  const backup = prepareBackup(input); // Validate everything before the first mutation.
  for (const [table, rows] of Object.entries(backup.supabaseData)) {
    if (table === SEARCH_TABLE) {
      if ((await client.remove(table, userId)).error) throw new Error('Backup delete failed');
      if (rows.length && (await client.insert(table, rows.map(row => ({ ...row, user_id: userId })))).error) throw new Error('Backup insert failed');
    } else if (rows.length) await restoreSingleton(client, table, userId, rows[0]);
  }
  // Failed SQL cannot be followed by a local success or page reload. Separate
  // HTTP/storage operations are not atomic; the UI must disclose partial failure.
  for (const [key, value] of Object.entries(backup.localData)) {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return { ignored: backup.ignored };
}
