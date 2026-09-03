// vite-prerender-plugin discovers its entry chunk by scanning every bundled
// .js chunk for one exporting a function literally named `prerender` (see
// its generateBundle: `bundle[output].exports?.includes('prerender')`, with
// no other disambiguation). Registering two separate vitePrerenderPlugin()
// instances - one for prerender/blog.js, one for prerender/wealth.js -
// forces each into its own top-level chunk (via manualChunks keyed on the
// prerenderScript id), and BOTH of those chunks export a function named
// `prerender`. Since the detection loop has no way to tell which chunk
// belongs to which plugin instance, one instance can silently pick up the
// other's chunk depending on bundle key iteration order - confirmed by
// building with two separate instances: /blog/'s prerendered pages came out
// completely empty (#root rendered blank, no article-specific meta tags),
// because the blog instance ended up calling wealth's prerender() for
// /blog/* URLs, whose router only knows about /wealth/*.
//
// Fix: a single combined entry, registered with exactly one
// vitePrerenderPlugin() call, so only one chunk in the whole build exports
// `prerender`. blog.js and wealth.js keep their own prerender() exports
// unchanged (still directly testable/reusable) - they're just imported
// here under local names, not re-exposed as the ambiguous `prerender` name
// on their own chunks.
import { prerender as prerenderBlog } from './blog.js';
import { prerender as prerenderWealth } from './wealth.js';
import { prerender as prerenderLegal } from './legal.js';
import { getLegalRoutes } from './legal-routes.js';

const legalPaths = new Set(getLegalRoutes());

export async function prerender(args) {
  if (legalPaths.has(args.url)) {
    return prerenderLegal(args);
  }
  if (args.url.startsWith('/wealth')) {
    return prerenderWealth(args);
  }
  return prerenderBlog(args);
}
