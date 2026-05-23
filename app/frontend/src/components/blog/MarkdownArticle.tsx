import Markdown from 'markdown-to-jsx';
import { useLanguage } from '@/contexts/LanguageContext';

type MarkdownArticleProps = {
  markdown: string;
};

const MarkdownArticle = ({ markdown }: MarkdownArticleProps) => {
  const { isRTL } = useLanguage();

  return (
    <div
      className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-foreground prose-h1:mt-0 prose-h1:text-3xl prose-h1:leading-tight prose-h2:mt-12 prose-h2:border-t prose-h2:border-border prose-h2:pt-8 prose-h2:text-2xl prose-h2:leading-snug prose-h3:mt-10 prose-h3:text-xl prose-h3:leading-snug prose-p:text-base prose-p:leading-8 prose-p:text-muted-foreground prose-li:leading-8 prose-li:text-muted-foreground prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:font-medium prose-pre:rounded-2xl prose-pre:bg-card prose-pre:border prose-pre:border-border prose-pre:p-5 prose-a:text-primary prose-a:decoration-primary/50 prose-a:underline-offset-4 hover:prose-a:text-primary/80"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={isRTL ? { fontFamily: "'Amiri', 'Tajawal', serif" } : undefined}
    >
      <Markdown
        options={{
          forceBlock: true,
          overrides: {
            a: {
              props: {
                className: 'font-medium',
              },
            },
            code: {
              props: {
                className: '',
              },
            },
            pre: {
              props: {
                className: 'overflow-x-auto',
              },
            },
          },
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
};

export default MarkdownArticle;