/**
 * Local, offline Islamic prayer-time calculation using adhan (batoulapps/
 * adhan-js) - replaces the Aladhan API fetch this app used to depend on
 * for every prayer time and every Suhoor/Iftar reminder (Phase B,
 * 2026-08-02; mirrors the same module in the amanahlife-rn repo).
 *
 * Umm al-Qura is the default calculation method - this app's actual
 * primary target markets are Saudi Arabia/UAE/Qatar/Egypt/Kuwait/Iraq, not
 * North America, so the previously-hardcoded method=2 (ISNA) default was
 * wrong for this app's own audience. All 13 methods adhan-js supports are
 * exposed so the user can still pick a different one.
 *
 * Time-zone correctness: adhan-js's PrayerTimes returns absolute instants
 * (UTC-backed Date objects) - correct regardless of any time zone. To
 * display them as local "HH:mm" for the coordinate in question (not the
 * browser's own time zone, which matters once manual city selection lets a
 * user pick a city in a different zone than where they physically are),
 * this looks up the coordinate's real IANA zone via tz-lookup and formats
 * through Intl.DateTimeFormat rather than Date.getHours()/getMinutes()
 * (which would silently use the browser's zone instead).
 */
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan';
import tzlookup from 'tz-lookup';

export type CalculationMethodKey =
  | 'UmmAlQura' | 'Egyptian' | 'Karachi' | 'MuslimWorldLeague' | 'Dubai'
  | 'Qatar' | 'Kuwait' | 'MoonsightingCommittee' | 'NorthAmerica'
  | 'Singapore' | 'Tehran' | 'Turkey' | 'Other';

export const DEFAULT_CALCULATION_METHOD: CalculationMethodKey = 'UmmAlQura';

export interface CalculationMethodInfo {
  key: CalculationMethodKey;
  labelEn: string;
  labelAr: string;
}

// Ordered with the app's actual target markets first (Gulf/MENA), matching
// the "sensible regional default" instruction rather than an alphabetical
// or North-America-first list.
export const CALCULATION_METHODS: CalculationMethodInfo[] = [
  { key: 'UmmAlQura', labelEn: 'Umm al-Qura University, Makkah', labelAr: 'جامعة أم القرى، مكة المكرمة' },
  { key: 'Qatar', labelEn: 'Qatar', labelAr: 'قطر' },
  { key: 'Dubai', labelEn: 'Dubai, UAE', labelAr: 'دبي، الإمارات' },
  { key: 'Kuwait', labelEn: 'Kuwait', labelAr: 'الكويت' },
  { key: 'Egyptian', labelEn: 'Egyptian General Authority of Survey', labelAr: 'الهيئة المصرية العامة للمساحة' },
  { key: 'Karachi', labelEn: 'University of Islamic Sciences, Karachi', labelAr: 'جامعة العلوم الإسلامية، كراتشي' },
  { key: 'MuslimWorldLeague', labelEn: 'Muslim World League', labelAr: 'رابطة العالم الإسلامي' },
  { key: 'NorthAmerica', labelEn: 'Islamic Society of North America (ISNA)', labelAr: 'الجمعية الإسلامية لأمريكا الشمالية' },
  { key: 'MoonsightingCommittee', labelEn: 'Moonsighting Committee', labelAr: 'لجنة تحري الأهلة' },
  { key: 'Singapore', labelEn: 'Singapore', labelAr: 'سنغافورة' },
  { key: 'Turkey', labelEn: 'Turkey (Diyanet)', labelAr: 'تركيا (ديانت)' },
  { key: 'Tehran', labelEn: 'Tehran, Institute of Geophysics', labelAr: 'طهران، معهد الجيوفيزياء' },
  { key: 'Other', labelEn: 'Other (0° angles, custom)', labelAr: 'أخرى (مخصص)' },
];

export interface PrayerTimingsResult {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  timezone: string;
}

function getCalculationParameters(method: CalculationMethodKey) {
  return CalculationMethod[method]();
}

function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function resolveTimezone(latitude: number, longitude: number): string {
  try {
    return tzlookup(latitude, longitude);
  } catch {
    return 'UTC';
  }
}

/** Compute all 5 daily prayer times (+ sunrise) for one date/location/method. */
export function calculatePrayerTimes(
  latitude: number,
  longitude: number,
  date: Date,
  method: CalculationMethodKey = DEFAULT_CALCULATION_METHOD
): PrayerTimingsResult {
  const coordinates = new Coordinates(latitude, longitude);
  const params = getCalculationParameters(method);
  const times = new PrayerTimes(coordinates, date, params);
  const timezone = resolveTimezone(latitude, longitude);
  return {
    Fajr: formatInZone(times.fajr, timezone),
    Sunrise: formatInZone(times.sunrise, timezone),
    Dhuhr: formatInZone(times.dhuhr, timezone),
    Asr: formatInZone(times.asr, timezone),
    Maghrib: formatInZone(times.maghrib, timezone),
    Isha: formatInZone(times.isha, timezone),
    timezone,
  };
}

/**
 * Compute prayer times for every day of a given month - mirrors the old
 * Aladhan /calendar endpoint's batching so a multi-day scheduler doesn't
 * need one calculation call per day. Purely local math, so unlike the old
 * fetch this cannot fail.
 */
export function calculatePrayerTimesForMonth(
  latitude: number,
  longitude: number,
  year: number,
  month: number, // 1-12
  method: CalculationMethodKey = DEFAULT_CALCULATION_METHOD
): Map<number, PrayerTimingsResult> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result = new Map<number, PrayerTimingsResult>();
  for (let day = 1; day <= daysInMonth; day++) {
    result.set(day, calculatePrayerTimes(latitude, longitude, new Date(year, month - 1, day), method));
  }
  return result;
}
