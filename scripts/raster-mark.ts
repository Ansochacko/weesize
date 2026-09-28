import { deflateSync } from 'node:zlib';
import { MARK_PATHS } from '../src/seo/marks.ts';

export type MarkKind = 'color' | 'flat' | 'reversed' | 'favicon' | 'favicon-dark' | 'mono' | 'mono-light' | 'maskable';

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Point {
  x: number;
  y: number;
}

const BIG = pathSegs(MARK_PATHS.big);
const BIG_FOLD = pathSegs(MARK_PATHS.bigFold);
const SMALL = pathSegs(MARK_PATHS.small);
const SMALL_FOLD = pathSegs(MARK_PATHS.smallFold);
const FAVICON_PAGE = pathSegs(MARK_PATHS.faviconPage);
const OUTLINE = [...BIG, ...BIG_FOLD];

function flattenArc(from: Point, rx: number, ry: number, large: number, sweep: number, to: Point, out: Point[]): void {
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  let rx2 = Math.abs(rx);
  let ry2 = Math.abs(ry);
  const lam = (dx * dx) / (rx2 * rx2) + (dy * dy) / (ry2 * ry2);
  if (lam > 1) {
    const scale = Math.sqrt(lam);
    rx2 *= scale;
    ry2 *= scale;
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx2 * rx2 * ry2 * ry2 - rx2 * rx2 * dy * dy - ry2 * ry2 * dx * dx;
  const den = rx2 * rx2 * dy * dy + ry2 * ry2 * dx * dx;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * (rx2 * dy)) / ry2;
  const cyp = (coef * -(ry2 * dx)) / rx2;
  const cx = cxp + (from.x + to.x) / 2;
  const cy = cyp + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let ang = Math.acos(Math.max(-1, Math.min(1, dot / (len || 1))));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };
  const start = angle(1, 0, (dx - cxp) / rx2, (dy - cyp) / ry2);
  let delta = angle((dx - cxp) / rx2, (dy - cyp) / ry2, (-dx - cxp) / rx2, (-dy - cyp) / ry2);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const steps = 10;
  for (let step = 1; step <= steps; step += 1) {
    const t = start + (delta * step) / steps;
    out.push({ x: cx + rx2 * Math.cos(t), y: cy + ry2 * Math.sin(t) });
  }
}

function quadPoints(p0: Point, p1: Point, p2: Point): Point[] {
  const out: Point[] = [];
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

function cubicPoints(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
  const out: Point[] = [];
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

export function pathSegs(d: string): Seg[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const segs: Seg[] = [];
  let index = 0;
  let command = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const read = () => Number(tokens[index++]);
  const line = (x: number, y: number) => {
    segs.push({ x1: cx, y1: cy, x2: x, y2: y });
    cx = x;
    cy = y;
  };
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) break;
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      index += 1;
    }
    if (command === 'M' || command === 'm') {
      cx = command === 'm' ? cx + read() : read();
      cy = command === 'm' ? cy + read() : read();
      sx = cx;
      sy = cy;
      command = command === 'm' ? 'l' : 'L';
    } else if (command === 'L') line(read(), read());
    else if (command === 'l') line(cx + read(), cy + read());
    else if (command === 'H') line(read(), cy);
    else if (command === 'h') line(cx + read(), cy);
    else if (command === 'V') line(cx, read());
    else if (command === 'v') line(cx, cy + read());
    else if (command === 'A' || command === 'a') {
      const rx = read();
      const ry = read();
      read();
      const large = read();
      const sweep = read();
      const x = read();
      const y = read();
      const to = command === 'a' ? { x: cx + x, y: cy + y } : { x, y };
      const points: Point[] = [];
      flattenArc({ x: cx, y: cy }, rx, ry, large, sweep, to, points);
      for (const point of points) line(point.x, point.y);
    } else if (command === 'Q' || command === 'q') {
      const x1 = read();
      const y1 = read();
      const x = read();
      const y = read();
      const p0 = { x: cx, y: cy };
      const p1 = command === 'q' ? { x: cx + x1, y: cy + y1 } : { x: x1, y: y1 };
      const p2 = command === 'q' ? { x: cx + x, y: cy + y } : { x, y };
      for (const point of quadPoints(p0, p1, p2)) line(point.x, point.y);
    } else if (command === 'C' || command === 'c') {
      const x1 = read();
      const y1 = read();
      const x2 = read();
      const y2 = read();
      const x = read();
      const y = read();
      const p0 = { x: cx, y: cy };
      const p1 = command === 'c' ? { x: cx + x1, y: cy + y1 } : { x: x1, y: y1 };
      const p2 = command === 'c' ? { x: cx + x2, y: cy + y2 } : { x: x2, y: y2 };
      const p3 = command === 'c' ? { x: cx + x, y: cy + y } : { x, y };
      for (const point of cubicPoints(p0, p1, p2, p3)) line(point.x, point.y);
    } else if (command === 'Z' || command === 'z') line(sx, sy);
    else throw new Error(`Unsupported path command ${command}`);
  }
  return segs;
}

