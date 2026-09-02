import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

type WealthArticleLayoutProps = {
  title: string;
  description?: string;
  slug: string;
  children: React.ReactNode;
};

const layoutTranslations = {
  backToWealth: { ar: 'العودة لأمانة ويلث', en: 'Back to wealth' },
  wealthArticle: { ar: 'مقال أمانة ويلث', en: 'AmanahWealth Article' },
};

const WealthArticleLayout = ({
  title,
  description,
  slug,
  children,
}: WealthArticleLayoutProps) => {
  const { language, isRTL } = useLanguage();
  const lt = (key: keyof typeof layoutTranslations) => layoutTranslations[key][language];
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <main
      className="min-h-screen bg-background text-foreground"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={isRTL ? { fontFamily: "'Amiri', 'Tajawal', serif" } : undefined}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 pt-8">
        <Link
          to="/wealth/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackArrow className="w-4 h-4" />
          {lt('backToWealth')}
        </Link>
        <LanguageSwitcher currentSlug={slug} />
      </div>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <header className="border-b border-border pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            {lt('wealthArticle')}
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>

        <div className="mt-10 prose prose-slate dark:prose-invert max-w-none">{children}</div>
      </article>
    </main>
  );
};

export default WealthArticleLayout;
