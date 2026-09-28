import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync('public/brand', { recursive: true });
mkdirSync('public/og', { recursive: true });

const markSvg = readFileSync('public/brand/lockup-horizontal.svg', 'utf8');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1200px;
      height: 630px;
      background: #F6F7F9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 72px 80px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo-svg {
      height: 48px;
    }
    .logo-svg svg {
      height: 48px;
      width: auto;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .headline {
      font-size: 58px;
      font-weight: 700;
      line-height: 1.15;
      color: #111827;
      letter-spacing: -0.025em;
      margin: 0;
    }
    .subline {
      font-size: 26px;
      color: #4B5563;
      margin: 0;
      line-height: 1.4;
      max-width: 950px;
    }
    .footer {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #FFFFFF;
      color: #111827;
      font-weight: 600;
      font-size: 19px;
      padding: 10px 20px;
      border-radius: 9999px;
      border: 1px solid #E5E7EB;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .badge.green {
      background: #ECFDF5;
      color: #065F46;
      border-color: #A7F3D0;
    }
    .badge.blue {
      background: #EFF6FF;
      color: #1E40AF;
      border-color: #BFDBFE;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-svg">${markSvg}</div>
  </div>
  <div class="main">
    <h1 class="headline">Free, In-Browser PDF Tools.<br>Zero File Uploads.</h1>
    <p class="subline">Compress, merge, split, and convert PDFs and images locally with WebAssembly. Your files never leave your browser.</p>
  </div>
  <div class="footer">
    <div class="badge green">🛡️ 100% Private (No Uploads)</div>
    <div class="badge blue">⚡ WebAssembly Engine</div>
    <div class="badge">🚀 Free & Open Source</div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: 'public/brand/og-image.png', type: 'png' });
await page.screenshot({ path: 'public/og/home.png', type: 'png' });
await browser.close();

console.log('Generated public/brand/og-image.png and public/og/home.png');
