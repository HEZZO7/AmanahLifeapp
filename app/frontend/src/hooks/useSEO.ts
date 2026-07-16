import { useEffect } from 'react';

interface SEOOptions {
  title: string;
  description: string;
  /** Optional JSON-LD structured data object(s) to inject as <script type="application/ld+json"> */
  jsonLd?: object | object[];
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Sets a unique document title/description/OG tags per page, since this is a
 * client-rendered SPA with a single static index.html — without this, every
 * route shares the same title/description regardless of content.
 */
export function useSEO({ title, description, jsonLd }: SEOOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);

    const scripts: HTMLScriptElement[] = [];
    if (jsonLd) {
      const entries = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const entry of entries) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(entry);
        document.head.appendChild(script);
        scripts.push(script);
      }
    }

    return () => {
      document.title = prevTitle;
      scripts.forEach((s) => s.remove());
    };
  }, [title, description, jsonLd]);
}
