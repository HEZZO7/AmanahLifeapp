import { useLanguage } from '@/contexts/LanguageContext';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';

export default function About() {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isAr ? 'عن أمانة لايف' : 'About AmanahLife'}
        subtitle={isAr ? 'تعرّف على المنتج والمؤسس والشركة' : 'Learn about the product, founder, and company'}
      />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

        {/* About the product */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            {isAr ? 'عن أمانة لايف' : 'About AmanahLife'}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isAr
              ? 'أمانة لايف تطبيق لتخطيط الحياة والتسجيل اليومي مصمّم للمستخدمين حول العالم. يساعد الأفراد والعائلات على تحديد الأهداف وتتبع العادات وإدارة الروتين اليومي والنمو الشخصي — كل ذلك في مكان واحد. متاح عالمياً مع دعم كامل للعملات المتعددة بما فيها الدولار الأمريكي.'
              : 'AmanahLife is a personal life planning and daily log app built for users worldwide. It helps individuals and families plan goals, track habits, manage their daily routines, and grow personally — all in one place. Available globally with full multi-currency support including USD.'}
          </p>
          <p className="text-sm font-semibold text-primary">
            {isAr
              ? 'طوّرته وتشغّله شركة LinkoraNet LLC، وهي شركة مسجّلة في الولايات المتحدة.'
              : 'Developed and operated by LinkoraNet LLC, a US-registered company.'}
          </p>
        </section>

        {/* Meet the Founder */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
            {isAr ? 'تعرّف على المؤسس' : 'Meet the Founder'}
          </p>
          <div className="flex gap-6 items-start flex-wrap">
            {/* Placeholder photo */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              {/* TODO(Huzaifa): Replace with professional photo */}
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-primary flex items-center justify-center bg-primary/10 text-4xl">
                👤
              </div>
              <span className="text-xs text-muted-foreground text-center max-w-[96px]">
                {isAr ? '[أضف صورة المؤسس هنا]' : '[Add founder photo here]'}
              </span>
            </div>

            <div className="flex-1 min-w-[220px] space-y-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Huzaifa Al Ezzo</h3>
                <p className="text-sm text-muted-foreground">
                  {isAr ? 'المؤسس والرئيس التنفيذي، LinkoraNet LLC' : 'Founder & CEO, LinkoraNet LLC'}
                </p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isAr
                  ? 'حذيفة العزو متخصص ثنائي اللغة يمتلك أكثر من عشر سنوات من الخبرة في الإدارة والموارد البشرية والتعليم والبحث. يحمل ماجستيراً في الإدارة العامة وبكالوريوس في اللغة الإنجليزية والترجمة، وبنى أمانة لايف من رغبة حقيقية في مساعدة الناس على تنظيم حياتهم وتتبع تقدمهم والنمو بهدف. تتمثل رؤيته في جعل أمانة لايف رفيقاً موثوقاً للحياة — أداة ترافق الناس في رحلتهم نحو حياة أكثر تعمداً وإشباعاً.'
                  : 'Huzaifa Al Ezzo is a bilingual professional with over ten years of experience in administration, human resources, education, and research. Holding a Master of Public Administration and a Bachelor\'s in English Language and Translation, he built AmanahLife out of a genuine desire to help people organize their lives, track their progress, and grow with purpose. His vision is to make AmanahLife a trusted life partner — a tool that walks alongside people on their journey toward a more intentional and fulfilling life.'}
              </p>
              <a
                href="https://www.linkedin.com/in/huzaifa-ezzo-trans7"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary border border-primary rounded-full px-4 py-1.5 hover:bg-primary/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            </div>
          </div>
        </section>

        {/* The Company */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-primary">
            {isAr ? 'الشركة' : 'The Company'}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isAr
              ? 'أمانة لايف منتج تابع لشركة LinkoraNet LLC، وهي شركة ذات مسؤولية محدودة مسجّلة في ولاية وايومنغ، الولايات المتحدة الأمريكية. تطوّر LinkoraNet LLC منتجات رقمية وتطبيقات SaaS تخدم المستخدمين حول العالم.'
              : 'AmanahLife is a product of LinkoraNet LLC, a limited liability company registered in the State of Wyoming, United States. LinkoraNet LLC develops digital products and SaaS applications serving users worldwide.'}
          </p>
        </section>

      </main>

      <Footer />
    </div>
  );
}