function inside(x: number, y: number, segs: Seg[]): boolean {
  let hit = false;
  for (const seg of segs) {
    if (seg.y1 > y !== seg.y2 > y && x < ((seg.x2 - seg.x1) * (y - seg.y1)) / (seg.y2 - seg.y1) + seg.x1) hit = !hit;
  }
  return hit;
}

function near(x: number, y: number, segs: Seg[], width: number): boolean {
  const limit = width / 2;
  for (const seg of segs) {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - seg.x1) * dx + (y - seg.y1) * dy) / len2));
    if (Math.hypot(x - (seg.x1 + t * dx), y - (seg.y1 + t * dy)) <= limit) return true;
  }
  return false;
}

function inRoundRect(x: number, y: number): boolean {
  const left = 4;
  const top = 4;
  const right = 60;
  const bottom = 60;
  const radius = 14;
  if (x < left || y < top || x > right || y > bottom) return false;
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return Math.hypot(x - cx, y - cy) <= radius + 0.01 || (x >= left + radius && x <= right - radius) || (y >= top + radius && y <= bottom - radius);
}

function mix(a: string, b: string, t: number): [number, number, number] {
  const parse = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const;
  const left = parse(a);
  const right = parse(b);
  return [
    Math.round((left[0] ?? 0) + ((right[0] ?? 0) - (left[0] ?? 0)) * t),
    Math.round((left[1] ?? 0) + ((right[1] ?? 0) - (left[1] ?? 0)) * t),
    Math.round((left[2] ?? 0) + ((right[2] ?? 0) - (left[2] ?? 0)) * t),
  ];
}

function hex(value: string): [number, number, number] {
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

type Rgba = [number, number, number, number];

function paintSample(x: number, y: number, kind: MarkKind): Rgba | null {
  const onSquare = inRoundRect(x, y);
  if (kind === 'favicon' || kind === 'favicon-dark') {
    if (!onSquare && !inside(x, y, FAVICON_PAGE)) return null;
    if (inside(x, y, FAVICON_PAGE)) return [255, 255, 255, 255];
    return kind === 'favicon-dark' ? [0x7f, 0x93, 0xff, 255] : [0x23, 0x40, 0xc9, 255];
  }
  if (kind === 'maskable') {
    let pixel: Rgba = [0x23, 0x40, 0xc9, 255];
    if (near(x, y, OUTLINE, 3)) pixel = blend(pixel, [255, 255, 255, 128]);
    if (inside(x, y, SMALL)) pixel = [255, 255, 255, 255];
    if (near(x, y, SMALL_FOLD, 1.6) && inside(x, y, SMALL)) pixel = [...hex('#2A44D0'), 255];
    return pixel;
  }
  if (!onSquare && !inside(x, y, SMALL) && !near(x, y, OUTLINE, 3)) return null;
  const base: Rgba = kind === 'reversed' ? [255, 255, 255, 255] : kind === 'mono' ? [0xe6, 0xe9, 0xef, 255] : kind === 'mono-light' ? [0x14, 0x18, 0x1f, 255] : kind === 'flat' ? [0x23, 0x40, 0xc9, 255] : [...mix('#3A58EC', '#1A2FA6', Math.max(0, Math.min(1, (x - 4 + (y - 4)) / 112))), 255];
  if (!onSquare && kind !== 'maskable') {
    if (!inside(x, y, SMALL) && !near(x, y, OUTLINE, 3)) return null;
  }
  let pixel = onSquare ? base : ([0, 0, 0, 0] as Rgba);
  if (kind === 'mono' || kind === 'mono-light') {
    if (!onSquare) return null;
    if (inside(x, y, SMALL)) return [0, 0, 0, 0];
    if (near(x, y, OUTLINE, 3)) return [base[0], base[1], base[2], 128];
    return base;
  }
  const outline = kind === 'reversed' ? hex('#2340C9') : hex('#FFFFFF');
  if (near(x, y, OUTLINE, 3)) pixel = blend(pixel[3] ? pixel : [0, 0, 0, 0], [...outline, kind === 'reversed' || kind !== 'reversed' ? 128 : 128]);
  if (inside(x, y, SMALL)) pixel = kind === 'reversed' ? [0x23, 0x40, 0xc9, 255] : [255, 255, 255, 255];
  if (near(x, y, SMALL_FOLD, 1.6) && inside(x, y, SMALL)) {
    const fold = kind === 'flat' ? '#2340C9' : kind === 'reversed' ? '#FFFFFF' : '#2A44D0';
    pixel = [...hex(fold), 255];
  }
  return pixel[3] === 0 ? null : pixel;
}

function blend(dst: Rgba, src: Rgba): Rgba {
  const alpha = src[3] / 255;
  const outA = alpha + (dst[3] / 255) * (1 - alpha);
  if (outA === 0) return [0, 0, 0, 0];
  const channel = (index: 0 | 1 | 2) => Math.round((src[index] * alpha + dst[index] * (dst[3] / 255) * (1 - alpha)) / outA);
  return [channel(0), channel(1), channel(2), Math.round(outA * 255)];
}

export function renderMark(size: number, kind: MarkKind): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  const samples = size >= 256 ? 2 : 3;
  const maskable = kind === 'maskable';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          let lx = (px / size) * 64;
          let ly = (py / size) * 64;
          if (maskable) {
            const box = size * 0.8;
            const origin = (size - box) / 2;
            lx = ((px - origin) / box) * 64;
            ly = ((py - origin) / box) * 64;
            if (lx < 0 || ly < 0 || lx > 64 || ly > 64) {
              r += 0x23;
              g += 0x40;
              b += 0xc9;
              a += 255;
              count += 1;
              continue;
            }
          }
          const sample = paintSample(lx, ly, kind);
          if (!sample) continue;
          r += sample[0];
          g += sample[1];
          b += sample[2];
          a += sample[3];
          count += 1;
        }
      }
      const i = (y * size + x) * 4;
      const total = samples * samples;
      if (maskable && count === 0) {
        rgba[i] = 0x23;
        rgba[i + 1] = 0x40;
        rgba[i + 2] = 0xc9;
        rgba[i + 3] = 255;
        continue;
      }
      if (count === 0) continue;
      rgba[i] = Math.round(r / count);
      rgba[i + 1] = Math.round(g / count);
      rgba[i + 2] = Math.round(b / count);
      rgba[i + 3] = Math.round(a / total);
    }
  }
  return rgba;
}

