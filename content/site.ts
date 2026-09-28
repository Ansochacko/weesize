import { toPage, type Seed } from './factory';
import { GUIDES } from './guides';
import { AWAITING_OFFICIAL_SOURCES, compareSeeds, convertSeeds, deviceSeeds, frameSeeds, guideSeeds, privacySeeds, usecaseSeeds } from './misc';
import { imageSizeSeeds, pdfSizeSeeds } from './sizes';
import { toolSeeds } from './tools-a';
import { toolSeedsB } from './tools-b';
import { toolSeedsC } from './tools-c';
import { IMAGE_SIZE_SLUGS } from '../src/seo/routes';
import type { SeoPage } from '../src/seo/document';

const tools: Seed[] = [...toolSeeds, ...toolSeedsB, ...toolSeedsC].map((seed) =>
  seed.path === 'compress-image' ? { ...seed, neighbors: IMAGE_SIZE_SLUGS } : seed,
);

export const englishPages: SeoPage[] = [...frameSeeds, ...tools, ...pdfSizeSeeds, ...imageSizeSeeds, ...privacySeeds, ...deviceSeeds, ...usecaseSeeds, ...convertSeeds, ...compareSeeds, ...guideSeeds].map(toPage);

const sitemap = englishPages.find((page) => page.path === 'sitemap');
if (sitemap) sitemap.related = englishPages.filter((page) => page.path && page.path !== 'sitemap').map((page) => page.path);

export { AWAITING_OFFICIAL_SOURCES, GUIDES };

const DRAFT = 'Draft translation, not reviewed by a native speaker. The tool still runs in this browser and does not upload the file.';

export interface Locale {
  code: string;
  htmlLang: string;
  label: string;
  compress: string;
}

export const LOCALES: Locale[] = [
  { code: 'es', htmlLang: 'es', label: 'Español', compress: 'comprimir-pdf' },
  { code: 'pt-br', htmlLang: 'pt-BR', label: 'Português (Brasil)', compress: 'comprimir-pdf' },
  { code: 'fr', htmlLang: 'fr', label: 'Français', compress: 'compresser-pdf' },
  { code: 'de', htmlLang: 'de', label: 'Deutsch', compress: 'pdf-komprimieren' },
  { code: 'it', htmlLang: 'it', label: 'Italiano', compress: 'comprimere-pdf' },
  { code: 'id', htmlLang: 'id', label: 'Bahasa Indonesia', compress: 'kompres-pdf' },
  { code: 'hi', htmlLang: 'hi', label: 'हिन्दी', compress: 'pdf-compress-karen' },
  { code: 'ja', htmlLang: 'ja', label: '日本語', compress: 'pdf-asshuku' },
  { code: 'ko', htmlLang: 'ko', label: '한국어', compress: 'pdf-apchuk' },
  { code: 'tr', htmlLang: 'tr', label: 'Türkçe', compress: 'pdf-sikistir' },
  { code: 'ru', htmlLang: 'ru', label: 'Русский', compress: 'szhat-pdf' },
  { code: 'pl', htmlLang: 'pl', label: 'Polski', compress: 'kompresuj-pdf' },
  { code: 'nl', htmlLang: 'nl', label: 'Nederlands', compress: 'pdf-comprimeren' },
  { code: 'vi', htmlLang: 'vi', label: 'Tiếng Việt', compress: 'nen-pdf' },
  { code: 'fi', htmlLang: 'fi', label: 'Suomi', compress: 'tiivista-pdf' },
  { code: 'sv', htmlLang: 'sv', label: 'Svenska', compress: 'komprimera-pdf' },
];

function draftPath(locale: Locale, page: SeoPage): string {
  if (page.path === 'compress-pdf' || page.path.startsWith('compress-pdf-to-')) {
    const size = page.path.replace('compress-pdf', '').replace(/^-to-/, '');
    if (!size) return `${locale.code}/${locale.compress}`;
    if (locale.code === 'de') return `${locale.code}/pdf-auf-${size}-komprimieren`;
    return `${locale.code}/${locale.compress}-${size}`;
  }
  if (page.kind === 'privacy') return `${locale.code}/${page.path}`;
  return `${locale.code}/${page.path}`;
}

export function draftPages(): SeoPage[] {
  const sources = englishPages.filter((page) => page.kind === 'tool' || page.kind === 'size' || (page.kind === 'privacy' && page.path !== 'privacy') || page.path === 'privacy');
  const drafts: SeoPage[] = [];
  for (const locale of LOCALES) {
    for (const source of sources) {
      const path = draftPath(locale, source);
      drafts.push({
        ...source,
        id: source.id,
        path,
        lang: locale.code,
        htmlLang: locale.htmlLang,
        reviewed: false,
        noindex: true,
        title: `${source.h1} — draft`,
        description: `${source.h1}. No upload. Draft translation awaiting native review.`,
        h1: source.h1,
        essay: `${DRAFT} ${locale.label}.`,
        faqs: source.faqs.map((faq, index) => ({ q: faq.q, a: `${DRAFT} (${locale.code}, ${index + 1}) ${faq.a}` })),
      });
    }
  }
  return drafts;
}

export function allPages(): SeoPage[] {
  return [...englishPages, ...draftPages()];
}

export function indexablePages(): SeoPage[] {
  return allPages().filter((page) => page.reviewed && !page.noindex);
}

export function hasPage(path: string): boolean {
  const key = path === 'home' ? '' : path;
  return allPages().some((page) => page.path === key);
}
