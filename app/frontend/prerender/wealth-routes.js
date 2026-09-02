import path from 'node:path';
import { collectMarkdownFiles } from './utils.js';
import { wealthContentDir, normalizeRouteFromWealthMarkdown } from './wealth-utils.js';

export function getWealthRoutes() {
  const routes = new Set(['/wealth/']);

  for (const filePath of collectMarkdownFiles(wealthContentDir)) {
    const relativePath = path.relative(wealthContentDir, filePath);
    routes.add(normalizeRouteFromWealthMarkdown(relativePath));
  }

  return Array.from(routes).sort();
}
