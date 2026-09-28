import { unzlibSync } from 'fflate';
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  type PDFPage,
} from 'pdf-lib';

export type FindingLevel = 'high' | 'medium' | 'info';

export interface Finding {
  id: string;
  level: FindingLevel;
  title: string;
  detail: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TextMark {
  x: number;
  y: number;
  size: number;
  white: boolean;
  block: string;
}

function latin(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function visibleText(bytes: Uint8Array): string {
  const raw = latin(bytes);
  let extra = '';
  const marker = /\/Length\s+(\d+)\s*>>\s*stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(raw))) {
    const start = match.index + match[0].length;
    const length = Number(match[1]);
    const slice = bytes.subarray(start, start + length);
    try {
      extra += latin(unzlibSync(slice));
    } catch {
      /* An uncompressed stream is already in the outer text. */
    }
  }
  return raw + extra;
}

function blocksOf(source: string): string[] {
  return source.split(/(?=^q\n)/m).map((block) => block.trim()).filter(Boolean);
}

function blackRects(source: string): Rect[] {
  const rects: Rect[] = [];
  for (const block of blocksOf(source)) {
    if (!/\nf\b/.test(block) || !/0 0 0 rg/.test(block)) continue;
    const cms = [...block.matchAll(/^1 0 0 1 ([-\d.]+) ([-\d.]+) cm$/gm)];
    let ox = 0;
    let oy = 0;
    for (const cm of cms) {
      ox += Number(cm[1] ?? 0);
      oy += Number(cm[2] ?? 0);
    }
    const xs: number[] = [];
    const ys: number[] = [];
    for (const mark of block.matchAll(/^([-\d.]+) ([-\d.]+) [ml]$/gm)) {
      xs.push(Number(mark[1]) + ox);
      ys.push(Number(mark[2]) + oy);
    }
    if (xs.length < 2 || ys.length < 2) continue;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    rects.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  }
  return rects;
}

function textMarks(source: string): TextMark[] {
  const marks: TextMark[] = [];
  for (const block of blocksOf(source)) {
    if (!/Tj/.test(block)) continue;
    const tm = /1 0 0 1 ([-\d.]+) ([-\d.]+) Tm/.exec(block);
    const size = /(\d+(?:\.\d+)?) Tf/.exec(block);
    const color = /([\d.]+) ([\d.]+) ([\d.]+) rg/.exec(block);
    if (!tm?.[1] || !tm[2]) continue;
    const channels = [color?.[1], color?.[2], color?.[3]].map((part) => Number(part ?? 0));
    marks.push({
      x: Number(tm[1]),
      y: Number(tm[2]),
      size: size?.[1] ? Number(size[1]) : 12,
      white: channels.every((channel) => channel >= 0.97),
      block,
    });
  }
  return marks;
}

function covers(rect: Rect, mark: TextMark): boolean {
  const y = mark.y + mark.size * 0.3;
  return mark.x >= rect.x && mark.x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function streamText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  if (value instanceof PDFRawStream) {
    try {
      return new TextDecoder().decode(decodePDFRawStream(value).decode());
    } catch {
      /* Fall through to the uncompressed contents string. */
    }
  }
  if ('getContentsString' in value && typeof value.getContentsString === 'function') {
    const text = String(value.getContentsString());
    if (text.includes('Tj') || text.includes(' rg')) return text;
    try {
      return latin(unzlibSync(Uint8Array.from(text, (char) => char.charCodeAt(0) & 255)));
    } catch {
      return text;
    }
  }
  return '';
}

function pageSource(doc: PDFDocument, page: PDFPage): string {
  const contents = page.node.Contents();
  if (!contents) return '';
  if ('asArray' in contents && typeof contents.asArray === 'function') {
    return contents.asArray().map((ref) => streamText(doc.context.lookup(ref))).join('\n');
  }
  return streamText(doc.context.lookup(contents));
}

function push(list: Finding[], id: string, level: FindingLevel, title: string, detail: string): void {
  if (list.some((item) => item.id === id)) return;
  list.push({ id, level, title, detail });
}

