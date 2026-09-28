import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

const THEMES = ['light', 'dark'] as const;
const PAGES = ['/', '/tools', '/compress-pdf'];

test.describe('no duplicate icons', () => {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`checks home, /tools, tool page and search dialog at ${vp.width}px in ${theme} mode`, async ({ page }) => {
        await page.setViewportSize(vp);

        for (const path of PAGES) {
          await page.goto(path, { waitUntil: 'networkidle' });
          await page.evaluate((th) => {
            document.documentElement.dataset.theme = th;
          }, theme);
          await page.waitForTimeout(200);

          // 1. Check all tool cards: must contain at most 1 tool icon (SVG)
          const cardViolations = await page.evaluate(() => {
            const bad = [];
            for (const card of document.querySelectorAll('.tool-card')) {
              const svgs = card.querySelectorAll('svg');
              if (svgs.length > 1) {
                bad.push({
                  name: card.querySelector('.tool-name')?.textContent?.trim() ?? 'unknown',
                  svgCount: svgs.length,
                });
              }
            }
            return bad;
          });
          expect(cardViolations, `Tool cards with duplicate icons on ${path}`).toEqual([]);

          // 2. Check sidebar links: must contain at most 1 icon
          const sidebarViolations = await page.evaluate(() => {
            const bad = [];
            for (const link of document.querySelectorAll('#sidebar .side-link')) {
              const svgs = link.querySelectorAll('svg');
              if (svgs.length > 1) {
                bad.push({
                  text: link.textContent?.trim() ?? 'unknown',
                  svgCount: svgs.length,
                });
              }
            }
            return bad;
          });
          expect(sidebarViolations, `Sidebar links with duplicate icons on ${path}`).toEqual([]);

          // 3. Check header wordmark: only 1 visible mark/symbol (lockup-full OR mark-only, never both visible)
          const wordmarkVisibleMarks = await page.evaluate(() => {
            const wm = document.querySelector('.wordmark');
            if (!wm) return 0;
            const full = wm.querySelector('.lockup-full');
            const mark = wm.querySelector('.mark-only');
            let visible = 0;
            if (full && getComputedStyle(full).display !== 'none') visible += 1;
            if (mark && getComputedStyle(mark).display !== 'none') visible += 1;
            return visible;
          });
          expect(wordmarkVisibleMarks, `Wordmark visible icons on ${path}`).toBeLessThanOrEqual(1);

          // 4. Check MegaMenu items if on desktop (or rendered)
          const menuViolations = await page.evaluate(() => {
            const bad = [];
            for (const item of document.querySelectorAll('#tools-mega-menu a')) {
              // Ignore the footer "View all tools ->" text link which may not have icon
              const svgs = item.querySelectorAll('svg');
              if (svgs.length > 1) {
                bad.push({
                  text: item.textContent?.trim() ?? 'unknown',
                  svgCount: svgs.length,
                });
              }
            }
            return bad;
          });
          expect(menuViolations, `MegaMenu items with duplicate icons on ${path}`).toEqual([]);
        }

        // 5. Check open search dialog (palette)
        await page.goto('/tools', { waitUntil: 'networkidle' });
        await page.evaluate((th) => {
          document.documentElement.dataset.theme = th;
        }, theme);
        await page.locator('#command-open').click();
        await expect(page.locator('#palette-input')).toBeVisible();
        await page.locator('#palette-input').fill('compress');
        await page.waitForTimeout(200);

        const paletteViolations = await page.evaluate(() => {
          const bad = [];
          for (const item of document.querySelectorAll('#palette-list a')) {
            const svgs = item.querySelectorAll('svg');
            if (svgs.length > 1) {
              bad.push({
                text: item.querySelector('.palette-copy span')?.textContent?.trim() ?? 'unknown',
                svgCount: svgs.length,
              });
            }
          }
          return bad;
        });
        expect(paletteViolations, `Search palette items with duplicate icons`).toEqual([]);
      });
    }
  }
});
