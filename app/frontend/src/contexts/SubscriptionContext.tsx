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

const TRIAL_KEY = 'amanah-trial-start';
const TRIAL_DURATION_DAYS = 7;

function getTrialInfo(): { isTrialActive: boolean; trialDaysRemaining: number } {
  const trialStart = localStorage.getItem(TRIAL_KEY);
  if (!trialStart) {
    return { isTrialActive: false, trialDaysRemaining: 0 };
  }
  const startDate = new Date(trialStart);
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remaining = TRIAL_DURATION_DAYS - diffDays;

  if (remaining <= 0) {
    return { isTrialActive: false, trialDaysRemaining: 0 };
  }
  return { isTrialActive: true, trialDaysRemaining: remaining };
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  paymentProvider: PaymentProvider;
  loading: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  startTrial: () => void;
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
  const [trialState, setTrialState] = useState(getTrialInfo);

  const startTrial = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(TRIAL_KEY, now);
    setTrialState({ isTrialActive: true, trialDaysRemaining: TRIAL_DURATION_DAYS });
  }, []);

  // Recalculate trial on mount and periodically
  useEffect(() => {
    setTrialState(getTrialInfo());
    const interval = setInterval(() => {
      setTrialState(getTrialInfo());
    }, 60000); // check every minute
    return () => clearInterval(interval);
  }, []);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setTier('free');
      setStatus('active');
      setBillingCycle('monthly');
      setPaymentProvider('stripe');
      setLoading(false);
      localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly', provider: 'stripe' }));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_11941c8fec_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        // No subscription record found - default to free
        setTier('free');
        setStatus('active');
        setBillingCycle('monthly');
        setPaymentProvider('stripe');
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
        localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: fetchedTier, billing: fetchedBilling, provider: fetchedProvider }));
      }
    } catch {
      // On error, default to free
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

  // Effective tier: if trial is active and DB tier is free, treat as balanced.
  // Otherwise, only grant the DB tier when status is actually entitling —
  // a canceled/expired/paused subscription falls back to free regardless of
  // what `tier` still says, until the row is updated by a payment webhook.
  const isEntitled = ENTITLING_STATUSES.has(status);
  const effectiveTier: SubscriptionTier =
    tier === 'free' && trialState.isTrialActive ? 'balanced' : isEntitled ? tier : 'free';

  return (
    <SubscriptionContext.Provider value={{
      tier: effectiveTier,
      status,
      billingCycle,
      paymentProvider,
      loading,
      isTrialActive: trialState.isTrialActive,
      trialDaysRemaining: trialState.trialDaysRemaining,
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
  startTrial: () => {},
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