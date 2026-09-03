import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'node:fs';
import { viteSourceLocator } from '@metagptx/vite-plugin-source-locator';
import { atoms } from '@metagptx/web-sdk/plugins';
import { vitePrerenderPlugin } from 'vite-prerender-plugin';
import Sitemap from 'vite-plugin-sitemap';
import { getBlogRoutes } from './prerender/blog-routes.js';
import { getSitemapLastmod } from './prerender/blog-sitemap.js';
import { getWealthRoutes } from './prerender/wealth-routes.js';
import { getWealthSitemapLastmod } from './prerender/wealth-sitemap.js';
import { getLegalRoutes } from './prerender/legal-routes.js';

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function collectHtmlFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// vite-prerender-plugin injects each prerendered page's own SEO <meta> tags
// by appending them to the base index.html's <head> (its own source only
// special-cases <title> for find-and-replace; every other head element is
// pure insertAdjacentHTML append, no deduplication). The base template's
// generic description/og:title/og:description/og:url/og:image end up
// duplicated alongside the page-specific ones on every prerendered page -
// most crawlers take the first tag of a given name, so they'd see the
// generic app-wide copy (site root URL, generic app logo) instead of the
// specific one. Strip the generic copies (everything before the
// `prerender-static-page` marker that always precedes the injected block -
// see prerender/blog.js and prerender/wealth.js) once the build has written
// the files, so each of these names appears exactly once, the page-specific
// one. Same mechanism applies to both /blog/ and /wealth/, just pointed at
// each one's own dist/ output directory.
//
// twitter:* is different: the project has no Twitter/X account, so these
// pages should carry zero twitter:* tags, not a deduplicated one. Nothing
// in prerender/blog.js, prerender/wealth.js, BlogPostPage.tsx, or
// WealthPostPage.tsx injects twitter:* any more - the only source left is
// the base template's static twitter:card/title/description/image
// (index.html), which still needs to be stripped from these pages
// specifically (the main app's other pages are untouched - out of scope
// here).
const DUPLICATE_BASE_META = [
  /<meta\s+name="description"[^>]*>\s*/i,
  /<meta\s+property="og:title"[^>]*>\s*/i,
  /<meta\s+property="og:description"[^>]*>\s*/i,
  /<meta\s+property="og:url"[^>]*>\s*/i,
  /<meta\s+property="og:image"[^>]*>\s*/i,
];
const REMOVED_TWITTER_META = /<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi;

function stripDuplicatePrerenderMetaPlugin(dirs: string[]): Plugin {
  return {
    name: 'strip-duplicate-prerender-meta',
    closeBundle() {
      const marker = '<meta name="prerender-static-page"';
      for (const dir of dirs) {
        for (const file of collectHtmlFiles(path.resolve(__dirname, dir))) {
          const html = fs.readFileSync(file, 'utf-8');
          const markerIdx = html.indexOf(marker);
          let next = html;
          if (markerIdx !== -1) {
            const before = html.slice(0, markerIdx);
            const after = html.slice(markerIdx);
            const cleanedBefore = DUPLICATE_BASE_META.reduce(
              (acc, pattern) => acc.replace(pattern, ''),
              before,
            );
            next = cleanedBefore + after;
          }
          next = next.replace(REMOVED_TWITTER_META, '');
          if (next !== html) {
            fs.writeFileSync(file, next, 'utf-8');
          }
        }
      }
    },
  };
}

