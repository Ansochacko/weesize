/**
 * Server-side IndexNow submit. Never import this from the browser.
 * Notifies Bing, DuckDuckGo, Yahoo, Naver, and Seznam about all indexed URLs.
 */
import { readFileSync } from 'node:fs';

const key = process.env.INDEXNOW_KEY || '5ef678b82194452aa3f1dcb8993fa294';
const host = process.env.INDEXNOW_HOST || 'weesize.com';
const keyLocation = `https://${host}/${key}.txt`;

const sitemap = readFileSync(new URL('../dist/sitemap-en.xml', import.meta.url), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).filter((url): url is string => Boolean(url));

console.log(`Submitting ${urls.length} URLs to IndexNow for ${host}...`);

try {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key,
      keyLocation,
      urlList: urls.slice(0, 10000),
    }),
  });
  console.log(`IndexNow response: ${response.status} (${response.statusText})`);
  if (!response.ok && response.status !== 200 && response.status !== 202) {
    const errorText = await response.text();
    console.error(`IndexNow error: ${errorText}`);
    process.exit(1);
  }
  console.log(`Successfully submitted ${urls.length} URLs to IndexNow! Search engines notified.`);
} catch (err) {
  console.error('Failed to submit to IndexNow:', err);
  process.exit(1);
}
