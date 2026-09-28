import { expect, test, type Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';

const TEST_FILES = {
  normalText: path.resolve('test-files/normal-text.pdf'),
  scanned: path.resolve('test-files/scanned.pdf'),
  photoHeavy: path.resolve('test-files/photo-heavy.pdf'),
  formsLinks: path.resolve('test-files/forms-links-bookmarks.pdf'),
  protected: path.resolve('test-files/protected.pdf'),
  damaged: path.resolve('test-files/damaged.pdf'),
  large200p: path.resolve('test-files/large-200p.pdf'),
  sampleJpg: path.resolve('test-files/sample.jpg'),
  transparentPng: path.resolve('test-files/transparent.png'),
  sampleWebp: path.resolve('test-files/sample.webp'),
  sampleAvif: path.resolve('test-files/sample.avif'),
  sampleHeic: path.resolve('test-files/sample.heic'),
  sampleDocx: path.resolve('test-files/sample.docx'),
  sampleXlsx: path.resolve('test-files/sample.xlsx'),
  samplePptx: path.resolve('test-files/sample.pptx'),
  sampleHtml: path.resolve('test-files/sample.html'),
  emptyFile: path.resolve('test-files/empty.pdf'),
};

// Create empty file if not exists
if (!fs.existsSync(TEST_FILES.emptyFile)) {
  fs.writeFileSync(TEST_FILES.emptyFile, Buffer.alloc(0));
}

test.describe('Tools E2E and Privacy Verification', () => {
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

  test('1. Limited boundary tools show clear boundary explanation', async ({ page }) => {
    const limitedTools = [
      { slug: 'excel-to-pdf', name: 'Excel to PDF' },
      { slug: 'powerpoint-to-pdf', name: 'PowerPoint to PDF' },
      { slug: 'pdf-to-excel', name: 'PDF to Excel' },
      { slug: 'pdf-to-powerpoint', name: 'PDF to PowerPoint' },
      { slug: 'pdf-to-pdfa', name: 'PDF to PDF/A' },
      { slug: 'edit-pdf', name: 'Edit PDF' },
      { slug: 'sign-pdf', name: 'Sign & fill' },
      { slug: 'pdf-forms', name: 'PDF forms' },
      { slug: 'protect-pdf', name: 'Protect PDF' },
      { slug: 'unlock-pdf', name: 'Unlock PDF' },
      { slug: 'redact-pdf', name: 'Redact PDF' },
      { slug: 'ocr-pdf', name: 'Make searchable' },
    ];

    for (const tool of limitedTools) {
      await page.goto(`/${tool.slug}`, { waitUntil: 'domcontentloaded' });
      const heading = page.locator('#panel-extra h2');
      await expect(heading).toHaveText(tool.name);
      const status = page.locator('#panel-extra .status[data-tone="bad"]');
      await expect(status).toBeVisible();
      const text = await status.textContent();
      expect(text?.length).toBeGreaterThan(10);
    }
  });

  test('2. AI tools display browser support note gracefully', async ({ page }) => {
    for (const slug of ['summarize-pdf', 'translate-pdf']) {
      await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
      const status = page.locator('#panel-extra .status');
      await expect(status).toBeVisible();
      const text = await status.textContent();
      expect(text).toContain('on-device');
      const toolId = slug === 'summarize-pdf' ? 'summarize' : 'translate';
      const isSupported = await page.evaluate((id) => (id === 'summarize' ? 'Summarizer' in globalThis : 'Translator' in globalThis && 'LanguageDetector' in globalThis), toolId);
      const button = page.locator('#panel-extra button.primary');
      if (isSupported) {
        await expect(button).toBeEnabled();
      } else {
        await expect(button).toBeDisabled();
      }
    }
  });

  test('3. Optimization: Compress PDF with photo-heavy PDF', async ({ page }) => {
    await page.goto('/compress-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-compress input.file-input');
    await fileInput.setInputFiles(TEST_FILES.photoHeavy);

    // Verify item added
    await expect(page.locator('#panel-compress .file-list li')).toBeVisible();

    // Click Compress PDF
    const actionBtn = page.locator('#panel-compress .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    // Wait for result
    const result = page.locator('#panel-compress [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });
    await expect(result.locator('.result-title')).toHaveText('Your file is ready');

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('4. Optimization: Compress images (JPG & PNG)', async ({ page }) => {
    await page.goto('/compress-image', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles([TEST_FILES.sampleJpg]);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      actionBtn.click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(100);
      // Valid JPEG starts with 0xFF 0xD8
      expect(buffer[0]).toBe(0xff);
      expect(buffer[1]).toBe(0xd8);
    }
  });

  test('5. Optimization: Repair PDF', async ({ page }) => {
    await page.goto('/repair-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('6. Optimization: ID photo crop & print sheet', async ({ page }) => {
    await page.goto('/id-photo', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.sampleJpg);

    const sheetBtn = page.locator('#panel-extra button[data-action="print-sheet"]');
    await expect(sheetBtn).toBeEnabled({ timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      sheetBtn.click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      // Valid PNG starts with 0x89 0x50 0x4E 0x47
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    }
  });

  test('7. Optimization: Lite mode page loads cleanly', async ({ page }) => {
    await page.goto('/lite', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#panel-extra h2')).toHaveText('Lite mode');
  });

  test('8. Organization: Merge PDF', async ({ page }) => {
    await page.goto('/merge-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-merge input.file-input');
    await fileInput.setInputFiles([TEST_FILES.normalText, TEST_FILES.scanned]);

    const actionBtn = page.locator('#panel-merge .action-row button.primary');
    await expect(actionBtn).toBeEnabled({ timeout: 5000 });
    await actionBtn.click();

    const result = page.locator('#panel-merge [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('9. Organization: Split PDF', async ({ page }) => {
    await page.goto('/split-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-split input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const rangeInput = page.locator('#split-range');
    await expect(rangeInput).toBeVisible();
    await rangeInput.fill('1-2');

    const actionBtn = page.locator('#panel-split .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-split [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
    }
  });

  test('10. Organization: Organize pages', async ({ page }) => {
    await page.goto('/organize-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-organize input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    // Wait for thumbnail items
    await expect(page.locator('#panel-organize .page-card').first()).toBeVisible({ timeout: 10000 });

    const actionBtn = page.locator('#panel-organize .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-organize [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('11. Organization: Rotate PDF', async ({ page }) => {
    await page.goto('/rotate-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('12. Organization: Crop PDF', async ({ page }) => {
    await page.goto('/crop-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('13. To PDF: Images to PDF', async ({ page }) => {
    await page.goto('/jpg-to-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-images input.file-input');
    await fileInput.setInputFiles([TEST_FILES.sampleJpg]);

    const actionBtn = page.locator('#panel-images .action-row button.primary');
    await expect(actionBtn).toBeEnabled({ timeout: 5000 });
    await actionBtn.click();

    const result = page.locator('#panel-images [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('14. To PDF: Word to PDF', async ({ page }) => {
    await page.goto('/word-to-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.sampleDocx);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('15. To PDF: HTML to PDF', async ({ page }) => {
    await page.goto('/html-to-pdf', { waitUntil: 'domcontentloaded' });
    const area = page.locator('#html-source');
    await area.fill('<h1>Test Report</h1><p>Client side rendering verified.</p>');

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await actionBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('16. From PDF: PDF to images', async ({ page }) => {
    await page.goto('/pdf-to-jpg', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      actionBtn.click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(100);
    }
  });

  test('17. From PDF: PDF to Word', async ({ page }) => {
    await page.goto('/pdf-to-word', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      actionBtn.click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(200);
      // Valid docx (zip) starts with PK
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    }
  });

  test('18. From PDF: PDF to Markdown', async ({ page }) => {
    await page.goto('/pdf-to-markdown', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      actionBtn.click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const text = fs.readFileSync(downloadedPath, 'utf8');
      expect(text).toContain('## Page 1');
      expect(text).toContain('normal text PDF');
    }
  });

  test('19. Edit: Watermark PDF', async ({ page }) => {
    await page.goto('/watermark-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const markInput = page.locator('#mark-text');
    await markInput.fill('CONFIDENTIAL');

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('20. Edit: Page numbers', async ({ page }) => {
    await page.goto('/add-page-numbers-to-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('21. Edit: Make accessible report', async ({ page }) => {
    await page.goto('/make-pdf-accessible', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    // Verify accessibility findings render
    await expect(page.locator('#panel-extra p:has-text("Pass:"), #panel-extra p:has-text("Fix available:"), #panel-extra p:has-text("Needs a human:")').first()).toBeVisible({ timeout: 10000 });
  });

  test('22. Security: Safe to share check', async ({ page }) => {
    await page.goto('/check-pdf-before-sending', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    // Verify findings or safe status render
    await expect(page.locator('#panel-extra p.status')).toBeVisible({ timeout: 10000 });
  });

  test('23. Security: Signature check', async ({ page }) => {
    await page.goto('/is-this-pdf-signed', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    // Verify signals render
    await expect(page.locator('#panel-extra p:has-text("Digital signature:"), #panel-extra p:has-text("Incremental revisions:"), #panel-extra p:has-text("Signature")').first()).toBeVisible({ timeout: 10000 });
  });

  test('24. Smart: Compare PDFs', async ({ page }) => {
    await page.goto('/compare-pdf', { waitUntil: 'domcontentloaded' });
    const inputs = page.locator('#panel-extra input.file-input');
    await inputs.nth(0).setInputFiles(TEST_FILES.normalText);
    await inputs.nth(1).setInputFiles(TEST_FILES.scanned);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await actionBtn.click();

    // Verify comparison status appears
    const status = page.locator('#panel-extra .status');
    await expect(status).toBeVisible({ timeout: 10000 });
    const text = await status.textContent();
    expect(text).toMatch(/changed pages|No word changes/);
  });

  test('25. Smart: Presets (Get it accepted)', async ({ page }) => {
    await page.goto('/get-it-accepted', { waitUntil: 'domcontentloaded' });
    const query = page.locator('#panel-extra input[type="search"]');
    await query.fill('passport');
    // Verify preset list renders
    await expect(page.locator('#panel-extra .suggest')).toBeVisible();
  });

  test('26. Smart: Chat with PDF', async ({ page }) => {
    await page.goto('/chat-with-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const summarizeBtn = page.locator('#panel-extra button:has-text("Summarize")');
    await expect(summarizeBtn).toBeVisible({ timeout: 10000 });
    await summarizeBtn.click();

    // Verify answer paragraph appears
    await expect(page.locator('#panel-extra p:has-text("Page")').first()).toBeVisible({ timeout: 10000 });
  });

  test('27. Workflows: PDF workflows packet recipe', async ({ page }) => {
    await page.goto('/pdf-workflows', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const runBtn = page.locator('#panel-extra button.primary:has-text("Run workflow")');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      result.locator('button[data-action="download-result"]').click(),
    ]);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    if (downloadedPath) {
      const buffer = fs.readFileSync(downloadedPath);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    }
  });

  test('28. Workflows: Commands parser and execution', async ({ page }) => {
    await page.goto('/pdf-commands', { waitUntil: 'domcontentloaded' });
    const textarea = page.locator('#panel-extra textarea');
    await textarea.fill('rotate 90');

    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.normalText);

    const runBtn = page.locator('#panel-extra button[data-action="run-command"]');
    await expect(runBtn).toBeEnabled({ timeout: 5000 });
    await runBtn.click();

    const result = page.locator('#panel-extra [data-result="true"]');
    await expect(result).toBeVisible({ timeout: 15000 });
  });

  test('29. Error Handling: Graceful handling of empty file', async ({ page }) => {
    await page.goto('/repair-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.emptyFile);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const status = page.locator('#panel-extra .status[data-tone="bad"]');
    await expect(status).toBeVisible({ timeout: 10000 });
    const text = await status.textContent();
    expect(text).toMatch(/This PDF has no pages|This file could not be read as a PDF/);
  });

  test('30. Error Handling: Graceful handling of damaged PDF', async ({ page }) => {
    await page.goto('/watermark-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.damaged);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const status = page.locator('#panel-extra .status[data-tone="bad"]');
    await expect(status).toBeVisible({ timeout: 10000 });
    const text = await status.textContent();
    expect(text).toContain('This file could not be read as a PDF.');
  });

  test('31. Error Handling: Graceful handling of password-protected PDF', async ({ page }) => {
    await page.goto('/watermark-pdf', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#panel-extra input.file-input');
    await fileInput.setInputFiles(TEST_FILES.protected);

    const actionBtn = page.locator('#panel-extra .action-row button.primary');
    await expect(actionBtn).toBeEnabled();
    await actionBtn.click();

    const status = page.locator('#panel-extra .status[data-tone="bad"]');
    await expect(status).toBeVisible({ timeout: 10000 });
    const text = await status.textContent();
    expect(text).toContain('This PDF is locked with a password.');
  });
});
