import { supabase } from './supabase';

function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1000;
type BillMirror = { user_id: string; local_id: string; name: string; due_date: string; is_paid: boolean };
type GoalMirror = { user_id: string; local_id: string; title: string; target_date: string; status: string };

// Local-first content remains local if sync fails. No notification credentials,
// ownership overrides or scheduler markers are accepted from stored rows.
export async function syncReminderMirror(kind: 'bill' | 'goal', input: unknown, expectedUser: string | undefined): Promise<boolean> {
  if (!expectedUser || !Array.isArray(input) || input.length > 1000) return false;
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session || session.user.id !== expectedUser) return false;
    const rows = input.flatMap<BillMirror | GoalMirror>(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid reminder');
      const row = value as Record<string, unknown>;
      if (!text(row.id)) throw Error('Invalid reminder');
      if (kind === 'bill') {
        if (!text(row.name) || !date(row.dueDate) || typeof row.isPaid !== 'boolean') throw Error('Invalid bill');
        return [{ user_id: session.user.id, local_id: row.id, name: row.name, due_date: row.dueDate, is_paid: row.isPaid }];
      }
      if (!row.targetDate) return [];
      if (!text(row.title) || !date(row.targetDate) || typeof row.status !== 'string' || !['Active', 'Completed', 'Paused'].includes(row.status)) throw Error('Invalid goal');
      return [{ user_id: session.user.id, local_id: row.id, title: row.title, target_date: row.targetDate, status: row.status }];
    });
    const table = kind === 'bill' ? 'app_11941c8fec_bill_reminders_sync' : 'app_11941c8fec_goal_reminders_sync';
    if ((await supabase.from(table).delete().eq('user_id', session.user.id)).error) return false;
    if (rows.length && (await supabase.from(table).insert(rows)).error) return false;
    return true;
  } catch { return false; }
}
