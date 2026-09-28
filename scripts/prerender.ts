import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand, brandName, brandOrigin } from '../src/brand.ts';
import { AWAITING_OFFICIAL_SOURCES, indexablePages, LOCALES } from '../content/site.ts';
import { breadcrumb, escapeHtml, jsonLd, landingHead, landingRest, UPDATED } from '../src/seo/document.ts';
import { toolIcons } from '../src/lib/icons.ts';
import { CATEGORIES, popularTools, TOOLS } from '../src/tools/registry.ts';
import { lockupHorizontal } from '../src/assets/brand/lockup.ts';
import { hrefFor } from '../src/seo/routes.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const pages = indexablePages();
const labels = new Map(pages.map((page) => [page.path, page.h1]));

function toolCardHtml(tool: (typeof TOOLS)[number]): string {
  const svg = (toolIcons[tool.icon]?.svg ?? '').replaceAll('width="24"', 'width="18"').replaceAll('height="24"', 'height="18"');
  const badge = tool.badges?.[0] ?? (tool.state === 'limited' ? 'Limited' : null);
  const badgeHtml = badge
    ? `<span class="badge badge-${tool.state === 'limited' ? 'warn' : badge.toLowerCase().includes('chrome') ? 'info' : 'ok'}">${escapeHtml(badge)}</span>`
    : tool.category === 'optimize' || tool.category === 'security'
    ? '<span class="badge badge-ok">On device</span>'
    : '';
  const top = `<span class="tool-top"><span class="tool-icon" data-cat="${escapeHtml(tool.category)}">${svg}</span>${badgeHtml}</span>`;
  const body = `<span class="tool-copy"><span class="tool-name">${escapeHtml(tool.name)}</span><span class="tool-desc">${escapeHtml(tool.description)}</span></span>`;
  const metaLeft = CATEGORIES.find((item) => item.id === tool.category)?.label ?? 'Tool';
  const metaRight = tool.state === 'limited' ? 'Not in this version' : 'Client-side';
  const meta = `<span class="tool-meta"><span>${escapeHtml(metaLeft)}</span><span>${escapeHtml(metaRight)}</span></span>`;
  return `<a class="tool-card" href="${hrefFor(tool.id)}" data-tool="${escapeHtml(tool.id)}" data-cat="${escapeHtml(tool.category)}">${top}${body}${meta}</a>`;
}

function catalogShell(): { popular: string; catalog: string } {
  const popular = `<h2>Popular tools</h2><div class="tool-grid-wrap"><div class="tool-grid">${popularTools().map(toolCardHtml).join('')}</div></div>`;
  const catalog = CATEGORIES.map((category) => {
    const tools = TOOLS.filter((tool) => tool.category === category.id);
    if (!tools.length) return '';
    return `<section class="tool-section"><h2>${escapeHtml(category.label)}</h2><div class="tool-grid-wrap"><div class="tool-grid">${tools.map(toolCardHtml).join('')}</div></div></section>`;
  }).join('');
  return { popular, catalog };
}

function footer(): string {
  const extras: string[] = [];
  if (brand.repoUrl) extras.push(`<a href="${escapeHtml(brand.repoUrl)}" target="_blank" rel="noopener">Open source</a>`);
  if (brand.supportUrl) extras.push(`<a href="${escapeHtml(brand.supportUrl)}" target="_blank" rel="noopener">Support ${escapeHtml(brandName())}</a>`);
  const extra = extras.length ? `<p class="foot-extra">${extras.join('')}</p>` : '';
  return `<div class="wrap foot-inner"><div class="foot-brand-block"><p class="foot-brand-name"><strong>${escapeHtml(brandName())}</strong></p><p class="foot-tag">${escapeHtml(brand.tagline)}</p>${extra}</div><nav class="foot-nav" aria-label="Footer tools"><h2>Tools</h2><a href="/compress-pdf">Compress PDF</a><a href="/merge-pdf">Merge PDF</a><a href="/split-pdf">Split PDF</a><a href="/tools">All tools</a></nav><nav class="foot-nav" aria-label="Convert"><h2>Convert</h2><a href="/jpg-to-pdf">JPG to PDF</a><a href="/png-to-pdf">PNG to PDF</a><a href="/pdf-to-jpg">PDF to JPG</a><a href="/heic-to-jpg">HEIC to JPG</a></nav><nav class="foot-nav" aria-label="Company"><h2>Company</h2><a href="/about">About</a><a href="/guides">Guides</a><a href="/brand">Brand</a><a href="/press">Press</a></nav><nav class="foot-nav" aria-label="Legal"><h2>Legal</h2><a href="/privacy">Privacy</a><a href="/sitemap">Sitemap</a></nav></div><div class="wrap foot-bar"><p>© 2026 ${escapeHtml(brandName())}. Processed on your device.</p><p>English. Other languages are drafts and are not indexed.</p></div>`;
}

