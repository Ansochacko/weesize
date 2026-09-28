import { brand, brandName, brandOrigin, brandSlug } from '../brand';
import { faviconSvg, markColor, markFlat, markMono, markReversed } from './marks';

export type PageKind =
  | 'home'
  | 'tools'
  | 'tool'
  | 'size'
  | 'privacy'
  | 'usecase'
  | 'convert'
  | 'compare'
  | 'guide'
  | 'guides'
  | 'brand'
  | 'press'
  | 'sitemap'
  | 'legal';

export interface Faq {
  q: string;
  a: string;
}

export interface SourceNote {
  url: string;
  checked: string;
  fact: string;
}

export interface SeoPage {
  id: string;
  path: string;
  lang: string;
  htmlLang: string;
  reviewed: boolean;
  noindex: boolean;
  kind: PageKind;
  keyword: string;
  title: string;
  description: string;
  h1: string;
  subtitle: string;
  toolId: string | null;
  essay: string;
  steps: [string, string, string];
  points: [string, string, string];
  faqs: Faq[];
  related: string[];
  neighbors: string[];
  guides: string[];
  updated: string;
  intent: string;
  priority: number;
  keywords: string[];
  sources: SourceNote[];
  presetKb?: number;
  presetMime?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export const UPDATED = '2026-09-27';

export function pageTitle(h1: string, name = brandName()): string {
  const titled = `${h1} — ${name}`;
  return titled.length <= 60 ? titled : `${h1.slice(0, Math.max(0, 57 - name.length))} — ${name}`;
}

export function absolute(path: string): string {
  if (!path) return `${brandOrigin()}/`;
  return `${brandOrigin()}/${path}`;
}

export function pageText(page: SeoPage): string {
  return [page.h1, page.subtitle, page.essay, ...page.steps, ...page.points, ...page.faqs.flatMap((faq) => [faq.q, faq.a])].join(' ');
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function shingles(text: string, size = 5): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let index = 0; index <= words.length - size; index += 1) out.add(words.slice(index, index + size).join(' '));
  return out;
}

