import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import BottomNav from '@/components/BottomNav';

type PaymentProvider = 'stripe' | 'lemonsqueezy' | 'paddle';

const CHECKOUT_ENDPOINTS: Record<PaymentProvider, string> = {
  stripe: 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_stripe_checkout',
  lemonsqueezy: 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_lemonsqueezy_checkout',
  paddle: 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_paddle_checkout',
};

const PAYMENT_PROVIDERS: { id: PaymentProvider; icon: string; nameAr: string; nameEn: string; descAr: string; descEn: string }[] = [
  {
    id: 'stripe',
    icon: '💳',
    nameAr: 'سترايب',
    nameEn: 'Stripe',
    descAr: 'بطاقات الائتمان والخصم',
    descEn: 'Credit & debit cards',
  },
  {
    id: 'lemonsqueezy',
    icon: '🍋',
    nameAr: 'ليمون سكويزي',
    nameEn: 'Lemon Squeezy',
    descAr: 'دفع عالمي مع ضريبة مدمجة',
    descEn: 'Global payments with built-in tax',
  },
  {
    id: 'paddle',
    icon: '🏓',
    nameAr: 'بادل',
    nameEn: 'Paddle',
    descAr: 'دفع آمن مع فواتير تلقائية',
    descEn: 'Secure payments with auto-invoicing',
  },
];

const PLANS = [
  {
    id: 'free' as const,
    nameAr: 'مجاني',
    nameEn: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: '🌟',
    featuresAr: ['أوقات الصلاة', 'قارئ القرآن', 'عداد الأذكار', 'حاسبة الزكاة'],
    featuresEn: ['Prayer Times', 'Quran Reader', 'Dhikr Counter', 'Zakat Calculator'],
  },
  {
    id: 'balanced' as const,
    nameAr: 'الحياة المتوازنة',
    nameEn: 'Balanced Life',
    monthlyPrice: 24.99,
    yearlyPrice: 19.99,
    icon: '⭐',
    featuresAr: ['تذكيرات متقدمة', 'تتبع الميزانية', 'رؤى الذكاء الاصطناعي', 'مراجعات الحياة', 'التخطيط الذكي', 'البحث الذكي'],
    featuresEn: ['Advanced Reminders', 'Budget Tracking', 'AI Insights', 'Life Reviews', 'Smart Planning', 'Smart Search'],
  },
  {
    id: 'family' as const,
    nameAr: 'أمانة العائلة',
    nameEn: 'Family Trust',
    monthlyPrice: 49.99,
    yearlyPrice: 39.99,
    icon: '👑',
    featuresAr: ['جميع مميزات الحياة المتوازنة', 'مشاركة العائلة', 'ميزانية مشتركة', 'خزنة المستندات'],
    featuresEn: ['All Balanced features', 'Family Sharing', 'Shared Budget', 'Document Vault'],
  },
];

export default function Subscription() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { tier: currentTier, billingCycle, paymentProvider: currentProvider, loading: subLoading, refetch } = useSubscription();

  const [billing, setBilling] = useState<'monthly' | 'yearly'>(billingCycle);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>(currentProvider);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'canceled'; text: string } | null>(null);

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

  // Update selected provider when subscription data loads
  useEffect(() => {
    setSelectedProvider(currentProvider);
  }, [currentProvider]);

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

      const endpoint = CHECKOUT_ENDPOINTS[selectedProvider];

      const response = await fetch(endpoint, {
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
        'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_stripe_portal',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            returnUrl: window.location.href,
          }),
        }
      );

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({
          type: 'canceled',
          text: isAr ? 'حدث خطأ أثناء فتح بوابة الإدارة' : 'Error opening management portal',
        });
      }
    } catch {
      setMessage({
        type: 'canceled',
        text: isAr ? 'حدث خطأ في الاتصال' : 'Connection error occurred',
      });
    } finally {
      setPortalLoading(false);
    }
  }, [isAr]);

  const currentPlanName = PLANS.find(p => p.id === currentTier);

  return (
    <div className="min-h-screen bg-background pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 flex items-center h-14">
          <h1 className="text-xl font-bold text-foreground">
            {isAr ? '💎 إعدادات الاشتراك' : '💎 Subscription Settings'}
          </h1>
        </div>
      </header>

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
              </p>
              <p className="text-xs text-muted-foreground">
                {billingCycle === 'yearly' ? (isAr ? 'اشتراك سنوي' : 'Yearly Plan') : (isAr ? 'اشتراك شهري' : 'Monthly Plan')}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">
            {isAr ? 'طريقة الدفع' : 'Payment Method'}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_PROVIDERS.map((provider) => {
              const isSelected = selectedProvider === provider.id;
              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-[#c9a96e] bg-[#c9a96e]/10'
                      : 'border-[#1a4a3a] hover:border-[#2a5a4a]'
                  }`}
                >
                  <span className="text-2xl">{provider.icon}</span>
                  <span className="text-xs font-semibold text-foreground">
                    {isAr ? provider.nameAr : provider.nameEn}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {isAr ? provider.descAr : provider.descEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Manage Subscription */}
        {currentTier !== 'free' && (
          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="text-sm text-muted-foreground mb-2">
              {isAr ? 'إدارة الاشتراك' : 'Manage Subscription'}
            </h3>
            {currentProvider === 'stripe' ? (
              <>
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
              </>
            ) : (
              <div className="rounded-xl bg-[#1a4a3a]/50 p-3 border border-[#2a5a4a]">
                <p className="text-xs text-muted-foreground">
                  {currentProvider === 'lemonsqueezy'
                    ? (isAr
                      ? 'لإدارة اشتراكك، يرجى زيارة لوحة تحكم ليمون سكويزي من خلال رابط الإدارة المرسل إلى بريدك الإلكتروني.'
                      : 'To manage your subscription, please visit the Lemon Squeezy dashboard via the management link sent to your email.')
                    : (isAr
                      ? 'لإدارة اشتراكك، يرجى زيارة لوحة تحكم بادل من خلال رابط الإدارة المرسل إلى بريدك الإلكتروني.'
                      : 'To manage your subscription, please visit the Paddle dashboard via the management link sent to your email.')}
                </p>
              </div>
            )}
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
                          <span className="text-[#c9a96e] font-bold text-lg">{price}</span>
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
        </div>
      </main>

      <BottomNav />
    </div>
  );
}