import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/compress-pdf', '/compress-pdf-to-100kb', '/guides/how-pdf-compression-works'];

test('axe finds no violations on key pages', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  for (const path of PAGES) {
    await page.goto(path);
    await page.locator('#command-open').waitFor();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${path}: ${results.violations.map((item) => item.id).join(', ')}`).toEqual([]);
  }
});
