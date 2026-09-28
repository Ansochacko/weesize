import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const outDir = 'C:\\Users\\ansoc\\.gemini\\antigravity\\brain\\059f4ca0-be09-4d6a-b416-cf0533e86a71\\screenshots';

const server = spawn('cmd.exe', ['/c', 'npx', 'vite', 'preview', '--host', '127.0.0.1', '--port', '4191', '--strictPort'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

// Wait for server to start
await new Promise((resolve) => setTimeout(resolve, 3000));

const browser = await chromium.launch();

async function snap(urlPath, filename, width, height, theme = 'light', beforeSnap = null) {
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(`http://127.0.0.1:4191${urlPath}`, { waitUntil: 'networkidle' });
  await page.evaluate((th) => {
    document.documentElement.dataset.theme = th;
  }, theme);
  await page.waitForTimeout(400);
  if (beforeSnap) {
    await beforeSnap(page);
    await page.waitForTimeout(400);
  }
  const fullPath = join(outDir, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  console.log('Saved:', filename);
  await page.close();
}

console.log('Starting screenshot captures...');

// 1. Home 1440 Light & Dark
await snap('/', 'home-1440-light.png', 1440, 900, 'light');
await snap('/', 'home-1440-dark.png', 1440, 900, 'dark');

// 2. Home 390 Light & Dark
await snap('/', 'home-390-light.png', 390, 844, 'light');
await snap('/', 'home-390-dark.png', 390, 844, 'dark');

// 3. All Tools 1440 Light & Dark
await snap('/tools', 'tools-1440-light.png', 1440, 900, 'light');
await snap('/tools', 'tools-1440-dark.png', 1440, 900, 'dark');

// 4. All Tools 390 Light & Dark
await snap('/tools', 'tools-390-light.png', 390, 844, 'light');
await snap('/tools', 'tools-390-dark.png', 390, 844, 'dark');

// 5. Tool Page (Empty) 1440 Light & Dark
await snap('/compress-pdf', 'compress-empty-1440-light.png', 1440, 900, 'light');
await snap('/compress-pdf', 'compress-empty-1440-dark.png', 1440, 900, 'dark');

// 6. Tool Page (Empty) 390 Light & Dark
await snap('/compress-pdf', 'compress-empty-390-light.png', 390, 844, 'light');
await snap('/compress-pdf', 'compress-empty-390-dark.png', 390, 844, 'dark');

// 7. Tool Page (Processing) 1440 Light
await snap('/compress-pdf', 'compress-processing-1440-light.png', 1440, 900, 'light', async (page) => {
  await page.evaluate(() => {
    const action = document.querySelector('[data-action="compress-pdf"]');
    if (action) {
      const text = action.querySelector('.btn-label');
      if (text) text.textContent = 'Compressing page 14 of 38…';
      const bar = action.querySelector('.btn-bar');
      if (bar) bar.style.width = '37%';
      action.setAttribute('aria-busy', 'true');
    }
    const row = document.querySelector('.inspector .action-row');
    if (row && !row.querySelector('.cancel')) {
      const cancel = document.createElement('button');
      cancel.className = 'btn quiet cancel';
      cancel.textContent = 'Cancel';
      row.append(cancel);
    }
  });
});

// 8. Tool Page (Result) 1440 Light & Dark
async function mockResult(page) {
  await page.evaluate(async () => {
    const resultCard = document.createElement('div');
    resultCard.className = 'result-card';
    resultCard.innerHTML = `
      <h2 class="result-title">Your file is ready</h2>
      <p class="result-filename">quarterly-report-2026.pdf</p>
      <div class="size-bar" role="img" aria-label="4.8 MB to 184 KB. 96% smaller · Fits the 200 KB limit">
        <div class="size-bar-limit-wrap" style="left: 4.16%;">
          <span class="size-bar-limit-caption">Limit: 200 KB</span>
          <div class="size-bar-limit-line"></div>
        </div>
        <div class="size-bar-track">
          <span class="size-bar-before" style="width: 100%;"></span>
          <span class="size-bar-after is-fit" style="width: 3.83%;"></span>
        </div>
        <p class="size-display">4.8 MB → 184 KB</p>
        <p class="size-bar-note is-fit">96% smaller · Fits the 200 KB limit</p>
      </div>
      <div class="action-row" style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
        <button class="btn primary" type="button">Download</button>
        <button class="btn quiet" type="button">Check before sharing</button>
        <button class="btn quiet text-link-btn" type="button">Start over</button>
      </div>
    `;
    const host = document.querySelector('#panel-compress');
    if (host) {
      host.replaceChildren(resultCard);
    }
  });
}
await snap('/compress-pdf', 'compress-result-1440-light.png', 1440, 900, 'light', mockResult);
await snap('/compress-pdf', 'compress-result-1440-dark.png', 1440, 900, 'dark', mockResult);

// 9. Guide Page 1440 Light & Dark
await snap('/guides/how-pdf-compression-works', 'guide-1440-light.png', 1440, 900, 'light');
await snap('/guides/how-pdf-compression-works', 'guide-1440-dark.png', 1440, 900, 'dark');

// 10. Guide Page 390 Light & Dark
await snap('/guides/how-pdf-compression-works', 'guide-390-light.png', 390, 844, 'light');
await snap('/guides/how-pdf-compression-works', 'guide-390-dark.png', 390, 844, 'dark');

// 11. Dev Design Gallery 1440 Light & Dark
await snap('/#/dev/design', 'dev-design-1440-light.png', 1440, 900, 'light');
await snap('/#/dev/design', 'dev-design-1440-dark.png', 1440, 900, 'dark');

console.log('All screenshots captured successfully.');

await browser.close();
server.kill();
process.exit(0);
