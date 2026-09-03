import { useSEO } from '@/hooks/useSEO';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/legal/LanguageSwitcher';
import { getLegalPageMeta } from '@/lib/legalPages';

const meta = getLegalPageMeta('/affiliate-disclosure/ar')!;

const sections = [
  {
    title: 'ماذا يعني هذا',
    content: 'تشارك AmanahLife، بما فيها قسم أمانة ويلث، في شراكات أفيليت مع بعض المنتجات والخدمات المالية المذكورة في محتوانا. إذا نقرت على رابط لأحد هذه المنتجات، وقمت لاحقًا بفتح حساب أو الاشتراك أو الشراء، قد نحصل على عمولة. هذا دون أي تكلفة إضافية عليك.',
  },
  {
    title: 'ماذا لا يعنيه هذا',
    content: 'علاقة العمولة لا تؤثر على المواضيع التي نغطيها أو استنتاجاتنا حول توافق أي منتج شرعيًا أو ملاءمته. شروحات الفحص والمحتوى التعليمي لدينا مبنية على معايير منشورة (مثل AAOIFI) ومعلومات متاحة للعموم، بمعزل عن أي علاقة تجارية.',
  },
  {
    title: 'التزامنا',
    content: 'لا نوصي بأي منتج لمجرد أنه يدفع عمولة. نُفصح عن علاقات الأفيليت بوضوح في كل مقالة تظهر فيها. نربط بالموقع الرسمي للمزود كخيار افتراضي؛ أي رابط أفيليت يستبدله فقط عند وجود شراكة رسمية فعلية. المحتوى التحريري وتوصيات المنتجات منفصلة عن أي ترتيب إعلاني أو تجاري.',
  },
  {
    title: 'تنويه مهم',
    content: 'نحن لسنا مستشارًا ماليًا مرخصًا أو عالمًا شرعيًا. المحتوى في هذا الموقع لأغراض تعليمية عامة ولا يشكل استشارة مالية أو شرعية فردية. تحقق دائمًا من الشروط والرسوم وحالة التوافق الشرعي الحالية مباشرة مع أي مزود قبل الاستثمار.',
  },
];

export default function AffiliateDisclosureAr() {
  useSEO({ title: meta.title, description: meta.description });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <PageHeader icon="🤝" title="إفصاح الأفيليت" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <p className="text-muted-foreground">
            توضح هذه الصفحة كيف قد تحصل أمانة لايف على عمولة من الروابط في محتوانا.
          </p>
          <LanguageSwitcher currentPath="/affiliate-disclosure/ar" />
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
