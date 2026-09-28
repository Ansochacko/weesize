import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { brand, brandName } from '../src/brand.ts';
import { faviconSvg, markColor, markFlat, markMono, markReversed } from '../src/seo/marks.ts';
import { blit, encodePng, fillColor, packIco, pathSegs, renderMark, type MarkKind } from './raster-mark.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [join(root, 'src', 'assets', 'brand'), join(root, 'public', 'brand')];
for (const dir of dirs) mkdirSync(dir, { recursive: true });

function writeBoth(name: string, svg: string): void {
  for (const dir of dirs) writeFileSync(join(dir, name), svg);
}

function inner(svg: string): string {
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

writeBoth('mark-color.svg', markColor('file'));
writeBoth('mark-flat.svg', markFlat());
writeBoth('mark-mono.svg', markMono('file'));
writeBoth('mark-reversed.svg', markReversed('file'));
writeBoth('favicon.svg', faviconSvg());
writeFileSync(join(root, 'public', 'favicon.svg'), faviconSvg());

const fontPath = join(root, 'node_modules', '@fontsource', 'ibm-plex-sans', 'files', 'ibm-plex-sans-latin-600-normal.woff');
const font = opentype.parse(readFileSync(fontPath).buffer);

function pathData(glyphPath: { commands: Array<Record<string, number | string>> }): string {
  const n = (value: number | string | undefined) => String(Math.round(Number(value) * 100) / 100);
  let d = '';
  for (const cmd of glyphPath.commands) {
    if (cmd.type === 'M' || cmd.type === 'L') d += `${cmd.type}${n(cmd.x)} ${n(cmd.y)}`;
    else if (cmd.type === 'Q') d += `Q${n(cmd.x1)} ${n(cmd.y1)} ${n(cmd.x)} ${n(cmd.y)}`;
    else if (cmd.type === 'C') d += `C${n(cmd.x1)} ${n(cmd.y1)} ${n(cmd.x2)} ${n(cmd.y2)} ${n(cmd.x)} ${n(cmd.y)}`;
    else if (cmd.type === 'Z') d += 'Z';
  }
  return d;
}

function glyphRun(text: string, size: number): { d: string; width: number } {
  const tracking = -0.02 * size;
  let x = 0;
  const parts: string[] = [];
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    parts.push(pathData(glyph.getPath(x, 0, size)));
    x += (glyph.advanceWidth ?? 0) * (size / font.unitsPerEm) + tracking;
  }
  if (text.length > 0) x -= tracking;
  return { d: parts.join(''), width: x };
}

const mark = 64;
const capUnits = font.tables.os2?.sCapHeight || font.charToGlyph('H').yMax || 700;
const fontSize = mark / 1.5 / (capUnits / font.unitsPerEm);
const capPx = fontSize * (capUnits / font.unitsPerEm);
const tracking = -0.02 * fontSize;
const wee = glyphRun('wee', fontSize);
const sizeWord = glyphRun('size', fontSize);
const advance = wee.width + tracking + sizeWord.width;
const gap = mark * 0.35;
const baseline = (mark + capPx) / 2;
const word = `<path class="wee" d="${wee.d}"/><path class="size" d="${sizeWord.d}" transform="translate(${(wee.width + tracking).toFixed(2)} 0)"/>`;

