/**
 * Server-side IndexNow submit. Never import this from the browser.
 * Set INDEXNOW_KEY and INDEXNOW_HOST, then: node --experimental-strip-types scripts/indexnow.ts
 */
import { readFileSync } from 'node:fs';

const key = process.env.INDEXNOW_KEY ?? '';
const host = process.env.INDEXNOW_HOST ?? '';
if (!key || !host) {
  console.log('IndexNow skipped. Set INDEXNOW_KEY and INDEXNOW_HOST to submit changed URLs after deploy.');
  process.exit(0);
}

const sitemap = readFileSync(new URL('../dist/sitemap-en.xml', import.meta.url), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).filter((url): url is string => Boolean(url));
const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ host, key, urlList: urls.slice(0, 10000) }),
});
console.log(`IndexNow ${response.status} for ${urls.length} URLs`);
if (!response.ok) process.exit(1);
