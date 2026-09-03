// A separate, import-light file (mirroring blog-routes.js/wealth-routes.js)
// so vite.config.ts can list these routes for additionalPrerenderRoutes
// without transitively importing legal.js, which pulls in the actual React
// page components (JSX, @/ path aliases) - safe inside Vite's real build
// pipeline, but not inside vite.config.ts's own config-eval context.
//
// The 6 paths are fixed and hardcoded here rather than derived from
// src/lib/legalPages.ts, for the same reason: keeping this file free of any
// import that isn't plain, dependency-free JS.
export function getLegalRoutes() {
  return [
    '/privacy',
    '/privacy/ar',
    '/about',
    '/about/ar',
    '/affiliate-disclosure',
    '/affiliate-disclosure/ar',
  ];
}
