import { useLanguage } from '@/contexts/LanguageContext';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';

export default function TermsOfService() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const sections = [
    {
      title: isAr ? 'قبول الشروط' : 'Acceptance of Terms',
      content: isAr
        ? 'باستخدامك لتطبيق أمانة لايف، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام خدماتنا.'
        : 'By using AmanahLife, you agree to be bound by these terms and conditions. If you do not agree to any part of these terms, please do not use our services.',
    },
    {
      title: isAr ? 'تسجيل الحساب' : 'Account Registration',
      content: isAr
        ? 'يجب أن يكون عمرك 13 عاماً على الأقل لإنشاء حساب. أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك. يجب أن تكون المعلومات التي تقدمها دقيقة وحديثة. يحق لنا تعليق أو إنهاء حسابك إذا انتهكت هذه الشروط.'
        : 'You must be at least 13 years old to create an account. You are responsible for maintaining the confidentiality of your login credentials. The information you provide must be accurate and up-to-date. We reserve the right to suspend or terminate your account if you violate these terms.',
    },
    {
      title: isAr ? 'شروط الاشتراك' : 'Subscription Terms',
      content: isAr
        ? 'نقدم خططاً مجانية ومدفوعة. الاشتراكات المدفوعة تتجدد تلقائياً ما لم يتم إلغاؤها. يمكنك إلغاء اشتراكك في أي وقت من خلال إعدادات حسابك. عند الإلغاء، ستستمر في الوصول إلى الميزات المدفوعة حتى نهاية فترة الفوترة الحالية. الأسعار قابلة للتغيير مع إشعار مسبق لمدة 30 يوماً.'
        : 'We offer free and paid plans. Paid subscriptions renew automatically unless cancelled. You can cancel your subscription at any time through your account settings. Upon cancellation, you will continue to have access to paid features until the end of the current billing period. Prices are subject to change with 30 days prior notice.',
    },
    {
      title: isAr ? 'الاستخدام المقبول' : 'Acceptable Use',
      content: isAr
        ? 'توافق على عدم: استخدام الخدمة لأي غرض غير قانوني، محاولة الوصول غير المصرح به إلى أنظمتنا، نشر محتوى ضار أو مسيء، استخدام الخدمة لإرسال رسائل غير مرغوب فيها، أو التدخل في عمل الخدمة أو تعطيلها.'
        : 'You agree not to: use the service for any unlawful purpose, attempt unauthorized access to our systems, post harmful or offensive content, use the service to send spam, or interfere with or disrupt the service.',
    },
    {
      title: isAr ? 'الملكية الفكرية' : 'Intellectual Property',
      content: isAr
        ? 'جميع المحتويات والعلامات التجارية والبرمجيات المتعلقة بـ أمانة لايف مملوكة لنا أو مرخصة لنا. لا يجوز لك نسخ أو تعديل أو توزيع أو بيع أي جزء من خدماتنا دون إذن كتابي مسبق.'
        : 'All content, trademarks, and software related to AmanahLife are owned by us or licensed to us. You may not copy, modify, distribute, or sell any part of our services without prior written permission.',
    },
    {
      title: isAr ? 'محتوى المستخدم' : 'User Content',
      content: isAr
        ? 'أنت تحتفظ بملكية المحتوى الذي تنشئه في التطبيق (الأهداف، المهام، البيانات المالية). بتحميل المحتوى، تمنحنا ترخيصاً محدوداً لتخزينه ومعالجته لتقديم الخدمة. يمكنك تصدير أو حذف بياناتك في أي وقت.'
        : 'You retain ownership of content you create in the app (goals, tasks, financial data). By uploading content, you grant us a limited license to store and process it to provide the service. You can export or delete your data at any time.',
    },
    {
      title: isAr ? 'تحديد المسؤولية' : 'Limitation of Liability',
      content: isAr
        ? 'يتم تقديم الخدمة "كما هي" دون ضمانات من أي نوع. لن نكون مسؤولين عن أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية. مسؤوليتنا الإجمالية لن تتجاوز المبلغ الذي دفعته لنا في الأشهر الـ 12 الماضية.'
        : 'The service is provided "as is" without warranties of any kind. We will not be liable for any indirect, incidental, special, or consequential damages. Our total liability will not exceed the amount you paid us in the past 12 months.',
    },
    {
      title: isAr ? 'إنهاء الخدمة' : 'Termination',
      content: isAr
        ? 'يمكنك إنهاء حسابك في أي وقت من خلال الإعدادات. يحق لنا إنهاء أو تعليق حسابك فوراً إذا انتهكت هذه الشروط. عند الإنهاء، ستفقد الوصول إلى حسابك وبياناتك بعد فترة السماح (30 يوماً).'
        : 'You can terminate your account at any time through Settings. We reserve the right to terminate or suspend your account immediately if you violate these terms. Upon termination, you will lose access to your account and data after the grace period (30 days).',
    },
    {
      title: isAr ? 'القانون الحاكم' : 'Governing Law',
      content: isAr
        ? 'تخضع هذه الشروط لقوانين الولايات المتحدة الأمريكية. أي نزاعات ستتم تسويتها من خلال التحكيم الملزم. توافق على الاختصاص القضائي الحصري للمحاكم في ولاية كاليفورنيا.'
        : 'These terms are governed by the laws of the United States. Any disputes will be resolved through binding arbitration. You agree to the exclusive jurisdiction of the courts in the State of California.',
    },
    {
      title: isAr ? 'تواصل معنا' : 'Contact',
      content: isAr
        ? 'لأي أسئلة حول هذه الشروط، يرجى التواصل معنا عبر البريد الإلكتروني: support@amanahlife.app'
        : 'For any questions about these terms, please contact us via email: support@amanahlife.app',
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="📜" title={isAr ? 'شروط الخدمة' : 'Terms of Service'} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {isAr ? 'آخر تحديث: 24 مايو 2026' : 'Last updated: May 24, 2026'}
          </p>
          <p className="text-muted-foreground mt-3">
            {isAr
              ? 'يرجى قراءة هذه الشروط بعناية قبل استخدام تطبيق أمانة لايف.'
              : 'Please read these terms carefully before using AmanahLife.'}
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-bold text-foreground mb-3">
                {index + 1}. {section.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}