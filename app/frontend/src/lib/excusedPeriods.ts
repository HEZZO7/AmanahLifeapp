/**
 * Excused periods (عذر شرعي) for the prayer and fasting trackers - Phase C,
 * 2026-08-02. Mirrors amanahlife-rn's src/lib/excusedPeriods.ts exactly
 * (same fiqh mapping, same storage key names) - see that file's header for
 * the full explanation. This is the web/localStorage (synchronous) port.
 *
 * PRIVACY: device-local only. `excused_` keys deliberately don't match any
 * BackupRestore.tsx sweep pattern - see the explicit exclusion note there.
 */
import { getUserItem, setUserItem } from './userStorage';

export type ExcusedReason = 'menstruation' | 'nifas' | 'illness' | 'travel';

export interface ExcusedPeriod {
  id: string;
  reason: ExcusedReason;
  /** ISO date (YYYY-MM-DD), inclusive. */
  startDate: string;
  /** ISO date (YYYY-MM-DD), inclusive, or null if still ongoing. */
  endDate: string | null;
  /** Illness only - was the user genuinely unable to pray (not just permitted to shorten/combine)? */
  illnessIncapacitated?: boolean;
  /** Illness + illnessIncapacitated only - app takes no fiqh position; user chooses explicitly. */
  illnessPrayerChoice?: 'qada' | 'waived';
}

const PERIODS_KEY = 'excused_periods';
const QADA_FASTS_MADE_UP_KEY = 'excused_qada_fasts_made_up';
const QADA_PRAYERS_MADE_UP_KEY = 'excused_qada_prayers_made_up';
const DISCLAIMER_SEEN_KEY = 'excused_disclaimer_seen';

export function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isDateInRange(iso: string, startDate: string, endDate: string | null): boolean {
  if (iso < startDate) return false;
  if (endDate !== null && iso > endDate) return false;
  return true;
}

