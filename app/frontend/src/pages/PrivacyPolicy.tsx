import { useLanguage } from '@/contexts/LanguageContext';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';

export default function PrivacyPolicy() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const sections = [
    {
      title: isAr ? 'ما هي البيانات التي نجمعها' : 'What Data We Collect',
      content: isAr
        ? 'نجمع المعلومات التالية: معلومات الحساب (الاسم، البريد الإلكتروني)، بيانات الاستخدام (الصفحات التي تزورها، الميزات التي تستخدمها)، بيانات الجهاز (نوع المتصفح، نظام التشغيل)، وبيانات الموقع (لحساب أوقات الصلاة واتجاه القبلة فقط).'
        : 'We collect the following information: Account information (name, email), usage data (pages visited, features used), device data (browser type, operating system), and location data (for prayer time calculations and Qibla direction only).',
    },
    {
      title: isAr ? 'كيف نستخدم بياناتك' : 'How We Use Your Data',
      content: isAr
        ? 'نستخدم بياناتك لتقديم خدماتنا وتحسينها، تخصيص تجربتك، إرسال إشعارات مهمة، معالجة المدفوعات، وتحليل أنماط الاستخدام لتحسين التطبيق.'
        : 'We use your data to provide and improve our services, personalize your experience, send important notifications, process payments, and analyze usage patterns to improve the application.',
    },
    {
      title: isAr ? 'خدمات الطرف الثالث' : 'Third-Party Services',
      content: isAr
        ? 'نستخدم الخدمات التالية: Supabase (استضافة قاعدة البيانات والمصادقة)، Lemon Squeezy/Paddle (معالجة المدفوعات)، Google (المصادقة عبر OAuth)، وAladhan API (أوقات الصلاة). كل خدمة لديها سياسة خصوصية خاصة بها.'
        : 'We use the following services: Supabase (database hosting and authentication), Lemon Squeezy/Paddle (payment processing), Google (OAuth authentication), and Aladhan API (prayer times). Each service has its own privacy policy.',
    },
    {
      title: isAr ? 'ملفات تعريف الارتباط' : 'Cookies',
      content: isAr
        ? 'نستخدم ملفات تعريف الارتباط والتخزين المحلي للحفاظ على جلسة تسجيل الدخول، حفظ تفضيلاتك (اللغة، المظهر)، وتخزين بيانات التطبيق محلياً. يمكنك مسح هذه البيانات في أي وقت من إعدادات المتصفح.'
        : 'We use cookies and local storage to maintain your login session, save your preferences (language, theme), and store application data locally. You can clear this data at any time from your browser settings.',
    },
    {
      title: isAr ? 'الاحتفاظ بالبيانات' : 'Data Retention',
      content: isAr
        ? 'نحتفظ ببياناتك طالما أن حسابك نشط. عند حذف حسابك، سيتم حذف جميع بياناتك الشخصية خلال 30 يوماً. قد نحتفظ ببعض البيانات المجمعة لأغراض التحليل.'
        : 'We retain your data as long as your account is active. When you delete your account, all your personal data will be deleted within 30 days. We may retain some aggregated data for analytical purposes.',
    },
    {
      title: isAr ? 'حقوق المستخدم' : 'Your Rights',
      content: isAr
        ? 'لديك الحق في: الوصول إلى بياناتك الشخصية، طلب تصحيح البيانات غير الدقيقة، طلب حذف بياناتك، تصدير بياناتك بتنسيق قابل للقراءة، الاعتراض على معالجة بياناتك، وسحب موافقتك في أي وقت.'
        : 'You have the right to: Access your personal data, request correction of inaccurate data, request deletion of your data, export your data in a readable format, object to processing of your data, and withdraw your consent at any time.',
    },
    {
      title: isAr ? 'الامتثال لـ GDPR و CCPA' : 'GDPR & CCPA Compliance',
      content: isAr
        ? 'نلتزم بلائحة حماية البيانات العامة (GDPR) وقانون خصوصية المستهلك في كاليفورنيا (CCPA). إذا كنت مقيماً في الاتحاد الأوروبي أو كاليفورنيا، لديك حقوق إضافية بما في ذلك الحق في معرفة البيانات المجمعة، الحق في الحذف، والحق في عدم التمييز.'
        : 'We comply with the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA). If you are a resident of the EU or California, you have additional rights including the right to know what data is collected, the right to deletion, and the right to non-discrimination.',
    },
    {
      title: isAr ? 'خصوصية الأطفال' : "Children's Privacy",
      content: isAr
        ? 'خدماتنا غير موجهة للأطفال دون سن 13 عاماً. لا نجمع عن قصد معلومات شخصية من الأطفال. إذا علمنا أننا جمعنا بيانات من طفل، سنحذفها فوراً.'
        : 'Our services are not directed to children under 13 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will delete it immediately.',
    },
    {
      title: isAr ? 'التغييرات على السياسة' : 'Changes to This Policy',
      content: isAr
        ? 'قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل التطبيق. استمرارك في استخدام الخدمة بعد التغييرات يعني موافقتك عليها.'
        : 'We may update this privacy policy from time to time. We will notify you of any material changes via email or in-app notification. Your continued use of the service after changes constitutes acceptance of the updated policy.',
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="🔒" title={isAr ? 'سياسة الخصوصية' : 'Privacy Policy'} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {isAr ? 'آخر تحديث: 24 مايو 2026' : 'Last updated: May 24, 2026'}
          </p>
          <p className="text-muted-foreground mt-3">
            {isAr
              ? 'نحن في Smart Life Companion نقدر خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيف نجمع ونستخدم ونحمي معلوماتك.'
              : 'At Smart Life Companion, we value your privacy and are committed to protecting your personal data. This policy explains how we collect, use, and protect your information.'}
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-bold text-foreground mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-bold text-foreground mb-3">
            {isAr ? 'تواصل معنا' : 'Contact Us'}
          </h2>
          <p className="text-muted-foreground">
            {isAr
              ? 'إذا كانت لديك أي أسئلة حول سياسة الخصوصية هذه، يرجى التواصل معنا على:'
              : 'If you have any questions about this privacy policy, please contact us at:'}
          </p>
          <a
            href="mailto:support@smartlifecompanion.app"
            className="text-primary hover:underline mt-2 inline-block"
          >
            support@smartlifecompanion.app
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}