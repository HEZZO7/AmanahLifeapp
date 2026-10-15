import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type SubscriptionTier = 'free' | 'balanced' | 'family';
type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'expired' | 'paused';
type BillingCycle = 'monthly' | 'yearly';
type PaymentProvider = 'lemonsqueezy' | 'paddle';

const TRIAL_DURATION_DAYS = 7;

function computeTrialState(trialStartedAt: string | null): { isTrialActive: boolean; trialDaysRemaining: number } {
  if (!trialStartedAt) return { isTrialActive: false, trialDaysRemaining: 0 };
  const diffDays = Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / (1000 * 60 * 60 * 24));
  const remaining = TRIAL_DURATION_DAYS - diffDays;
  return { isTrialActive: remaining > 0 && diffDays >= 0, trialDaysRemaining: Math.max(0, remaining) };
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  paymentProvider: PaymentProvider;
  // Conservative access end selected from confirmed private payment evidence.
  // This is not an expected renewal date or a claim about invoice service dates.
  // Null when no currently valid proof exists, including unverified legacy rows.
  currentPeriodEnd: string | null;
  hasSubscription: boolean;
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
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('lemonsqueezy');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [hasSubscription,setHasSubscription] = useState(false);
  const [recordUser, setRecordUser] = useState<string | null>(null);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const [paidFrom, setPaidFrom] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [hasBinding, setHasBinding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialUsed, setTrialUsed] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setRecordUser(null); setHasSubscription(false);
      setPaidUntil(null); setPaidFrom(null); setHasBinding(false); setRevoked(false);
      setTier('free');
      setStatus('active');
      setBillingCycle('monthly');
      setPaymentProvider('lemonsqueezy');
      setCurrentPeriodEnd(null);
      setIsTrialActive(false);
      setTrialDaysRemaining(0);
      setTrialUsed(false);
      setLoading(false);
      localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly', provider: 'lemonsqueezy' }));
      return;
    }

    setLoading(true);
    try {
      // The authenticated RPC derives identity and current entitlement on the server.
      // Raw legacy tier/status values are never sufficient evidence of payment.
      const { data, error } = await supabase.rpc('app_11941c8fec_current_subscription');

      if (error || !data) {
        setRecordUser(null); setHasSubscription(false); setPaidUntil(null); setPaidFrom(null); setHasBinding(false); setRevoked(false);
        // No subscription record found - default to free
        setTier('free');
        setStatus('active');
        setBillingCycle('monthly');
        setPaymentProvider('lemonsqueezy');
        setCurrentPeriodEnd(null);
        setIsTrialActive(false);
        setTrialDaysRemaining(0);
        setTrialUsed(false);
        localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly', provider: 'lemonsqueezy' }));
      } else {
        setRecordUser(user.id);
        setHasSubscription(data.has_private_binding === true);
        const fetchedTier = (data.tier as SubscriptionTier) || 'free';
        const fetchedStatus = (data.status as SubscriptionStatus) || 'active';
        const fetchedBilling = (data.billing_cycle as BillingCycle) || 'monthly';
        const fetchedProvider = (data.payment_provider as PaymentProvider) || 'lemonsqueezy';
        setTier(fetchedTier);
        setStatus(fetchedStatus);
        setBillingCycle(fetchedBilling);
        setPaymentProvider(fetchedProvider);
        setCurrentPeriodEnd(data.current_period_end ?? null);
        setTrialUsed(!!data.trial_used);
        setPaidUntil(data.paid_access_until ?? null);
        setPaidFrom(data.paid_access_from ?? null);
        setRevoked(!!data.entitlement_revoked_at);
        setHasBinding(!!data.lemonsqueezy_subscription_id);
        const computed = computeTrialState(data.entitlement_revoked_at ? null : data.trial_started_at ?? null);
        setIsTrialActive(computed.isTrialActive);
        setTrialDaysRemaining(computed.trialDaysRemaining);
        localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: fetchedTier, billing: fetchedBilling, provider: fetchedProvider }));
      }
    } catch {
      setRecordUser(null); setHasSubscription(false); setPaidUntil(null); setPaidFrom(null); setHasBinding(false); setRevoked(false);
      // A network failure is not entitlement evidence. Database/server checks remain authoritative.
      setIsTrialActive(false); setTrialDaysRemaining(0);
      setTier('free');
      setStatus('active');
      setBillingCycle('monthly');
      setPaymentProvider('lemonsqueezy');
      localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly', provider: 'lemonsqueezy' }));
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

  useEffect(() => {
    // Refresh on returning from a hosted checkout/portal, and expire time-bound UI access.
    const refresh = () => { void fetchSubscription(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [fetchSubscription]);

  const startTrial = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'not_signed_in' };
    try {
      // The database derives identity and time and atomically enforces one trial.
      const { data, error } = await supabase.rpc('app_11941c8fec_start_trial');
      if (error) return { error: error.message };
      if (data?.error) {
        if (data.error === 'trial_already_used') setTrialUsed(true);
        return { error: data.error };
      }
      const startedAt = data?.trial_started_at;
      if (typeof startedAt !== 'string' || !Number.isFinite(Date.parse(startedAt))) {
        return { error: 'invalid_trial_response' };
      }

      setRecordUser(user.id);
      setTrialUsed(true);
      setIsTrialActive(true);
      setTrialDaysRemaining(TRIAL_DURATION_DAYS);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'unknown_error' };
    }
  };

  // Display follows verified paid bounds; status or a legacy tier alone never proves payment.
  const scoped = !!user && recordUser === user.id;
  const paid = scoped && !revoked && hasBinding && ['active', 'past_due', 'canceled'].includes(status)
    && !!paidFrom && Date.parse(paidFrom) <= Date.now()
    && !!paidUntil && Date.parse(paidUntil) > Date.now()
    && (status !== 'canceled' || !currentPeriodEnd || Date.parse(currentPeriodEnd) > Date.now());
  const effectiveTier: SubscriptionTier = scoped && isTrialActive && !revoked ? 'family' : paid ? tier : 'free';

  return (
    <SubscriptionContext.Provider value={{
      tier: effectiveTier,
      status,
      billingCycle,
      paymentProvider,
      currentPeriodEnd,
      hasSubscription: scoped && hasSubscription,
      loading,
      isTrialActive: scoped && isTrialActive && !revoked,
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
  paymentProvider: 'lemonsqueezy',
  currentPeriodEnd: null,
  hasSubscription: false,
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
