import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getUserCurrency, fetchExchangeRates, CURRENCY_SYMBOLS } from '@/lib/currency';
import type { ExchangeRateResult } from '@/lib/currency';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

// Primary payment provider — Lemon Squeezy (only visible flow)
const CHECKOUT_ENDPOINT = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_lemonsqueezy_checkout';

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

const TESTIMONIALS = [
  {
    nameAr: 'أحمد الراشدي',
    nameEn: 'Ahmed Al-Rashidi',
    locationAr: 'الرياض، السعودية',
    locationEn: 'Riyadh, Saudi Arabia',
    quoteAr: 'أمانة غيّرت طريقة تنظيم حياتي. أصبحت أحافظ على صلواتي وأذكاري بانتظام مع تتبع ميزانية العائلة.',
    quoteEn: 'AmanahLife changed how I organize my life. I now maintain my prayers and adhkar regularly while tracking our family budget.',
    rating: 5,
  },
  {
    nameAr: 'فاطمة المنصوري',
    nameEn: 'Fatima Al-Mansouri',
    locationAr: 'دبي، الإمارات',
    locationEn: 'Dubai, UAE',
    quoteAr: 'التخطيط الذكي بالذكاء الاصطناعي ساعدني على تحقيق أهدافي الروحية والمالية. تطبيق رائع للعائلة المسلمة!',
    quoteEn: 'The AI planning helped me achieve my personal and lifestyle goals. Amazing productivity app!',
    rating: 5,
  },
  {
    nameAr: 'عمر حسين',
    nameEn: 'Omar Hussein',
    locationAr: 'عمّان، الأردن',
    locationEn: 'Amman, Jordan',
    quoteAr: 'أفضل تطبيق استخدمته لتنظيم حياتي. متتبع الصيام وأدوات التخطيط دقيقان جداً. أنصح به بشدة.',
    quoteEn: 'Best lifestyle app I have used. The fasting tracker and planning tools are very accurate. Highly recommend.',
    rating: 5,
  },
  {
    nameAr: 'نورة الحربي',
    nameEn: 'Noura Al-Harbi',
    locationAr: 'جدة، السعودية',
    locationEn: 'Jeddah, Saudi Arabia',
    quoteAr: 'ميزة تتبع الأهداف والعادات ممتازة. أصبحت أقرأ القرآن يومياً وأتابع تقدمي بسهولة.',
    quoteEn: 'The goals and habits tracker is excellent. I now read Quran daily and easily track my progress.',
    rating: 4,
  },
];

export default function Subscription() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { tier: currentTier, billingCycle, loading: subLoading, isTrialActive, trialDaysRemaining, startTrial, refetch } = useSubscription();

  const [billing, setBilling] = useState<'monthly' | 'yearly'>(billingCycle);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
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

  // Handle URL params for success/canceled
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
      if (!session) {
        setMessage({
          type: 'canceled',
          text: isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first',
        });
        setCheckoutLoading(null);
        return;
      }

      const response = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tier,
          billing,
          successUrl: window.location.origin + '/subscription?success=true',
          cancelUrl: window.location.origin + '/subscription?canceled=true',
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
      }
    } catch {
      setMessage({
        type: 'canceled',
        text: isAr ? 'حدث خطأ في الاتصال' : 'Connection error occurred',
      });
    } finally {
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
      const timeStr = date.toLocaleTimeString(isAr ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' });
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

        {/* Start Free Trial CTA */}
        {isFreeTier && (
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
              onClick={startTrial}
              className="bg-gradient-to-r from-[#c9a96e] to-[#a67c3d] hover:from-[#b8944f] hover:to-[#956b2e] text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#c9a96e]/20"
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

        {/* Testimonials Section */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-1">
            {isAr ? 'ماذا يقول مستخدمونا' : 'What Our Users Say'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {isAr ? 'آراء المستخدمين حول العالم' : 'Reviews from users worldwide'}
          </p>
          <div className="space-y-3">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-xl p-4 bg-background/50 border border-border/50">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <svg
                      key={si}
                      className={`w-3.5 h-3.5 ${si < t.rating ? 'text-[#c9a96e]' : 'text-muted-foreground/30'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-foreground mb-2 leading-relaxed">
                  &ldquo;{isAr ? t.quoteAr : t.quoteEn}&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1a4a3a] flex items-center justify-center">
                    <span className="text-xs text-[#c9a96e] font-bold">
                      {(isAr ? t.nameAr : t.nameEn).charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{isAr ? t.nameAr : t.nameEn}</p>
                    <p className="text-[10px] text-muted-foreground">{isAr ? t.locationAr : t.locationEn}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}