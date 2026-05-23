import { Link } from 'react-router-dom';
import { blogPosts, getBlogRoute } from '@/lib/blog';
import { ArrowLeft, BookOpen, Calendar } from 'lucide-react';

const BlogIndexPage = () => (
  <main className="min-h-screen bg-background text-foreground">
    <div className="bg-gradient-to-b from-primary/20 to-background px-4 pt-12 pb-8">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Blog
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Articles and tips to enhance your balanced lifestyle
        </p>
      </div>
    </div>

    <section className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-6 md:grid-cols-2">
        {blogPosts.length > 0 ? (
          blogPosts.map((post) => (
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
                  Read article →
                </Link>
              </div>
            </article>
          ))
        ) : (
          <section className="col-span-full rounded-2xl border border-dashed border-border bg-card p-8">
            <h2 className="text-2xl font-bold text-foreground">No articles yet</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Articles will appear here soon. Check back later for content about
              Islamic lifestyle, productivity, and halal finance.
            </p>
          </section>
        )}
      </div>
    </section>
  </main>
);

export default BlogIndexPage;