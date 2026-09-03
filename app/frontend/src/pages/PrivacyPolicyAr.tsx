import { useSEO } from '@/hooks/useSEO';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/legal/LanguageSwitcher';
import { getLegalPageMeta } from '@/lib/legalPages';

const meta = getLegalPageMeta('/privacy/ar')!;

const sections = [
  {
    title: 'المعلومات التي نجمعها',
    content: 'بيانات تُجمع تلقائيًا: عنوان IP، نوع المتصفح، معلومات الجهاز، والصفحات التي تزورها، عبر أدوات تحليل قياسية (مثل Google Analytics) وشركاء إعلانيين (مثل Google AdSense). ملفات تعريف الارتباط: نستخدمها لفهم استخدام الموقع وعرض إعلانات ذات صلة. تستخدم جهات خارجية، بما فيها Google، هذه الملفات لعرض إعلانات بناءً على زياراتك السابقة لهذا الموقع أو غيره. بيانات تُقدَّم طوعًا: إذا اشتركت في نشرتنا البريدية أو تواصلت معنا، نجمع المعلومات التي تقدمها.',
  },
  {
    title: 'كيف نستخدم المعلومات',
    content: 'تشغيل الموقع وتحسينه. عرض إعلانات ذات صلة عبر Google AdSense وشبكات إعلانية أخرى. قياس أداء المحتوى واهتمامات القراء. التواصل معك إذا اشتركت أو تواصلت معنا مباشرة.',
  },
  {
    title: 'الإعلانات من جهات خارجية',
    content: 'يستخدم هذا الموقع خدمة Google AdSense الإعلانية. تستخدم Google، كطرف ثالث، ملفات تعريف ارتباط لعرض الإعلانات بناءً على زياراتك لهذا الموقع ومواقع أخرى. يمكنك إلغاء الاشتراك في الإعلانات المخصصة عبر إعدادات إعلانات Google.',
  },
  {
    title: 'روابط الأفيليت',
    content: 'قد تحتوي بعض المقالات في هذا الموقع، خصوصًا في قسم أمانة ويلث، روابط تابعة (أفيليت). عند النقر عليها وإتمام عملية شراء أو فتح حساب، قد نحصل على عمولة دون أي تكلفة إضافية عليك. راجع صفحة إفصاح الأفيليت للتفاصيل الكاملة.',
  },
  {
    title: 'الاحتفاظ بالبيانات وأمانها',
    content: 'نحتفظ بالبيانات فقط للمدة اللازمة للأغراض المذكورة أعلاه، ونتخذ تدابير معقولة لحمايتها. لا توجد وسيلة نقل عبر الإنترنت آمنة بنسبة 100%.',
  },
  {
    title: 'خياراتك',
    content: 'يمكنك تعطيل ملفات تعريف الارتباط عبر إعدادات متصفحك، مع العلم أن هذا قد يؤثر على وظائف الموقع. يمكنك إلغاء الاشتراك في الإعلانات المخصصة عبر الرابط أعلاه.',
  },
  {
    title: 'التعديلات على هذه السياسة',
    content: 'قد نحدّث هذه السياسة دوريًا. استمرار استخدامك للموقع بعد أي تعديل يُعتبر موافقة على السياسة المحدَّثة.',
  },
];

export default function PrivacyPolicyAr() {
  useSEO({ title: meta.title, description: meta.description });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <PageHeader icon="🔒" title="سياسة الخصوصية" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">آخر تحديث: 3 سبتمبر 2026</p>
            <p className="text-muted-foreground mt-3">
              نحن في أمانة لايف نقدر خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيف نجمع ونستخدم ونحمي معلوماتك.
            </p>
          </div>
          <LanguageSwitcher currentPath="/privacy/ar" />
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
          <h2 className="text-lg font-bold text-foreground mb-3">تواصل معنا</h2>
          <p className="text-muted-foreground">
            إذا كانت لديك أي أسئلة حول سياسة الخصوصية هذه، يرجى التواصل معنا على:
          </p>
          <a
            href="mailto:support@amanahlife.com"
            className="text-primary hover:underline mt-2 inline-block"
          >
            support@amanahlife.com
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