function lockup(markSvg: string, id: string): string {
  const width = mark + gap + advance;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${mark}" role="img" aria-label="${brandName()}">
  <g class="lockup-symbol">${inner(markSvg)}</g>
  <g class="lockup-word" transform="translate(${(mark + gap).toFixed(2)} ${baseline.toFixed(2)})" fill="currentColor">${word}</g>
</svg>`.replaceAll('wg-file', `wg-${id}`).replaceAll('wm-file', `wm-${id}`);
}

const horizontal = lockup(markColor('lockup-h'), 'lockup-h');
const horizontalFlat = lockup(markFlat(), 'lockup-flat');
const stackedWidth = Math.max(mark, advance);
const stackedHeight = mark + gap + capPx;
const stacked = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stackedWidth.toFixed(2)} ${stackedHeight.toFixed(2)}" role="img" aria-label="${brandName()}">
  <g transform="translate(${((stackedWidth - mark) / 2).toFixed(2)} 0)">${inner(markColor('lockup-s'))}</g>
  <g transform="translate(${((stackedWidth - advance) / 2).toFixed(2)} ${(mark + gap + capPx).toFixed(2)})" fill="currentColor">${word}</g>
</svg>`;
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${advance.toFixed(2)} ${capPx.toFixed(2)}" role="img" aria-label="${brandName()}">
  <g transform="translate(0 ${capPx.toFixed(2)})" fill="currentColor">${word}</g>
</svg>`;
writeBoth('lockup-horizontal.svg', horizontal);
writeBoth('lockup-stacked.svg', stacked);
writeBoth('wordmark.svg', wordmark);

const wordmarkHtml = `<span class="lockup-full">${horizontalFlat}</span><span class="mark-only">${markFlat()}</span>`;
writeFileSync(join(root, 'src', 'assets', 'brand', 'lockup.ts'), `export const lockupHorizontal = ${JSON.stringify(wordmarkHtml)};\n`);

function pngFile(name: string, rgba: Uint8Array, width: number, height: number): void {
  writeFileSync(name, encodePng(width, height, rgba));
}

const iconDir = join(root, 'public', 'icons');
mkdirSync(iconDir, { recursive: true });
pngFile(join(iconDir, 'icon-192.png'), renderMark(192, 'color'), 192, 192);
pngFile(join(iconDir, 'icon-512.png'), renderMark(512, 'color'), 512, 512);
pngFile(join(iconDir, 'icon-maskable-512.png'), renderMark(512, 'maskable'), 512, 512);
pngFile(join(iconDir, 'apple-touch-icon.png'), renderMark(180, 'color'), 180, 180);
pngFile(join(root, 'public', 'brand', 'mark-256.png'), renderMark(256, 'color'), 256, 256);

const avatar = new Uint8Array(400 * 400 * 4);
fillColor(avatar, 400, 400, [0xf5, 0xf6, 0xf8, 255]);
blit(avatar, 400, renderMark(256, 'color'), 256, 256, 72, 72);
pngFile(join(root, 'public', 'brand', 'avatar-400.png'), avatar, 400, 400);

const bannerW = 1500;
const bannerH = 500;
const banner = new Uint8Array(bannerW * bannerH * 4);
fillColor(banner, bannerW, bannerH, [0xf5, 0xf6, 0xf8, 255]);
const bannerMark = 120;
blit(banner, bannerW, renderMark(bannerMark, 'color'), bannerMark, bannerMark, 72, Math.round((bannerH - bannerMark) / 2));
const taglineSize = 36;
const tagline = glyphRun(brand.tagline, taglineSize);
const taglineSegs = pathSegs(tagline.d);
stamp(banner, bannerW, bannerH, taglineSegs, 72 + bannerMark + 48, Math.round(bannerH / 2 + taglineSize * 0.35), [0x14, 0x18, 0x1f, 255]);
pngFile(join(root, 'public', 'brand', 'banner-1500x500.png'), banner, bannerW, bannerH);

function stamp(dst: Uint8Array, width: number, height: number, segs: ReturnType<typeof pathSegs>, originX: number, originY: number, color: [number, number, number, number]): void {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const seg of segs) {
    minX = Math.min(minX, seg.x1, seg.x2);
    minY = Math.min(minY, seg.y1, seg.y2);
    maxX = Math.max(maxX, seg.x1, seg.x2);
    maxY = Math.max(maxY, seg.y1, seg.y2);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x += 1) {
      let hits = 0;
      const samples = 2;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          let hit = false;
          for (const seg of segs) {
            if (seg.y1 > py !== seg.y2 > py && px < ((seg.x2 - seg.x1) * (py - seg.y1)) / (seg.y2 - seg.y1) + seg.x1) hit = !hit;
          }
          if (hit) hits += 1;
        }
      }
      if (!hits) continue;
      const dx = Math.round(originX + x);
      const dy = Math.round(originY + y);
      if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;
      const i = (dy * width + dx) * 4;
      const alpha = hits / (samples * samples);
      dst[i] = Math.round((color[0] ?? 0) * alpha + (dst[i] ?? 0) * (1 - alpha));
      dst[i + 1] = Math.round((color[1] ?? 0) * alpha + (dst[i + 1] ?? 0) * (1 - alpha));
      dst[i + 2] = Math.round((color[2] ?? 0) * alpha + (dst[i + 2] ?? 0) * (1 - alpha));
      dst[i + 3] = 255;
    }
  }
}

const icoSizes = [16, 32, 48] as const;
writeFileSync(
  join(root, 'public', 'favicon.ico'),
  packIco(icoSizes.map((size) => ({ size, png: encodePng(size, size, renderMark(size, 'favicon')) }))),
);

const sheetSizes = [16, 24, 32, 64, 128, 512] as const;
const cell = 528;
const labelW = 72;
const sheetW = 24 + labelW + 3 * cell;
const sheetH = 48 + sheetSizes.reduce((sum, size) => sum + size + 36, 0) + 320;
const sheet = new Uint8Array(sheetW * sheetH * 4);
fillColor(sheet, sheetW, sheetH, [255, 255, 255, 255]);
const backgrounds: Array<{ kind: MarkKind; fill: [number, number, number, number] }> = [
  { kind: 'color', fill: [0xf5, 0xf6, 0xf8, 255] },
  { kind: 'color', fill: [0x14, 0x18, 0x1f, 255] },
  { kind: 'reversed', fill: [0x23, 0x40, 0xc9, 255] },
];
let rowY = 24;
for (const size of sheetSizes) {
  const kindFor = (column: number): MarkKind => {
    if (column === 2) return 'reversed';
    if (size < 24) return column === 1 ? 'favicon-dark' : 'favicon';
    if (size <= 32) return 'flat';
    return 'color';
  };
  backgrounds.forEach((column, index) => {
    const x = 24 + labelW + index * cell;
    for (let y = 0; y < size + 16; y += 1) {
      for (let px = 0; px < cell - 16; px += 1) {
        const i = ((rowY + y) * sheetW + x + px) * 4;
        sheet[i] = column.fill[0];
        sheet[i + 1] = column.fill[1];
        sheet[i + 2] = column.fill[2];
        sheet[i + 3] = 255;
      }
    }
    blit(sheet, sheetW, renderMark(size, kindFor(index)), size, size, x + 8, rowY + 8);
  });
  rowY += size + 36;
}
const maskable = renderMark(256, 'maskable');
const maskX = 24 + labelW;
const maskY = rowY + 16;
blit(sheet, sheetW, maskable, 256, 256, maskX, maskY);
blit(sheet, sheetW, maskable, 256, 256, maskX + 280, maskY);
function mask(cx: number, cy: number, radius: number, squircle: boolean): void {
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const dx = x - 128;
      const dy = y - 128;
      const outside = squircle ? Math.pow(Math.abs(dx) / 128, 4) + Math.pow(Math.abs(dy) / 128, 4) > 1 : dx * dx + dy * dy > radius * radius;
      if (!outside) continue;
      const i = ((cy + y) * sheetW + cx + x) * 4;
      sheet[i] = 255;
      sheet[i + 1] = 255;
      sheet[i + 2] = 255;
      sheet[i + 3] = 255;
    }
  }
}
mask(maskX, maskY, 128, false);
mask(maskX + 280, maskY, 128, true);
mkdirSync(join(root, 'public', 'dev'), { recursive: true });
pngFile(join(root, 'public', 'dev', 'brand-check.png'), sheet, sheetW, sheetH);

const readmePath = join(root, 'README.md');
const readme = readFileSync(readmePath, 'utf8').replace(
  /The product name is defined in `src\/brand\.ts` \(currently [^)]+\)\./,
  `The product name is defined in \`src/brand.ts\` (currently ${brandName()}).`,
);
writeFileSync(readmePath, readme);
console.log(`Brand assets written for ${brandName()}`);