export async function scanPdf(bytes: Uint8Array): Promise<Finding[]> {
  const findings: Finding[] = [];
  const raw = visibleText(bytes);
  const revisions = raw.match(/%%EOF/g)?.length ?? 0;
  if (revisions > 1) {
    push(findings, 'revisions', 'high', 'Older copies may still be in the file', `This file has ${revisions} endings. An earlier save can still hold text you thought was gone.`);
  }
  if (/\/JavaScript\b|\/JS\b/.test(raw)) {
    push(findings, 'javascript', 'high', 'The file contains a script', 'A PDF script can run when someone opens the file. This check found the marker. It did not run the script.');
  }
  if (/\/EmbeddedFile\b/.test(raw)) {
    push(findings, 'attachment', 'high', 'A file is attached', 'An attached file is easy to miss and can carry its own private details.');
  }
  if (/GPSLatitude|GPSLongitude/.test(raw)) {
    push(findings, 'gps', 'high', 'Location data is in the file', 'A GPS tag was found in the bytes. It can point at where a photo was taken.');
  }
  if (/\/OCProperties\b|\/OCG\b/.test(raw)) {
    push(findings, 'layers', 'medium', 'A hidden layer marker is present', 'Optional content can hide text until someone turns the layer on.');
  }
  if (/\/Annot\b/.test(raw)) {
    push(findings, 'annotations', 'medium', 'Comments or marks are stored', 'A comment can hold a sentence that is not painted on the page.');
  }

  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const author = doc.getAuthor()?.trim();
    const creator = doc.getCreator()?.trim();
    const producer = doc.getProducer()?.trim();
    if (author || creator || producer) {
      const bits = [author && `author ${author}`, creator && `creator ${creator}`, producer && `producer ${producer}`].filter(Boolean);
      push(findings, 'metadata', 'info', 'The file names the software or a person', bits.join(', ') + '.');
    }
    for (const page of doc.getPages()) {
      const source = pageSource(doc, page);
      const rects = blackRects(source);
      const marks = textMarks(source);
      const { width, height } = page.getSize();
      if (marks.some((mark) => rects.some((rect) => covers(rect, mark)))) {
        push(findings, 'covered-text', 'high', 'Text sits under a filled shape', 'Words are still in the page description, underneath a dark shape. A black box alone is not removal.');
      }
      if (marks.some((mark) => mark.white)) {
        push(findings, 'white-text', 'high', 'White text is in the page', 'White lettering on a white page can be copied even when you cannot see it.');
      }
      if (marks.some((mark) => mark.x < -1 || mark.y < -1 || mark.x > width + 1 || mark.y > height + 1)) {
        push(findings, 'off-page', 'high', 'Text is outside the page', 'Some words are positioned off the page, where they are invisible and still searchable.');
      }
    }
  } catch {
    push(findings, 'unreadable', 'info', 'Part of the file could not be read', 'The byte checks above still ran. The page description could not be opened.');
  }
  return findings;
}

function rewriteSource(source: string, width: number, height: number): string {
  const rects = blackRects(source);
  const kept: string[] = [];
  for (const block of blocksOf(source)) {
    const marks = textMarks(block);
    if (!marks.length) {
      kept.push(block);
      continue;
    }
    const drop = marks.some(
      (mark) => mark.white || mark.x < -1 || mark.y < -1 || mark.x > width + 1 || mark.y > height + 1 || rects.some((rect) => covers(rect, mark)),
    );
    if (!drop) kept.push(block);
  }
  return `${kept.join('\n')}\n`;
}

function clearInfo(doc: PDFDocument): void {
  const infoRef = doc.context.trailerInfo.Info;
  if (!infoRef) return;
  const info = doc.context.lookup(infoRef);
  if (!(info instanceof PDFDict)) return;
  for (const key of ['Author', 'Creator', 'Producer', 'Title', 'Subject', 'Keywords', 'CreationDate', 'ModDate']) {
    info.delete(PDFName.of(key));
  }
}

export async function fixPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.catalog.delete(PDFName.of('OpenAction'));
  doc.catalog.delete(PDFName.of('Names'));
  doc.catalog.delete(PDFName.of('AcroForm'));
  doc.catalog.delete(PDFName.of('OCProperties'));
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of('Annots'));
    const { width, height } = page.getSize();
    const next = rewriteSource(pageSource(doc, page), width, height);
    page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.stream(next)));
  }
  clearInfo(doc);
  const clean = await PDFDocument.create();
  const copied = await clean.copyPages(doc, doc.getPageIndices());
  for (const page of copied) clean.addPage(page);
  clearInfo(clean);
  return clean.save({ useObjectStreams: false, updateFieldAppearances: false });
}

export function stripJpegMetadata(jpeg: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const parts: Uint8Array[] = [jpeg.subarray(0, 2)];
  let i = 2;
  while (i + 4 < jpeg.length && jpeg[i] === 0xff) {
    const marker = jpeg[i + 1] ?? 0;
    if (marker === 0xda) {
      parts.push(jpeg.subarray(i));
      break;
    }
    const length = ((jpeg[i + 2] ?? 0) << 8) | (jpeg[i + 3] ?? 0);
    const drop = marker >= 0xe1 && marker <= 0xef || marker === 0xfe;
    if (!drop) parts.push(jpeg.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function insertExifGps(jpeg: Uint8Array): Uint8Array {
  const payload = new TextEncoder().encode('Exif\0\0GPSLatitude');
  const app = new Uint8Array(4 + payload.length);
  app[0] = 0xff;
  app[1] = 0xe1;
  const length = payload.length + 2;
  app[2] = length >> 8;
  app[3] = length & 255;
  app.set(payload, 4);
  const out = new Uint8Array(jpeg.length + app.length);
  out.set(jpeg.subarray(0, 2));
  out.set(app, 2);
  out.set(jpeg.subarray(2), 2 + app.length);
  return out;
}
