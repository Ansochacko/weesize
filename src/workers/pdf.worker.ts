import { degrees, EncryptedPDFError, PDFDocument, rgb, StandardFonts } from 'pdf-lib/es/index.js';
import PDFArray from 'pdf-lib/es/core/objects/PDFArray.js';
import PDFDict from 'pdf-lib/es/core/objects/PDFDict.js';
import PDFName from 'pdf-lib/es/core/objects/PDFName.js';
import PDFNumber from 'pdf-lib/es/core/objects/PDFNumber.js';
import PDFObject from 'pdf-lib/es/core/objects/PDFObject.js';
import PDFRawStream from 'pdf-lib/es/core/objects/PDFRawStream.js';
import PDFRef from 'pdf-lib/es/core/objects/PDFRef.js';
import PDFStream from 'pdf-lib/es/core/objects/PDFStream.js';
import type { ImageOptions, PdfJob, PdfOut, ScanImage } from './protocol';

interface WorkerScope {
  postMessage(message: PdfOut, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<PdfJob>) => void) | null;
}

interface Held {
  doc: PDFDocument;
  original: Uint8Array;
  dirty: boolean;
}

const worker = globalThis as unknown as WorkerScope;
const held = new Map<string, Held>();
const cancelled = new Set<number>();

function classify(error: unknown): 'encrypted' | 'damaged' | 'cancelled' {
  if (error instanceof Error && error.name === 'Cancelled') return 'cancelled';
  if (error instanceof EncryptedPDFError) return 'encrypted';
  const message = error instanceof Error ? error.message : '';
  if (/encrypt|password/i.test(message)) return 'encrypted';
  return 'damaged';
}

function stop(id: number): void {
  if (!cancelled.has(id)) return;
  const error = new Error('cancelled');
  error.name = 'Cancelled';
  throw error;
}

function report(id: number, done: number, total: number): void {
  const message: PdfOut = { id, type: 'progress', done, total };
  worker.postMessage(message);
}

function filesOf(bytes: Uint8Array[]): ArrayBuffer[] {
  return bytes.map((file) => file.slice().buffer);
}

async function load(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  return PDFDocument.load(copy, { updateMetadata: false });
}

async function save(doc: PDFDocument, streams: boolean): Promise<Uint8Array> {
  return doc.save({ updateFieldAppearances: false, useObjectStreams: streams });
}

async function copyAll(
  out: PDFDocument,
  src: PDFDocument,
  indices: number[],
  id: number,
  done: { n: number },
  total: number,
): Promise<void> {
  // One copyPages call reuses the object copier, so a shared font is copied
  // once per file instead of once per page.
  stop(id);
  const pages = await out.copyPages(src, indices);
  for (const page of pages) {
    if (!page) throw new Error('missing page');
    out.addPage(page);
    done.n += 1;
    if (done.n === 1 || done.n === total || done.n % 25 === 0) report(id, done.n, total);
  }
}

async function merge(job: Extract<PdfJob, { type: 'merge' }>): Promise<void> {
  stop(job.id);
  const sources: PDFDocument[] = [];
  for (const bytes of job.docs) sources.push(await load(bytes));
  const total = sources.reduce((sum, doc) => sum + doc.getPageCount(), 0) || 1;
  const out = await PDFDocument.create();
  const done = { n: 0 };
  report(job.id, 0, total);
  for (const src of sources) await copyAll(out, src, src.getPageIndices(), job.id, done, total);
  const buffers = filesOf([await save(out, false)]);
  const message: PdfOut = { id: job.id, type: 'files', files: buffers };
  worker.postMessage(message, buffers);
}

async function split(job: Extract<PdfJob, { type: 'split' }>): Promise<void> {
  const src = await load(job.bytes);
  const total = Math.max(1, job.groups.reduce((sum, group) => sum + group.length, 0));
  const done = { n: 0 };
  const files: Uint8Array[] = [];
  report(job.id, 0, total);
  for (const group of job.groups) {
    const out = await PDFDocument.create();
    await copyAll(out, src, group, job.id, done, total);
    files.push(await save(out, false));
  }
  const buffers = filesOf(files);
  const message: PdfOut = { id: job.id, type: 'files', files: buffers };
  worker.postMessage(message, buffers);
}

