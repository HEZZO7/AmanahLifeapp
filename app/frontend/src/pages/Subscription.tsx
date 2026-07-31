import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTimeFormat } from '@/contexts/TimeFormatContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getUserCurrency, fetchExchangeRates, CURRENCY_SYMBOLS } from '@/lib/currency';
import type { ExchangeRateResult } from '@/lib/currency';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

// CHECKOUT_ENDPOINT is used for "Manage Subscription" (looking up the Lemon
// Squeezy customer portal URL for an existing subscriber - see
// handleManageSubscription below) and for starting a NEW subscription when
// the signed-in user has already used their trial (see handleUpgrade) - that
// case needs the API-based checkout so checkout_options.skip_trial can
// actually suppress Lemon Squeezy's own native trial offer, which a static
// buy-link cannot do. A first-time-trial-eligible user skips this endpoint
// entirely and goes straight to Lemon Squeezy's hosted buy-links instead
// (BUY_LINKS/buildCheckoutUrl below).
const CHECKOUT_ENDPOINT = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_lemonsqueezy_checkout';

// One buy-link per (tier, billing) variant - confirmed by live-checking each
// of the 4 URLs in a browser: each shows a single fixed price with no
// interval selector, so all 4 are genuinely required (2 given earlier turned
// out to be yearly-only). The `?enabled=<variant_id>` query param restricts
// the buy-link to that one variant, matching what Lemon Squeezy itself
// generated when these were created.
const BUY_LINKS: Record<'balanced' | 'family', Record<'monthly' | 'yearly', string>> = {
  balanced: {
    monthly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/648ef373-e4f9-4a53-8837-3c42306acf48?enabled=1959952',
    yearly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/134fbb9c-1a72-4cfa-a3cb-8d90d733bcf1?enabled=1959859',
  },
  family: {
    monthly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/0d44ea94-b1db-450e-bf8b-47a39fd304f0?enabled=1959970',
    yearly: 'https://amanahlife.lemonsqueezy.com/checkout/buy/008ffbea-25d1-47dc-a1ec-8acc17e56c96?enabled=1959954',
  },
};

/**
 * Builds a Lemon Squeezy checkout URL for the given plan, pre-filled with
 * the signed-in user's email and carrying their user_id (+ this app's fixed
 * app_id) in custom_data so the webhook can attribute the resulting
 * subscription to the right account. app_id is NOT optional here - the
 * webhook rejects any payload where custom_data.app_id !== "11941c8fec" as
 * an "App ID mismatch", so a buy-link missing this would silently never
 * grant access after a real payment.
 */
function buildCheckoutUrl(
  tier: 'balanced' | 'family',
  billing: 'monthly' | 'yearly',
  user: { id: string; email?: string | null }
): string {
  if (!user?.id) {
    throw new Error('buildCheckoutUrl requires an authenticated user');
  }
  const base = BUY_LINKS[tier][billing];
  const params = new URLSearchParams();
  if (user.email) params.set('checkout[email]', user.email);
  params.set('checkout[custom][user_id]', user.id);
  params.set('checkout[custom][app_id]', '11941c8fec');
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}

const PLANS = [
  {
    id: 'free' as const,
    nameAr: 'مجاني',
    nameEn: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: '🌱',
    featuresAr: ['أوقات الصلاة', 'قارئ القرآن', 'عداد الأذكار', 'المخطط الأساسي'],
    featuresEn: ['Prayer Times', 'Quran Reader', 'Dhikr Counter', 'Basic Planner'],
  },
  {
    id: 'balanced' as const,
    nameAr: 'الحياة المتوازنة',
    nameEn: 'Balanced Life',
    monthlyPrice: 6.99,
    yearlyPrice: 4.99,
    icon: '⭐',
    featuresAr: ['تذكيرات متقدمة', 'تتبع نمط الحياة', 'رؤى الذكاء الاصطناعي', 'التخطيط الذكي', 'المراجعات اليومية'],
    featuresEn: ['Advanced Reminders', 'Lifestyle Tracking', 'AI Insights', 'Smart Planning', 'Daily Reviews'],
  },
  {
    id: 'family' as const,
    nameAr: 'أمانة العائلة',
    nameEn: 'Family Plan',
    monthlyPrice: 12.99,
    yearlyPrice: 9.99,
    icon: '👑',
    featuresAr: ['جميع مميزات الحياة المتوازنة', 'مشاركة العائلة', 'لوحة مشتركة', 'خزنة المستندات'],
    featuresEn: ['All Balanced features', 'Family Sharing', 'Shared Dashboard', 'Document Vault'],
  },
];

