import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paperIcon(pad) {
  return (x, y, size) => {
    const bg = [230, 233, 239, 255];
    const m = size * pad;
    const x0 = m;
    const y0 = m * 0.92;
    const x1 = size - m;
    const y1 = size - m * 0.82;
    const fold = size * 0.14;
    if (x < x0 || y < y0 || x > x1 || y > y1) return bg;
    const lx = x - (x1 - fold);
    const ly = y - y0;
    if (lx >= 0 && ly >= 0 && lx + ly >= fold) return [35, 64, 201, 255];
    if (x < x0 + size * 0.012 || y < y0 + size * 0.012 || x > x1 - size * 0.012 || y > y1 - size * 0.012) {
      return [210, 216, 228, 255];
    }
    return [255, 255, 255, 255];
  };
}

const dir = path.resolve('public/icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), png(192, paperIcon(0.22)));
fs.writeFileSync(path.join(dir, 'icon-512.png'), png(512, paperIcon(0.22)));
fs.writeFileSync(path.join(dir, 'icon-maskable-512.png'), png(512, paperIcon(0.3)));
