import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface SubscriptionState {
  tier: 'free' | 'balanced' | 'family';
  billing: 'monthly' | 'yearly';
}

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

  const [subscription, setSubscription] = useState<SubscriptionState>(() => {
    try {
      const stored = localStorage.getItem('amanahlife_subscription');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { tier: 'free', billing: 'monthly' };
  });

  const [billing, setBilling] = useState<'monthly' | 'yearly'>(subscription.billing);

  useEffect(() => {
    localStorage.setItem('amanahlife_subscription', JSON.stringify(subscription));
  }, [subscription]);

  const selectPlan = (tier: 'free' | 'balanced' | 'family') => {
    setSubscription({ tier, billing });
  };

  const currentPlanName = PLANS.find(p => p.id === subscription.tier);

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
                {isAr ? currentPlanName?.nameAr : currentPlanName?.nameEn}
              </p>
              <p className="text-xs text-muted-foreground">
                {subscription.billing === 'yearly' ? (isAr ? 'اشتراك سنوي' : 'Yearly Plan') : (isAr ? 'اشتراك شهري' : 'Monthly Plan')}
              </p>
            </div>
          </div>
        </div>

        {/* Manage Subscription */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm text-muted-foreground mb-3">
            {isAr ? 'إدارة الاشتراك' : 'Manage Subscription'}
          </h3>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#1a4a3a] hover:border-primary transition-all">
              <span className="text-foreground text-sm">{isAr ? 'تحديث طريقة الدفع' : 'Update Payment Method'}</span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#1a4a3a] hover:border-primary transition-all">
              <span className="text-foreground text-sm">{isAr ? 'تغيير الباقة' : 'Change Plan'}</span>
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/30 hover:border-red-500 transition-all">
              <span className="text-red-400 text-sm">{isAr ? 'إلغاء الاشتراك' : 'Cancel Subscription'}</span>
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>

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
              const isCurrent = subscription.tier === plan.id;
              const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
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
                            {' '}{isAr ? 'ر.س/شهر' : 'SAR/mo'}
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
                  ) : (
                    <button
                      onClick={() => selectPlan(plan.id)}
                      className="w-full bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold py-2.5 rounded-xl transition-all"
                    >
                      {isAr ? 'ترقية' : 'Upgrade'}
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