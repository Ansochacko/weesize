import { expect, test, type Page } from '@playwright/test';

const WIDTHS = [360, 768, 1280, 1920];
const KEY_PAGES = ['/', '/tools', '/compress-pdf', '/compress-pdf-to-100kb', '/merge-pdf', '/guides/how-pdf-compression-works', '/pro'];

async function visibleCount(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.filter((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    }).length,
  );
}

test.describe('one search and one primary', () => {
  test('key pages stay uncluttered at every width', async ({ page, browserName }) => {
    const errors: string[] = [];
    const hosts = new Set<string>();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => hosts.add(new URL(request.url()).host));
    test.skip(browserName === 'firefox', 'Playwright Firefox crashes on a second full reload. A single Compress load in Firefox succeeds.');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of KEY_PAGES) {
        await page.goto(path);
        await page.locator('#command-open').waitFor();
        expect(await visibleCount(page, '[role="search"]'), `${path} @ ${width}`).toBeLessThanOrEqual(1);
        expect(await visibleCount(page, '.btn.primary'), `${path} @ ${width}`).toBeLessThanOrEqual(1);
        expect(await page.locator('#tools-search').count()).toBe(0);
        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          const extra = root.scrollWidth - root.clientWidth;
          let offender = '';
          let max = 0;
          if (extra > 1) {
            for (const node of document.body.querySelectorAll('*')) {
              const box = node.getBoundingClientRect();
              if (box.right > root.clientWidth + 1 && box.right > max) {
                max = box.right;
                const name = node instanceof Element ? `${node.tagName}.${node.className}` : '';
                offender = name.slice(0, 120);
              }
            }
          }
          return `${extra} ${offender}`;
        });
        expect(overflow, `${path} @ ${width}`).toMatch(/^0 |^1 /);
      }
    }
    expect([...hosts].every((host) => host.startsWith('127.0.0.1'))).toBe(true);
    const unexpected = errors.filter((message) => !(browserName === 'webkit' && message.includes('access control checks')));
    expect(unexpected).toEqual([]);
  });

  test('palette is the only search while it is open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/tools');
    await page.locator('#command-open').click();
    await expect(page.locator('#palette-input')).toBeVisible();
    expect(await visibleCount(page, '[role="search"]')).toBe(1);
    expect(await visibleCount(page, '#command-open')).toBe(0);
    await page.locator('#palette-input').fill('compress');
    await expect(page.locator('#view-tools .tool-card').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('mobile search is an icon, and the 100 KB tool is on screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    const box = await page.locator('#command-open').boundingBox();
    expect(box?.width ?? 99).toBeLessThanOrEqual(48);
    await page.goto('/compress-pdf-to-100kb');
    const action = page.locator('[data-action="compress-pdf"]');
    await expect(action).toBeVisible();
    const top = await action.evaluate((node) => node.getBoundingClientRect().top);
    expect(top).toBeLessThan(740);
    await expect(page.locator('.target-note')).toContainText('100 KB');
  });

  test('every sitemap page has one search and no sideways scroll', async ({ page, browserName }) => {
    test.setTimeout(120_000);
    test.skip(browserName !== 'chromium', 'Width matrix already covers the other engines on key pages.');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/sitemap-en.xml');
    const xml = await page.locator('body').innerText();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? 'http://127.0.0.1/').pathname);
    expect(paths.length).toBeGreaterThan(100);
    for (const path of paths) {
      await page.goto(path);
      await page.locator('#command-open').waitFor();
      expect(await visibleCount(page, '[role="search"]'), path).toBeLessThanOrEqual(1);
      expect(await visibleCount(page, '.btn.primary'), path).toBeLessThanOrEqual(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});
