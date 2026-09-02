import { parse as parseYaml } from 'yaml';

type WealthFrontmatterValue = string | string[];

type WealthFrontmatter = Record<string, WealthFrontmatterValue | undefined> & {
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
};

type WealthPost = {
  slug: string;
  markdown: string;
  title: string;
  description: string;
  frontmatter: WealthFrontmatter;
};

type WealthSeoMeta = {
  title: string;
  description: string;
  keywords?: string;
  lang?: string;
  url?: string;
  siteName: string;
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogType: string;
  publishedTime?: string;
  tags?: string[];
};

const markdownModules = import.meta.glob(
  ['../../seo/wealth-content/**/*.md'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

function parseFrontmatter(markdown: string) {
  if (!markdown.startsWith('---')) {
    return {
      data: {} satisfies WealthFrontmatter,
      content: markdown,
    };
  }

  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!frontmatterMatch) {
    return {
      data: {} satisfies WealthFrontmatter,
      content: markdown,
    };
  }

  const rawFrontmatter = frontmatterMatch[1];
  const content = markdown.slice(frontmatterMatch[0].length);

  try {
    const parsed = parseYaml(rawFrontmatter);
    const data = normalizeFrontmatter(parsed);

    return { data, content };
  } catch (error) {
    console.warn(
      'Failed to parse wealth frontmatter, falling back to raw content',
      error,
    );

    return {
      data: {} satisfies WealthFrontmatter,
      content: markdown,
    };
  }
}

function normalizeFrontmatter(value: unknown): WealthFrontmatter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, entryValue]) => {
      if (Array.isArray(entryValue)) {
        return [
          key,
          entryValue
            .map((item) => String(item).trim())
            .filter(Boolean),
        ] as const;
      }

      if (entryValue === null || typeof entryValue === 'undefined') {
        return [key, undefined] as const;
      }

      return [key, String(entryValue).trim()] as const;
    },
  );

  return Object.fromEntries(entries) as WealthFrontmatter;
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function descriptionFromMarkdown(markdown: string) {
  const plainText = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText.slice(0, 160);
}

function normalizeSlug(filePath: string) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^.*\/seo\/wealth-content\//, '')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');
}

function compareWealthPosts(a: WealthPost, b: WealthPost) {
  const aTime = a.frontmatter.date ? Date.parse(a.frontmatter.date) : NaN;
  const bTime = b.frontmatter.date ? Date.parse(b.frontmatter.date) : NaN;

  if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
    return bTime - aTime;
  }

  if (!Number.isNaN(aTime) && Number.isNaN(bTime)) {
    return -1;
  }

  if (Number.isNaN(aTime) && !Number.isNaN(bTime)) {
    return 1;
  }

  return a.slug.localeCompare(b.slug);
}

const wealthPosts: WealthPost[] = Object.entries(markdownModules)
  .map(([filePath, rawMarkdown]) => {
    const { data, content } = parseFrontmatter(rawMarkdown);
    const slug = normalizeSlug(filePath);
    const frontmatter = data;
    const title = frontmatter.title || titleFromSlug(slug.split('/').pop() || slug);
    const description = frontmatter.description || descriptionFromMarkdown(content);

    return {
      slug,
      markdown: content,
      title,
      description,
      frontmatter,
    };
  })
  .sort(compareWealthPosts);

function getWealthPost(slug: string) {
  return wealthPosts.find((post) => post.slug === slug);
}

// /wealth/ has no single post of its own, so it has no per-article hero
// image to use for its og:image - fall back to the most recent English
// post's hero image (matches what the index page itself actually lists)
// rather than the site-wide app logo used everywhere else on the site.
function getWealthIndexImage(): { image?: string; alt: string } {
  const featured = wealthPosts.find((post) => {
    const lang = typeof post.frontmatter.lang === 'string' ? post.frontmatter.lang : 'en';
    return lang === 'en';
  });
  const image =
    frontmatterString(featured?.frontmatter ?? {}, 'og_image') ??
    frontmatterString(featured?.frontmatter ?? {}, 'hero_image');
  return { image, alt: featured?.title ?? getSiteName() };
}