function paint(pagePath: string): string {
  const page = pages.find((item) => item.path === pagePath);
  if (!page) return template;
  const head = landingHead(page, breadcrumb(page, labels));
  const rest = landingRest(page, (path) => labels.get(path) ?? path);
  const image = `${brandOrigin()}/brand/og-image.png`;
  let html = template.replaceAll('href="#/', 'href="/').replace('href="#/"', 'href="/"').replace('href="#/"', 'href="/"');
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${page.htmlLang}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  html = html.replace(/(name="description" content=")[^"]*(")/, `$1${escapeHtml(page.description)}$2`);
  html = html.replace(/(property="og:title" content=")[^"]*(")/, `$1${escapeHtml(page.title)}$2`);
  html = html.replace(/(property="og:description" content=")[^"]*(")/, `$1${escapeHtml(page.description)}$2`);
  html = html.replace(/(property="og:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`);
  html = html.replace(/(name="twitter:title" content=")[^"]*(")/, `$1${escapeHtml(page.title)}$2`);
  html = html.replace(/(name="twitter:description" content=")[^"]*(")/, `$1${escapeHtml(page.description)}$2`);
  html = html.replace(/(name="twitter:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`);
  html = html.replace(/(id="seo-canonical" href=")[^"]*(")/, `$1${brandOrigin()}/${page.path}$2`);
  const links = pages
    .filter((item) => item.id === page.id && item.reviewed)
    .map((item) => `<link rel="alternate" hreflang="${item.htmlLang}" href="${brandOrigin()}/${item.path}" />`)
    .join('');
  const json = `<script type="application/ld+json">${JSON.stringify(jsonLd(page, breadcrumb(page, labels)))}</script>`;
  const preload = readdirSync(join(dist, 'assets'))
    .filter((file) => (file.toLowerCase().includes('plex') || file.toLowerCase().includes('ibm')) && file.endsWith('.woff2'))
    .slice(0, 3)
    .map((file) => `<link rel="preload" href="/assets/${file}" as="font" type="font/woff2" crossorigin>`)
    .join('');
  const verify = [
    brand.verification.google ? `<meta name="google-site-verification" content="${escapeHtml(brand.verification.google)}">` : '',
    brand.verification.bing ? `<meta name="msvalidate.01" content="${escapeHtml(brand.verification.bing)}">` : '',
  ].join('');
  html = html.replace('</head>', `${preload}${verify}${links}<link rel="alternate" hreflang="x-default" href="${brandOrigin()}/${page.path}" />${json}</head>`);
  html = html.replace('<a class="wordmark" href="/"></a>', `<a class="wordmark" href="/" aria-label="${escapeHtml(brandName())}">${lockupHorizontal}</a>`);
  if (page.path) {
    html = html.replace('id="view-home"', 'id="view-home" hidden');
    html = html.replace('id="workspace" hidden', 'id="workspace"');
    html = html.replace(/<h1>Private PDF tools<\/h1>/, '<p class="lede">Private PDF tools</p>');
    html = html.replace('<div id="landing-head" hidden>', `<div id="landing-head" data-path="${escapeHtml(page.path)}">`);
    html = html.replace('<div id="landing-rest" hidden>', '<div id="landing-rest">');
    const panel = page.toolId && ['compress', 'merge', 'split', 'organize', 'images'].includes(page.toolId) ? page.toolId : page.toolId ? 'extra' : '';
    if (panel) html = html.replace(`id="panel-${panel}" tabindex="0" hidden`, `id="panel-${panel}" tabindex="0"`);
    else html = html.replace('<div class="sheet">', '<div class="sheet" hidden>');
  } else {
    html = html.replace('<div id="home-seo"></div>', `<div id="home-seo">${rest}</div>`);
  }
  if (page.path) {
    html = html.replace(/(<div id="landing-head"[^>]*>)(<\/div>)/, `$1${head}$2`);
    html = html.replace(/(<div id="landing-rest"[^>]*>)(<\/div>)/, `$1${rest}$2`);
  }
  html = html.replace(/<footer class="foot" id="site-footer">[\s\S]*?<\/footer>/, `<footer class="foot" id="site-footer">${footer()}</footer>`);
  const shell = catalogShell();
  html = html.replace('<div id="popular"></div>', `<div id="popular">${shell.popular}</div>`);
  html = html.replace('<div id="catalog"></div>', `<div id="catalog">${shell.catalog}</div>`);
  return html;
}

function writePage(pagePath: string, html: string): void {
  if (!pagePath) {
    writeFileSync(join(dist, 'index.html'), html);
    return;
  }
  const dir = join(dist, ...pagePath.split('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

const ogDir = join(dist, 'og');
mkdirSync(ogDir, { recursive: true });
const lockupInner = readFileSync(join(root, 'public', 'brand', 'lockup-horizontal.svg'), 'utf8').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
for (const page of pages) {
  writePage(page.path, paint(page.path));
  const title = escapeHtml(page.h1).slice(0, 80);
  const subtitle = escapeHtml(page.subtitle).slice(0, 110);
  const file = `${page.path || 'home'}.svg`.replaceAll('/', '-');
  writeFileSync(
    join(ogDir, file),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#F5F6F8"/><g transform="translate(72 64) scale(1.35)" color="#14181F">${lockupInner}</g><text x="72" y="300" fill="#14181F" font-family="IBM Plex Sans, sans-serif" font-size="56" font-weight="600">${title}</text><text x="72" y="372" fill="#14181F" font-family="IBM Plex Sans, sans-serif" font-size="28">${subtitle}</text><text x="72" y="540" fill="#1B7A4A" font-family="IBM Plex Sans, sans-serif" font-size="22">Processed on your device</text></svg>\n`,
  );
}

const missing = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Page not found — ${brandName()}</title><meta name="robots" content="noindex"></head><body><h1>Page not found</h1><p>That address is not a page on this site.</p><p><a href="/compress-pdf">Compress PDF</a> <a href="/merge-pdf">Merge PDF</a> <a href="/">Home</a></p></body></html>`;
writeFileSync(join(dist, '404.html'), missing);

const lastmod = UPDATED;
const body = pages
  .map((page) => `  <url><loc>${brandOrigin()}/${page.path}</loc><lastmod>${page.updated}</lastmod></url>`)
  .join('\n');
writeFileSync(join(dist, 'sitemap-en.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${brandOrigin()}/sitemap-en.xml</loc><lastmod>${lastmod}</lastmod></sitemap>\n</sitemapindex>\n`,
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dev/\nSitemap: ${brandOrigin()}/sitemap.xml\n`);

const csv = ['keyword,intent,page URL,language,priority,notes'];
for (const page of pages) {
  for (const keyword of page.keywords) {
    const notes = page.sources.length ? `source ${page.sources[0]?.checked}` : '';
    csv.push([keyword, page.intent, `${brandOrigin()}/${page.path}`, page.lang, String(page.priority), notes].map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','));
  }
}
mkdirSync(join(root, 'seo'), { recursive: true });
writeFileSync(join(root, 'seo', 'keywords.csv'), `${csv.join('\n')}\n`);

const unreviewed = LOCALES.map((locale) => `${locale.code} (${locale.label}) reviewed: false`).join('\n');
writeFileSync(join(root, 'seo', 'unreviewed-translations.txt'), `${unreviewed}\n\nAwaiting official sources:\n${AWAITING_OFFICIAL_SOURCES.join('\n')}\n`);

function writeHomeRedirect(pagePath: string): void {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Moved — ${escapeHtml(brandName())}</title><meta http-equiv="refresh" content="0;url=/"><link rel="canonical" href="${brandOrigin()}/"><meta name="robots" content="noindex"><script>location.replace('/')</script></head><body><p><a href="/">Continue to home</a></p></body></html>\n`;
  writePage(pagePath, html);
}

for (const slug of ['pro', 'pricing']) {
  writeHomeRedirect(slug);
  for (const locale of LOCALES) writeHomeRedirect(`${locale.code}/${slug}`);
}

const counts = new Map();
for (const page of pages) counts.set(page.kind, (counts.get(page.kind) ?? 0) + 1);
console.log(`Prerendered ${pages.length} indexable pages`);
console.log([...counts.entries()].map(([kind, count]) => `${kind} ${count}`).join(', '));
console.log('Redirects: /pro, /pricing, and language variants → /');
