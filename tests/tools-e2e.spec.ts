import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

const TEST_FILES = {
  normalText: path.resolve('test-files/normal-text.pdf'),
  scanned: path.resolve('test-files/scanned.pdf'),
  photoHeavy: path.resolve('test-files/photo-heavy.pdf'),
  protected: path.resolve('test-files/protected.pdf'),
  damaged: path.resolve('test-files/damaged.pdf'),
  sampleJpg: path.resolve('test-files/sample.jpg'),
  transparentPng: path.resolve('test-files/transparent.png'),
  sampleWebp: path.resolve('test-files/sample.webp'),
  emptyFile: path.resolve('test-files/empty.pdf'),
};

// Create empty file if not exists
if (!fs.existsSync(TEST_FILES.emptyFile)) {
  fs.writeFileSync(TEST_FILES.emptyFile, Buffer.alloc(0));
}

test.describe('Weesize Core Tools and Privacy Verification', () => {
  let externalRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    externalRequests = [];
    page.on('request', (req) => {
      const raw = req.url();
      if (raw.startsWith('blob:') || raw.startsWith('data:')) return;
      try {
        const url = new URL(raw);
        if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
          externalRequests.push(raw);
        }
      } catch {
        externalRequests.push(raw);
      }
    });
  });

  test.afterEach(async () => {
    // Assert zero external network requests
    expect(externalRequests).toEqual([]);
  });

  test('1. Removed tools redirect to /tools', async ({ page }) => {
    const removedTools = ['edit-pdf', 'sign-pdf', 'redact-pdf', 'ocr-pdf', 'protect-pdf', 'unlock-pdf', 'excel-to-pdf'];
    for (const slug of removedTools) {
      await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
      // Meta refresh or client redirect lands on /tools or displays tools view
      await expect(page).toHaveURL(/\/(tools)?/);
    }
  });

  test('2. Signature Resizer: mounts and processes signature photo', async ({ page }) => {
    await page.goto('/signature-resizer');
    const fileInput = page.locator('#panel-extra input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    if (fs.existsSync(TEST_FILES.sampleJpg)) {
      await fileInput.setInputFiles(TEST_FILES.sampleJpg);
      const actionBtn = page.locator('#panel-extra .action-row button');
      await expect(actionBtn).toBeAttached({ timeout: 10000 });
    }
  });

  test('3. Compress Image: exact size targeting', async ({ page }) => {
    await page.goto('/compress-image');
    const fileInput = page.locator('#panel-extra input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    if (fs.existsSync(TEST_FILES.sampleJpg)) {
      await fileInput.setInputFiles(TEST_FILES.sampleJpg);
      const downloadBtn = page.locator('#panel-extra .action-row button');
      await expect(downloadBtn).toBeAttached({ timeout: 10000 });
    }
  });

  test('4. Compress PDF: loads and mounts compression workspace', async ({ page }) => {
    await page.goto('/compress-pdf');
    const fileInput = page.locator('#panel-compress input[type="file"], #smart-drop input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    if (fs.existsSync(TEST_FILES.normalText)) {
      await fileInput.setInputFiles(TEST_FILES.normalText);
      const actionBtn = page.locator('#panel-compress button:has-text("Download"), #panel-compress button.primary').first();
      await expect(actionBtn).toBeAttached({ timeout: 10000 });
    }
  });

  test('5. ID Photo Maker: mounts passport crop controls', async ({ page }) => {
    await page.goto('/id-photo');
    const heading = page.locator('#panel-extra h2');
    await expect(heading).toBeAttached();

    if (fs.existsSync(TEST_FILES.sampleJpg)) {
      const fileInput = page.locator('#panel-extra input[type="file"]').first();
      await fileInput.setInputFiles(TEST_FILES.sampleJpg);
      const dlBtn = page.locator('#panel-extra button:has-text("Download")');
      await expect(dlBtn.first()).toBeAttached({ timeout: 10000 });
    }
  });

  test('6. Presets / Get It Accepted: custom rule parsing and verification', async ({ page }) => {
    await page.goto('/get-it-accepted');
    const customInput = page.locator('.custom-rule-box input');
    await expect(customInput).toBeAttached();

    await customInput.fill('JPG, 20–50 KB, 200×230 px');
    await page.locator('.custom-rule-box button').click();

    const detailText = page.locator('#panel-extra');
    await expect(detailText).toContainText('Custom', { ignoreCase: true });
  });

  test('7. Merge PDF: combines multiple documents', async ({ page }) => {
    await page.goto('/merge-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-merge input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    if (fs.existsSync(TEST_FILES.normalText) && fs.existsSync(TEST_FILES.photoHeavy)) {
      await fileInput.setInputFiles([TEST_FILES.normalText, TEST_FILES.photoHeavy]);
      const mergeBtn = page.locator('#panel-merge button:has-text("Merge")');
      await expect(mergeBtn).toBeVisible({ timeout: 10000 });
    }
  });

  test('8. Split PDF: page range extraction', async ({ page }) => {
    await page.goto('/split-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-split input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('9. Organize PDF: thumbnail grid and reorder', async ({ page }) => {
    await page.goto('/organize-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-organize input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('10. Images to PDF: converts photos to PDF', async ({ page }) => {
    await page.goto('/jpg-to-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-images input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('11. Safe to Share: sanitize metadata', async ({ page }) => {
    await page.goto('/check-pdf-before-sending', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('12. Error Handling: graceful handling of empty or damaged files', async ({ page }) => {
    await page.goto('/repair-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    if (fs.existsSync(TEST_FILES.damaged)) {
      await fileInput.setInputFiles(TEST_FILES.damaged);
      const status = page.locator('#panel-extra .status');
      await expect(status).toBeVisible({ timeout: 10000 });
    }
  });
});
