import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type SubscriptionTier = 'free' | 'balanced' | 'family';
type SubscriptionStatus = 'active' | 'canceled' | 'past_due';
type BillingCycle = 'monthly' | 'yearly';

interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  loading: boolean;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setTier('free');
      setStatus('active');
      setBillingCycle('monthly');
      setLoading(false);
      localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly' }));
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
        localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly' }));
      } else {
        const fetchedTier = (data.tier as SubscriptionTier) || 'free';
        const fetchedStatus = (data.status as SubscriptionStatus) || 'active';
        const fetchedBilling = (data.billing_cycle as BillingCycle) || 'monthly';
        setTier(fetchedTier);
        setStatus(fetchedStatus);
        setBillingCycle(fetchedBilling);
        localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: fetchedTier, billing: fetchedBilling }));
      }
    } catch {
      // On error, default to free
      setTier('free');
      setStatus('active');
      setBillingCycle('monthly');
      localStorage.setItem('amanahlife_subscription', JSON.stringify({ tier: 'free', billing: 'monthly' }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={{ tier, status, billingCycle, loading, refetch: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}