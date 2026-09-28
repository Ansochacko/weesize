import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand, brandName, brandOrigin } from '../src/brand.ts';
import { AWAITING_OFFICIAL_SOURCES, englishPages, indexablePages, LOCALES } from '../content/site.ts';
import { breadcrumb, escapeHtml, jsonLd, landingHead, landingRest, UPDATED } from '../src/seo/document.ts';
import { toolIcons } from '../src/lib/icons.ts';
import { activeToolsCount, CATEGORIES, comingSoonTools, popularTools, toolById, toolsIn, TOOLS, type ToolInfo } from '../src/tools/registry.ts';
import { lockupHorizontal } from '../src/assets/brand/lockup.ts';
import { hrefFor } from '../src/seo/routes.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const indexable = indexablePages();
const pages = englishPages;
const labels = new Map(pages.map((page) => [page.path, page.h1]));

function toolCardHtml(tool: ToolInfo, isComingSoon = false): string {
  const svg = (toolIcons[tool.icon]?.svg ?? '').replaceAll('width="24"', 'width="18"').replaceAll('height="24"', 'height="18"');
  const isSoon = isComingSoon || tool.status === 'coming-soon';
  let badgeHtml = '';
  if (isSoon) {
    badgeHtml = '<span class="badge badge-neutral">Coming soon</span>';
  } else if (tool.status === 'beta' || tool.badges?.includes('Beta')) {
    badgeHtml = '<span class="badge badge-ok">Beta</span>';
  }
  const top = `<span class="tool-top"><span class="tool-icon" data-cat="${escapeHtml(tool.category)}">${svg}</span>${badgeHtml}</span>`;
  const body = `<span class="tool-copy"><span class="tool-name">${escapeHtml(tool.name)}</span><span class="tool-desc">${escapeHtml(tool.description)}</span></span>`;
  if (isSoon) {
    return `<div class="tool-card tool-card-muted" data-tool="${escapeHtml(tool.id)}" data-cat="${escapeHtml(tool.category)}" aria-label="${escapeHtml(tool.name)} – Coming soon">${top}${body}</div>`;
  }
  return `<a class="tool-card" href="${hrefFor(tool.id)}" data-tool="${escapeHtml(tool.id)}" data-cat="${escapeHtml(tool.category)}" aria-label="${escapeHtml(tool.name)} – ${escapeHtml(tool.description)}">${top}${body}</a>`;
}

function catalogShell(): { popular: string; catalog: string } {
  const popular = `<div class="tool-grid-wrap"><div class="tool-grid">${popularTools().slice(0, 8).map((t) => toolCardHtml(t)).join('')}</div></div>`;
  const categorySections = CATEGORIES.map((category) => {
    const tools = toolsIn(category.id);
    if (!tools.length) return '';
    return `<section class="tool-section"><h2>${escapeHtml(category.label)}</h2><div class="tool-grid-wrap"><div class="tool-grid">${tools.map((t) => toolCardHtml(t)).join('')}</div></div></section>`;
  }).join('');
  const soon = comingSoonTools();
  const soonSection = soon.length
    ? `<section class="tool-section tool-section-soon"><header class="tool-section-head"><h2>Coming soon</h2><span class="tool-section-tag">in development</span></header><div class="tool-grid-wrap"><div class="tool-grid tool-grid-soon">${soon.map((t) => toolCardHtml(t, true)).join('')}</div></div></section>`
    : '';
  return { popular, catalog: `${categorySections}${soonSection}` };
}

function comingSoonHtml(tool: ToolInfo): string {
  const svg = (toolIcons[tool.icon]?.svg ?? '').replaceAll('width="24"', 'width="24"').replaceAll('height="24"', 'height="24"');
  const relatedIds = tool.relatedWorkingTools ?? [];
  const related = relatedIds
    .map((id) => toolById(id))
    .filter((t): t is ToolInfo => Boolean(t && (t.status === 'ready' || t.status === 'beta')))
    .slice(0, 3);
  const relatedHtml = related.length
    ? `<div class="coming-soon-related"><h2 class="related-title">Working alternatives you can use right now:</h2><div class="related-tools-grid">${related.map((alt) => {
        const altSvg = (toolIcons[alt.icon]?.svg ?? '').replaceAll('width="24"', 'width="16"').replaceAll('height="24"', 'height="16"');
        return `<a class="btn outline related-tool-btn" href="${hrefFor(alt.id)}">${altSvg}<span>${escapeHtml(alt.name)}</span></a>`;
      }).join('')}</div></div>`
    : '';

  return `<div class="coming-soon-panel"><div class="coming-soon-top"><span class="tool-icon" data-cat="${escapeHtml(tool.category)}">${svg}</span><span class="badge badge-neutral">Coming soon</span></div><h1>${escapeHtml(tool.name)}</h1><p class="tool-intro">${escapeHtml(tool.description)}</p><div class="coming-soon-card"><p class="coming-soon-lead">We're building a privacy-first, on-device version of this tool. No files will ever leave your browser.</p><p class="coming-soon-sub">${escapeHtml(tool.limit ?? 'This feature is currently in active development.')}</p></div>${relatedHtml}</div>`;
}

