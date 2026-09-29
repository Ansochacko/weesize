import { chromium } from '@playwright/test';
import { join } from 'node:path';

const outDir = 'C:/Users/ansoc/.gemini/antigravity/brain/059f4ca0-be09-4d6a-b416-cf0533e86a71/screenshots';

const configs = [
  { name: 'desktop-light', width: 1440, height: 900, isMobile: false, colorScheme: 'light' },
  { name: 'desktop-dark', width: 1440, height: 900, isMobile: false, colorScheme: 'dark' },
  { name: 'mobile-light', width: 390, height: 844, isMobile: true, colorScheme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, isMobile: true, colorScheme: 'dark' },
];

const pagesToTest = [
  { path: '', label: 'home' },
  { path: 'compress-image', label: 'compress-image' },
  { path: 'compress-pdf-to-100kb', label: 'compress-pdf-to-100kb' },
];

async function run() {
  const browser = await chromium.launch();
  for (const cfg of configs) {
    const context = await browser.newContext({
      viewport: { width: cfg.width, height: cfg.height },
      isMobile: cfg.isMobile,
      colorScheme: cfg.colorScheme,
    });
    const page = await context.newPage();
    for (const p of pagesToTest) {
      const url = `https://weesize.com/${p.path}`;
      console.log(`Testing ${url} [${cfg.name}]`);
      await page.goto(url, { waitUntil: 'networkidle' });

      // Verify no home-tools on non-home pages
      if (p.path) {
        const homeToolsCount = await page.locator('#home-tools').count();
        const homeToolsVisible = homeToolsCount > 0 ? await page.locator('#home-tools').isVisible() : false;
        console.log(`  -> #home-tools visible on ${p.label}: ${homeToolsVisible} (expected: false)`);
        if (homeToolsVisible) {
          console.error(`  ERROR: #home-tools is visible on ${url}!`);
        }
      }

      // Check tool is above the fold or visible
      if (p.path === 'compress-image') {
        const toolTitle = await page.locator('#landing-head h1').textContent();
        console.log(`  -> Title: ${toolTitle}`);
        const lede = await page.locator('#landing-head .lede').textContent();
        console.log(`  -> Subtitle: ${lede}`);
      }

      const file = join(outDir, `${p.label}-${cfg.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`  Saved screenshot: ${file}`);
    }
    await context.close();
  }
  await browser.close();
  console.log('All live checks completed!');
}

run().catch(console.error);
