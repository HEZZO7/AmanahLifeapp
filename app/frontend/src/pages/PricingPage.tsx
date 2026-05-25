import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';

export default function PricingPage() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: isAr ? 'مجاني' : 'Free',
      price: { monthly: 0, yearly: 0 },
      description: isAr ? 'ابدأ رحلتك' : 'Start your journey',
      features: isAr
        ? ['أوقات الصلاة', 'قارئ القرآن', 'عداد الذكر', 'الأدعية', 'اتجاه القبلة', 'التقويم الهجري', 'تتبع المهام الأساسي', '3 أهداف نشطة']
        : ['Prayer Times', 'Quran Reader', 'Dhikr Counter', 'Duas Collection', 'Qibla Finder', 'Islamic Calendar', 'Basic Task Tracking', '3 Active Goals'],
      cta: isAr ? 'ابدأ مجاناً' : 'Get Started Free',
      highlight: false,
    },
    {
      name: isAr ? 'الحياة المتوازنة' : 'Balanced Life',
      price: { monthly: 6.99, yearly: 4.89 },
      description: isAr ? 'للمستخدم الجاد' : 'For the dedicated user',
      features: isAr
        ? ['كل ميزات المجاني', 'المدرب الذكي AI', 'البحث الذكي AI', 'تحديات الادخار', 'ماسح الإيصالات', 'مؤشر الحياة الأسبوعي', 'أهداف غير محدودة', 'تصدير البيانات', 'تحليلات متقدمة']
        : ['All Free features', 'AI Life Coach', 'AI Smart Search', 'Savings Challenges', 'Receipt Scanner', 'Weekly Life Score', 'Unlimited Goals', 'Data Export', 'Advanced Analytics'],
      cta: isAr ? 'اشترك الآن' : 'Subscribe Now',
      highlight: true,
    },
    {
      name: isAr ? 'خطة العائلة' : 'Family Plan',
      price: { monthly: 12.99, yearly: 9.09 },
      description: isAr ? 'لكل العائلة' : 'For the whole family',
      features: isAr
        ? ['كل ميزات المتوازنة', 'لوحة العائلة المشتركة', 'حتى 6 أفراد', 'ميزانية عائلية', 'أهداف مشتركة', 'تتبع الصلاة العائلي', 'دعم أولوية', 'تقارير عائلية']
        : ['All Balanced features', 'Shared Family Dashboard', 'Up to 6 members', 'Family Budget', 'Shared Goals', 'Family Prayer Tracking', 'Priority Support', 'Family Reports'],
      cta: isAr ? 'اشترك للعائلة' : 'Subscribe for Family',
      highlight: false,
    },
  ];

  const comparisonFeatures = [
    { name: isAr ? 'أوقات الصلاة' : 'Prayer Times', free: true, balanced: true, family: true },
    { name: isAr ? 'قارئ القرآن' : 'Quran Reader', free: true, balanced: true, family: true },
    { name: isAr ? 'عداد الذكر' : 'Dhikr Counter', free: true, balanced: true, family: true },
    { name: isAr ? 'تتبع المهام' : 'Task Tracking', free: true, balanced: true, family: true },
    { name: isAr ? 'تتبع مالي أساسي' : 'Basic Finance Tracking', free: true, balanced: true, family: true },
    { name: isAr ? 'المدرب الذكي AI' : 'AI Life Coach', free: false, balanced: true, family: true },
    { name: isAr ? 'البحث الذكي AI' : 'AI Smart Search', free: false, balanced: true, family: true },
    { name: isAr ? 'تحديات الادخار' : 'Savings Challenges', free: false, balanced: true, family: true },
    { name: isAr ? 'ماسح الإيصالات' : 'Receipt Scanner', free: false, balanced: true, family: true },
    { name: isAr ? 'أهداف غير محدودة' : 'Unlimited Goals', free: false, balanced: true, family: true },
    { name: isAr ? 'تصدير البيانات' : 'Data Export', free: false, balanced: true, family: true },
    { name: isAr ? 'لوحة العائلة' : 'Family Dashboard', free: false, balanced: false, family: true },
    { name: isAr ? 'حتى 6 أفراد' : 'Up to 6 Members', free: false, balanced: false, family: true },
    { name: isAr ? 'دعم أولوية' : 'Priority Support', free: false, balanced: false, family: true },
  ];

  const billingFaqs = [
    {
      q: isAr ? 'هل يمكنني تغيير خطتي لاحقاً؟' : 'Can I change my plan later?',
      a: isAr ? 'نعم، يمكنك الترقية أو التخفيض في أي وقت من إعدادات الاشتراك.' : 'Yes, you can upgrade or downgrade at any time from your subscription settings.',
    },
    {
      q: isAr ? 'ما هي طرق الدفع المقبولة؟' : 'What payment methods are accepted?',
      a: isAr ? 'نقبل بطاقات الائتمان والخصم عبر Lemon Squeezy و Paddle و Stripe.' : 'We accept credit and debit cards via Lemon Squeezy, Paddle, and Stripe.',
    },
    {
      q: isAr ? 'هل هناك ضمان استرداد؟' : 'Is there a money-back guarantee?',
      a: isAr ? 'نعم، نقدم ضمان استرداد لمدة 14 يوماً على جميع الاشتراكات الجديدة.' : 'Yes, we offer a 14-day money-back guarantee on all new subscriptions.',
    },
    {
      q: isAr ? 'ماذا يحدث عند انتهاء اشتراكي؟' : 'What happens when my subscription ends?',
      a: isAr ? 'سيتم تحويل حسابك إلى الخطة المجانية مع الاحتفاظ ببياناتك.' : 'Your account will be converted to the free plan while retaining your data.',
    },
    {
      q: isAr ? 'هل الأسعار تشمل الضريبة؟' : 'Are prices inclusive of tax?',
      a: isAr ? 'الأسعار المعروضة لا تشمل الضريبة. قد تُضاف ضرائب حسب موقعك.' : 'Displayed prices do not include tax. Taxes may be added based on your location.',
    },
  ];

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="💎" title={isAr ? 'الأسعار' : 'Pricing'} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-foreground">
            {isAr ? 'اختر الخطة المناسبة لك' : 'Choose the Right Plan for You'}
          </h2>
          <p className="text-muted-foreground mt-2">
            {isAr ? 'ابدأ مجاناً وقم بالترقية في أي وقت' : 'Start free and upgrade anytime'}
          </p>
        </div>

        {/* Monthly/Yearly Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center bg-card border border-border rounded-full p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!isYearly ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              {isAr ? 'شهري' : 'Monthly'}
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isYearly ? 'bg-primary text-white' : 'text-muted-foreground'}`}
            >
              {isAr ? 'سنوي' : 'Yearly'}
            </button>
          </div>
          {isYearly && (
            <span className="bg-[#D4A017]/20 text-[#D4A017] text-xs px-2 py-0.5 rounded-full font-medium">
              {isAr ? 'وفر 30%' : 'Save 30%'}
            </span>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border ${
                plan.highlight
                  ? 'border-[#D4A017] bg-[#D4A017]/5 shadow-lg shadow-[#D4A017]/10 relative'
                  : 'border-border bg-card'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D4A017] text-black text-xs px-3 py-1 rounded-full font-bold">
                  {isAr ? 'الأكثر شعبية' : 'Most Popular'}
                </span>
              )}
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              <div className="mt-4 mb-5">
                <span className="text-3xl font-bold text-foreground">
                  ${isYearly ? plan.price.yearly : plan.price.monthly}
                </span>
                {plan.price.monthly > 0 && (
                  <span className="text-muted-foreground text-sm">
                    /{isAr ? 'شهر' : 'mo'}
                  </span>
                )}
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-primary">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => plan.price.monthly === 0 ? navigate('/login') : navigate('/subscription')}
                className={`w-full py-3 rounded-xl font-semibold transition-opacity hover:opacity-90 ${
                  plan.highlight
                    ? 'bg-[#D4A017] text-black'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* 14-day guarantee */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-2">
            <span>🛡️</span>
            <span className="text-sm font-medium text-foreground">
              {isAr ? 'ضمان استرداد لمدة 14 يوماً' : '14-Day Money-Back Guarantee'}
            </span>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-foreground text-center mb-6">
            {isAr ? 'مقارنة الميزات' : 'Feature Comparison'}
          </h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left rtl:text-right p-3 text-sm font-semibold text-foreground">
                      {isAr ? 'الميزة' : 'Feature'}
                    </th>
                    <th className="p-3 text-sm font-semibold text-foreground text-center">
                      {isAr ? 'مجاني' : 'Free'}
                    </th>
                    <th className="p-3 text-sm font-semibold text-[#D4A017] text-center">
                      {isAr ? 'المتوازنة' : 'Balanced'}
                    </th>
                    <th className="p-3 text-sm font-semibold text-foreground text-center">
                      {isAr ? 'العائلة' : 'Family'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="p-3 text-sm text-muted-foreground">{feature.name}</td>
                      <td className="p-3 text-center">{feature.free ? '✅' : '—'}</td>
                      <td className="p-3 text-center">{feature.balanced ? '✅' : '—'}</td>
                      <td className="p-3 text-center">{feature.family ? '✅' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Billing FAQ */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-foreground text-center mb-6">
            {isAr ? 'أسئلة حول الفوترة' : 'Billing FAQ'}
          </h3>
          <div className="space-y-2 max-w-2xl mx-auto">
            {billingFaqs.map((faq, index) => (
              <div key={index} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-background/50 transition-colors"
                >
                  <span className="font-medium text-foreground text-sm">{faq.q}</span>
                  <span className="text-muted-foreground text-lg ml-2 rtl:mr-2 rtl:ml-0">
                    {expandedFaq === index ? '−' : '+'}
                  </span>
                </button>
                {expandedFaq === index && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}