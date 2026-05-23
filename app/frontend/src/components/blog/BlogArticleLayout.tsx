import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type BlogArticleLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const layoutTranslations = {
  backToBlog: { ar: 'العودة للمدونة', en: 'Back to blog' },
  blogArticle: { ar: 'مقال المدونة', en: 'Blog Article' },
};

const BlogArticleLayout = ({
  title,
  description,
  children,
}: BlogArticleLayoutProps) => {
  const { language, isRTL } = useLanguage();
  const lt = (key: keyof typeof layoutTranslations) => layoutTranslations[key][language];
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <main
      className="min-h-screen bg-background text-foreground"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={isRTL ? { fontFamily: "'Amiri', 'Tajawal', serif" } : undefined}
    >
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <Link
          to="/blog/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackArrow className="w-4 h-4" />
          {lt('backToBlog')}
        </Link>
      </div>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <header className="border-b border-border pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            {lt('blogArticle')}
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

export default BlogArticleLayout;