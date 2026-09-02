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

// vite-prerender-plugin injects each blog page's own SEO <meta> tags by
// appending them to the base index.html's <head> (its own source only
// special-cases <title> for find-and-replace; every other head element is
// pure insertAdjacentHTML append, no deduplication). The base template's
// generic description/og:title/og:description/og:url/og:image end up
// duplicated alongside the article-specific ones on every prerendered blog
// page - most crawlers take the first tag of a given name, so they'd see
// the generic app-wide copy (site root URL, generic app logo) instead of
// the per-article one. Strip the generic copies (everything before the
// `prerender-static-page` marker that always precedes the injected block -
// see prerender/blog.js) once the build has written the files, so each of
// these names appears exactly once, the article-specific one.
//
// twitter:* is different: the project has no Twitter/X account, so blog
// pages should carry zero twitter:* tags, not a deduplicated one. Nothing
// in prerender/blog.js or BlogPostPage.tsx injects twitter:* any more - the
// only source left is the base template's static twitter:card/title/
// description/image (index.html), which still needs to be stripped from
// blog pages specifically (the main app's non-blog pages are untouched -
// out of scope here).
const BLOG_DUPLICATE_BASE_META = [
  /<meta\s+name="description"[^>]*>\s*/i,
  /<meta\s+property="og:title"[^>]*>\s*/i,
  /<meta\s+property="og:description"[^>]*>\s*/i,
  /<meta\s+property="og:url"[^>]*>\s*/i,
  /<meta\s+property="og:image"[^>]*>\s*/i,
];
const BLOG_REMOVED_TWITTER_META = /<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi;

function stripDuplicateBlogMetaPlugin(): Plugin {
  return {
    name: 'strip-duplicate-blog-meta',
    closeBundle() {
      const blogDir = path.resolve(__dirname, 'dist/blog');
      const marker = '<meta name="prerender-static-page"';
      for (const file of collectHtmlFiles(blogDir)) {
        const html = fs.readFileSync(file, 'utf-8');
        const markerIdx = html.indexOf(marker);
        let next = html;
        if (markerIdx !== -1) {
          const before = html.slice(0, markerIdx);
          const after = html.slice(markerIdx);
          const cleanedBefore = BLOG_DUPLICATE_BASE_META.reduce(
            (acc, pattern) => acc.replace(pattern, ''),
            before,
          );
          next = cleanedBefore + after;
        }
        next = next.replace(BLOG_REMOVED_TWITTER_META, '');
        if (next !== html) {
          fs.writeFileSync(file, next, 'utf-8');
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

  return {
    plugins: [
      viteSourceLocator({
        prefix: 'mgx', // Prefix used to identify source locations; do not change.
      }),
      react(),
      atoms(),
      Sitemap({
        hostname: 'https://app.amanahlife.com',
        lastmod: getSitemapLastmod(),
        readable: true,
        generateRobotsTxt: true,
        // These public pages have no prerendered HTML (only blog posts do),
        // so the plugin can't auto-discover them by scanning dist/ output —
        // list them explicitly so they're at least in the sitemap.
        dynamicRoutes: [
          '/about',
          '/pricing',
          '/privacy',
          '/terms',
          '/refund',
          '/contact',
          '/delete-account',
        ],
      }),
      ...(blogPrerenderRoutes.length > 0
        ? [
            ...vitePrerenderPlugin({
              renderTarget: '#root',
              prerenderScript: path.resolve(__dirname, 'prerender/blog.js'),
              additionalPrerenderRoutes: blogPrerenderRoutes,
            }),
            stripDuplicateBlogMetaPlugin(),
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
