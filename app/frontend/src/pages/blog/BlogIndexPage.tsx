import { Link } from 'react-router-dom';
import { getBlogPostsByLang, getBlogRoute } from '@/lib/blog';
import { ArrowLeft, ArrowRight, BookOpen, Calendar } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const blogTranslations = {
  blog: { ar: 'المدونة', en: 'Blog' },
  home: { ar: 'الرئيسية', en: 'Home' },
  subtitle: { ar: 'مقالات ونصائح لتعزيز نمط حياتك المتوازن', en: 'Articles and tips to enhance your balanced lifestyle' },
  noArticles: { ar: 'لا توجد مقالات بعد', en: 'No articles yet' },
  noArticlesDesc: { ar: 'ستظهر المقالات هنا قريباً. تابعنا للحصول على محتوى حول نمط الحياة الإسلامي والإنتاجية والمالية الحلال.', en: 'Articles will appear here soon. Check back later for content about Islamic lifestyle, productivity, and halal finance.' },
  readArticle: { ar: '← اقرأ المقال', en: 'Read article →' },
};

const BlogIndexPage = () => {
  const { language, isRTL } = useLanguage();
  const posts = getBlogPostsByLang(language);

  const bt = (key: keyof typeof blogTranslations) => blogTranslations[key][language];
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <main
      className="min-h-screen bg-background text-foreground"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={isRTL ? { fontFamily: "'Amiri', 'Tajawal', serif" } : undefined}
    >
      <div className="bg-gradient-to-b from-primary/20 to-background px-4 pt-12 pb-8">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <BackArrow className="w-4 h-4" />
            <span>{bt('home')}</span>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {bt('blog')}
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            {bt('subtitle')}
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {posts.length > 0 ? (
            posts.map((post) => (
              <article
                key={post.slug}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                {post.frontmatter.hero_image && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.frontmatter.hero_image as string}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Calendar className="w-3 h-3" />
                    <span>{post.frontmatter.date || '2026'}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                    <Link to={getBlogRoute(post.slug)}>
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {post.description}
                  </p>
                  {post.frontmatter.keywords && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(typeof post.frontmatter.keywords === 'string'
                        ? post.frontmatter.keywords.split(',')
                        : post.frontmatter.keywords
                      )
                        .slice(0, 3)
                        .map((kw: string) => (
                          <span
                            key={kw}
                            className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                          >
                            {kw.trim()}
                          </span>
                        ))}
                    </div>
                  )}
                  <Link
                    to={getBlogRoute(post.slug)}
                    className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
                  >
                    {bt('readArticle')}
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <section className="col-span-full rounded-2xl border border-dashed border-border bg-card p-8">
              <h2 className="text-2xl font-bold text-foreground">{bt('noArticles')}</h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                {bt('noArticlesDesc')}
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
};

export default BlogIndexPage;