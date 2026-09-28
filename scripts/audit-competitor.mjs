import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCREENSHOT_DIR = path.resolve('research/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const TOOLS = [
  { name: 'Compress PDF', weesizeSlug: 'compress-pdf', iloveSlug: 'compress_pdf', sampleFile: 'test-files/photo-heavy.pdf' },
  { name: 'Merge PDF', weesizeSlug: 'merge-pdf', iloveSlug: 'merge_pdf', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Split PDF', weesizeSlug: 'split-pdf', iloveSlug: 'split_pdf', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'JPG to PDF', weesizeSlug: 'jpg-to-pdf', iloveSlug: 'jpg_to_pdf', sampleFile: 'test-files/sample.jpg' },
  { name: 'PDF to JPG', weesizeSlug: 'pdf-to-jpg', iloveSlug: 'pdf_to_jpg', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'PDF to Word', weesizeSlug: 'pdf-to-word', iloveSlug: 'pdf_to_word', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Word to PDF', weesizeSlug: 'word-to-pdf', iloveSlug: 'word_to_pdf', sampleFile: 'test-files/sample.docx' },
  { name: 'Sign PDF', weesizeSlug: 'sign-pdf', iloveSlug: 'sign-pdf', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Organize pages', weesizeSlug: 'organize-pdf', iloveSlug: 'organize-pdf', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Rotate PDF', weesizeSlug: 'rotate-pdf', iloveSlug: 'rotate_pdf', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Protect PDF', weesizeSlug: 'protect-pdf', iloveSlug: 'protect-pdf', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Unlock PDF', weesizeSlug: 'unlock-pdf', iloveSlug: 'unlock_pdf', sampleFile: 'test-files/protected.pdf' },
  { name: 'OCR', weesizeSlug: 'ocr-pdf', iloveSlug: 'ocr-pdf', sampleFile: 'test-files/scanned.pdf' },
  { name: 'Edit PDF', weesizeSlug: 'edit-pdf', iloveSlug: 'edit-pdf', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Watermark', weesizeSlug: 'watermark-pdf', iloveSlug: 'pdf_add_watermark', sampleFile: 'test-files/normal-text.pdf' },
  { name: 'Page numbers', weesizeSlug: 'add-page-numbers-to-pdf', iloveSlug: 'add_pdf_page_number', sampleFile: 'test-files/normal-text.pdf' },
];

async function runAudit() {
  console.log('Launching Chromium for competitive benchmarking...');
  const browser = await chromium.launch({ headless: true });

  const auditResults = [];

  for (const tool of TOOLS) {
    console.log(`\nAuditing [${tool.name}]...`);
    const result = {
      name: tool.name,
      weesize: { url: `http://127.0.0.1:5000/${tool.weesizeSlug}` },
      ilove: { url: `https://www.ilovepdf.com/${tool.iloveSlug}` },
    };

    // 1. Audit Weesize Desktop
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const requests = [];
      let totalBytes = 0;
      page.on('response', async (res) => {
        requests.push(res.url());
        try {
          const b = await res.body();
          totalBytes += b.length;
        } catch {}
      });

      const t0 = Date.now();
      await page.goto(result.weesize.url, { waitUntil: 'networkidle' });
      const loadTimeMs = Date.now() - t0;

      const title = await page.title();
      const metaDesc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => '');
      const h1 = await page.locator('h1').allInnerTexts().then(arr => arr.join('; ')).catch(() => '');
      const h2s = await page.locator('h2').allInnerTexts().catch(() => []);
      const jsonLd = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.innerText)).catch(() => []);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => '');
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

      const safeName = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const ssPathDesktop = path.join(SCREENSHOT_DIR, `weesize-${safeName}-1440.png`);
      await page.screenshot({ path: ssPathDesktop });

      // Mobile check
      await page.setViewportSize({ width: 390, height: 844 });
      const ssPathMobile = path.join(SCREENSHOT_DIR, `weesize-${safeName}-390.png`);
      await page.screenshot({ path: ssPathMobile });

      result.weesize = {
        ...result.weesize,
        loadTimeMs,
        requestsCount: requests.length,
        totalBytes,
        externalRequestsCount: requests.filter(u => !u.includes('127.0.0.1')).length,
        title,
        metaDesc,
        h1,
        h2Count: h2s.length,
        h2Sample: h2s.slice(0, 4),
        wordCount,
        jsonLdTypes: jsonLd.map(s => { try { return JSON.parse(s)['@type'] || 'raw'; } catch { return 'err'; } }),
        canonical,
        screenshotDesktop: `weesize-${safeName}-1440.png`,
        screenshotMobile: `weesize-${safeName}-390.png`,
      };
      await page.close();
    } catch (err) {
      console.error(`Weesize error on ${tool.name}:`, err.message);
      result.weesize.error = err.message;
    }

    // 2. Audit iLovePDF (polite single page read)
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const requests = [];
      let totalBytes = 0;
      page.on('response', async (res) => {
        requests.push(res.url());
        try {
          const b = await res.body();
          totalBytes += b.length;
        } catch {}
      });

      const t0 = Date.now();
      await page.goto(result.ilove.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const loadTimeMs = Date.now() - t0;
      await page.waitForTimeout(1500); // polite pause

      const title = await page.title();
      const metaDesc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => '');
      const h1 = await page.locator('h1').allInnerTexts().then(arr => arr.join('; ')).catch(() => '');
      const h2s = await page.locator('h2').allInnerTexts().catch(() => []);
      const jsonLd = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.innerText)).catch(() => []);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => '');
      const hreflang = await page.$$eval('link[rel="alternate"][hreflang]', els => els.map(e => e.getAttribute('hreflang'))).catch(() => []);
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

      // Trackers & Ads detection
      const thirdPartyHosts = new Set();
      for (const reqUrl of requests) {
        try {
          const host = new URL(reqUrl).hostname;
          if (!host.includes('ilovepdf.com')) thirdPartyHosts.add(host);
        } catch {}
      }

      const hasCookieBanner = await page.locator('#cookie-law, .cookie-consent, [aria-label*="cookie" i], .banner--cookie').isVisible().catch(() => false);
      const hasAdContainers = await page.locator('ins.adsbygoogle, [id*="ad-" i], [class*="advertisement" i]').count().catch(() => 0);

      const safeName = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const ssPathDesktop = path.join(SCREENSHOT_DIR, `ilovepdf-${safeName}-1440.png`);
      await page.screenshot({ path: ssPathDesktop });

      await page.setViewportSize({ width: 390, height: 844 });
      const ssPathMobile = path.join(SCREENSHOT_DIR, `ilovepdf-${safeName}-390.png`);
      await page.screenshot({ path: ssPathMobile });

      result.ilove = {
        ...result.ilove,
        loadTimeMs,
        requestsCount: requests.length,
        totalBytes,
        thirdPartyHostsCount: thirdPartyHosts.size,
        thirdPartySample: Array.from(thirdPartyHosts).slice(0, 6),
        hasCookieBanner,
        adContainersCount: hasAdContainers,
        title,
        metaDesc,
        h1,
        h2Count: h2s.length,
        h2Sample: h2s.slice(0, 4),
        wordCount,
        jsonLdTypes: jsonLd.map(s => { try { return JSON.parse(s)['@type'] || 'raw'; } catch { return 'err'; } }),
        canonical,
        hreflangCount: hreflang.length,
        hreflangSample: hreflang.slice(0, 8),
        screenshotDesktop: `ilovepdf-${safeName}-1440.png`,
        screenshotMobile: `ilovepdf-${safeName}-390.png`,
      };
      await page.close();
    } catch (err) {
      console.error(`iLovePDF error on ${tool.name}:`, err.message);
      result.ilove.error = err.message;
    }

    auditResults.push(result);
  }

  // Also audit Homepage
  console.log('\nAuditing Homepages...');
  const homeResult = { name: 'Home', weesize: { url: 'http://127.0.0.1:5000/' }, ilove: { url: 'https://www.ilovepdf.com/' } };
  try {
    const pageW = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pageW.goto(homeResult.weesize.url, { waitUntil: 'networkidle' });
    await pageW.screenshot({ path: path.join(SCREENSHOT_DIR, 'weesize-home-1440.png') });
    await pageW.setViewportSize({ width: 390, height: 844 });
    await pageW.screenshot({ path: path.join(SCREENSHOT_DIR, 'weesize-home-390.png') });
    await pageW.close();

    const pageI = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pageI.goto(homeResult.ilove.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await pageI.waitForTimeout(2000);
    await pageI.screenshot({ path: path.join(SCREENSHOT_DIR, 'ilovepdf-home-1440.png') });
    await pageI.setViewportSize({ width: 390, height: 844 });
    await pageI.screenshot({ path: path.join(SCREENSHOT_DIR, 'ilovepdf-home-390.png') });
    await pageI.close();
  } catch (err) {
    console.error('Home audit error:', err.message);
  }

  await browser.close();

  fs.writeFileSync('research/audit-data.json', JSON.stringify(auditResults, null, 2));
  console.log('\nAudit complete! Saved data to research/audit-data.json and screenshots to research/screenshots/');
}

runAudit().catch(console.error);
