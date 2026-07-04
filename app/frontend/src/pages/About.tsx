import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const About = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';

  const content = {
    en: {
      back: 'Back',
      title: 'About AmanahLife',
      desc: 'AmanahLife is a personal life planning and daily log app built for users worldwide. It helps individuals and families plan goals, track habits, manage their daily routines, and grow personally — all in one place. Available globally with full multi-currency support including USD.',
      operated: 'Developed and operated by LinkoraNet LLC, a US-registered company.',
      founderHeading: 'Meet the Founder',
      founderName: 'Huzaifa Al Ezzo',
      founderTitle: 'Founder & CEO, LinkoraNet LLC',
      founderBio: 'Huzaifa Al Ezzo is a bilingual professional with over ten years of experience in administration, human resources, education, and research. Holding a Master of Public Administration and a Bachelor\'s in English Language and Translation, he built AmanahLife out of a genuine desire to help people organize their lives, track their progress, and grow with purpose. His vision is to make AmanahLife a trusted life partner — a tool that walks alongside people on their journey toward a more intentional and fulfilling life.',
      companyHeading: 'The Company',
      companyText: 'AmanahLife is a product of LinkoraNet LLC, a limited liability company registered in the State of Wyoming, United States. LinkoraNet LLC develops digital products and SaaS applications serving users worldwide.',
      photoPlaceholder: '[Add founder photo here]',
      copyright: '© 2026 AmanahLife, a product of LinkoraNet LLC. All rights reserved.',
    },
    ar: {
      back: 'رجوع',
      title: 'عن أمانة لايف',
      desc: 'أمانة لايف تطبيق تخطيط الحياة الشخصية والسجل اليومي مصمم للمستخدمين حول العالم. يساعد الأفراد والعائلات على تخطيط الأهداف وتتبع العادات وإدارة روتينهم اليومي والنمو شخصياً — كل ذلك في مكان واحد. متاح عالمياً مع دعم كامل للعملات المتعددة بما في ذلك الدولار الأمريكي.',
      operated: 'تم تطويره وتشغيله بواسطة شركة LinkoraNet LLC، شركة مسجلة في الولايات المتحدة.',
      founderHeading: 'تعرف على المؤسس',
      founderName: 'حذيفة العزو',
      founderTitle: 'المؤسس والرئيس التنفيذي، LinkoraNet LLC',
      founderBio: 'حذيفة العزو متخصص ثنائي اللغة يمتلك أكثر من عشر سنوات من الخبرة في الإدارة والموارد البشرية والتعليم والبحث العلمي. يحمل ماجستير في الإدارة العامة وبكالوريوس في اللغة الإنجليزية والترجمة، وقد أسس أمانة لايف انطلاقاً من رغبة حقيقية في مساعدة الناس على تنظيم حياتهم وتتبع تقدمهم والنمو بهدف. رؤيته أن يكون أمانة لايف شريكاً حقيقياً في الحياة — أداة ترافق الإنسان في رحلته نحو حياة أكثر وعياً وتحقيقاً.',
      companyHeading: 'عن الشركة',
      companyText: 'أمانة لايف منتج تابع لشركة LinkoraNet LLC، شركة ذات مسؤولية محدودة مسجلة في ولاية وايومنغ، الولايات المتحدة الأمريكية. تطور LinkoraNet LLC منتجات رقمية وتطبيقات SaaS تخدم المستخدمين حول العالم.',
      photoPlaceholder: '[أضف صورة المؤسس هنا]',
      copyright: '© 2026 أمانة لايف، منتج تابع لشركة LinkoraNet LLC. جميع الحقوق محفوظة.',
    },
  };

  const t = content[language] || content.en;

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <h1 className="text-lg font-bold">{t.title}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        {/* About the Product */}
        <section className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-primary">{t.title}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">{t.desc}</p>
          <p className="text-sm text-muted-foreground/80 italic">{t.operated}</p>
        </section>

        {/* Founder Section */}
        <section className="space-y-6">
          <h3 className="text-xl font-bold text-center">{t.founderHeading}</h3>
          <div className="grid md:grid-cols-[200px_1fr] gap-8 items-start">
            <div className="flex flex-col items-center text-center">
              <div className="w-40 h-40 rounded-full border-2 border-dashed border-border flex items-center justify-content-center bg-muted/30 text-muted-foreground text-xs p-4 flex items-center justify-center">
                {t.photoPlaceholder}
              </div>
              <h4 className="mt-4 font-bold text-lg">{t.founderName}</h4>
              <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">{t.founderTitle}</p>

            </div>
            <div>
              <p className="text-muted-foreground leading-relaxed text-[0.95rem]">{t.founderBio}</p>
            </div>
          </div>
        </section>

        {/* Company Section */}
        <section className="text-center space-y-4 pb-8 border-b border-border">
          <h3 className="text-xl font-bold">{t.companyHeading}</h3>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">{t.companyText}</p>
        </section>

        {/* Footer copyright */}
        <div className="text-center text-xs text-muted-foreground/70 pb-4">
          {t.copyright}
        </div>
      </div>
    </div>
  );
};

export default About;