export function getExcusedPeriods(userId: string | null): ExcusedPeriod[] {
  const raw = getUserItem(PERIODS_KEY, userId);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function savePeriods(userId: string | null, periods: ExcusedPeriod[]): void {
  setUserItem(PERIODS_KEY, userId, JSON.stringify(periods));
}

export function addExcusedPeriod(userId: string | null, period: Omit<ExcusedPeriod, 'id'>): void {
  const periods = getExcusedPeriods(userId);
  periods.push({ ...period, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  savePeriods(userId, periods);
}

export function endExcusedPeriod(userId: string | null, id: string, endDate?: string): void {
  const periods = getExcusedPeriods(userId);
  const updated = periods.map((p) => (p.id === id ? { ...p, endDate: endDate || isoDate(new Date()) } : p));
  savePeriods(userId, updated);
}

export function deleteExcusedPeriod(userId: string | null, id: string): void {
  const periods = getExcusedPeriods(userId);
  savePeriods(userId, periods.filter((p) => p.id !== id));
}

/** Prayer is excused only for hayd/nifas, or illness explicitly marked incapacitated. */
export function isDateExcusedForPrayer(iso: string, periods: ExcusedPeriod[]): boolean {
  return periods.some((p) => {
    if (!isDateInRange(iso, p.startDate, p.endDate)) return false;
    if (p.reason === 'menstruation' || p.reason === 'nifas') return true;
    if (p.reason === 'illness' && p.illnessIncapacitated) return true;
    return false;
  });
}

/** Fasting is excused for all 4 reasons whenever a period covers the date. */
export function isDateExcusedForFasting(iso: string, periods: ExcusedPeriod[]): boolean {
  return periods.some((p) => isDateInRange(iso, p.startDate, p.endDate));
}

function eachDateInPeriod(period: ExcusedPeriod, todayIso: string): string[] {
  const end = period.endDate && period.endDate < todayIso ? period.endDate : todayIso;
  if (period.startDate > end) return [];
  const dates: string[] = [];
  const cursor = new Date(`${period.startDate}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    dates.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Days owed = excused-for-fasting days with no `fasting: true` record. Recomputed live, never independently incremented. */
export function computeFastingQadaOwed(userId: string | null): number {
  const periods = getExcusedPeriods(userId);
  const todayIso = isoDate(new Date());
  let owed = 0;
  for (const period of periods) {
    for (const iso of eachDateInPeriod(period, todayIso)) {
      const dateStr = new Date(`${iso}T00:00:00`).toDateString();
      const raw = getUserItem(`fasting_today_${dateStr}`, userId);
      const fasted = raw ? JSON.parse(raw).fasting === true : false;
      if (!fasted) owed++;
    }
  }
  return owed;
}

/** Owed prayer-instances (illness + incapacitated + qada choice only). */
export function computePrayerQadaOwed(userId: string | null): number {
  const periods = getExcusedPeriods(userId).filter(
    (p) => p.reason === 'illness' && p.illnessIncapacitated && p.illnessPrayerChoice === 'qada'
  );
  const todayIso = isoDate(new Date());
  let owed = 0;
  for (const period of periods) {
    for (const iso of eachDateInPeriod(period, todayIso)) {
      const dateStr = new Date(`${iso}T00:00:00`).toDateString();
      const raw = getUserItem(`prayer_completed_${dateStr}`, userId);
      const completedCount = raw ? (JSON.parse(raw) as unknown[]).length : 0;
      owed += Math.max(0, 5 - completedCount);
    }
  }
  return owed;
}

function getMadeUpCount(userId: string | null, key: string): number {
  const raw = getUserItem(key, userId);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function setMadeUpCount(userId: string | null, key: string, value: number): void {
  setUserItem(key, userId, String(Math.max(0, value)));
}

export function getFastingQadaMadeUp(userId: string | null): number {
  return getMadeUpCount(userId, QADA_FASTS_MADE_UP_KEY);
}
export function adjustFastingQadaMadeUp(userId: string | null, delta: number): number {
  const next = getFastingQadaMadeUp(userId) + delta;
  setMadeUpCount(userId, QADA_FASTS_MADE_UP_KEY, next);
  return Math.max(0, next);
}

export function getPrayerQadaMadeUp(userId: string | null): number {
  return getMadeUpCount(userId, QADA_PRAYERS_MADE_UP_KEY);
}
export function adjustPrayerQadaMadeUp(userId: string | null, delta: number): number {
  const next = getPrayerQadaMadeUp(userId) + delta;
  setMadeUpCount(userId, QADA_PRAYERS_MADE_UP_KEY, next);
  return Math.max(0, next);
}

export function hasSeenDisclaimer(userId: string | null): boolean {
  return getUserItem(DISCLAIMER_SEEN_KEY, userId) === 'true';
}
export function markDisclaimerSeen(userId: string | null): void {
  setUserItem(DISCLAIMER_SEEN_KEY, userId, 'true');
}

export const EXCUSED_REASON_LABELS: Record<ExcusedReason, { en: string; ar: string }> = {
  menstruation: { en: 'Menstruation', ar: 'حيض' },
  nifas: { en: 'Postpartum bleeding (nifas)', ar: 'نفاس' },
  illness: { en: 'Illness', ar: 'مرض' },
  travel: { en: 'Travel', ar: 'سفر' },
};

export const DISCLAIMER_TEXT = {
  en: "AmanahLife is a habit-tracking tool, not a source of religious rulings (fatwa). For genuine illness incapacity that prevents prayer, whether missed prayers require makeup (qada) or are waived depends on the duration and severity of the incapacity — general guidance from IslamWeb and mainstream Ahlus Sunnah wal Jama'ah sources reflects this. Please assess your own situation or consult a knowledgeable source; the app takes no position and accepts no responsibility for this determination.",
  ar: 'أمانة لايف أداة لتتبع العادات، وليست مصدرًا للفتاوى الشرعية. بالنسبة للمرض الذي يمنع أداء الصلاة فعليًا، فإن وجوب قضاء الصلوات الفائتة من عدمه يعتمد على مدة وشدة العجز — وهذا ما تعكسه الإرشادات العامة من مصادر مثل الإسلام ويب وآراء أهل السنة والجماعة السائدة. يرجى تقييم حالتك أو استشارة مصدر موثوق؛ التطبيق لا يتبنى موقفًا في هذه المسألة ولا يتحمل أي مسؤولية عن هذا التحديد.',
};
