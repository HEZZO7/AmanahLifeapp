/**
 * FamilyBudget server sync - Phase B step 1 (dual-write).
 *
 * The screen still READS from local storage. This module additionally mirrors
 * every change to Supabase so server-side data starts accumulating and can be
 * verified before reads are flipped over in step 2. Nothing here is allowed to
 * affect what the user sees: every server call is best-effort and failures are
 * swallowed (and reported via the returned status) rather than surfaced.
 *
 * Two things this module also fixes on the way past:
 *
 * 1. The local key was NOT user-scoped on web ('amanah_family_budget', read
 *    with no reference to who is signed in), while RN scopes it per account
 *    via src/lib/userStorage.ts. On a shared browser that meant account B saw
 *    and could overwrite account A's family budget. Keys are now scoped the
 *    same way RN does it: `amanah_family_budget:<user.id>`.
 *
 * 2. Because of (1), a pre-existing unscoped blob has no owner recorded
 *    anywhere - nothing in it identifies which account entered it. It holds
 *    real salary and expense figures, so it is NOT auto-claimed by whoever
 *    happens to sign in first; the screen asks, and only migrates on an
 *    explicit yes. See claimLegacyBlob / declineLegacyBlob.
 */
import { supabase } from './supabase';

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
}

export interface BudgetCategory {
  name: string;
  nameAr: string;
  icon: string;
  budgeted: number;
  actual: number;
}

export interface IncomeEntry {
  id: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
}

export interface ExpenseEntry {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
}

export interface FamilyBudgetData {
  members: FamilyMember[];
  annualGoals: { hajj: number; education: number; emergency: number; savings: number };
  monthlyBudget: number;
  categories: BudgetCategory[];
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
}

/**
 * Conversion rates to the app's base currency (SAR).
 *
 * Deliberately still hardcoded and client-side, matching the pre-migration
 * behaviour exactly. A real app_11941c8fec_exchange_rates table exists and is
 * unused here; wiring it up is a separate follow-up, at which point
 * amount_base becomes server-computed and this constant goes away.
 */
export const RATES: Record<string, number> = { SAR: 1, USD: 3.75, EUR: 4.05, GBP: 4.72 };

export const toBase = (amount: number, currency: string): number =>
  amount * (RATES[currency] || 1);

const LEGACY_KEY = 'amanah_family_budget';
const scopedKey = (userId: string | null) => `${LEGACY_KEY}:${userId ?? 'guest'}`;
const declinedKey = (userId: string | null) => `${LEGACY_KEY}:legacy_declined:${userId ?? 'guest'}`;

// ---------------------------------------------------------------------------
// Local storage (still the read source during Phase B step 1)
// ---------------------------------------------------------------------------

export function readLocal(userId: string | null): FamilyBudgetData | null {
  try {
    const raw = localStorage.getItem(scopedKey(userId));
    return raw ? (JSON.parse(raw) as FamilyBudgetData) : null;
  } catch {
    return null;
  }
}

export function writeLocal(userId: string | null, data: FamilyBudgetData): void {
  try {
    localStorage.setItem(scopedKey(userId), JSON.stringify(data));
  } catch {
    /* quota or private mode - nothing useful to do here */
  }
}

// ---------------------------------------------------------------------------
// Legacy unscoped blob: ask, never assume
// ---------------------------------------------------------------------------

/** True when an unscoped blob exists and this user has neither claimed nor declined it. */
export function hasUnclaimedLegacyBlob(userId: string | null): boolean {
  try {
    if (!localStorage.getItem(LEGACY_KEY)) return false;
    if (localStorage.getItem(declinedKey(userId))) return false;
    // If this user already has their own scoped data, the legacy blob is not
    // theirs to inherit - don't offer to overwrite what they already have.
    if (localStorage.getItem(scopedKey(userId))) return false;
    return true;
  } catch {
    return false;
  }
}

/** Summary shown in the confirmation prompt so the user can recognise their own data. */
export function describeLegacyBlob(): { members: number; income: number; expenses: number } | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as FamilyBudgetData;
    return {
      members: d.members?.length ?? 0,
      income: d.income?.length ?? 0,
      expenses: d.expenses?.length ?? 0,
    };
  } catch {
    return null;
  }
}

/** User confirmed the blob is theirs: move it under their scoped key and stop offering it. */
export function claimLegacyBlob(userId: string | null): FamilyBudgetData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    localStorage.setItem(scopedKey(userId), raw);
    localStorage.removeItem(LEGACY_KEY);
    return JSON.parse(raw) as FamilyBudgetData;
  } catch {
    return null;
  }
}

