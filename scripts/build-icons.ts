import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolIcons, uiIcons } from '../src/lib/icons.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = join(root, 'public', 'icons');

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.subarray(y * width * 4, (y + 1) * width * 4).forEach((value, index) => {
      raw[row + 1 + index] = value;
    });
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

interface Point {
  x: number;
  y: number;
}

function flattenArc(from: Point, rx: number, ry: number, large: number, sweep: number, to: Point, out: Point[]): void {
  const phi = 0;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let rx2 = Math.abs(rx);
  let ry2 = Math.abs(ry);
  const lam = (x1 * x1) / (rx2 * rx2) + (y1 * y1) / (ry2 * ry2);
  if (lam > 1) {
    const scale = Math.sqrt(lam);
    rx2 *= scale;
    ry2 *= scale;
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx2 * rx2 * ry2 * ry2 - rx2 * rx2 * y1 * y1 - ry2 * ry2 * x1 * x1;
  const den = rx2 * rx2 * y1 * y1 + ry2 * ry2 * x1 * x1;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = coef * ((rx2 * y1) / ry2);
  const cyp = coef * -((ry2 * x1) / rx2);
  const cx = cos * cxp - sin * cyp + (from.x + to.x) / 2;
  const cy = sin * cxp + cos * cyp + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };
  const start = angle(1, 0, (x1 - cxp) / rx2, (y1 - cyp) / ry2);
  let delta = angle((x1 - cxp) / rx2, (y1 - cyp) / ry2, (-x1 - cxp) / rx2, (-y1 - cyp) / ry2);
  if (sweep === 0 && delta > 0) delta -= Math.PI * 2;
  if (sweep === 1 && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(4, Math.ceil(Math.abs(delta) / (Math.PI / 8)));
  for (let step = 1; step <= steps; step += 1) {
    const t = start + (delta * step) / steps;
    out.push({ x: cx + rx2 * Math.cos(t), y: cy + ry2 * Math.sin(t) });
  }
}

function flatten(d: string): Point[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const points: Point[] = [];
  let index = 0;
  let command = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const read = () => Number(tokens[index++]);
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) break;
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      index += 1;
    }
    if (command === 'M' || command === 'L') {
      cx = read();
      cy = read();
      if (command === 'M') {
        sx = cx;
        sy = cy;
      }
      points.push({ x: cx, y: cy });
      if (command === 'M') command = 'L';
    } else if (command === 'H' || command === 'h') {
      cx = command === 'h' ? cx + read() : read();
      points.push({ x: cx, y: cy });
    } else if (command === 'V' || command === 'v') {
      cy = command === 'v' ? cy + read() : read();
      points.push({ x: cx, y: cy });
    } else if (command === 'a') {
      const rx = read();
      const ry = read();
      read();
      const large = read();
      const sweep = read();
      const dx = read();
      const dy = read();
      const from = { x: cx, y: cy };
      cx += dx;
      cy += dy;
      flattenArc(from, rx, ry, large, sweep, { x: cx, y: cy }, points);
    } else if (command === 'z' || command === 'Z') {
      cx = sx;
      cy = sy;
      points.push({ x: cx, y: cy });
    } else {
      throw new Error(`Unsupported path command ${command}`);
    }
  }
  return points;
}

const PAGE = [
  'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z',
  'M14 3v3a2 2 0 0 0 2 2h3',
];

function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function rounded(px: number, py: number, size: number, radius: number): boolean {
  const qx = Math.abs(px - size / 2) - (size / 2 - radius);
  const qy = Math.abs(py - size / 2) - (size / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= 0;
}

function drawAppIcon(size: number, maskable: boolean): Buffer {
  const rgba = new Uint8Array(size * size * 4);
  const scale = maskable ? (size * 0.62) / 24 : size / 24;
  const origin = (size - 24 * scale) / 2;
  const radius = (2 * scale) / 2;
  const strokes = PAGE.map((d) =>
    flatten(d).map((point) => ({ x: origin + point.x * scale, y: origin + point.y * scale })),
  );
  const corner = size * 0.22;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (!rounded(px, py, size, corner)) continue;
      let cover = 0;
      for (const line of strokes) {
        for (let index = 1; index < line.length; index += 1) {
          const a = line[index - 1];
          const b = line[index];
          if (!a || !b) continue;
          const distance = distToSegment(px, py, a, b);
          cover = Math.max(cover, Math.min(1, radius + 0.65 - distance));
        }
      }
      const offset = (y * size + x) * 4;
      const blue = 1 - cover;
      rgba[offset] = Math.round(255 * cover + 35 * blue);
      rgba[offset + 1] = Math.round(255 * cover + 64 * blue);
      rgba[offset + 2] = Math.round(255 * cover + 201 * blue);
      rgba[offset + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112.64" fill="#2340C9"/><g transform="scale(21.333333)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v3a2 2 0 0 0 2 2h3"/></g></svg>`;
}

mkdirSync(iconDir, { recursive: true });
for (const [id, tool] of Object.entries(toolIcons)) writeFileSync(join(iconDir, `${id}.svg`), tool.svg);
for (const [id, svg] of Object.entries(uiIcons)) writeFileSync(join(iconDir, `${id}.svg`), svg);
writeFileSync(join(root, 'public', 'favicon.svg'), faviconSvg());
writeFileSync(join(iconDir, 'icon-192.png'), drawAppIcon(192, false));
writeFileSync(join(iconDir, 'icon-512.png'), drawAppIcon(512, false));
writeFileSync(join(iconDir, 'icon-maskable-512.png'), drawAppIcon(512, true));
console.log(`Wrote ${Object.keys(toolIcons).length + Object.keys(uiIcons).length} icons and the app marks.`);
