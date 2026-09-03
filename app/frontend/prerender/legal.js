import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import PrivacyPolicy from '../src/pages/PrivacyPolicy';
import PrivacyPolicyAr from '../src/pages/PrivacyPolicyAr';
import About from '../src/pages/About';
import AboutAr from '../src/pages/AboutAr';
import AffiliateDisclosure from '../src/pages/AffiliateDisclosure';
import AffiliateDisclosureAr from '../src/pages/AffiliateDisclosureAr';
import { getLegalPageMeta, getLegalAbsoluteUrl } from '../src/lib/legalPages';

// Unlike /blog/ and /wealth/, there's no dynamic :slug matching here - a
// small fixed table maps each of the 6 known paths directly to its
// component. Still rendered inside a StaticRouter (not called directly)
// because LanguageSwitcher uses <Link>, which requires Router context.
const PAGES = {
  '/privacy': PrivacyPolicy,
  '/privacy/ar': PrivacyPolicyAr,
  '/about': About,
  '/about/ar': AboutAr,
  '/affiliate-disclosure': AffiliateDisclosure,
  '/affiliate-disclosure/ar': AffiliateDisclosureAr,
};

function getHeadElements(url) {
  const meta = getLegalPageMeta(url);
  if (!meta) {
    return undefined;
  }

  const canonicalUrl = getLegalAbsoluteUrl(url);
  const logoUrl = getLegalAbsoluteUrl('/assets/amanah-logo.png');
  const elements = [
    // Same marker prerender/blog.js and prerender/wealth.js emit - the
    // dedup plugin in vite.config.ts finds this exact string to know where
    // the base index.html template's generic tags end and this page's own
    // injected ones begin. Without it, nothing before it ever gets
    // stripped, since the plugin's marker search simply fails to match.
    { type: 'meta', props: { name: 'prerender-static-page', content: 'legal' } },
    canonicalUrl
      ? { type: 'link', props: { rel: 'canonical', href: canonicalUrl } }
      : null,
    { type: 'meta', props: { name: 'description', content: meta.description } },
    { type: 'meta', props: { property: 'og:title', content: meta.title } },
    { type: 'meta', props: { property: 'og:description', content: meta.description } },
    canonicalUrl
      ? { type: 'meta', props: { property: 'og:url', content: canonicalUrl } }
      : null,
    // These are text-only pages with no per-article hero image, unlike
    // /blog/ and /wealth/ - fall back to the site-wide app logo, same
    // getLegalAbsoluteUrl() used for canonical/og:url above so it's an
    // absolute URL, not the relative /assets/... path the base template's
    // own generic og:image already carries (which the dedup plugin below
    // strips as the duplicate). Guarded the same way canonicalUrl is - if
    // VITE_SITE_URL is ever unset, omit the element entirely rather than
    // emit a <meta property="og:image"> with no content attribute.
    logoUrl
      ? { type: 'meta', props: { property: 'og:image', content: logoUrl } }
      : null,
    logoUrl
      ? { type: 'meta', props: { property: 'og:image:alt', content: meta.title } }
      : null,
  ].filter(Boolean);

  return {
    title: meta.title,
    lang: meta.lang,
    elements: new Set(elements),
  };
}

export async function prerender({ url }) {
  const Component = PAGES[url];
  if (!Component) {
    return { html: '' };
  }

  const html = renderToString(
    React.createElement(
      StaticRouter,
      { location: url },
      React.createElement(Component),
    ),
  );

  return {
    html,
    head: getHeadElements(url),
  };
}