async function organize(job: Extract<PdfJob, { type: 'organize' }>): Promise<void> {
  const src = await load(job.bytes);
  const out = await PDFDocument.create();
  const total = Math.max(1, job.pages.length);
  report(job.id, 0, total);
  stop(job.id);
  const copied = await out.copyPages(
    src,
    job.pages.map((spec) => spec.index),
  );
  for (let index = 0; index < copied.length; index += 1) {
    const page = copied[index];
    const spec = job.pages[index];
    if (!page || !spec) throw new Error('missing page');
    const angle = (((page.getRotation().angle + spec.rotation) % 360) + 360) % 360;
    page.setRotation(degrees(angle));
    out.addPage(page);
    const step = index + 1;
    if (step === 1 || step === total || step % 25 === 0) report(job.id, step, total);
  }
  const buffers = filesOf([await save(out, false)]);
  const message: PdfOut = { id: job.id, type: 'files', files: buffers };
  worker.postMessage(message, buffers);
}

const MARGIN: Record<ImageOptions['margin'], number> = { none: 0, small: 36, large: 72 };

function pageBox(width: number, height: number, options: ImageOptions): { pageW: number; pageH: number; margin: number } {
  const margin = MARGIN[options.margin];
  const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && width > height);
  if (options.pageSize === 'image') {
    let pageW = (width * 72) / 96;
    let pageH = (height * 72) / 96;
    if (landscape && pageH > pageW) [pageW, pageH] = [pageH, pageW];
    if (!landscape && pageW > pageH) [pageW, pageH] = [pageH, pageW];
    return { pageW: pageW + margin * 2, pageH: pageH + margin * 2, margin };
  }
  const short = options.pageSize === 'a4' ? 595.28 : 612;
  const long = options.pageSize === 'a4' ? 841.89 : 792;
  return landscape ? { pageW: long, pageH: short, margin } : { pageW: short, pageH: long, margin };
}

