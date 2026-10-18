// Column contract for safe preference backup/restore, paired with migration 007.
// Server/RLS still authorizes identity; this helper never restores registrations.
import { preferenceKeys, sanitizePatch } from './notificationPreferenceClient';
export const notificationBackupColumns = [
  ...preferenceKeys, 'timezone', 'language', 'prayer_calc_method',
  'prayer_location_mode', 'prayer_manual_city',
] as const;
export function notificationRestoreRow(raw: unknown, userId: string): Record<string, unknown> {
  if (!userId || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid preferences backup');
  const source = raw as Record<string, unknown>;
  let patch: Record<string, unknown> = {};
  try { patch = sanitizePatch(source); } catch { /* A location-only backup is valid. */ }
  for (const key of ['timezone', 'language', 'prayer_calc_method'] as const) {
    if (typeof source[key] === 'string' && source[key].length > 0 && source[key].length <= 100) patch[key] = source[key];
  }
  if (source.prayer_location_mode === 'auto' || source.prayer_location_mode === 'manual') patch.prayer_location_mode = source.prayer_location_mode;
  const city = source.prayer_manual_city;
  if (city === null) patch.prayer_manual_city = null;
  else if (city && typeof city === 'object' && !Array.isArray(city)) {
    const c = city as Record<string, unknown>;
    if (['name', 'nameAr', 'country', 'countryCode'].every(key => typeof c[key] === 'string' && (c[key] as string).length <= 200)
      && typeof c.lat === 'number' && Number.isFinite(c.lat) && Math.abs(c.lat) <= 90
      && typeof c.lon === 'number' && Number.isFinite(c.lon) && Math.abs(c.lon) <= 180) {
      patch.prayer_manual_city = { name: c.name, nameAr: c.nameAr, country: c.country, countryCode: c.countryCode, lat: c.lat, lon: c.lon };
    }
  }
  if (!Object.keys(patch).length) throw new Error('No valid preferences to restore');
  return { ...patch, user_id: userId };
}

