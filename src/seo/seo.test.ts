import { describe, expect, it } from 'vitest';
import { brand, brandName } from '../brand';
import { AWAITING_OFFICIAL_SOURCES, allPages, indexablePages, LOCALES } from '../../content/site';
import { jaccard, jsonLd, pageText, pageTitle, shingles, wordCount } from './document';
import { hrefFor, targetFromPath, TOOL_SLUG } from './routes';

describe('seo pages', () => {
  const pages = indexablePages();

  it('uses the brand name in every title', () => {
    expect(pageTitle('Compress PDF', 'Testname')).toBe('Compress PDF — Testname');
    for (const page of pages) expect(page.title.endsWith(brandName())).toBe(true);
  });

  it('keeps titles, descriptions, and FAQ answers unique and within limits', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const answers = new Set<string>();
    for (const page of pages) {
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeLessThanOrEqual(155);
      expect(page.description.toLowerCase()).toMatch(/no upload|without upload|never uploaded|never leave|stay on your device|processed on your device|free/);
      expect(titles.has(page.title), `${page.path}: ${page.title}`).toBe(false);
      expect(descriptions.has(page.description)).toBe(false);
      titles.add(page.title);
      descriptions.add(page.description);
      expect(page.faqs).toHaveLength(5);
      for (const faq of page.faqs) {
        expect(answers.has(faq.a), `${page.path}: ${faq.a.slice(0, 140)}`).toBe(false);
        answers.add(faq.a);
      }
      expect(wordCount(pageText(page)), page.path || 'home').toBeGreaterThanOrEqual(150);
    }
  });

  it('flags pages whose text is more than 70% similar', () => {
    const bags = pages.map((page) => ({ path: page.path || 'home', bag: shingles(pageText(page)) }));
    const hits: string[] = [];
    for (let i = 0; i < bags.length; i += 1) {
      for (let j = i + 1; j < bags.length; j += 1) {
        const score = jaccard(bags[i]!.bag, bags[j]!.bag);
        if (score > 0.7) hits.push(`${bags[i]!.path} ~ ${bags[j]!.path} ${score.toFixed(2)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('has no orphan indexable pages and no broken internal links', () => {
    const byPath = new Map(pages.map((page) => [page.path, page]));
    const footer = pages.filter((page) => page.kind === 'tool' || ['guides', 'privacy', 'brand', 'sitemap', 'press', 'tools'].includes(page.path)).map((page) => page.path);
    const links = new Map<string, string[]>();
    for (const page of pages) {
      const out = [...page.related, ...page.neighbors, ...page.guides, ...footer];
      if (page.path !== '') out.push('');
      links.set(page.path, out);
    }
    const seen = new Set<string>(['']);
    const queue: Array<{ path: string; depth: number }> = [{ path: '', depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (!current || current.depth >= 3) continue;
      for (const next of links.get(current.path) ?? []) {
        if (seen.has(next) || !byPath.has(next)) continue;
        seen.add(next);
        queue.push({ path: next, depth: current.depth + 1 });
      }
    }
    const orphans = pages.filter((page) => !seen.has(page.path)).map((page) => page.path || 'home');
    expect(orphans).toEqual([]);
    for (const page of pages) {
      for (const link of [...page.related, ...page.neighbors, ...page.guides]) {
        expect(byPath.has(link), `${page.path} -> ${link}`).toBe(true);
      }
    }
  });

  it('validates JSON-LD shape for schema.org types', () => {
    for (const page of pages) {
      const data = jsonLd(page, [{ name: 'Home', path: '' }]);
      expect(data['@context']).toBe('https://schema.org');
      const graph = data['@graph'] as Array<Record<string, unknown>>;
      expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true);
      if (page.kind === 'home') {
        const org = graph.find((node) => node['@type'] === 'Organization');
        expect(org?.name).toBe('Weesize');
        expect(org?.url).toBe('https://weesize.com');
        expect(String(org?.logo)).toBe('https://weesize.com/brand/mark-color.svg');
        expect(org?.description).toBe('Weesize is a free, open-source tool that compresses PDFs and photos to an exact file size in your browser, without uploading files.');
        expect(org?.sameAs).toEqual([
          'https://github.com/Ansochacko/weesize',
          'https://www.instagram.com/weesize',
          'https://www.facebook.com/weesize',
        ]);

        const site = graph.find((node) => node['@type'] === 'WebSite');
        expect(site?.name).toBe('Weesize');
        expect(site?.url).toBe('https://weesize.com');
        expect(String(site?.logo)).toBe('https://weesize.com/brand/mark-color.svg');
        expect(site?.description).toBe('Weesize is a free, open-source tool that compresses PDFs and photos to an exact file size in your browser, without uploading files.');
        expect(site?.sameAs).toEqual([
          'https://github.com/Ansochacko/weesize',
          'https://www.instagram.com/weesize',
          'https://www.facebook.com/weesize',
        ]);
      }
      if (page.path === 'about') {
        const paragraphs = page.essay.split(/\n+/).filter(Boolean);
        expect(paragraphs[0]).toBe('Weesize is a free, open-source tool that compresses PDFs and photos to an exact file size in your browser, without uploading files.');
        expect(paragraphs[1]).toContain('students and job applicants resizing photos, signatures and PDFs for online forms');
        expect(paragraphs[1]).toContain('private file compression');
        expect(page.essay).toContain('https://github.com/Ansochacko/weesize');
        expect(page.essay).toContain('https://www.instagram.com/weesize');

        const code = graph.find((node) => node['@type'] === 'SoftwareSourceCode');
        expect(code?.name).toBe(brand.name);
        expect(code?.programmingLanguage).toBe('TypeScript');
      }
      if (page.toolId) {
        const app = graph.find((node) => node['@type'] === 'WebApplication');
        expect(app?.applicationCategory).toBe('UtilitiesApplication');
        expect(app?.operatingSystem).toBe('Any (web browser)');
        expect(app?.isAccessibleForFree).toBe(true);
        const offers = app?.offers as { price: string };
        expect(offers.price).toBe('0');
        expect(Array.isArray(app?.featureList)).toBe(true);
      }
      if (page.faqs.length) {
        const faq = graph.find((node) => node['@type'] === 'FAQPage');
        const main = faq?.mainEntity as Array<Record<string, unknown>>;
        expect(main.length).toBe(page.faqs.length);
        expect(main[0]?.['@type']).toBe('Question');
      }
      if (page.kind === 'guide') {
        const article = graph.find((node) => node['@type'] === 'Article');
        expect(article?.headline).toBe(page.h1);
        expect(article?.dateModified).toBe(page.updated);
      }
    }
  });

  it('maps public slugs onto real tools and keeps drafts out of the index', () => {
    expect(hrefFor('compress')).toBe('/compress-pdf');
    expect(targetFromPath('/compress-pdf-to-100kb')?.pdfTargetKb).toBe(100);
    expect(targetFromPath('/jpg-to-png')?.imageMime).toBe('image/png');
    expect(Object.keys(TOOL_SLUG).length).toBeGreaterThanOrEqual(30);
    const drafts = allPages().filter((page) => !page.reviewed);
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((page) => page.noindex)).toBe(true);
    expect(indexablePages().every((page) => page.lang === 'en')).toBe(true);
    expect(LOCALES).toHaveLength(20);
    expect(AWAITING_OFFICIAL_SOURCES.length).toBeGreaterThan(0);
  });
});
