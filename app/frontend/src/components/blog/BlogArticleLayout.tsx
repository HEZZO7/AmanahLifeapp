import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type BlogArticleLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const BlogArticleLayout = ({
  title,
  description,
  children,
}: BlogArticleLayoutProps) => (
  <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-4xl px-4 pt-8">
      <Link
        to="/blog/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to blog
      </Link>
    </div>
    <article className="mx-auto max-w-3xl px-4 py-12">
      <header className="border-b border-border pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
          Blog Article
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

export default BlogArticleLayout;