function footer(): string {
  const extras: string[] = [];
  if (brand.repoUrl) extras.push(`<a href="${escapeHtml(brand.repoUrl)}" target="_blank" rel="noopener">GitHub</a>`);
  if (brand.social.instagram) extras.push(`<a href="${escapeHtml(brand.social.instagram)}" target="_blank" rel="noopener">Instagram</a>`);
  if (brand.supportUrl) extras.push(`<a href="${escapeHtml(brand.supportUrl)}" target="_blank" rel="noopener">Support ${escapeHtml(brandName())}</a>`);
  const extra = extras.length ? `<p class="foot-extra">${extras.join(' · ')}</p>` : '';
  return `<div class="wrap foot-inner"><div class="foot-brand-block"><p class="foot-brand-name"><strong>${escapeHtml(brandName())}</strong></p><p class="foot-tag">${escapeHtml(brand.tagline)}</p>${extra}</div><nav class="foot-nav" aria-label="Footer tools"><h2>Tools</h2><a href="/compress-pdf">Compress PDF</a><a href="/merge-pdf">Merge PDF</a><a href="/split-pdf">Split PDF</a><a href="/tools">All tools</a></nav><nav class="foot-nav" aria-label="Convert"><h2>Convert</h2><a href="/jpg-to-pdf">JPG to PDF</a><a href="/png-to-pdf">PNG to PDF</a><a href="/pdf-to-jpg">PDF to JPG</a><a href="/heic-to-jpg">HEIC to JPG</a></nav><nav class="foot-nav" aria-label="Company"><h2>Company</h2><a href="/about">About</a><a href="/guides">Guides</a><a href="/brand">Brand</a><a href="/press">Press</a><a href="${escapeHtml(brand.repoUrl)}" target="_blank" rel="noopener">GitHub</a><a href="${escapeHtml(brand.social.instagram)}" target="_blank" rel="noopener">Instagram</a></nav><nav class="foot-nav" aria-label="Legal"><h2>Legal</h2><a href="/privacy">Privacy</a><a href="/sitemap">Sitemap</a></nav></div><div class="wrap foot-bar"><p>© 2026 ${escapeHtml(brandName())}. Processed on your device.</p><p>English</p></div>`;
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
  const links = indexable
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
  const robotsTag = page.noindex ? '<meta name="robots" content="noindex, follow">\n' : '';
  const altXDefault = page.noindex ? '' : `<link rel="alternate" hreflang="x-default" href="${brandOrigin()}/${page.path}" />`;
  html = html.replace('</head>', `${robotsTag}${preload}${verify}${links}${altXDefault}${json}</head>`);
  html = html.replace(/<a class="wordmark"[^>]*>[\s\S]*?<\/a>/, `<a class="wordmark" href="/" aria-label="${escapeHtml(brandName())} home">${lockupHorizontal}</a>`);
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
  const soonTool = page.toolId ? toolById(page.toolId) : undefined;
  if (soonTool && soonTool.status === 'coming-soon') {
    html = html.replace('<div class="panel" id="panel-extra" tabindex="0"></div>', `<div class="panel" id="panel-extra" tabindex="0">${comingSoonHtml(soonTool)}</div>`);
    html = html.replace(/(<div id="landing-rest"[^>]*>)[\s\S]*?(<\/div>)/, '$1$2');
  }
  if (page.path) {
    html = html.replace(/(<div id="landing-head"[^>]*>)(<\/div>)/, `$1${head}$2`);
    html = html.replace(/(<div id="landing-rest"[^>]*>)(<\/div>)/, `$1${rest}$2`);
  }
  html = html.replace(/<footer class="foot" id="site-footer">[\s\S]*?<\/footer>/, `<footer class="foot" id="site-footer">${footer()}</footer>`);
  const shell = catalogShell();
  html = html.replace('<div id="popular"></div>', `<div id="popular">${shell.popular}</div>`);
  html = html.replace('<div id="catalog"></div>', `<div id="catalog">${shell.catalog}</div>`);
  html = html.replaceAll(/View all \d+\+? tools/g, `View all ${activeToolsCount()} tools`);
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
  if (!page.noindex) {
    const title = escapeHtml(page.h1).slice(0, 80);
    const subtitle = escapeHtml(page.subtitle).slice(0, 110);
    const file = `${page.path || 'home'}.svg`.replaceAll('/', '-');
    writeFileSync(
      join(ogDir, file),
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#F5F6F8"/><g transform="translate(72 64) scale(1.35)" color="#14181F">${lockupInner}</g><text x="72" y="300" fill="#14181F" font-family="IBM Plex Sans, sans-serif" font-size="56" font-weight="600">${title}</text><text x="72" y="372" fill="#14181F" font-family="IBM Plex Sans, sans-serif" font-size="28">${subtitle}</text><text x="72" y="540" fill="#1B7A4A" font-family="IBM Plex Sans, sans-serif" font-size="22">Processed on your device</text></svg>\n`,
    );
  }
}

const missing = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Page not found — ${brandName()}</title><meta name="robots" content="noindex"></head><body><h1>Page not found</h1><p>That address is not a page on this site.</p><p><a href="/compress-pdf">Compress PDF</a> <a href="/merge-pdf">Merge PDF</a> <a href="/">Home</a></p></body></html>`;
writeFileSync(join(dist, '404.html'), missing);

const lastmod = UPDATED;
const body = indexable
  .map((page) => `  <url><loc>${brandOrigin()}/${page.path}</loc><lastmod>${page.updated}</lastmod></url>`)
  .join('\n');
writeFileSync(join(dist, 'sitemap-en.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${brandOrigin()}/sitemap-en.xml</loc><lastmod>${lastmod}</lastmod></sitemap>\n</sitemapindex>\n`,
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dev\nDisallow: /dev/\nSitemap: ${brandOrigin()}/sitemap.xml\n`);

const csv = ['keyword,intent,page URL,language,priority,notes'];
for (const page of indexable) {
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