export function jaccard(left: Set<string>, right: Set<string>): number {
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function jsonLd(page: SeoPage, crumbs: Array<{ name: string; path: string }>): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: absolute(crumb.path),
      })),
    },
  ];
  if (page.kind === 'home') {
    graph.push({
      '@type': 'Organization',
      name: brandName(),
      url: brandOrigin(),
      logo: `${brandOrigin()}/brand/mark-color.svg`,
      sameAs: brand.repoUrl ? [brand.repoUrl] : [],
      description: brand.tagline,
    });
  }
  if (page.path === 'about') {
    graph.push({
      '@type': 'SoftwareSourceCode',
      name: brandName(),
      codeRepository: brand.repoUrl || 'https://github.com/weesize/weesize',
      programmingLanguage: 'TypeScript',
      runtimePlatform: 'Web Browser',
      description: brand.description,
    });
  }
  if (page.toolId) {
    graph.push({
      '@type': 'WebApplication',
      name: page.h1,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (web browser)',
      url: absolute(page.path),
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      featureList: [page.subtitle, ...page.points],
      isAccessibleForFree: true,
      browserRequirements: 'Requires JavaScript. No upload.',
    });
  }
  if (page.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    });
  }
  if (page.kind === 'guide') {
    graph.push({
      '@type': 'Article',
      headline: page.h1,
      dateModified: page.updated,
      datePublished: page.updated,
      author: { '@type': 'Organization', name: brandName() },
      publisher: { '@type': 'Organization', name: brandName(), logo: `${brandOrigin()}/brand/mark-color.svg` },
      mainEntityOfPage: absolute(page.path),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function breadcrumb(page: SeoPage, labels: Map<string, string>): Array<{ name: string; path: string }> {
  if (!page.path) return [{ name: 'Home', path: '' }];
  const crumbs = [{ name: 'Home', path: '' }];
  if (page.kind === 'guide') crumbs.push({ name: 'Guides', path: 'guides' });
  if (page.kind === 'compare') crumbs.push({ name: 'Compare', path: 'guides' });
  crumbs.push({ name: labels.get(page.path) ?? page.h1, path: page.path });
  return crumbs;
}

export function landingHead(page: SeoPage, crumbs: Array<{ name: string; path: string }>): string {
  if (page.kind === 'home') return '';
  const trail = crumbs
    .map((crumb, index) => {
      const last = index === crumbs.length - 1;
      const href = crumb.path ? `/${crumb.path}` : '/';
      return last ? `<span aria-current="page">${escapeHtml(crumb.name)}</span>` : `<a href="${href}">${escapeHtml(crumb.name)}</a>`;
    })
    .join('<span aria-hidden="true"> / </span>');
  const byline = page.kind === 'guide' ? `<p class="guide-byline">Updated September 2026 · 6 min read</p>` : '';
  return `<nav class="crumbs" aria-label="Breadcrumb">${trail}</nav><h1>${escapeHtml(page.h1)}</h1>${byline}<p class="lede">${escapeHtml(page.subtitle)}</p>`;
}

function compareTableHtml(page: SeoPage): string {
  const isIlove = page.path.includes('ilovepdf');
  const compName = isIlove
    ? 'iLovePDF'
    : page.path.includes('smallpdf')
    ? 'Smallpdf'
    : page.path.includes('adobe')
    ? 'Adobe Acrobat Online'
    : page.path.includes('pdf24')
    ? 'PDF24 Online'
    : 'Cloud PDF Suites';
  const compLimits = isIlove
    ? 'Ads, upload queues, cloud retention'
    : page.path.includes('smallpdf')
    ? '2 tasks/day limit, sign-up prompts'
    : 'Free daily limits or sign-up gates';

  return `<div class="compare-table-wrap">
  <table class="compare-table">
    <caption class="sr-only">${escapeHtml(brandName())} vs ${escapeHtml(compName)} comparison</caption>
    <thead>
      <tr>
        <th scope="col">Feature</th>
        <th scope="col">${escapeHtml(brandName())}</th>
        <th scope="col">${escapeHtml(compName)}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row"><strong>Processing Architecture</strong></th>
        <td><span class="badge badge-ok">100% Client-side (In-browser WASM)</span></td>
        <td>Cloud servers (Upload required)</td>
      </tr>
      <tr>
        <th scope="row"><strong>Privacy & Tracking</strong></th>
        <td><span class="badge badge-ok">0 Trackers, 0 Uploads, 0 Cookies</span></td>
        <td>Ad scripts, trackers, server storage</td>
      </tr>
      <tr>
        <th scope="row"><strong>Exact Size Targeting</strong></th>
        <td><span class="badge badge-ok">Exact target slider (100 KB, 200 KB, etc.)</span></td>
        <td>Fixed presets (Extreme, Recommended, Less)</td>
      </tr>
      <tr>
        <th scope="row"><strong>Task Speed</strong></th>
        <td><span class="badge badge-ok">Instant local compute (No network wait)</span></td>
        <td>Dependent on internet upload bandwidth</td>
      </tr>
      <tr>
        <th scope="row"><strong>Usage Limits & Accounts</strong></th>
        <td><span class="badge badge-ok">Free forever, unlimited, no sign-up</span></td>
        <td>${escapeHtml(compLimits)}</td>
      </tr>
      <tr>
        <th scope="row"><strong>Offline Functionality</strong></th>
        <td><span class="badge badge-ok">Full offline support (PWA)</span></td>
        <td>Requires continuous internet access</td>
      </tr>
      <tr>
        <th scope="row"><strong>File Size Cap</strong></th>
        <td><span class="badge badge-ok">No artificial cap (device memory only)</span></td>
        <td>Upload file size thresholds</td>
      </tr>
    </tbody>
  </table>
</div>`;
}

export function landingRest(page: SeoPage, linkLabel: (path: string) => string): string {
  if (page.kind === 'home' || page.kind === 'tools') return homeLinks(page, linkLabel);
  const steps = page.steps.map((step, index) => `<li><strong>${index + 1}.</strong> ${escapeHtml(step)}</li>`).join('');
  const points = page.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('');
  const faqs = page.faqs.map((faq) => `<details><summary>${escapeHtml(faq.q)}</summary><p>${escapeHtml(faq.a)}</p></details>`).join('');
  const related = page.related.map((path) => `<a href="/${path}">${escapeHtml(linkLabel(path))}</a>`).join('');
  const neighbors = page.neighbors.map((path) => `<a href="/${path}">${escapeHtml(linkLabel(path))}</a>`).join('');
  const guides = page.guides.map((path) => `<a href="/${path}">${escapeHtml(linkLabel(path))}</a>`).join('');
  const sources = page.sources
    .map((source) => `<p>Requirement last checked: ${escapeHtml(source.checked)}. Source: <a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a>. ${escapeHtml(source.fact)}</p>`)
    .join('');
  const paragraphs = page.essay
    .split(/\n+/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
  const about = `<details class="fold"><summary>About this tool</summary>${paragraphs}${sources}<ul>${points}</ul></details>`;
  const faq = `<details class="fold"><summary>FAQ</summary>${faqs}</details>`;
  const tryBox = page.toolId ? `<div class="try-box"><h3>Try it now</h3><p>Compress or convert your document right in your browser with zero upload.</p><p><a class="btn quiet" href="/${page.toolId}">Open ${escapeHtml(page.h1)} tool →</a></p></div>` : '';
  const toc = `<aside class="guide-toc"><h3>Contents</h3><nav><a href="#how-to">How to use</a><a href="#about-guide">Guide overview</a><a href="#questions">Questions</a></nav></aside>`;
  const guideContent = `<section id="how-to"><h2>How to ${escapeHtml(page.h1.toLowerCase())}</h2><ol class="guide-steps">${steps}</ol></section>${tryBox}<section id="about-guide">${paragraphs}${sources}</section><section id="questions"><h2>Questions</h2>${faqs}</section>`;
  const long = page.kind === 'guide' || page.kind === 'guides';
  const body = long
    ? `<div class="guide-layout"><article class="guide-article">${guideContent}</article>${toc}</div>`
    : page.path === 'privacy'
    ? `<div class="try-box"><strong>Privacy summary:</strong> Your files never leave your device. Weesize processes everything locally using client-side JavaScript and WebAssembly with zero analytics or cloud telemetry.</div><section><h2>1. Local device processing</h2>${paragraphs}</section><section><h2>2. Verification & sources</h2>${sources}<ul>${points}</ul></section><section><h2>3. Frequently asked questions</h2>${faqs}</section>`
    : page.kind === 'compare'
    ? `<section class="compare-section"><h2>Direct comparison: ${escapeHtml(page.h1)}</h2><p class="lede">See how ${escapeHtml(brandName())} compares on privacy, speed, limits, and file handling.</p>${compareTableHtml(page)}<div class="try-box"><h3>Try the private alternative</h3><p>Compress, merge, and organize PDFs right in your browser with zero file upload.</p><p><a class="btn primary" href="/compress-pdf">Try Compress PDF →</a> <a class="btn quiet" href="/tools">Explore all tools</a></p></div><h2>Architecture & Privacy Analysis</h2>${paragraphs}<h2>Key Architectural Points</h2><ul>${points}</ul><h2>Frequently asked questions</h2>${faqs}</section>`
    : `<p class="how-row">${page.steps.map((step, index) => `<span><strong>${index + 1}</strong> ${escapeHtml(step)}</span>`).join('')}</p>${about}${faq}`;
  return `${body}
<p class="link-row">${related}</p>${neighbors ? `<p class="link-row">${neighbors}</p>` : ''}${guides ? `<p class="link-row">${guides}</p>` : ''}
<p class="updated">Last updated ${escapeHtml(page.updated)}.</p>${page.kind === 'brand' || page.kind === 'press' ? brandKit() : ''}`;
}

function brandKit(): string {
  const files: Array<[string, string]> = [
    ['/brand/mark-color.svg', 'Color mark (SVG)'],
    ['/brand/mark-flat.svg', 'Flat mark (SVG)'],
    ['/brand/mark-mono.svg', 'Mono mark (SVG)'],
    ['/brand/mark-reversed.svg', 'Reversed mark (SVG)'],
    ['/brand/favicon.svg', 'Favicon (SVG)'],
    ['/favicon.ico', 'Favicon (ICO)'],
    ['/brand/lockup-horizontal.svg', 'Horizontal lockup (SVG)'],
    ['/brand/lockup-stacked.svg', 'Stacked lockup (SVG)'],
    ['/brand/wordmark.svg', 'Wordmark (SVG)'],
    ['/brand/mark-256.png', 'Mark at 256 px (PNG)'],
    ['/brand/avatar-400.png', 'Avatar 400 (PNG)'],
    ['/brand/banner-1500x500.png', 'Banner 1500×500 (PNG)'],
    ['/icons/icon-192.png', 'App icon 192 (PNG)'],
    ['/icons/icon-512.png', 'App icon 512 (PNG)'],
    ['/icons/icon-maskable-512.png', 'Maskable icon (PNG)'],
    ['/icons/apple-touch-icon.png', 'Apple touch icon (PNG)'],
  ];
  const links = files.map(([href, label]) => `<li><a href="${href}" download>${escapeHtml(label)}</a></li>`).join('');
  const swatches: Array<[string, string]> = [
    ['Accent', '#2340C9'],
    ['Accent bright', '#3A58EC'],
    ['Accent deep', '#1A2FA6'],
    ['Text', '#14181F'],
    ['Text on dark', brand.colors.textDark],
    ['Background', '#F5F6F8'],
  ];
  const colors = swatches.map(([name, hex]) => `<li><span class="brand-chip" style="background:${hex}"></span> ${escapeHtml(name)} <code>${hex}</code></li>`).join('');
  const specimen = (bg: string, mark: string, label: string) =>
    `<figure class="brand-swatch" data-bg="${bg}"><div>${mark}</div><figcaption>${escapeHtml(label)}</figcaption></figure>`;
  const grid = [
    specimen('light', markColor('brand-light'), 'Color, light'),
    specimen('dark', markColor('brand-dark'), 'Color, dark'),
    specimen('blue', markReversed('brand-blue'), 'Reversed, blue'),
    specimen('light', markFlat(), 'Flat, 32 px and below'),
    specimen('dark', markMono('brand-mono-dark'), 'Mono, dark'),
    specimen('light', faviconSvg(), 'Favicon, 16–24 px'),
  ].join('');
  return `<section>
<h2>Marks</h2>
<div class="brand-grid">${grid}</div>
<h2>Clear space and minimum size</h2>
<p>Keep at least 25% of the mark’s width empty on every side. The mark is at least 16 pixels. Below 24 pixels, use the favicon. The horizontal lockup is at least 96 pixels wide, with the mark at 1.5× the wordmark cap height and a gap of 0.35× the mark.</p>
<div class="clear-demo" aria-hidden="true">${markColor('brand-clear')}</div>
<p>The wordmark is “weesize” in lowercase IBM Plex Sans SemiBold, with letter-spacing −0.02em. On the home page and this page, “wee” is the accent and “size” is the text color. Everywhere else the whole word uses the text color: #14181F on light, #E6E9EF on dark.</p>
<h2>Maskable icon</h2>
<p>The installed icon is a full-bleed accent square. The pages sit inside the central 80%.</p>
<div class="mask-row">
  <div class="mask-circle" style="background-image:url('/icons/icon-maskable-512.png')" role="img" aria-label="Maskable icon inside a circle"></div>
  <div class="mask-squircle" style="background-image:url('/icons/icon-maskable-512.png')" role="img" aria-label="Maskable icon inside a squircle"></div>
</div>
<h2>Downloads</h2><ul>${links}</ul>
<h3>Colors</h3><ul>${colors}</ul>
<h3>Do and don’t</h3>
<ul>
<li>Do use the color mark above 32 pixels, the flat mark at 32 pixels and below, and the favicon below 24 pixels.</li>
<li>Do keep the clear space.</li>
<li>Don’t stretch the mark.</li>
<li>Don’t recolor the mark.</li>
<li>Don’t rotate the mark.</li>
<li>Don’t add a shadow, glow, or other effect.</li>
<li>Don’t place the color mark on a busy photograph. Use the reversed mark on a flat color or photo.</li>
</ul>
</section>`;
}

function homeLinks(_page: SeoPage, _linkLabel: (path: string) => string): string {
  return '';
}

export function hreflangLinks(page: SeoPage, group: SeoPage[]): string {
  const reviewed = group.filter((item) => item.reviewed && item.id === page.id);
  if (!page.reviewed) return '';
  const links = reviewed.map((item) => `<link rel="alternate" hreflang="${item.htmlLang}" href="${absolute(item.path)}" />`);
  const fallback = reviewed.find((item) => item.lang === 'en') ?? page;
  links.push(`<link rel="alternate" hreflang="x-default" href="${absolute(fallback.path)}" />`);
  return links.join('');
}

export function metaBlock(page: SeoPage, group: SeoPage[]): string {
  const image = `${brandOrigin()}/og/${page.path || 'home'}.png`;
  const verify = [
    brand.verification.google ? `<meta name="google-site-verification" content="${escapeHtml(brand.verification.google)}" />` : '',
    brand.verification.bing ? `<meta name="msvalidate.01" content="${escapeHtml(brand.verification.bing)}" />` : '',
  ].join('');
  const robots = page.noindex ? 'noindex, follow' : 'index, follow';
  return `<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${absolute(page.path)}" />
${hreflangLinks(page, group)}
<meta property="og:type" content="${page.kind === 'guide' ? 'article' : 'website'}" />
<meta property="og:title" content="${escapeHtml(page.title)}" />
<meta property="og:description" content="${escapeHtml(page.description)}" />
<meta property="og:url" content="${absolute(page.path)}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(page.title)}" />
<meta name="twitter:description" content="${escapeHtml(page.description)}" />
<meta name="twitter:image" content="${image}" />
${verify}
<script type="application/ld+json">${JSON.stringify(jsonLd(page, breadcrumb(page, new Map())))}</script>`;
}

export function comparePath(competitor: string): string {
  return `compare/${brandSlug()}-vs-${competitor}`;
}
