import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';

export default function DeleteAccount() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  const steps = [
    {
      title: isAr ? 'سجّل الدخول إلى حسابك' : 'Sign in to your account',
      body: isAr
        ? 'افتح تطبيق أمانة لايف (الويب أو أندرويد) وسجّل الدخول بحسابك.'
        : 'Open AmanahLife (web or Android) and sign in with your account.',
    },
    {
      title: isAr ? 'اذهب إلى الإعدادات' : 'Go to Settings',
      body: isAr
        ? 'من القائمة الرئيسية، افتح صفحة الإعدادات.'
        : 'From the main menu, open the Settings page.',
    },
    {
      title: isAr ? 'منطقة الخطر ← حذف الحساب' : 'Danger Zone → Delete Account',
      body: isAr
        ? 'مرّر إلى أسفل الصفحة إلى "منطقة الخطر"، اضغط "حذف الحساب"، ثم اكتب DELETE للتأكيد.'
        : 'Scroll to the bottom of the page to the "Danger Zone" section, tap "Delete Account", then type DELETE to confirm.',
    },
  ];

  const dataRemoved = isAr
    ? [
        'حساب تسجيل الدخول وملف اشتراكه المجاني أو التجريبي المؤهل للحذف',
        'تفضيلات الإشعارات وتسجيلات إشعارات الجهاز وسجل البحث وإعدادات الملخص البريدي',
        'البيانات المحلية في المتصفح الذي أكمل الحذف من الإعدادات',
      ]
    : [
        'The sign-in account and its eligible free or trial subscription record',
        'Notification preferences, device push registrations, search history and email-digest settings',
        'Local data in the browser that completed deletion through Settings',
      ];

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isAr ? 'حذف الحساب' : 'Delete Your Account'}
        subtitle={isAr ? 'كيفية حذف حسابك وبياناتك من أمانة لايف' : 'How to permanently delete your AmanahLife account and data'}
      />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            {isAr ? 'خطوات حذف الحساب داخل التطبيق' : 'Steps to delete your account in-app'}
          </h2>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-foreground text-sm">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-semibold text-primary border border-primary rounded-full px-4 py-2 hover:bg-primary/10 transition-colors"
          >
            {isAr ? 'تسجيل الدخول لحذف الحساب' : 'Sign in to delete your account'}
          </button>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {isAr ? 'ما الذي يتم حذفه' : 'What gets deleted'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'إذا سُمح بالحذف واكتمل بنجاح، فهو نهائي ولا يمكن التراجع عنه. يشمل النطاق المدعوم ما يلي؛ أما النسخ الاحتياطية والأجهزة الأخرى فلا تُمسح تلقائياً:'
              : 'If deletion is allowed and completes, it is permanent. The supported scope includes the following; exported backups and other devices are not cleared automatically:'}
          </p>
          <ul className="list-disc ps-5 space-y-1 text-sm text-muted-foreground">
            {dataRemoved.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {isAr ? 'الفوترة والاحتفاظ بالسجلات' : 'Billing and record retention'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'وجود تاريخ فوترة أو حجز دفع يمنع الحذف التلقائي إلى حين مراجعة الدعم. يبقى هذا القيد بعد إلغاء التجديد أو انتهاء الاشتراك؛ لا يوجد وعد بحذف سجلات الفوترة أو مدة احتفاظ محددة هنا. طلب حذف الحساب لا يُلغي الاشتراك ولا يغيّر الوصول المدفوع. افتح إدارة الاشتراك لإدارة التجديد، ثم تواصل مع الدعم لطلب مراجعة الحذف والاحتفاظ بالسجلات.'
              : 'Billing history or a payment reservation blocks automatic deletion pending support review, including after renewal cancellation or expiry. No billing-record deletion or fixed retention period is promised here. Requesting account deletion does not cancel a subscription or change paid access. Use subscription management for renewal, then contact support for deletion and retention review.'}
          </p>
          <a href="/subscription" className="text-sm font-semibold text-primary underline">
            {isAr ? 'إدارة الاشتراك' : 'Manage subscription'}
          </a>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            {isAr ? 'لا يمكنك تسجيل الدخول؟' : "Can't sign in?"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'إذا تعذر تسجيل الدخول أو مُنع الحذف، راسل الدعم لطلب مراجعة الهوية ونطاق الحذف والاحتفاظ بالسجلات. التواصل مع الدعم لا يعني اكتمال الحذف أو إلغاء الاشتراك:'
              : 'If you cannot sign in or deletion is blocked, contact support for an identity, deletion-scope and retention review. Contacting support does not mean deletion or subscription cancellation has completed:'}
          </p>
          <a href="mailto:support@amanahlife.com" className="text-sm font-semibold text-primary">
            support@amanahlife.com
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
}