/**
 * User said it isn't theirs. The blob is left untouched so its real owner can
 * still claim it on their next sign-in; we only record that THIS user declined.
 */
export function declineLegacyBlob(userId: string | null): void {
  try {
    localStorage.setItem(declinedKey(userId), '1');
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Server mirror
// ---------------------------------------------------------------------------

export type MirrorResult = { ok: true; familyId: string } | { ok: false; error: string };

/**
 * Find the family this user belongs to, creating one if they have none.
 *
 * KNOWN SIMPLIFICATION: nothing in the schema stops a user belonging to
 * several families, but this client assumes exactly one and picks the family
 * they own, else their first membership. If multi-family support is ever
 * needed, this function and the callers that assume a single familyId are
 * where to start - the ambiguity is deliberate and recorded, not overlooked.
 */
async function ensureFamily(userId: string): Promise<string> {
  const { data: owned, error: ownedErr } = await supabase
    .from('app_11941c8fec_families')
    .select('id')
    .eq('owner_user_id', userId)
    .limit(1);
  if (ownedErr) throw ownedErr;
  if (owned && owned.length) return owned[0].id as string;

  const { data: memberships, error: memErr } = await supabase
    .from('app_11941c8fec_family_members')
    .select('family_id')
    .eq('user_id', userId)
    .limit(1);
  if (memErr) throw memErr;
  if (memberships && memberships.length) return memberships[0].family_id as string;

  const { data: created, error: createErr } = await supabase
    .from('app_11941c8fec_families')
    .insert({ owner_user_id: userId, name: 'My Family' })
    .select('id')
    .single();
  if (createErr) throw createErr;
  return created.id as string;
}

/**
 * Mirror the whole local blob to the server. Safe to call repeatedly: every
 * write is an upsert keyed on something stable (family_id for settings,
 * name for categories, local_id for income/expense rows), so a retry or a
 * second tab cannot duplicate anything.
 */
export async function mirrorToServer(
  userId: string | null,
  data: FamilyBudgetData
): Promise<MirrorResult> {
  if (!userId) return { ok: false, error: 'not signed in' };

  try {
    const familyId = await ensureFamily(userId);

    const settings = supabase
      .from('app_11941c8fec_family_budget_settings')
      .upsert(
        {
          family_id: familyId,
          monthly_budget: data.monthlyBudget,
          goal_hajj: data.annualGoals?.hajj ?? 0,
          goal_education: data.annualGoals?.education ?? 0,
          goal_emergency: data.annualGoals?.emergency ?? 0,
          goal_savings: data.annualGoals?.savings ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'family_id' }
      );

    const categories = data.categories?.length
      ? supabase.from('app_11941c8fec_family_budget_categories').upsert(
          data.categories.map((c, i) => ({
            family_id: familyId,
            name: c.name,
            name_ar: c.nameAr,
            icon: c.icon,
            budgeted: c.budgeted,
            sort_order: i,
          })),
          { onConflict: 'family_id,name' }
        )
      : null;

    // `actual` is intentionally not sent - it is derived server-side from the
    // expense rows by app_11941c8fec_family_category_spend.

    const income = data.income?.length
      ? supabase.from('app_11941c8fec_family_income').upsert(
          data.income.map((e) => ({
            family_id: familyId,
            local_id: e.id,
            source: e.source,
            amount: e.amount,
            currency: e.currency,
            amount_base: toBase(e.amount, e.currency),
            entry_date: e.date,
            created_by: userId,
          })),
          { onConflict: 'family_id,local_id' }
        )
      : null;

    const expenses = data.expenses?.length
      ? supabase.from('app_11941c8fec_family_expenses').upsert(
          data.expenses.map((e) => ({
            family_id: familyId,
            local_id: e.id,
            category: e.category,
            description: e.description,
            amount: e.amount,
            currency: e.currency,
            amount_base: toBase(e.amount, e.currency),
            entry_date: e.date,
            created_by: userId,
          })),
          { onConflict: 'family_id,local_id' }
        )
      : null;

    const results = await Promise.all(
      [settings, categories, income, expenses].filter(Boolean) as Promise<{ error: unknown }>[]
    );
    const failed = results.find((r) => r && (r as { error?: unknown }).error);
    if (failed) {
      const err = (failed as { error: { message?: string } }).error;
      return { ok: false, error: err?.message ?? 'unknown server error' };
    }

    return { ok: true, familyId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
