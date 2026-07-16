import { useLanguage } from '@/contexts/LanguageContext';
import { useSEO } from '@/hooks/useSEO';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';

export default function RefundPolicy() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  useSEO({
    title: isAr ? 'سياسة الاسترداد — أمانة لايف' : 'Refund Policy — AmanahLife',
    description: isAr
      ? 'سياسة استرداد الأموال لاشتراكات أمانة لايف.'
      : 'The refund policy for AmanahLife subscriptions.',
  });

  const sections = [
    {
      title: isAr ? 'أهلية الاسترداد' : 'Refund Eligibility',
      content: isAr
        ? 'يمكنك طلب استرداد كامل المبلغ خلال 14 يوماً من تاريخ الاشتراك الأول. ينطبق هذا على الاشتراكات الجديدة فقط وليس على التجديدات. يجب أن يكون طلب الاسترداد هو الأول من نوعه لحسابك.'
        : 'You can request a full refund within 14 days of your initial subscription date. This applies to new subscriptions only, not renewals. The refund request must be the first of its kind for your account.',
    },
    {
      title: isAr ? 'كيفية طلب الاسترداد' : 'How to Request a Refund',
      content: isAr
        ? 'لطلب استرداد، يرجى التواصل مع فريق الدعم عبر البريد الإلكتروني support@amanahlife.com مع ذكر: عنوان البريد الإلكتروني المرتبط بحسابك، تاريخ الاشتراك، وسبب طلب الاسترداد. سنرد في أقرب وقت ممكن.'
        : 'To request a refund, please contact our support team at support@amanahlife.com with: the email address associated with your account, subscription date, and reason for the refund request. We will respond as soon as possible.',
    },
    {
      title: isAr ? 'وقت المعالجة' : 'Processing Time',
      content: isAr
        ? 'بمجرد الموافقة على طلب الاسترداد، ستتم معالجته خلال 5-10 أيام عمل. سيظهر المبلغ المسترد في حسابك حسب مزود الدفع الخاص بك (قد يستغرق 3-5 أيام إضافية).'
        : 'Once your refund request is approved, it will be processed within 5-10 business days. The refunded amount will appear in your account depending on your payment provider (may take an additional 3-5 days).',
    },
    {
      title: isAr ? 'العناصر غير القابلة للاسترداد' : 'Non-Refundable Items',
      content: isAr
        ? 'لا يمكن استرداد: الاشتراكات بعد مرور 14 يوماً، الاشتراكات المتجددة (يمكن إلغاؤها فقط)، أي رسوم معالجة من مزود الدفع، والحسابات التي تم تعليقها بسبب انتهاك الشروط.'
        : 'The following are non-refundable: subscriptions after 14 days, renewed subscriptions (can only be cancelled), any processing fees from the payment provider, and accounts suspended for terms violation.',
    },
    {
      title: isAr ? 'إلغاء الاشتراك' : 'Subscription Cancellation',
      content: isAr
        ? 'يمكنك إلغاء اشتراكك في أي وقت من صفحة الإعدادات. عند الإلغاء: ستستمر في الوصول إلى الميزات المدفوعة حتى نهاية فترة الفوترة الحالية، لن يتم تحصيل رسوم إضافية، وسيتم تحويل حسابك تلقائياً إلى الخطة المجانية.'
        : 'You can cancel your subscription at any time from the Settings page. Upon cancellation: you will continue to have access to paid features until the end of the current billing period, no additional charges will be made, and your account will automatically convert to the free plan.',
    },
    {
      title: isAr ? 'الاسترداد الجزئي' : 'Partial Refunds',
      content: isAr
        ? 'في حالات استثنائية (مثل انقطاع الخدمة لفترة طويلة)، قد نقدم استرداداً جزئياً يتناسب مع فترة عدم التوفر. يتم تقييم هذه الحالات على أساس فردي.'
        : 'In exceptional cases (such as extended service outages), we may offer a partial refund proportional to the period of unavailability. These cases are evaluated on an individual basis.',
    },
    {
      title: isAr ? 'التواصل بشأن الاسترداد' : 'Contact for Refunds',
      content: isAr
        ? 'لجميع طلبات الاسترداد والاستفسارات المتعلقة بالفوترة، يرجى التواصل مع فريق الدعم على support@amanahlife.com. نسعى للرد على جميع الطلبات في أقرب وقت ممكن.'
        : 'For all refund requests and billing inquiries, please contact our support team at support@amanahlife.com. We aim to respond to all requests as soon as possible.',
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="💳" title={isAr ? 'سياسة الاسترداد' : 'Refund Policy'} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {isAr ? 'آخر تحديث: 24 مايو 2026' : 'Last updated: May 24, 2026'}
          </p>
          <p className="text-muted-foreground mt-3">
            {isAr
              ? 'نريد أن تكون راضياً عن خدمتنا. إذا لم تكن كذلك، إليك سياسة الاسترداد الخاصة بنا.'
              : 'We want you to be satisfied with our service. If you are not, here is our refund policy.'}
          </p>
        </div>

        {/* 14-day guarantee badge */}
        <div className="mb-6 bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <p className="font-bold text-foreground">
              {isAr ? 'ضمان استرداد لمدة 14 يوماً' : '14-Day Money-Back Guarantee'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? 'جرب بدون مخاطر. استرد أموالك بالكامل إذا لم تكن راضياً.'
                : 'Try risk-free. Get a full refund if you are not satisfied.'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-bold text-foreground mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}