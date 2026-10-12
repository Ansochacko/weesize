import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FILES = {
  normalText: path.resolve('test-files/normal-text.pdf'),
  protected: path.resolve('test-files/protected.pdf'),
  damaged: path.resolve('test-files/damaged.pdf'),
  sampleJpg: path.resolve('test-files/sample.jpg'),
  transparentPng: path.resolve('test-files/transparent.png'),
};

// Simulates phones without Map.prototype.getOrInsertComputed (Chrome < 145,
// iOS Safari < 26.2, Samsung Internet), both on the page and inside workers.
const REMOVE_NEW_MAP_METHODS =
  'delete Map.prototype.getOrInsertComputed; delete Map.prototype.getOrInsert;' +
  'delete WeakMap.prototype.getOrInsertComputed; delete WeakMap.prototype.getOrInsert;';

async function simulateOlderBrowser(page: Page): Promise<void> {
  await page.addInitScript(REMOVE_NEW_MAP_METHODS);
  await page.route(/\/assets\/.*worker.*\.js(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ response, body: `${REMOVE_NEW_MAP_METHODS}\n${body}` });
  });
}

function redactInput(page: Page) {
  return page.locator('main input[type=file][accept*="pdf"]:not([webkitdirectory])').last();
}

async function openRedact(page: Page, file: string): Promise<void> {
  await page.goto('/redact');
  await redactInput(page).setInputFiles(file);
  await expect(page.getByText('is ready for redaction')).toBeVisible({ timeout: 20_000 });
}

/** Drags a box with the mouse; coordinates are fractions of the page preview. */
async function drawBox(page: Page, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  const svg = page.locator('.stage-wrapper svg');
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  if (!box) throw new Error('No preview to draw on');
  await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1, { steps: 8 });
  await page.mouse.up();
}

async function download(page: Page): Promise<Buffer> {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download Redacted File/ }).click(),
  ]);
  const file = await dl.path();
  return fs.readFileSync(file);
}

async function extractPdf(bytes: Buffer): Promise<{ pages: number; text: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const doc = await task.promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((item) => ('str' in item ? item.str : '')).join('');
  }
  const pages = doc.numPages;
  await task.destroy();
  return { pages, text: text.trim() };
}

/** Decodes an image in the browser and reads one pixel at fractional coordinates. */
async function pixelAt(page: Page, bytes: Buffer, mime: string, fx: number, fy: number): Promise<number[]> {
  return page.evaluate(
    async ({ b64, mime, fx, fy }) => {
      // Decode without fetch(): the site's CSP blocks data: URLs.
      const raw = atob(b64);
      const buf = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
      const blob = new Blob([buf], { type: mime });
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(Math.floor(bmp.width * fx), Math.floor(bmp.height * fy), 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]!];
    },
    { b64: bytes.toString('base64'), mime, fx, fy },
  );
}