process.env.VITE_APP_TITLE ??= process.env.OVERVIEW_TITLE ?? 'AmanahLife';
process.env.VITE_APP_DESCRIPTION ??= process.env.OVERVIEW_DESCRIPTION ?? 'Your Smart Life Companion - Finance, Wellness & Spiritual Growth';
process.env.VITE_APP_TITLE = escapeHtmlAttr(process.env.VITE_APP_TITLE);
process.env.VITE_APP_DESCRIPTION = escapeHtmlAttr(process.env.VITE_APP_DESCRIPTION);
process.env.VITE_APP_LOGO_URL ??= process.env.OVERVIEW_LOGO_URL ?? '/assets/amanah-logo.png';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const blogPrerenderRoutes = command === 'build' ? getBlogRoutes() : [];
  const wealthPrerenderRoutes = command === 'build' ? getWealthRoutes() : [];
  const legalPrerenderRoutes = command === 'build' ? getLegalRoutes() : [];

  return {
    plugins: [
      viteSourceLocator({
        prefix: 'mgx', // Prefix used to identify source locations; do not change.
      }),
      react(),
      atoms(),
      Sitemap({
        hostname: 'https://app.amanahlife.com',
        lastmod: { ...getSitemapLastmod(), ...getWealthSitemapLastmod() },
        readable: true,
        generateRobotsTxt: true,
        // These public pages have no prerendered HTML (unlike blog/wealth
        // posts, and now privacy/about/affiliate-disclosure, which the
        // plugin auto-discovers by scanning dist/ output) — list them
        // explicitly so they're at least in the sitemap. /about and
        // /privacy were removed from here once they became genuinely
        // prerendered, to avoid duplicate sitemap entries.
        dynamicRoutes: [
          '/pricing',
          '/terms',
          '/refund',
          '/contact',
          '/delete-account',
        ],
      }),
      // A single combined entry (prerender/index.js), not one per section -
      // vite-prerender-plugin identifies its entry chunk by scanning every
      // bundled .js chunk for one exporting a function named `prerender`,
      // with no other disambiguation. Two separate vitePrerenderPlugin()
      // instances (one per section) each force their own script into its
      // own chunk, and since both prerender/blog.js and prerender/wealth.js
      // export a function with that same name, one instance can silently
      // pick up the other's chunk depending on bundle key order - confirmed
      // by testing that way first: /blog/'s pages came out completely empty.
      // See prerender/index.js for the full explanation.
      ...(blogPrerenderRoutes.length > 0 || wealthPrerenderRoutes.length > 0 || legalPrerenderRoutes.length > 0
        ? [
            ...vitePrerenderPlugin({
              renderTarget: '#root',
              prerenderScript: path.resolve(__dirname, 'prerender/index.js'),
              additionalPrerenderRoutes: [
                ...blogPrerenderRoutes,
                ...wealthPrerenderRoutes,
                ...legalPrerenderRoutes,
              ],
            }),
            stripDuplicatePrerenderMetaPlugin([
              'dist/blog',
              'dist/wealth',
              'dist/privacy',
              'dist/about',
              'dist/affiliate-disclosure',
            ]),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0', // Listen on all network interfaces.
      port: parseInt(process.env.VITE_PORT || '3000'),
      proxy: {
        '/api': {
          target: `http://localhost:8000`,
          changeOrigin: true,
        },
      },
      watch: { usePolling: true, interval: 600 },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'ui-vendor': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-aspect-ratio',
              '@radix-ui/react-avatar',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-context-menu',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-hover-card',
              '@radix-ui/react-label',
              '@radix-ui/react-menubar',
              '@radix-ui/react-navigation-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-toggle',
              '@radix-ui/react-toggle-group',
              '@radix-ui/react-tooltip',
            ],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'utils-vendor': [
              'axios',
              'clsx',
              'tailwind-merge',
              'class-variance-authority',
              'date-fns',
              'lucide-react',
            ],
            'query-vendor': ['@tanstack/react-query'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    // Strip console.log/debug/info/warn + debugger statements from
    // production builds (32+ calls, several with raw "🔧 DEBUG:" prefixes,
    // were shipping to every visitor's console). console.error is kept —
    // it's the one signal worth having in production.
    esbuild: command === 'build' ? { pure: ['console.log', 'console.debug', 'console.info', 'console.warn'], drop: ['debugger'] } : undefined,
  };
});
