import fs from 'node:fs';
import path from 'node:path';
import { collectMarkdownFiles } from './utils.js';
import { wealthContentDir, normalizeRouteFromWealthMarkdown } from './wealth-utils.js';

function collectMarkdownLastmod(dir) {
  const bucket = {};

  for (const fullPath of collectMarkdownFiles(dir)) {
    const relativePath = path.relative(wealthContentDir, fullPath);
    const route = normalizeRouteFromWealthMarkdown(relativePath);
    bucket[route] = fs.statSync(fullPath).mtime;
  }

  return bucket;
}

function getLatestContentMtime(lastmodMap) {
  const dates = Object.values(lastmodMap).filter((value) => value instanceof Date);

  if (dates.length === 0) {
    return undefined;
  }

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function getWealthSitemapLastmod() {
  const contentLastmod = collectMarkdownLastmod(wealthContentDir);
  const latestContentMtime = getLatestContentMtime(contentLastmod);

  return {
    ...(latestContentMtime ? { '/wealth/': latestContentMtime } : {}),
    ...contentLastmod,
  };
}