export function blit(dst: Uint8Array, dstWidth: number, src: Uint8Array, srcWidth: number, srcHeight: number, x: number, y: number): void {
  for (let row = 0; row < srcHeight; row += 1) {
    for (let col = 0; col < srcWidth; col += 1) {
      const si = (row * srcWidth + col) * 4;
      const alpha = src[si + 3] ?? 0;
      if (!alpha) continue;
      const dx = x + col;
      const dy = y + row;
      if (dx < 0 || dy < 0) continue;
      const di = (dy * dstWidth + dx) * 4;
      if (di < 0 || di + 3 >= dst.length) continue;
      if (alpha === 255) {
        dst[di] = src[si] ?? 0;
        dst[di + 1] = src[si + 1] ?? 0;
        dst[di + 2] = src[si + 2] ?? 0;
        dst[di + 3] = 255;
      } else {
        const blended = blend(
          [dst[di] ?? 0, dst[di + 1] ?? 0, dst[di + 2] ?? 0, dst[di + 3] ?? 0],
          [src[si] ?? 0, src[si + 1] ?? 0, src[si + 2] ?? 0, src[si + 3] ?? 0],
        );
        dst[di] = blended[0];
        dst[di + 1] = blended[1];
        dst[di + 2] = blended[2];
        dst[di + 3] = blended[3];
      }
    }
  }
}

export function fillColor(dst: Uint8Array, width: number, height: number, color: Rgba): void {
  for (let i = 0; i < width * height; i += 1) {
    dst[i * 4] = color[0];
    dst[i * 4 + 1] = color[1];
    dst[i * 4 + 2] = color[2];
    dst[i * 4 + 3] = color[3];
  }
}

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

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
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
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function packIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + entries.length;
  const parts: Buffer[] = [header, entries];
  for (const [index, image] of images.entries()) {
    const at = index * 16;
    entries.writeUInt8(image.size >= 256 ? 0 : image.size, at);
    entries.writeUInt8(image.size >= 256 ? 0 : image.size, at + 1);
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(image.png.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += image.png.length;
    parts.push(image.png);
  }
  return Buffer.concat(parts);
}