async function images(job: Extract<PdfJob, { type: 'images' }>): Promise<void> {
  const out = await PDFDocument.create();
  const total = Math.max(1, job.images.length);
  report(job.id, 0, total);
  for (let index = 0; index < job.images.length; index += 1) {
    stop(job.id);
    const image = job.images[index];
    if (!image) continue;
    const embedded = image.kind === 'jpg' ? await out.embedJpg(image.bytes) : await out.embedPng(image.bytes);
    const box = pageBox(image.width, image.height, job.options);
    const page = out.addPage([box.pageW, box.pageH]);
    const margin = Math.min(box.margin, box.pageW / 2 - 8, box.pageH / 2 - 8);
    const safe = Number.isFinite(margin) && margin > 0 ? margin : 0;
    const boxW = Math.max(1, box.pageW - safe * 2);
    const boxH = Math.max(1, box.pageH - safe * 2);
    const imgW = (image.width * 72) / 96;
    const imgH = (image.height * 72) / 96;
    const scale = Math.min(boxW / imgW, boxH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    page.drawImage(embedded, {
      x: safe + (boxW - drawW) / 2,
      y: safe + (boxH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
    const step = index + 1;
    if (step === 1 || step === total || step % 1 === 0) report(job.id, step, total);
  }
  const buffers = filesOf([await save(out, false)]);
  const message: PdfOut = { id: job.id, type: 'files', files: buffers };
  worker.postMessage(message, buffers);
}

function refKey(ref: PDFRef): string {
  return `${ref.objectNumber} ${ref.generationNumber}`;
}

function refFromKey(key: string): PDFRef {
  const [objectNumber, generation] = key.split(' ');
  return PDFRef.of(Number(objectNumber), Number(generation));
}

function filterNames(dict: PDFDict): string[] {
  const filter = dict.lookup(PDFName.of('Filter'));
  if (!filter) return [];
  if (filter instanceof PDFArray) {
    const names: string[] = [];
    for (let index = 0; index < filter.size(); index += 1) {
      const text = filter.get(index)?.toString() ?? '';
      if (text.startsWith('/')) names.push(text.slice(1));
    }
    return names;
  }
  const text = filter.toString();
  return text.startsWith('/') ? [text.slice(1)] : [];
}

function colorName(dict: PDFDict): string {
  const color = dict.lookup(PDFName.of('ColorSpace'));
  if (!color) return '';
  if (color instanceof PDFArray) return color.get(0)?.toString() ?? '';
  return color.toString();
}

async function fresh(entry: Held): Promise<PDFDocument> {
  if (!entry.dirty) return entry.doc;
  entry.doc = await load(entry.original);
  entry.dirty = false;
  return entry.doc;
}

async function prescan(job: Extract<PdfJob, { type: 'prescan' }>): Promise<void> {
  stop(job.id);
  const original = new Uint8Array(job.bytes);
  const doc = await load(original);
  held.set(job.docId, { doc, original, dirty: false });
  const masks = new Set<string>();
  const objects = doc.context.enumerateIndirectObjects();
  for (const [, object] of objects) {
    if (!(object instanceof PDFRawStream)) continue;
    const mask = object.dict.lookup(PDFName.of('SMask'));
    const extra = object.dict.lookup(PDFName.of('Mask'));
    if (mask instanceof PDFRef) masks.add(refKey(mask));
    if (extra instanceof PDFRef) masks.add(refKey(extra));
  }
  const images: ScanImage[] = [];
  for (const [ref, object] of objects) {
    if (!(object instanceof PDFRawStream)) continue;
    const key = refKey(ref);
    if (masks.has(key)) continue;
    const dict = object.dict;
    if (dict.lookup(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
    if (dict.has(PDFName.of('SMask')) || dict.has(PDFName.of('Mask'))) continue;
    const width = dict.lookup(PDFName.of('Width'));
    const height = dict.lookup(PDFName.of('Height'));
    if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) continue;
    const pixelWidth = width.asNumber();
    const pixelHeight = height.asNumber();
    if (pixelWidth < 1 || pixelHeight < 1 || Math.max(pixelWidth, pixelHeight) < 64) continue;
    const filters = filterNames(dict);
    let kind: ScanImage['kind'] | null = null;
    if (filters.length === 1 && filters[0] === 'DCTDecode') kind = 'jpeg';
    if (filters.length === 1 && filters[0] === 'FlateDecode') {
      if (dict.has(PDFName.of('DecodeParms')) || dict.has(PDFName.of('DP'))) continue;
      const bits = dict.lookup(PDFName.of('BitsPerComponent'));
      if (!(bits instanceof PDFNumber) || bits.asNumber() !== 8) continue;
      const color = colorName(dict);
      if (color === '/DeviceRGB') kind = 'flate-rgb';
      else if (color === '/DeviceGray') kind = 'flate-gray';
    }
    if (!kind) continue;
    images.push({ key, width: pixelWidth, height: pixelHeight, bytes: object.contents.length, kind });
  }
  const message: PdfOut = { id: job.id, type: 'scan', images };
  worker.postMessage(message);
}

async function extract(job: Extract<PdfJob, { type: 'extract' }>): Promise<void> {
  stop(job.id);
  const entry = held.get(job.docId);
  if (!entry) throw new Error('missing');
  const doc = await fresh(entry);
  const images: Array<{ key: string; bytes: ArrayBuffer }> = [];
  const transfer: ArrayBuffer[] = [];
  for (const key of job.keys) {
    const object = doc.context.lookup(refFromKey(key));
    if (!(object instanceof PDFRawStream)) continue;
    const copy = object.contents.slice().buffer;
    images.push({ key, bytes: copy });
    transfer.push(copy);
  }
  const message: PdfOut = { id: job.id, type: 'extracted', images };
  worker.postMessage(message, transfer);
}

function mark(doc: PDFDocument): void {
  const seen = new Set<string>();
  const stack: PDFObject[] = [];
  const trailer = doc.context.trailerInfo;
  if (trailer.Root) stack.push(trailer.Root);
  if (trailer.Info) stack.push(trailer.Info);
  if (trailer.ID) stack.push(trailer.ID);
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current instanceof PDFRef) {
      const key = refKey(current);
      if (seen.has(key)) continue;
      seen.add(key);
      const next = doc.context.lookup(current);
      if (next) stack.push(next);
      continue;
    }
    if (current instanceof PDFArray) {
      for (let index = 0; index < current.size(); index += 1) {
        const value = current.get(index);
        if (value) stack.push(value);
      }
      continue;
    }
    const dict = current instanceof PDFStream ? current.dict : current instanceof PDFDict ? current : null;
    if (!dict) continue;
    for (const [, value] of dict.entries()) stack.push(value);
  }
  const pending: PDFRef[] = [];
  for (const [ref] of doc.context.enumerateIndirectObjects()) {
    if (!seen.has(refKey(ref))) pending.push(ref);
  }
  for (const ref of pending) doc.context.delete(ref);
}

function strip(doc: PDFDocument): void {
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('');
  doc.setCreator('');
  doc.catalog.delete(PDFName.of('Metadata'));
  doc.catalog.delete(PDFName.of('PieceInfo'));
  for (const page of doc.getPages()) page.node.delete(PDFName.of('Thumb'));
  mark(doc);
}

async function apply(job: Extract<PdfJob, { type: 'apply' }>): Promise<void> {
  stop(job.id);
  const entry = held.get(job.docId);
  if (!entry) throw new Error('missing');
  const doc = await fresh(entry);
  for (const item of job.items) {
    const ref = refFromKey(item.key);
    const object = doc.context.lookup(ref);
    if (!(object instanceof PDFRawStream)) continue;
    const jpeg = new Uint8Array(item.bytes);
    if (jpeg.byteLength >= object.contents.length) continue;
    const dict = object.dict;
    dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    dict.set(PDFName.of('Width'), PDFNumber.of(item.width));
    dict.set(PDFName.of('Height'), PDFNumber.of(item.height));
    dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
    dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    dict.set(PDFName.of('Length'), PDFNumber.of(jpeg.byteLength));
    dict.delete(PDFName.of('DecodeParms'));
    dict.delete(PDFName.of('Decode'));
    doc.context.assign(ref, PDFRawStream.of(dict, jpeg));
  }
  strip(doc);
  entry.dirty = true;
  const saved = await save(doc, true);
  const unchanged = saved.byteLength >= entry.original.byteLength;
  const bytes = (unchanged ? entry.original.slice() : saved.slice()).buffer;
  const message: PdfOut = { id: job.id, type: 'applied', bytes, unchanged };
  worker.postMessage(message, [bytes]);
}

async function edit(job: Extract<PdfJob, { type: 'edit' }>): Promise<void> {
  stop(job.id);
  const change = job.edit;
  if (change.kind === 'textpdf') {
    const fontDoc = await PDFDocument.create();
    const font = await fontDoc.embedFont(StandardFonts.Helvetica);
    const size = 11;
    const leading = 16;
    let page = fontDoc.addPage([612, 792]);
    let y = 750;
    const write = (line: string) => {
      if (y < 54) {
        page = fontDoc.addPage([612, 792]);
        y = 750;
      }
      page.drawText(line.slice(0, 110), { x: 54, y, size, font, color: rgb(0.1, 0.12, 0.16) });
      y -= leading;
    };
    for (const line of change.lines) {
      const text = line.replace(/\s+/g, ' ').trim();
      if (!text) {
        y -= leading;
        continue;
      }
      for (let index = 0; index < text.length; index += 90) write(text.slice(index, index + 90));
    }
    const buffers = filesOf([await save(fontDoc, false)]);
    const message: PdfOut = { id: job.id, type: 'files', files: buffers };
    worker.postMessage(message, buffers);
    return;
  }
  const doc = await load(job.bytes);
  const pages = doc.getPages();
  if (change.kind === 'rotate') {
    for (const page of pages) {
      const next = (page.getRotation().angle + change.turns * 90) % 360;
      page.setRotation(degrees(next));
    }
  } else if (change.kind === 'crop') {
    const margin = Math.max(0, change.points);
    for (const page of pages) {
      const size = page.getSize();
      const width = Math.max(1, size.width - margin * 2);
      const height = Math.max(1, size.height - margin * 2);
      page.setCropBox(margin, margin, width, height);
    }
  } else if (change.kind === 'watermark') {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const page of pages) {
      const size = page.getSize();
      page.drawText(change.text.slice(0, 80), {
        x: size.width * 0.18,
        y: size.height * 0.45,
        size: 42,
        font,
        color: rgb(0.55, 0.58, 0.64),
        opacity: 0.28,
        rotate: degrees(32),
      });
    }
  } else if (change.kind === 'numbers') {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    let value = change.start;
    pages.forEach((page, index) => {
      if (change.skipFirst && index === 0) return;
      const size = page.getSize();
      const label = String(value);
      page.drawText(label, { x: size.width / 2 - label.length * 3, y: 28, size: 11, font, color: rgb(0.15, 0.17, 0.2) });
      value += 1;
    });
  }
  const buffers = filesOf([await save(doc, true)]);
  const message: PdfOut = { id: job.id, type: 'files', files: buffers };
  worker.postMessage(message, buffers);
}

async function release(job: Extract<PdfJob, { type: 'release' }>): Promise<void> {
  held.delete(job.docId);
  const message: PdfOut = { id: job.id, type: 'released' };
  worker.postMessage(message);
}

worker.postMessage({ type: 'ready' });

let chain: Promise<void> = Promise.resolve();

worker.onmessage = (event: MessageEvent<PdfJob>) => {
  const job = event.data;
  if (job.type === 'cancel') {
    cancelled.add(job.id);
    return;
  }
  chain = chain
    .then(async () => {
      if (job.type === 'merge') await merge(job);
      else if (job.type === 'split') await split(job);
      else if (job.type === 'organize') await organize(job);
      else if (job.type === 'edit') await edit(job);
      else if (job.type === 'images') await images(job);
      else if (job.type === 'prescan') await prescan(job);
      else if (job.type === 'extract') await extract(job);
      else if (job.type === 'apply') await apply(job);
      else await release(job);
      cancelled.delete(job.id);
    })
    .catch((error: unknown) => {
      cancelled.delete(job.id);
      const message: PdfOut = { id: job.id, type: 'error', kind: classify(error) };
      worker.postMessage(message);
    });
};
