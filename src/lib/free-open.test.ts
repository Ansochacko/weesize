import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOLS } from '../tools/registry';
import { brand } from '../brand';
import { jsonLd, type SeoPage } from '../seo/document';

const ROOT = join(process.cwd());
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage', 'playwright-report', 'test-results']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|js|mjs|cjs|html|css|md|json)$/i.test(name)) out.push(path);
  }
  return out;
}

describe('free and open product', () => {
  it('has no Pro flag on tools', () => {
    for (const tool of TOOLS) {
      expect('pro' in tool).toBe(false);
    }
  });

  it('keeps ready tools available without a license gate', () => {
    const ready = TOOLS.filter((tool) => tool.state === 'ready');
    expect(ready.some((tool) => tool.id === 'compare')).toBe(true);
    expect(ready.some((tool) => tool.id === 'workflows')).toBe(true);
    expect(ready.some((tool) => tool.id === 'hot-folders')).toBe(true);
    expect(ready.some((tool) => tool.id === 'word')).toBe(true);
  });

  it('exposes optional support and repo URLs', () => {
    expect(brand.supportUrl).toBe('');
    expect(brand.repoUrl).toBe('https://github.com/Ansochacko/weesize');
    expect('pro' in brand).toBe(false);
  });

  it('emits free WebApplication offers in EUR', () => {
    const page = {
      id: 'compress',
      path: 'compress-pdf',
      lang: 'en',
      htmlLang: 'en',
      reviewed: true,
      noindex: false,
      kind: 'tool',
      keyword: 'compress pdf',
      title: 'Compress PDF',
      description: 'Free',
      h1: 'Compress PDF',
      subtitle: 'No upload',
      toolId: 'compress',
      essay: 'essay',
      steps: ['a', 'b', 'c'],
      points: ['a', 'b', 'c'],
      faqs: [],
      related: [],
      neighbors: [],
      guides: [],
      updated: '2026-09-27',
      intent: 'transactional',
      priority: 1,
      keywords: [],
      sources: [],
    } as SeoPage;
    const data = jsonLd(page, [{ name: 'Home', path: '' }]);
    const graph = data['@graph'] as Array<Record<string, unknown>>;
    const app = graph.find((item) => item['@type'] === 'WebApplication') as {
      offers: { price: string; priceCurrency: string };
    };
    expect(app.offers.price).toBe('0');
    expect(app.offers.priceCurrency).toBe('EUR');
  });

  it('keeps paywall wording out of the working tree', () => {
    const banned =
      /\b(isPro|requiresPro|hasProLicense|verifyLicense|applyProGate|licenseKey|paywall|premium|subscription|checkout|Get Pro|proCheckout|proPrice|brand\.pro)\b|href=["']\/(?:pro|pricing)|#\/pro\b|Enter license key|Pro active|Remove license/i;
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file).replaceAll('\\', '/');
      if (rel === 'LICENSE' || rel.endsWith('/LICENSE') || rel === 'TRADEMARK.md') continue;
      if (rel.includes('free-open.test')) continue;
      const text = readFileSync(file, 'utf8');
      if (banned.test(text)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});
