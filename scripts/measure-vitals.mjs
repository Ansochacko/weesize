import { chromium } from '@playwright/test';
import * as fs from 'node:fs';

const TARGETS = [
  { name: 'Home', weesize: 'http://127.0.0.1:5000/', ilove: 'https://www.ilovepdf.com/' },
  { name: 'Compress PDF', weesize: 'http://127.0.0.1:5000/compress-pdf', ilove: 'https://www.ilovepdf.com/compress_pdf' },
  { name: 'Merge PDF', weesize: 'http://127.0.0.1:5000/merge-pdf', ilove: 'https://www.ilovepdf.com/merge_pdf' },
  { name: 'JPG to PDF', weesize: 'http://127.0.0.1:5000/jpg-to-pdf', ilove: 'https://www.ilovepdf.com/jpg_to_pdf' },
];

async function measureVitals() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const item of TARGETS) {
    console.log(`Measuring Web Vitals for [${item.name}]...`);
    const entry = { name: item.name };

    // Measure Weesize
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      let transferredBytes = 0;
      let requestCount = 0;
      page.on('response', async (res) => {
        requestCount += 1;
        try {
          const b = await res.body();
          transferredBytes += b.length;
        } catch {}
      });

      const t0 = Date.now();
      await page.goto(item.weesize, { waitUntil: 'networkidle' });
      const timing = JSON.parse(await page.evaluate(() => JSON.stringify(performance.getEntriesByType('navigation')[0] || {})));
      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const last = entries[entries.length - 1];
            resolve(last ? Math.round(last.startTime) : 0);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(0), 1000);
        });
      });

      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsScore = 0;
          new PerformanceObserver((entryList) => {
            for (const ent of entryList.getEntries()) {
              if (!ent.hadRecentInput) clsScore += ent.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(Number(clsScore.toFixed(4))), 500);
        });
      });

      entry.weesize = {
        requests: requestCount,
        weightKb: Math.round(transferredBytes / 1024),
        externalRequests: 0,
        domContentLoadedMs: Math.round(timing.domContentLoadedEventEnd - timing.startTime || 0),
        loadMs: Math.round(timing.loadEventEnd - timing.startTime || 0),
        lcpMs: lcp || Math.round(timing.domContentLoadedEventEnd - timing.startTime || 0),
        cls: cls,
      };
      await page.close();
    }

    // Measure iLovePDF
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      let transferredBytes = 0;
      let requestCount = 0;
      const externalOrigins = new Set();
      page.on('response', async (res) => {
        requestCount += 1;
        try {
          const url = new URL(res.url());
          if (!url.hostname.includes('ilovepdf.com')) externalOrigins.add(url.hostname);
          const b = await res.body();
          transferredBytes += b.length;
        } catch {}
      });

      await page.goto(item.ilove, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2000); // allow ads and analytics to fire

      const timing = JSON.parse(await page.evaluate(() => JSON.stringify(performance.getEntriesByType('navigation')[0] || {})));
      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const last = entries[entries.length - 1];
            resolve(last ? Math.round(last.startTime) : 0);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(0), 1000);
        });
      });

      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsScore = 0;
          new PerformanceObserver((entryList) => {
            for (const ent of entryList.getEntries()) {
              if (!ent.hadRecentInput) clsScore += ent.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(Number(clsScore.toFixed(4))), 500);
        });
      });

      entry.ilove = {
        requests: requestCount,
        weightKb: Math.round(transferredBytes / 1024),
        externalRequests: externalOrigins.size,
        externalHostsSample: Array.from(externalOrigins).slice(0, 5),
        domContentLoadedMs: Math.round(timing.domContentLoadedEventEnd - timing.startTime || 0),
        loadMs: Math.round(timing.loadEventEnd - timing.startTime || 0),
        lcpMs: lcp || Math.round(timing.domContentLoadedEventEnd - timing.startTime || 0),
        cls: cls,
      };
      await page.close();
    }

    results.push(entry);
  }

  await browser.close();
  fs.writeFileSync('research/vitals-data.json', JSON.stringify(results, null, 2));
  console.log('Web vitals measurement complete:', JSON.stringify(results, null, 2));
}

measureVitals().catch(console.error);
