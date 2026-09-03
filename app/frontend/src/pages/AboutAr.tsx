import { useSEO } from '@/hooks/useSEO';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '@/components/legal/LanguageSwitcher';
import Footer from '@/components/Footer';
import { getLegalPageMeta } from '@/lib/legalPages';

const meta = getLegalPageMeta('/about/ar')!;

const t = {
  title: 'عن أمانة لايف',
  desc: 'أمانة لايف تطبيق تخطيط الحياة الشخصية والسجل اليومي مصمم للمستخدمين حول العالم. يساعد الأفراد والعائلات على تخطيط الأهداف وتتبع العادات وإدارة روتينهم اليومي والنمو شخصياً — كل ذلك في مكان واحد. متاح عالمياً مع دعم كامل للعملات المتعددة بما في ذلك الدولار الأمريكي.',
  operated: 'تم تطويره وتشغيله بواسطة شركة LinkoraNet LLC، شركة مسجلة في الولايات المتحدة.',
  companyHeading: 'عن الشركة',
  companyText: 'أمانة لايف منتج تابع لشركة LinkoraNet LLC، شركة ذات مسؤولية محدودة مسجلة في ولاية وايومنغ، الولايات المتحدة الأمريكية. تطور LinkoraNet LLC منتجات رقمية وتطبيقات SaaS تخدم المستخدمين حول العالم.',
  copyright: '© 2026 أمانة لايف، منتج تابع لشركة LinkoraNet LLC. جميع الحقوق محفوظة.',
};

const AboutAr = () => {
  const navigate = useNavigate();

  useSEO({
    title: meta.title,
    description: meta.description,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'LinkoraNet LLC',
        url: 'https://app.amanahlife.com/about/ar',
        description: 'LinkoraNet LLC develops digital products and SaaS applications serving users worldwide, including AmanahLife.',
      },
    ],
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </button>
          <h1 className="text-lg font-bold flex-1">{t.title}</h1>
          <LanguageSwitcher currentPath="/about/ar" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        {/* About the Product */}
        <section className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-primary">{t.title}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">{t.desc}</p>
          <p className="text-sm text-muted-foreground/80 italic">{t.operated}</p>
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

      <Footer />
    </div>
  );
};

export default AboutAr;