export default function Subscription() {
  const { language } = useLanguage();
  const { timeFormat } = useTimeFormat();
  const isAr = language === 'ar';
  const { tier: currentTier, status: currentStatus, billingCycle, currentPeriodEnd, loading: subLoading, isTrialActive, trialDaysRemaining, trialUsed, startTrial, refetch } = useSubscription();

  const [billing, setBilling] = useState<'monthly' | 'yearly'>(billingCycle);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'canceled'; text: string } | null>(null);
  const [userCurrency, setUserCurrency] = useState<string>(() => getUserCurrency());

  const handleCurrencyChange = (newCurrency: string) => {
    setUserCurrency(newCurrency);
    try {
      const stored = localStorage.getItem('amanah-settings');
      const settings = stored ? JSON.parse(stored) : {};
      settings.currency = newCurrency;
      localStorage.setItem('amanah-settings', JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  };

  // Live exchange rates
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);
  const [ratesMeta, setRatesMeta] = useState<{ source: string; updated_at: string } | null>(null);

  // Fetch live rates on mount
  useEffect(() => {
    let cancelled = false;
    fetchExchangeRates().then((result: ExchangeRateResult) => {
      if (!cancelled) {
        setLiveRates(result.rates);
        setRatesMeta({ source: result.source, updated_at: result.updated_at });
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Handle URL params for success/canceled.
  //
  // KNOWN GAP since moving checkout initiation to Lemon Squeezy's hosted
  // buy-links: this only fires if the browser actually lands back on
  // /subscription?success=true, but static buy-links have no per-user
  // redirect_url query param - that's API-only (part of product_options on
  // the Create-a-Checkout endpoint), confirmed via Lemon Squeezy's own docs
  // and a 3-year-old open (unresolved) feature request asking for exactly
  // this on buy-links. Without a fixed confirmation-redirect URL configured
  // in each product's own Lemon Squeezy dashboard settings, a customer who
  // pays via one of these buy-links will see Lemon Squeezy's own receipt
  // page, not this banner, and has to navigate back to the app manually.
  // This does NOT affect whether they actually get access - the webhook
  // still grants it - only whether they see this specific on-page message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setMessage({
        type: 'success',
        text: isAr ? 'تم تفعيل اشتراكك بنجاح!' : 'Your subscription has been activated successfully!',
      });
      refetch();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled') === 'true') {
      setMessage({
        type: 'canceled',
        text: isAr ? 'تم إلغاء عملية الدفع' : 'Payment was canceled',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isAr, refetch]);

  // Update billing toggle when subscription data loads
  useEffect(() => {
    setBilling(billingCycle);
  }, [billingCycle]);

  const handleUpgrade = async (tier: 'balanced' | 'family') => {
    setCheckoutLoading(tier);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setMessage({
          type: 'canceled',
          text: isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first',
        });
        setCheckoutLoading(null);
        return;
      }

      // A trial-used account is routed through the API-based checkout
      // instead of the static buy-link, because only the API can set
      // checkout_options.skip_trial - genuinely suppressing Lemon Squeezy's
      // own native trial offer, rather than just disclosing it. Everyone
      // else goes straight to the buy-link, skipping the extra round trip
      // since skip_trial would be a no-op for a first-time user anyway.
      // (The Edge Function independently re-derives trial_used from the
      // database - this branch is purely an optimization, not the source of
      // enforcement.)
      if (trialUsed) {
        const response = await fetch(CHECKOUT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tier,
            billing,
            successUrl: `${window.location.origin}/subscription?success=true`,
          }),
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setMessage({
            type: 'canceled',
            text: isAr ? 'حدث خطأ أثناء إنشاء جلسة الدفع' : 'Error creating checkout session',
          });
          setCheckoutLoading(null);
        }
        return;
      }

      // setCheckoutLoading is left set rather than cleared in a finally: the
      // page is navigating away, so there is nothing left here to reset it
      // for, and clearing it first would flash the button back to its
      // normal state for a frame before the browser actually leaves.
      const url = buildCheckoutUrl(tier, billing, { id: session.user.id, email: session.user.email });
      window.location.href = url;
    } catch {
      setMessage({
        type: 'canceled',
        text: isAr ? 'حدث خطأ أثناء إنشاء جلسة الدفع' : 'Error creating checkout session',
      });
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = useCallback(async () => {
    setPortalLoading(true);
    try {
      // If user is on free tier, no subscription to manage
      if (currentTier === 'free') {
        setMessage({
          type: 'canceled',
          text: isAr
            ? 'ليس لديك اشتراك نشط حالياً. اختر خطة للاشتراك.'
            : 'You don\'t have an active subscription. Choose a plan to subscribe.',
        });
        setPortalLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({
          type: 'canceled',
          text: isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first',
        });
        setPortalLoading(false);
        return;
      }

      const response = await fetch(
        CHECKOUT_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'manage',
            returnUrl: window.location.href,
          }),
        }
      );

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === 'no_subscription' || data.error === 'Lemon Squeezy not configured') {
        setMessage({
          type: 'canceled',
          text: isAr
            ? 'إدارة الاشتراك غير متاحة حالياً. يرجى التواصل مع الدعم.'
            : 'Subscription management is not available yet. Please contact support.',
        });
      } else {
        setMessage({
          type: 'canceled',
          text: isAr
            ? 'إدارة الاشتراك غير متاحة حالياً. يرجى التواصل مع الدعم.'
            : 'Subscription management is not available yet. Please contact support.',
        });
      }
    } catch {
      setMessage({
        type: 'canceled',
        text: isAr
          ? 'إدارة الاشتراك غير متاحة حالياً. يرجى التواصل مع الدعم.'
          : 'Subscription management is not available yet. Please contact support.',
      });
    } finally {
      setPortalLoading(false);
    }
  }, [isAr, currentTier]);

  const handleStartTrial = async () => {
    setTrialLoading(true);
    try {
      const { error } = await startTrial();
      if (error === 'trial_already_used') {
        setMessage({
          type: 'canceled',
          text: isAr ? 'لقد استخدمت التجربة المجانية بالفعل لهذا الحساب.' : 'You already used your free trial on this account.',
        });
      } else if (error) {
        setMessage({
          type: 'canceled',
          text: isAr ? 'حدث خطأ ما. حاول مرة أخرى.' : 'Something went wrong. Please try again.',
        });
      }
    } finally {
      setTrialLoading(false);
    }
  };

  const currentPlanName = PLANS.find(p => p.id === currentTier);

  // Determine if user is on free tier (not trial, not paid)
  const isFreeTier = currentTier === 'free' && !isTrialActive;

  // Helper to format price with live rates
  const fmtPrice = (priceUSD: number) => {
    return formatPrice(priceUSD, userCurrency, liveRates ?? undefined);
  };

  // Format the "last updated" indicator
  const getRatesIndicator = () => {
    if (!ratesMeta) return null;
    if (ratesMeta.source === 'fallback') {
      return isAr ? 'أسعار تقريبية' : 'Approximate rates';
    }
    if (ratesMeta.updated_at) {
      const date = new Date(ratesMeta.updated_at);
      const timeStr = date.toLocaleTimeString(isAr ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' });
      return isAr ? `آخر تحديث: ${timeStr}` : `Updated: ${timeStr}`;
    }
    return isAr ? 'أسعار حية' : 'Live rates';
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader icon="💎" title={isAr ? 'إعدادات الاشتراك' : 'Subscription Settings'} />

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Status Message */}
        {message && (
          <div
            className={`rounded-xl p-4 border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Social Proof Badge */}
        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#c9a96e]/10 to-[#1a4a3a]/20 border border-[#c9a96e]/20">
          <span className="text-lg">🌍</span>
          <span className="text-sm font-semibold text-foreground">
            {isAr ? 'رفيقك الذكي لحياة أكثر تنظيمًا وتوازنًا' : 'Your smart companion for a more organized and balanced life'}
          </span>
          <span className="text-lg">✨</span>
        </div>

        {/* Trial Banner */}
        {isTrialActive && (
          <div className="rounded-2xl p-4 border border-[#c9a96e]/40 bg-[#c9a96e]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#c9a96e]/20 flex items-center justify-center">
                <span className="text-xl">⏳</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">
                  {isAr ? 'التجربة المجانية نشطة' : 'Free Trial Active'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? `متبقي ${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'يوم' : 'أيام'}`
                    : `${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'day' : 'days'} remaining`}
                </p>
              </div>
              <div className="text-2xl font-bold text-[#c9a96e]">{trialDaysRemaining}</div>
            </div>
          </div>
        )}

        {/* Start Free Trial CTA — hidden once the account has already used its trial */}
        {isFreeTier && !trialUsed && (
          <div className="rounded-2xl p-5 border-2 border-dashed border-[#c9a96e]/50 bg-gradient-to-br from-[#c9a96e]/5 to-transparent text-center">
            <span className="text-3xl mb-2 block">🎁</span>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {isAr ? 'جرّب المميز مجاناً' : 'Try Premium Free'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isAr
                ? 'احصل على جميع المميزات لمدة 7 أيام بدون دفع'
                : 'Get all premium features for 7 days, no payment required'}
            </p>
            <button
              onClick={handleStartTrial}
              disabled={trialLoading}
              className="bg-gradient-to-r from-[#c9a96e] to-[#a67c3d] hover:from-[#b8944f] hover:to-[#956b2e] text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#c9a96e]/20 disabled:opacity-50"
            >
              {isAr ? '🚀 ابدأ تجربة 7 أيام مجانية' : '🚀 Start 7-Day Free Trial'}
            </button>
          </div>
        )}

        {/* Current Plan */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">
            {isAr ? 'باقتك الحالية' : 'Current Plan'}
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#c9a96e] to-[#a67c3d] flex items-center justify-center">
              <span className="text-xl">👑</span>
            </div>
            <div>
              <p className="text-foreground font-bold text-lg">
                {subLoading ? '...' : (isAr ? currentPlanName?.nameAr : currentPlanName?.nameEn)}
                {isTrialActive && (
                  <span className="text-xs ms-2 px-2 py-0.5 rounded-full bg-[#c9a96e]/20 text-[#c9a96e]">
                    {isAr ? 'تجربة' : 'Trial'}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {billingCycle === 'yearly' ? (isAr ? 'اشتراك سنوي' : 'Yearly Plan') : (isAr ? 'اشتراك شهري' : 'Monthly Plan')}
              </p>
              {/* Renewal/expiry date. null for free/trial users and for any
                  provider whose webhook doesn't populate current_period_end
                  yet (currently Paddle) - shown only when we genuinely have
                  it, never a guessed date. */}
              {!isTrialActive && currentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentStatus === 'canceled'
                    ? (isAr ? 'ينتهي الوصول في ' : 'Access ends ')
                    : (isAr ? 'يتجدد في ' : 'Renews ')}
                  {new Date(currentPeriodEnd).toLocaleDateString(isAr ? 'ar' : 'en', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Manage Subscription */}
        {currentTier !== 'free' && !isTrialActive && (
          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="text-sm text-muted-foreground mb-2">
              {isAr ? 'إدارة الاشتراك' : 'Manage Subscription'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {isAr
                ? 'إدارة طريقة الدفع، عرض الفواتير، أو إلغاء الاشتراك'
                : 'Manage payment method, view invoices, or cancel subscription'}
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-[#c9a96e] text-[#c9a96e] hover:bg-[#c9a96e]/10 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>
                {portalLoading
                  ? (isAr ? 'جاري التحميل...' : 'Loading...')
                  : (isAr ? 'إدارة الاشتراك' : 'Manage Subscription')}
              </span>
            </button>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">
            {isAr ? 'الباقات المتاحة' : 'Available Plans'}
          </h3>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-background rounded-full p-1 flex border border-border">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === 'monthly' ? 'bg-primary text-white' : 'text-muted-foreground'
                }`}
              >
                {isAr ? 'شهري' : 'Monthly'}
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === 'yearly' ? 'bg-primary text-white' : 'text-muted-foreground'
                }`}
              >
                {isAr ? 'سنوي (-20%)' : 'Yearly (-20%)'}
              </button>
            </div>
          </div>

          {/* Plan Cards */}
          <div className="space-y-3">
            {PLANS.map((plan) => {
              const isCurrent = currentTier === plan.id;
              const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
              const isLoading = checkoutLoading === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-4 border transition-all ${
                    isCurrent ? 'border-[#c9a96e] bg-[#c9a96e]/5' : 'border-[#1a4a3a]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{plan.icon}</span>
                      <span className="text-foreground font-bold">
                        {isAr ? plan.nameAr : plan.nameEn}
                      </span>
                    </div>
                    <div className="text-end">
                      {price === 0 ? (
                        <span className="text-[#c9a96e] font-bold text-lg">
                          {isAr ? 'مجاني' : 'Free'}
                        </span>
                      ) : (
                        <div>
                          <span className="text-[#c9a96e] font-bold text-lg">{fmtPrice(price)}</span>
                          <span className="text-muted-foreground text-xs">
                            {' '}{isAr ? '/شهر' : '/mo'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-1.5 mb-3">
                    {(isAr ? plan.featuresAr : plan.featuresEn).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#c9a96e]/10 border border-[#c9a96e]/30">
                      <svg className="w-4 h-4 text-[#c9a96e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[#c9a96e] text-sm font-medium">
                        {isAr ? 'باقتك الحالية' : 'Current Plan'}
                      </span>
                    </div>
                  ) : plan.id === 'free' ? (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted/30 border border-border">
                      <span className="text-muted-foreground text-sm font-medium">
                        {isAr ? 'الباقة الأساسية' : 'Basic Plan'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id as 'balanced' | 'family')}
                      disabled={isLoading}
                      className="w-full bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading
                        ? (isAr ? 'جاري التحميل...' : 'Loading...')
                        : (isAr ? 'ترقية' : 'Upgrade')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Currency Selector with live rates indicator */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <label className="text-xs text-muted-foreground font-medium">
                {isAr ? 'العملة:' : 'Currency:'}
              </label>
              <select
                value={userCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="rounded-lg border border-border bg-card text-sm px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-[#c9a96e]/50 focus:border-[#c9a96e] transition-all"
              >
                {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                  <option key={code} value={code}>
                    {code} ({symbol})
                  </option>
                ))}
              </select>
            </div>
            {ratesMeta && (
              <p className="text-[10px] text-muted-foreground/70 flex items-center justify-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${ratesMeta.source === 'fallback' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                {getRatesIndicator()}
              </p>
            )}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}