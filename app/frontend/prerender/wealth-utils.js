import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const projectRoot = path.resolve(__dirname, '..');

export const wealthContentDir = path.resolve(projectRoot, 'seo', 'wealth-content');

export function normalizeRouteFromWealthMarkdown(relativePath) {
  const normalized = relativePath
    .replace(/\\/g, '/')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');

  return normalized ? `/wealth/${normalized}/` : '/wealth/';
}
