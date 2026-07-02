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
        'معلومات الحساب (الاسم، البريد الإلكتروني)',
        'بيانات الاستخدام والتفضيلات',
        'البيانات المالية المُدخلة في التطبيق (الميزانيات، المعاملات)',
        'الأهداف والعادات والتقدّم المسجّل',
      ]
    : [
        'Account information (name, email)',
        'Usage data and preferences',
        'Financial data entered in the app (budgets, transactions)',
        'Goals, habits, and recorded progress',
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
              ? 'حذف الحساب نهائي ولا يمكن التراجع عنه. يتم حذف ما يلي:'
              : 'Account deletion is permanent and cannot be undone. The following is deleted:'}
          </p>
          <ul className="list-disc ps-5 space-y-1 text-sm text-muted-foreground">
            {dataRemoved.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6 space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            {isAr ? 'لا يمكنك تسجيل الدخول؟' : "Can't sign in?"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'إذا كنت غير قادر على تسجيل الدخول إلى حسابك، راسلنا على البريد التالي وسنقوم بحذف حسابك وبياناتك يدوياً خلال 30 يوماً:'
              : "If you're unable to sign in to your account, email us and we'll manually delete your account and data within 30 days:"}
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