for (const olderBrowser of [false, true]) {
  test.describe(`Redact${olderBrowser ? ' (older phone browser)' : ''}`, () => {
    let errors: string[] = [];

    test.beforeEach(async ({ page }) => {
      errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (olderBrowser) await simulateOlderBrowser(page);
    });

    test.afterEach(() => {
      expect(errors, 'uncaught page errors').toEqual([]);
    });

    test('redacts a text PDF so no text survives', async ({ page }) => {
      await openRedact(page, FILES.normalText);
      await expect(page.locator('.redact-editor')).toContainText('Page 1 of 3');
      await drawBox(page, 0.05, 0.05, 0.95, 0.3);
      await expect(page.locator('.redact-count')).toHaveText(/^1 box on this page/);

      // Page through so on-demand rendering is exercised.
      await page.getByRole('button', { name: 'Next →' }).click();
      await expect(page.locator('.redact-editor')).toContainText('Page 2 of 3');
      await expect(page.locator('.redact-count')).toHaveText(/^0 boxes on this page · 1 in total/);
      await page.getByRole('button', { name: '← Prev' }).click();
      await expect(page.locator('.redact-count')).toHaveText(/^1 box on this page/);

      const out = await download(page);
      const { pages, text } = await extractPdf(out);
      expect(pages).toBe(3);
      expect(text).toBe('');
      await expect(page.getByText(/Downloaded .*-redacted\.pdf/)).toBeVisible();
    });

    test('burns a black box into a photo', async ({ page }) => {
      await openRedact(page, FILES.sampleJpg);
      await drawBox(page, 0.2, 0.2, 0.6, 0.6);
      const out = await download(page);
      const [r, g, b] = await pixelAt(page, out, 'image/jpeg', 0.4, 0.4);
      expect(Math.max(r!, g!, b!)).toBeLessThan(20);
    });

    test('transparent PNG saved as JPG gets a white background', async ({ page }) => {
      await openRedact(page, FILES.transparentPng);
      await drawBox(page, 0.6, 0.6, 0.9, 0.9); // a box is required; read a pixel outside it
      const out = await download(page); // defaults to JPG for images
      const [r, g, b] = await pixelAt(page, out, 'image/jpeg', 0, 0);
      expect(Math.min(r!, g!, b!)).toBeGreaterThan(235);
    });

    test('password-protected PDF shows a clear message and lets you pick again', async ({ page }) => {
      await page.goto('/redact');
      await redactInput(page).setInputFiles(FILES.protected);
      await expect(page.getByText(/password-protected/).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.redact-editor')).toBeHidden();
      await expect(page.locator('main .drop').last()).toBeVisible();

      // Picking a good file afterwards still works.
      await redactInput(page).setInputFiles(FILES.normalText);
      await expect(page.getByText('is ready for redaction')).toBeVisible({ timeout: 20_000 });
    });

    test('damaged PDF shows a clear message', async ({ page }) => {
      await page.goto('/redact');
      await redactInput(page).setInputFiles(FILES.damaged);
      await expect(page.getByText(/couldn’t be opened/).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('main .drop').last()).toBeVisible();
    });
  });
}

test.describe('Redact safety and layout', () => {
  test('refuses to download when nothing is blacked out', async ({ page }) => {
    await openRedact(page, FILES.normalText);
    // A click without dragging must not count as a box.
    const svg = page.locator('.stage-wrapper svg');
    await svg.scrollIntoViewIfNeeded();
    const box = await svg.boundingBox();
    if (!box) throw new Error('No preview');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByText('A single click or tap doesn’t draw a box')).toBeVisible();

    let downloaded = false;
    page.on('download', () => {
      downloaded = true;
    });
    await page.getByRole('button', { name: /Download Redacted File/ }).click();
    await expect(page.getByText('Nothing is blacked out yet')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(downloaded).toBe(false);

    // After drawing a box, the same button must work again.
    await drawBox(page, 0.05, 0.05, 0.95, 0.3);
    const out = await download(page);
    expect((await extractPdf(out)).text).toBe('');
  });

  test('the whole page preview fits on screen and the drawing layer lines up', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openRedact(page, FILES.normalText);
    const canvas = await page.locator('.stage-wrapper canvas').boundingBox();
    const svg = await page.locator('.stage-wrapper svg').boundingBox();
    if (!canvas || !svg) throw new Error('No preview');
    expect(canvas.height).toBeLessThanOrEqual(768 * 0.75 + 1);
    expect(Math.abs(svg.x - canvas.x)).toBeLessThan(2);
    expect(Math.abs(svg.y - canvas.y)).toBeLessThan(2);
    expect(Math.abs(svg.width - canvas.width)).toBeLessThan(2);
    expect(Math.abs(svg.height - canvas.height)).toBeLessThan(2);
  });

  test('dropping a file onto the page opens it', async ({ page }) => {
    await page.goto('/redact');
    const bytes = fs.readFileSync(FILES.normalText).toString('base64');
    const dataTransfer = await page.evaluateHandle((b64) => {
      const raw = atob(b64);
      const buf = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([buf], 'dropped.pdf', { type: 'application/pdf' }));
      return dt;
    }, bytes);
    const zone = page.locator('main .drop').last();
    await zone.dispatchEvent('dragenter', { dataTransfer });
    await zone.dispatchEvent('dragover', { dataTransfer });
    await zone.dispatchEvent('drop', { dataTransfer });
    await expect(page.getByText('dropped.pdf is ready for redaction')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Redact on a phone (touch)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('draws a box with a finger and exports', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Touch drag is simulated through Chromium DevTools');
    await simulateOlderBrowser(page);
    await openRedact(page, FILES.normalText);

    const box = await page.locator('.stage-wrapper svg').boundingBox();
    if (!box) throw new Error('No preview to draw on');
    const cdp = await page.context().newCDPSession(page);
    const x0 = box.x + box.width * 0.1;
    const y0 = box.y + box.height * 0.1;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 30, y: y0 + i * 12 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.redact-count')).toHaveText(/^1 box on this page/);

    const out = await download(page);
    const { pages, text } = await extractPdf(out);
    expect(pages).toBe(3);
    expect(text).toBe('');
  });
});
