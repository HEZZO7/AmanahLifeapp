import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type SubscriptionTier = 'free' | 'balanced' | 'family';
type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'expired' | 'paused';
type BillingCycle = 'monthly' | 'yearly';
type PaymentProvider = 'stripe' | 'lemonsqueezy' | 'paddle';

// Statuses that still grant access to a paid tier. 'past_due' is included
// deliberately — a payment retry is in flight, and cutting off a paying
// customer mid-retry is hostile. 'canceled', 'expired', and 'paused' are not
// entitling: without this, a canceled/expired row whose `tier` column still
// says 'family' would keep granting family access forever, since nothing
// else in this file ever reads `status`.
const ENTITLING_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(['active', 'past_due']);

// Local cache of the trial start date, used only to render an instant,
// optimistic value while fetchSubscription's network call is in flight.
// The server's `trial_started_at`/`trial_used` columns (subscriptions
// table) are the actual source of truth - see RN's SubscriptionContext.tsx
// (supabase/migrations/20260720000000_add_trial_columns.sql) for the same
// pattern this ports. Trial state used to live ONLY in this localStorage
// key, which meant clearing site data reset the trial indefinitely; that's
// now impossible since startTrial() checks the server before granting
// anything.
const TRIAL_KEY = 'amanah-trial-start';
const TRIAL_DURATION_DAYS = 7;

function computeTrialState(trialStartedAt: string | null): { isTrialActive: boolean; trialDaysRemaining: number } {
  if (!trialStartedAt) return { isTrialActive: false, trialDaysRemaining: 0 };
  const diffDays = Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / (1000 * 60 * 60 * 24));
  const remaining = TRIAL_DURATION_DAYS - diffDays;
  return { isTrialActive: remaining > 0, trialDaysRemaining: Math.max(0, remaining) };
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  paymentProvider: PaymentProvider;
  loading: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialUsed: boolean;
  startTrial: () => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('stripe');
  const [loading, setLoading] = useState(true);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialUsed, setTrialUsed] = useState(false);

  // Fast, optimistic read from the local cache so the UI has a sensible
  // value immediately on load - corrected by fetchSubscription's server
  // read the moment the network responds.
  useEffect(() => {
    const cached = localStorage.getItem(TRIAL_KEY);
    const computed = computeTrialState(cached);
    setIsTrialActive(computed.isTrialActive);
    setTrialDaysRemaining(computed.trialDaysRemaining);
  }, []);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setTier('free');
      setStatus('active');
      setBillingCycle('monthly');
      setPaymentProvider('stripe');
      setIsTrialActive(false);
      setTrialDaysRemaining(0);
      setTrialUsed(false);
      setLoading(false);
      localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly', provider: 'stripe' }));
      return;
    }

    setLoading(true);
    try {
      // Fetch by user_id only (not filtered to status='active') so a
      // canceled/expired/paused row is still seen and can correctly reset
      // the tier to free below, instead of silently returning no row and
      // leaving whatever tier was last fetched stuck in state.
      const { data, error } = await supabase
        .from('app_11941c8fec_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        // No subscription record found - default to free
        setTier('free');
        setStatus('active');
        setBillingCycle('monthly');
        setPaymentProvider('stripe');
        setIsTrialActive(false);
        setTrialDaysRemaining(0);
        setTrialUsed(false);
        localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly', provider: 'stripe' }));
      } else {
        const fetchedTier = (data.tier as SubscriptionTier) || 'free';
        const fetchedStatus = (data.status as SubscriptionStatus) || 'active';
        const fetchedBilling = (data.billing_cycle as BillingCycle) || 'monthly';
        const fetchedProvider = (data.payment_provider as PaymentProvider) || 'stripe';
        setTier(fetchedTier);
        setStatus(fetchedStatus);
        setBillingCycle(fetchedBilling);
        setPaymentProvider(fetchedProvider);
        setTrialUsed(!!data.trial_used);
        const computed = computeTrialState(data.trial_started_at ?? null);
        setIsTrialActive(computed.isTrialActive);
        setTrialDaysRemaining(computed.trialDaysRemaining);
        // Server is authoritative - keep the local cache in sync with it
        // purely so the next page load has an instant value to show.
        if (data.trial_started_at) localStorage.setItem(TRIAL_KEY, data.trial_started_at);
        else localStorage.removeItem(TRIAL_KEY);
        localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: fetchedTier, billing: fetchedBilling, provider: fetchedProvider }));
      }
    } catch {
      // Network failed - free tier fallback for tier/status, but leave
      // whatever the optimistic local-cache effect already computed for
      // trial state rather than resetting it to inactive while offline.
      setTier('free');
      setStatus('active');
      setBillingCycle('monthly');
      setPaymentProvider('stripe');
      localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly', provider: 'stripe' }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    try {
      fetchSubscription();
    } catch {
      // Silently handle - defaults are already set
      setLoading(false);
    }
  }, [fetchSubscription]);

  const startTrial = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'not_signed_in' };
    try {
      // Check the server fresh - not whatever's currently in local state -
      // so a stale render can't grant a second trial.
      const { data: existing } = await supabase
        .from('app_11941c8fec_subscriptions')
        .select('trial_used')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing?.trial_used) {
        setTrialUsed(true);
        return { error: 'trial_already_used' };
      }

      const startedAt = new Date().toISOString();
      const { error } = await supabase
        .from('app_11941c8fec_subscriptions')
        .upsert({ user_id: user.id, trial_started_at: startedAt, trial_used: true }, { onConflict: 'user_id' });

      if (error) return { error: error.message };

      localStorage.setItem(TRIAL_KEY, startedAt);
      setTrialUsed(true);
      setIsTrialActive(true);
      setTrialDaysRemaining(TRIAL_DURATION_DAYS);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'unknown_error' };
    }
  };

  // Effective tier: if trial is active and DB tier is free, treat as balanced.
  // Otherwise, only grant the DB tier when status is actually entitling —
  // a canceled/expired/paused subscription falls back to free regardless of
  // what `tier` still says, until the row is updated by a payment webhook.
  const isEntitled = ENTITLING_STATUSES.has(status);
  const effectiveTier: SubscriptionTier =
    tier === 'free' && isTrialActive ? 'balanced' : isEntitled ? tier : 'free';

  return (
    <SubscriptionContext.Provider value={{
      tier: effectiveTier,
      status,
      billingCycle,
      paymentProvider,
      loading,
      isTrialActive,
      trialDaysRemaining,
      trialUsed,
      startTrial,
      refetch: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

const defaultSubscription: SubscriptionContextType = {
  tier: 'free',
  status: 'active',
  billingCycle: 'monthly',
  paymentProvider: 'stripe',
  loading: false,
  isTrialActive: false,
  trialDaysRemaining: 0,
  trialUsed: false,
  startTrial: async () => ({ error: 'not_available' }),
  refetch: async () => {},
};

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    // Return safe defaults instead of throwing - prevents blank page crashes
    return defaultSubscription;
  }
  return context;
}