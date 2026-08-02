/**
 * Local Hijri date calculation - no network call.
 *
 * Replaces the previous `fetch('https://api.aladhan.com/v1/gToH/...')` call,
 * which made the dashboard's date badge depend on network latency (slow or
 * missing entirely on a poor/offline connection - the exact bug this fixes).
 *
 * Implements the standard tabular ("civil") Islamic calendar via Julian Day
 * Number conversion (the algorithm published in Reingold & Dershowitz,
 * "Calendrical Calculations" - the reference implementation many Hijri
 * conversion libraries are based on). Verified against the standard test
 * reference for this exact algorithm: 1 January 2000 CE = 24 Ramadan 1420 AH.
 *
 * IMPORTANT LIMITATION: this is a *computed* civil calendar, not a
 * moonsighting-based one. Real Hijri months begin on lunar crescent
 * observation, which varies by up to a day or two across regions/methods -
 * the same limitation every offline/computed Hijri date has (there is no
 * way to compute an observation ahead of time). For religiously significant
 * dates (start of Ramadan, Eid), a user's local moonsighting announcement
 * is the authority, not this calculation - this is presented as a
 * best-effort calendar reference, same as any offline Islamic calendar app.
 */

const ISLAMIC_EPOCH = 1948439.5;
const GREGORIAN_EPOCH = 1721425.5;

function isLeapGregorian(year: number): boolean {
  return year % 4 === 0 && !(year % 100 === 0 && year % 400 !== 0);
}

function gregorianToJd(year: number, month: number, day: number): number {
  return (
    GREGORIAN_EPOCH -
    1 +
    365 * (year - 1) +
    Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) +
    Math.floor((year - 1) / 400) +
    Math.floor((367 * month - 362) / 12) +
    (month <= 2 ? 0 : isLeapGregorian(year) ? -1 : -2) +
    day
  );
}

function islamicToJd(year: number, month: number, day: number): number {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    ISLAMIC_EPOCH -
    1
  );
}

function jdToIslamic(jd: number): [number, number, number] {
  jd = Math.floor(jd) + 0.5;
  const year = Math.floor((30 * (jd - ISLAMIC_EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jd - (29 + islamicToJd(year, 1, 1))) / 29.5) + 1);
  const day = jd - islamicToJd(year, month, 1) + 1;
  return [year, month, Math.round(day)];
}

export interface HijriDate {
  day: number;
  month: number; // 1-12
  year: number;
}

export function gregorianToHijri(date: Date): HijriDate {
  const jd = gregorianToJd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const [year, month, day] = jdToIslamic(jd);
  return { day, month, year };
}

const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani",
  'Jumada al-awwal', 'Jumada al-thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];
const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Converts a non-negative integer's decimal digits to Arabic-Indic numerals. */
export function toArabicIndicNumerals(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

export function hijriMonthName(month: number, isAr: boolean): string {
  return isAr ? HIJRI_MONTHS_AR[month - 1] : HIJRI_MONTHS_EN[month - 1];
}

/** "19 صفر 1448 هـ" (Arabic script month, Arabic-Indic numerals) or "19 Safar 1448 AH". */
export function formatHijri(h: HijriDate, isAr: boolean): string {
  const monthName = hijriMonthName(h.month, isAr);
  if (isAr) {
    return `${toArabicIndicNumerals(h.day)} ${monthName} ${toArabicIndicNumerals(h.year)} هـ`;
  }
  return `${h.day} ${monthName} ${h.year} AH`;
}

const GREGORIAN_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const GREGORIAN_MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/** "2 أغسطس 2026" or "August 2, 2026". */
export function formatGregorian(date: Date, isAr: boolean): string {
  const day = date.getDate();
  const month = isAr ? GREGORIAN_MONTHS_AR[date.getMonth()] : GREGORIAN_MONTHS_EN[date.getMonth()];
  const year = date.getFullYear();
  if (isAr) {
    return `${toArabicIndicNumerals(day)} ${month} ${toArabicIndicNumerals(year)}`;
  }
  return `${month} ${day}, ${year}`;
}
