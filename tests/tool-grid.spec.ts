import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

async function firstRowCount(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluateAll((nodes) => {
    const cards = nodes
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0);
    const first = cards[0];
    if (!first) return 0;
    return cards.filter((box) => Math.abs(box.top - first.top) <= 2).length;
  });
}

test('home popular grid shows four cards on the first row at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#popular .tool-card').first().waitFor();
  expect(await firstRowCount(page, '#popular .tool-card')).toBeGreaterThanOrEqual(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('tool cards follow the width of the grid', async ({ page }) => {
  const cases: Array<{ width: number; theme: 'light' | 'dark'; columns: number; collapse?: boolean }> = [
    { width: 1920, theme: 'light', columns: 4 },
    { width: 1440, theme: 'dark', columns: 4 },
    { width: 1280, theme: 'light', columns: 4 },
    { width: 1280, theme: 'dark', columns: 4, collapse: true },
    { width: 1024, theme: 'light', columns: 3 },
    { width: 768, theme: 'dark', columns: 3 },
    { width: 390, theme: 'light', columns: 2 },
    { width: 360, theme: 'dark', columns: 2 },
  ];
  await page.goto('/');
  await page.locator('#popular .tool-card').first().waitFor();
  await page.locator('#all-tools').evaluate((node) => {
    if (node instanceof HTMLDetailsElement) node.open = true;
  });
  for (const item of cases) {
    await page.setViewportSize({ width: item.width, height: 900 });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, item.theme);
    const collapse = page.getByRole('button', { name: /tool names/i }).first();
    const hasCollapse = (await collapse.count()) > 0 && (await collapse.isVisible());
    const collapsed = hasCollapse ? (await collapse.getAttribute('aria-label')) === 'Show tool names' : false;
    if (Boolean(item.collapse) !== collapsed && hasCollapse) await collapse.click();
    const label = `${item.width}-${item.theme}${item.collapse ? '-collapsed' : ''}`;
    expect(await firstRowCount(page, '#popular .tool-card'), label).toBe(item.columns);
    const catalog = await firstRowCount(page, '#catalog .tool-section .tool-card');
    expect(catalog, `${label} catalog`).toBe(item.columns);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, label).toBeLessThanOrEqual(1);
    await page.locator('#popular').screenshot({ path: join(tmpdir(), `weesize-grid-${label}.png`) });
  }
});
