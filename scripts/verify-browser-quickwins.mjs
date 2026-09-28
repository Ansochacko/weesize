import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const externalRequests = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      externalRequests.push(req.url());
    }
  });

  // 1. Visit 100 KB page
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5000/compress-pdf-to-100kb', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'research/screenshots/quickwin-100kb-1440.png', fullPage: true });

  // 2. Visit Alternatives page
  await page.goto('http://127.0.0.1:5000/alternatives/ilovepdf', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'research/screenshots/quickwin-alternatives-1440.png', fullPage: true });

  // 3. Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5000/alternatives/ilovepdf', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'research/screenshots/quickwin-alternatives-390.png', fullPage: true });

  await browser.close();

  console.log('Screenshots captured successfully.');
  console.log('External requests count:', externalRequests.length);
  if (externalRequests.length > 0) {
    console.error('Violations:', externalRequests);
  }
}

main().catch(console.error);