function getWealthRoute(slug: string) {
  return `/wealth/${slug}/`.replace(/\/+/g, '/');
}

function getSiteDomainUrl() {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();
  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : undefined;
}

function getSiteName() {
  return import.meta.env.VITE_APP_TITLE?.trim() || 'AmanahLife';
}

function getAbsoluteUrl(pathname: string) {
  const siteDomainUrl = getSiteDomainUrl();
  if (!siteDomainUrl) {
    return undefined;
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${siteDomainUrl}${normalizedPath}`;
}

// og:image must be an absolute URL per the Open Graph spec - social
// crawlers (Facebook, WhatsApp, LinkedIn) don't reliably resolve a relative
// one the way a browser would. /wealth/'s images are local
// (/assets/wealth/...), unlike /blog/'s, which are already absolute CDN
// URLs - only prefix when the value isn't already absolute, so a future
// externally-hosted image wouldn't get double-prefixed.
function toAbsoluteImageUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return getAbsoluteUrl(value);
}

function hasWealthPosts() {
  return wealthPosts.length > 0;
}

function frontmatterString(
  frontmatter: WealthFrontmatter,
  key: string,
): string | undefined {
  const value = frontmatter[key];
  return typeof value === 'string' ? value : undefined;
}

function frontmatterStringList(
  frontmatter: WealthFrontmatter,
  key: string,
): string[] | undefined {
  const value = frontmatter[key];

  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return undefined;
}

function getWealthSeoMeta(post?: WealthPost | null): WealthSeoMeta {
  const siteName = getSiteName();
  const fallbackTitle = `AmanahWealth | ${siteName}`;
  const fallbackDescription =
    'Practical guides on halal investing, budgeting, and building lasting wealth the halal way.';

  if (!post) {
    const fallbackUrl = getAbsoluteUrl('/wealth/');
    const indexImage = getWealthIndexImage();
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      url: fallbackUrl,
      siteName,
      ogTitle: fallbackTitle,
      ogDescription: fallbackDescription,
      ogImage: toAbsoluteImageUrl(indexImage.image),
      ogImageAlt: indexImage.alt,
      ogType: 'website',
    };
  }

  const title = `${post.title} | AmanahWealth`;
  const description = post.description;
  const url =
    frontmatterString(post.frontmatter, 'og_url') ??
    getAbsoluteUrl(getWealthRoute(post.slug));
  const keywordsList =
    frontmatterStringList(post.frontmatter, 'keywords') ?? post.frontmatter.tags;
  const ogImage = toAbsoluteImageUrl(
    frontmatterString(post.frontmatter, 'og_image') ??
      frontmatterString(post.frontmatter, 'hero_image'),
  );
  const imageAlt =
    frontmatterString(post.frontmatter, 'og_image_alt') ?? post.title;

  return {
    title,
    description,
    keywords: keywordsList?.join(', '),
    lang: frontmatterString(post.frontmatter, 'lang'),
    url,
    siteName: frontmatterString(post.frontmatter, 'og_site_name') ?? siteName,
    ogTitle: frontmatterString(post.frontmatter, 'og_title') ?? title,
    ogDescription:
      frontmatterString(post.frontmatter, 'og_description') ?? description,
    ogImage,
    ogImageAlt: imageAlt,
    ogType: frontmatterString(post.frontmatter, 'og_type') ?? 'article',
    publishedTime: frontmatterString(post.frontmatter, 'date'),
    tags: post.frontmatter.tags,
  };
}

function getWealthPostsByLang(lang: 'ar' | 'en') {
  return wealthPosts.filter((post) => {
    const postLang = typeof post.frontmatter.lang === 'string' ? post.frontmatter.lang : 'en';
    return postLang === lang;
  });
}

export {
  wealthPosts,
  getWealthPost,
  getWealthPostsByLang,
  getWealthRoute,
  getWealthSeoMeta,
  hasWealthPosts,
};
export type { WealthFrontmatter, WealthPost, WealthSeoMeta };
