import { createClient } from 'npm:@supabase/supabase-js@2';
import { Coordinates, CalculationMethod, PrayerTimes } from 'npm:adhan@4';

/**
 * Cron-triggered (pg_cron -> pg_net, hourly) sweep that brings web's Bill
 * Payment, Habit & Goal, and Fasting reminder categories to real parity
 * with Android's expo-notifications scheduling. Not user-facing - guarded
 * by a shared internal secret, not JWT auth (see push_notify's
 * send_notification action for the other half of that check).
 *
 * Design mirrors Android's own scheduler exactly: re-derive "what's due"
 * from current state on every sweep (full-sweep rebuild, not one-shot
 * pre-computed triggers) rather than pre-scheduling future sends - see
 * notificationPreferences.ts on the RN side for the source of truth these
 * rules are ported from. Because this SENDS immediately rather than
 * scheduling a future OS-level trigger, each sweep must also record what it
 * already sent (the *_sent_at/*_sent_date columns) so the next hourly run
 * doesn't resend the same reminder while it's still "due".
 *
 * Savings Challenge is NOT swept here - it stays event-triggered from the
 * client (useSavingsNotifications.ts's celebrateMilestone), matching
 * Android's trigger:null "send now" pattern exactly.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- Hijri calendar (tabular/civil), ported verbatim from hijriDate.ts -
// same algorithm, same verified reference point (1 Jan 2000 CE = 24
// Ramadan 1420 AH). Only isRamadan() is needed here. ---
const ISLAMIC_EPOCH = 1948439.5;
const GREGORIAN_EPOCH = 1721425.5;

function isLeapGregorian(year: number): boolean {
  return year % 4 === 0 && !(year % 100 === 0 && year % 400 !== 0);
}
function gregorianToJd(year: number, month: number, day: number): number {
  return (
    GREGORIAN_EPOCH - 1 + 365 * (year - 1) + Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400) +
    Math.floor((367 * month - 362) / 12) +
    (month <= 2 ? 0 : isLeapGregorian(year) ? -1 : -2) + day
  );
}
function islamicToJd(year: number, month: number, day: number): number {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + ISLAMIC_EPOCH - 1;
}
function jdToIslamic(jd: number): [number, number, number] {
  jd = Math.floor(jd) + 0.5;
  const year = Math.floor((30 * (jd - ISLAMIC_EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jd - (29 + islamicToJd(year, 1, 1))) / 29.5) + 1);
  const day = jd - islamicToJd(year, month, 1) + 1;
  return [year, month, Math.round(day)];
}
function isRamadan(date: Date): boolean {
  const jd = gregorianToJd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const [, month] = jdToIslamic(jd);
  return month === 9;
}

const MECCA = { latitude: 21.4225, longitude: 39.8262 };
const SUHOOR_MINUTES_BEFORE_FAJR = 30;

/** Local wall-clock date (YYYY-MM-DD) and hour for a UTC instant, in a given IANA zone. */
function getLocalParts(date: Date, timeZone: string): { dateStr: string; hour: number } {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
        .formatToParts(date).map((p) => [p.type, p.value])
    );
  } catch {
    // Invalid/unknown IANA zone string - fall back to UTC rather than throw.
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
        .formatToParts(date).map((p) => [p.type, p.value])
    );
  }
  return { dateStr: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

async function sendPush(
  supabaseUrl: string,
  internalSecret: string,
  user_id: string,
  notification_type: string,
  title: string,
  body: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/app_11941c8fec_push_notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Push-Secret': internalSecret },
      body: JSON.stringify({ action: 'send_notification', user_id, notification_type, title, body }),
    });
  } catch (err) {
    console.error(JSON.stringify({ action: 'scheduler_send_error', user_id, notification_type, error: (err as Error)?.message }));
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const internalSecret = req.headers.get('X-Internal-Push-Secret');
  const expectedSecret = Deno.env.get('INTERNAL_PUSH_SECRET');
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const nowUtc = new Date();
  const stats = { billsChecked: 0, billsSent: 0, goalsChecked: 0, goalsSent: 0, fastingChecked: 0, fastingSent: 0 };

  const { data: prefsRows } = await supabase.from('app_11941c8fec_notification_preferences').select('*');
  const prefsByUser = new Map<string, any>((prefsRows || []).map((p: any) => [p.user_id, p]));

  // --- Bill sweep: 9am local on due_date, and 9am local the day before ---
  const { data: bills } = await supabase
    .from('app_11941c8fec_bill_reminders_sync')
    .select('*')
    .eq('is_paid', false);

  for (const bill of bills || []) {
    const pref = prefsByUser.get(bill.user_id);
    if (!pref || pref.bill_reminders === false) continue;
    const { dateStr: todayLocal, hour } = getLocalParts(nowUtc, pref.timezone || 'UTC');
    if (hour !== 9) continue;
    stats.billsChecked++;

    const isAr = pref.language === 'ar';
    if (bill.due_date === todayLocal && !bill.due_date_sent_at) {
      await sendPush(supabaseUrl, expectedSecret, bill.user_id, 'bill', isAr ? '💰 فاتورة مستحقة اليوم' : '💰 Bill due today',
        isAr ? `${bill.name} مستحقة الدفع اليوم` : `${bill.name} is due today`);
      await supabase.from('app_11941c8fec_bill_reminders_sync').update({ due_date_sent_at: nowUtc.toISOString() }).eq('id', bill.id);
      stats.billsSent++;
    }
    const { dateStr: tomorrowLocal } = getLocalParts(addDays(nowUtc, 1), pref.timezone || 'UTC');
    if (bill.due_date === tomorrowLocal && !bill.day_before_sent_at) {
      await sendPush(supabaseUrl, expectedSecret, bill.user_id, 'bill', isAr ? '💰 فاتورة مستحقة غداً' : '💰 Bill due tomorrow',
        isAr ? `${bill.name} مستحقة الدفع غداً` : `${bill.name} is due tomorrow`);
      await supabase.from('app_11941c8fec_bill_reminders_sync').update({ day_before_sent_at: nowUtc.toISOString() }).eq('id', bill.id);
      stats.billsSent++;
    }
  }

  // --- Goal sweep: 10am local on target_date, and 10am local 3 days before ---
  const { data: goals } = await supabase
    .from('app_11941c8fec_goal_reminders_sync')
    .select('*')
    .eq('status', 'Active');

  for (const goal of goals || []) {
    const pref = prefsByUser.get(goal.user_id);
    if (!pref || pref.habit_reminders === false) continue;
    const { dateStr: todayLocal, hour } = getLocalParts(nowUtc, pref.timezone || 'UTC');
    if (hour !== 10) continue;
    stats.goalsChecked++;

    const isAr = pref.language === 'ar';
    if (goal.target_date === todayLocal && !goal.target_date_sent_at) {
      await sendPush(supabaseUrl, expectedSecret, goal.user_id, 'habit', isAr ? '🎯 الهدف مستحق اليوم' : '🎯 Goal target reached today',
        isAr ? `اليوم هو الموعد المستهدف لـ "${goal.title}"` : `Today is the target date for "${goal.title}"`);
      await supabase.from('app_11941c8fec_goal_reminders_sync').update({ target_date_sent_at: nowUtc.toISOString() }).eq('id', goal.id);
      stats.goalsSent++;
    }
    const { dateStr: threeDaysLocal } = getLocalParts(addDays(nowUtc, 3), pref.timezone || 'UTC');
    if (goal.target_date === threeDaysLocal && !goal.three_day_sent_at) {
      await sendPush(supabaseUrl, expectedSecret, goal.user_id, 'habit', isAr ? '🎯 اقترب موعد الهدف' : '🎯 Goal target in 3 days',
        isAr ? `باقي 3 أيام على "${goal.title}"` : `3 days left for "${goal.title}"`);
      await supabase.from('app_11941c8fec_goal_reminders_sync').update({ three_day_sent_at: nowUtc.toISOString() }).eq('id', goal.id);
      stats.goalsSent++;
    }
  }

  // --- Fasting sweep: real Fajr-30min (Suhoor) / Maghrib (Iftar), local
  // calendar date's Hijri month must be Ramadan. Falls back to Mecca when
  // no manual city was ever synced - same fallback both platforms already
  // use elsewhere. Only manual-city location is server-reachable (GPS/
  // last-known have no server equivalent - see PROJECT.md). ---
  for (const [user_id, pref] of prefsByUser) {
    if (!pref || pref.fasting_reminders === false) continue;
    stats.fastingChecked++;

    const { dateStr: todayLocal } = getLocalParts(nowUtc, pref.timezone || 'UTC');
    const todayLocalDate = new Date(`${todayLocal}T12:00:00Z`); // midday avoids any date-boundary edge case in isRamadan's own Gregorian->JD math
    if (!isRamadan(todayLocalDate)) continue;

    let latitude = MECCA.latitude;
    let longitude = MECCA.longitude;
    if (pref.prayer_location_mode === 'manual' && pref.prayer_manual_city) {
      const city = pref.prayer_manual_city as { lat?: number; lon?: number };
      if (typeof city.lat === 'number' && typeof city.lon === 'number') {
        latitude = city.lat;
        longitude = city.lon;
      }
    }
    const methodKey = pref.prayer_calc_method && (CalculationMethod as any)[pref.prayer_calc_method] ? pref.prayer_calc_method : 'UmmAlQura';
    const params = (CalculationMethod as any)[methodKey]();
    const times = new PrayerTimes(new Coordinates(latitude, longitude), todayLocalDate, params);
    const suhoorTrigger = new Date(times.fajr.getTime() - SUHOOR_MINUTES_BEFORE_FAJR * 60000);
    const iftarTrigger = times.maghrib;
    const isAr = pref.language === 'ar';

    const justPassed = (trigger: Date) => nowUtc.getTime() >= trigger.getTime() && nowUtc.getTime() - trigger.getTime() < 3600000;

    if (pref.last_suhoor_sent_date !== todayLocal && justPassed(suhoorTrigger)) {
      await sendPush(supabaseUrl, expectedSecret, user_id, 'fasting', isAr ? '🌙 السحور' : '🌙 Suhoor',
        isAr ? `${SUHOOR_MINUTES_BEFORE_FAJR} دقيقة حتى الفجر` : `${SUHOOR_MINUTES_BEFORE_FAJR} minutes until Fajr`);
      await supabase.from('app_11941c8fec_notification_preferences').update({ last_suhoor_sent_date: todayLocal }).eq('user_id', user_id);
      stats.fastingSent++;
    }
    if (pref.last_iftar_sent_date !== todayLocal && justPassed(iftarTrigger)) {
      await sendPush(supabaseUrl, expectedSecret, user_id, 'fasting', isAr ? '🌇 الإفطار' : '🌇 Iftar',
        isAr ? 'حان وقت الإفطار' : 'It\'s time for Iftar');
      await supabase.from('app_11941c8fec_notification_preferences').update({ last_iftar_sent_date: todayLocal }).eq('user_id', user_id);
      stats.fastingSent++;
    }
  }

  console.log(JSON.stringify({ requestId, ...stats }));

  return new Response(JSON.stringify({ success: true, ...stats }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
