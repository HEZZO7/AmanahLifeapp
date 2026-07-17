export type TimeFormat = '12h' | '24h';

/** Formats an "HH:MM" (24h) string per the given format, e.g. "05:32" -> "5:32 AM" */
export function formatClockTime(hhmm: string, format: TimeFormat): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = (mStr ?? '00').padStart(2, '0');
  if (Number.isNaN(h)) return hhmm;
  if (format === '24h') return `${String(h).padStart(2, '0')}:${m}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

/** Detects the device's likely time format preference from its locale; defaults to 24h if undetectable. */
export function detectDefaultTimeFormat(): TimeFormat {
  try {
    const hour12 = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric' }).resolvedOptions().hour12;
    return hour12 ? '12h' : '24h';
  } catch {
    return '24h';
  }
}
