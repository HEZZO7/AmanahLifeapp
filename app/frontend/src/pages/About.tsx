import { useSEO } from '@/hooks/useSEO';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '@/components/legal/LanguageSwitcher';
import Footer from '@/components/Footer';
import { getLegalPageMeta } from '@/lib/legalPages';

const meta = getLegalPageMeta('/about')!;

const t = {
  title: 'About AmanahLife',
  desc: 'AmanahLife is a personal life planning and daily log app built for users worldwide. It helps individuals and families plan goals, track habits, manage their daily routines, and grow personally — all in one place. Available globally with full multi-currency support including USD.',
  operated: 'Developed and operated by LinkoraNet LLC, a US-registered company.',
  companyHeading: 'The Company',
  companyText: 'AmanahLife is a product of LinkoraNet LLC, a limited liability company registered in the State of Wyoming, United States. LinkoraNet LLC develops digital products and SaaS applications serving users worldwide.',
  copyright: '© 2026 AmanahLife, a product of LinkoraNet LLC. All rights reserved.',
};

const About = () => {
  const navigate = useNavigate();

  useSEO({
    title: meta.title,
    description: meta.description,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'LinkoraNet LLC',
        url: 'https://app.amanahlife.com/about',
        description: 'LinkoraNet LLC develops digital products and SaaS applications serving users worldwide, including AmanahLife.',
      },
    ],
  });

  return (
    <div className="min-h-screen bg-background" dir="ltr">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex-1">{t.title}</h1>
          <LanguageSwitcher currentPath="/about" />
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

export default About;
