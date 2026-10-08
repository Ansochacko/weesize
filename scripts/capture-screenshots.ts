import { chromium } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/ansoc/.gemini/antigravity/brain/059f4ca0-be09-4d6a-b416-cf0533e86a71/screenshots';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch();
  const pages = [
    { slug: '', name: 'home' },
    { slug: 'compress-image', name: 'compress-image' },
    { slug: 'signature-resizer', name: 'signature-resizer' },
    { slug: 'compress-pdf-to-100kb', name: 'compress-pdf-to-100kb' },
  ];

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  const themes = ['light', 'dark'];

  const context = await browser.newContext();
  const page = await context.newPage();

  // Using local vite preview at port 4191 or starting preview
  for (const vp of viewports) {
    for (const theme of themes) {
      for (const p of pages) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`http://127.0.0.1:4191/${p.slug}`, { waitUntil: 'networkidle' });
        await page.evaluate((th) => {
          document.documentElement.dataset.theme = th;
        }, theme);
        await page.waitForTimeout(400);

        const outPath = path.join(ARTIFACTS_DIR, `${p.name}-${vp.name}-${theme}.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`Saved screenshot: ${outPath}`);
      }
    }
  }

  await browser.close();
  console.log('Finished capturing all verification screenshots.');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
