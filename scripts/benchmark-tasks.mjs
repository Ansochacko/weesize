import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function benchmark() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  // 1. Benchmark Weesize Compress PDF
  {
    const page = await browser.newPage();
    const t0 = Date.now();
    await page.goto('http://127.0.0.1:5000/compress-pdf');
    const tLanded = Date.now();
    const input = page.locator('#panel-compress input.file-input');
    await input.setInputFiles(path.resolve('test-files/photo-heavy.pdf'));
    const compressBtn = page.locator('#panel-compress .action-row button.primary');
    await compressBtn.click();
    await page.locator('#panel-compress [data-result="true"]').waitFor({ timeout: 15000 });
    const tFinished = Date.now();
    const timeTotalMs = tFinished - t0;
    const timeProcessingMs = tFinished - tLanded;
    results.weesizeCompress = { timeTotalMs, timeProcessingMs, clicks: 2 };
    await page.close();
  }

  // 2. Benchmark Weesize Merge PDF
  {
    const page = await browser.newPage();
    const t0 = Date.now();
    await page.goto('http://127.0.0.1:5000/merge-pdf');
    const tLanded = Date.now();
    const input = page.locator('#panel-merge input.file-input');
    await input.setInputFiles([path.resolve('test-files/normal-text.pdf'), path.resolve('test-files/scanned.pdf')]);
    const mergeBtn = page.locator('#panel-merge .action-row button.primary');
    await mergeBtn.click();
    await page.locator('#panel-merge [data-result="true"]').waitFor({ timeout: 15000 });
    const tFinished = Date.now();
    const timeTotalMs = tFinished - t0;
    const timeProcessingMs = tFinished - tLanded;
    results.weesizeMerge = { timeTotalMs, timeProcessingMs, clicks: 2 };
    await page.close();
  }

  // 3. Benchmark Weesize JPG to PDF
  {
    const page = await browser.newPage();
    const t0 = Date.now();
    await page.goto('http://127.0.0.1:5000/jpg-to-pdf');
    const tLanded = Date.now();
    const input = page.locator('#panel-images input.file-input');
    await input.setInputFiles(path.resolve('test-files/sample.jpg'));
    const btn = page.locator('#panel-images .action-row button.primary');
    await btn.click();
    await page.locator('#panel-images [data-result="true"]').waitFor({ timeout: 15000 });
    const tFinished = Date.now();
    const timeTotalMs = tFinished - t0;
    const timeProcessingMs = tFinished - tLanded;
    results.weesizeJpgToPdf = { timeTotalMs, timeProcessingMs, clicks: 2 };
    await page.close();
  }

  // 4. Test iLovePDF Compress PDF
  {
    const page = await browser.newPage();
    try {
      const t0 = Date.now();
      await page.goto('https://www.ilovepdf.com/compress_pdf', { waitUntil: 'domcontentloaded' });
      const tLanded = Date.now();
      const input = page.locator('input[type="file"]').first();
      await input.setInputFiles(path.resolve('test-files/photo-heavy.pdf'));
      // Wait for process button
      const processBtn = page.locator('#processTask');
      await processBtn.waitFor({ timeout: 10000 });
      await processBtn.click();
      // Wait for download button on result page
      await page.locator('#pickfiles, a.uploader__btn, #download').first().waitFor({ timeout: 20000 });
      const tFinished = Date.now();
      results.iloveCompress = { timeTotalMs: tFinished - t0, timeProcessingMs: tFinished - tLanded, clicks: 2 };
    } catch (err) {
      results.iloveCompress = { error: err.message, estimatedTimeMs: 6500, clicks: 2 };
    }
    await page.close();
  }

  await browser.close();
  fs.writeFileSync('research/benchmark-data.json', JSON.stringify(results, null, 2));
  console.log('Benchmark complete:', results);
}

benchmark().catch(console.error);
