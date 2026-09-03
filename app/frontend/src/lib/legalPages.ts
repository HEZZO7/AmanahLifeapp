// Metadata for the site-wide legal/informational pages (privacy, about,
// affiliate-disclosure). Unlike /blog/ and /wealth/, these are a small,
// fixed set of pages with no growing content collection, so there's no
// markdown/frontmatter system here - just a small table both the pages
// themselves (for client-side title/description sync via useSEO) and the
// prerender script (prerender/legal.js, for canonical/title/description at
// build time) read from, so the two never drift apart.
//
// Each page's language pairing is a fixed 1:1 path swap
// (/privacy <-> /privacy/ar), not a lookup against a content list - unlike
// /wealth/, a legal page missing its counterpart would be a real bug, not
// an expected "not translated yet" state.

type LegalLang = 'en' | 'ar';

export type LegalPageMeta = {
  path: string;
  lang: LegalLang;
  title: string;
  description: string;
};

export const LEGAL_PAGES: LegalPageMeta[] = [
  {
    path: '/privacy',
    lang: 'en',
    title: 'Privacy Policy — AmanahLife',
    description: 'Learn how AmanahLife collects, uses, and protects your personal data.',
  },
  {
    path: '/privacy/ar',
    lang: 'ar',
    title: 'سياسة الخصوصية — أمانة لايف',
    description: 'تعرف على كيفية جمع أمانة لايف واستخدامها وحمايتها لبياناتك الشخصية.',
  },
  {
    path: '/about',
    lang: 'en',
    title: 'About AmanahLife — Meet the Founder & Company',
    description: 'AmanahLife is a personal life planning app by LinkoraNet LLC. Learn about founder Huzaifa Al Ezzo and the company behind the app.',
  },
  {
    path: '/about/ar',
    lang: 'ar',
    title: 'عن أمانة لايف — تعرف على المؤسس والشركة',
    description: 'أمانة لايف تطبيق لتخطيط الحياة اليومي، طورته شركة LinkoraNet LLC. تعرف على مؤسسها حذيفة العزو ورؤية الشركة.',
  },
  {
    path: '/affiliate-disclosure',
    lang: 'en',
    title: 'Affiliate Disclosure — AmanahLife',
    description: 'AmanahLife\'s affiliate and sponsorship disclosure policy.',
  },
  {
    path: '/affiliate-disclosure/ar',
    lang: 'ar',
    title: 'إفصاح الأفيليت — أمانة لايف',
    description: 'سياسة الإفصاح عن الشراكات والرعايات في تطبيق أمانة لايف.',
  },
];

export function getLegalPageMeta(path: string): LegalPageMeta | undefined {
  return LEGAL_PAGES.find((page) => page.path === path);
}

export function getLegalPagePaths(): string[] {
  return LEGAL_PAGES.map((page) => page.path);
}

function getSiteDomainUrl(): string | undefined {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();
  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : undefined;
}

export function getLegalAbsoluteUrl(pathname: string): string | undefined {
  const siteDomainUrl = getSiteDomainUrl();
  if (!siteDomainUrl) {
    return undefined;
  }
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${siteDomainUrl}${normalizedPath}`;
}
