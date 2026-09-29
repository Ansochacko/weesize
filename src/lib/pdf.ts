import type { ScanImage } from '../workers/protocol';
import type { WorkerFailure } from '../workers/pool';

export type PdfKind = 'encrypted' | 'damaged' | 'empty' | 'failed' | 'cancelled';
export type PageSizeId = 'image' | 'a4' | 'letter';
export type OrientationId = 'auto' | 'portrait' | 'landscape';
export type MarginId = 'none' | 'small' | 'large';

export interface PageBox {
  width: number;
  height: number;
}

export interface PreparedImage {
  bytes: Uint8Array;
  kind: 'jpg' | 'png';
  width: number;
  height: number;
}

export interface PageRange {
  start: number;
  end: number;
}

export interface RangeParse {
  ranges: PageRange[];
  pages: number[];
  error: string | null;
  incomplete: boolean;
}

export interface CompressSettings {
  maxEdge: number;
  quality: number;
  resize: 'high' | 'medium';
  grayscale: boolean;
  squeeze: boolean;
}

export const COMPRESS_LEVELS = {
  light: { maxEdge: 2400, quality: 0.85, resize: 'high' as const },
  recommended: { maxEdge: 1600, quality: 0.72, resize: 'medium' as const },
  strong: { maxEdge: 1100, quality: 0.55, resize: 'medium' as const },
};

export const ALREADY_SMALL = 'This PDF is already well compressed. No smaller version was possible.';

export class PdfReadError extends Error {
  readonly kind: PdfKind;

  constructor(kind: PdfKind) {
    super(kind);
    this.name = 'PdfReadError';
    this.kind = kind;
  }
}

interface Opened {
  pageCount: number;
  first: PageBox;
  boxes: PageBox[] | null;
}

interface PoolModule {
  WorkerFailure: typeof WorkerFailure;
  startPool: () => Promise<void>;
  askPdf: (
    request: never,
    transfer: ArrayBuffer[],
    onProgress?: (done: number, total: number) => void,
  ) => { id: number; result: Promise<import('../workers/protocol').PdfOut> };
  cancelPdf: (id: number) => void;
  askRender: (
    request: never,
    transfer: ArrayBuffer[],
    onProgress?: (done: number, total: number) => void,
  ) => Promise<import('../workers/protocol').RenderOut>;
  cancelRender: (docId: string, pageIndex: number, gen: number) => void;
  cancelQueuedCompress: () => void;
  compressImage: (
    payload: Omit<import('../workers/protocol').CompressJob, 'id'>,
    transfer: ArrayBuffer,
  ) => Promise<{ bytes: ArrayBuffer | null; width: number; height: number }>;
}

const opened = new Map<string, Opened>();
const scans = new Map<string, Promise<ScanImage[]>>();
const thumbs = new Map<string, string>();
const thumbToken = new Map<string, number>();
let thumbSerial = 1;
let halt = false;
let stopActive: (() => void) | null = null;

export function describePdfError(error: unknown): string {
  const kind = error instanceof PdfReadError ? error.kind : 'damaged';
  if (kind === 'encrypted') return 'This PDF is locked with a password. Remove the password on this device, then try again.';
  if (kind === 'empty') return 'This PDF has no pages.';
  if (kind === 'failed') return 'This file could not be read in the browser. Try a smaller copy.';
  if (kind === 'cancelled') return 'Stopped before a new file was saved.';
  return 'This file could not be read as a PDF. Export it again from the program that created it.';
}

export { isImageFile, isPdfFile } from './detect';

export function cancelWork(): void {
  halt = true;
  stopActive?.();
}

export function startEngines(): Promise<void> {
  return loadPool().then((mod) => mod.startPool());
}

async function loadPool(): Promise<PoolModule> {
  return (await import('../workers/pool')) as unknown as PoolModule;
}

function transferBytes(bytes: Uint8Array): ArrayBuffer {
  // The page keeps the original so another tool can reuse it. The worker gets this copy as a transferable.
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function mapError(error: unknown, mod: PoolModule): PdfReadError {
  if (error instanceof PdfReadError) return error;
  if (error instanceof mod.WorkerFailure) {
    if (error.kind === 'failed') return new PdfReadError('failed');
    return new PdfReadError(error.kind);
  }
  if (error instanceof Error && error.name === 'Cancelled') return new PdfReadError('cancelled');
  return new PdfReadError('damaged');
}

function beginJob(mod: PoolModule, cancel: () => void): void {
  halt = false;
  stopActive = () => {
    cancel();
    mod.cancelQueuedCompress();
  };
}

function endJob(): void {
  stopActive = null;
}

export async function openPdf(id: string, bytes: Uint8Array): Promise<{ pageCount: number }> {
  if (bytes.byteLength === 0) throw new PdfReadError('empty');
  const mod = await loadPool();
  const copy = transferBytes(bytes);
  try {
    const data = await mod.askRender({ type: 'open', docId: id, bytes: copy } as never, [copy]);
    if (data.type !== 'opened') throw new PdfReadError('failed');
    opened.set(id, { pageCount: data.pageCount, first: { width: data.width, height: data.height }, boxes: null });
    return { pageCount: data.pageCount };
  } catch (error) {
    throw mapError(error, mod);
  }
}

export async function readFirstBox(id: string): Promise<PageBox> {
  const doc = opened.get(id);
  if (!doc) throw new PdfReadError('failed');
  return doc.first;
}

export async function readPageBoxes(id: string, onProgress?: (done: number, total: number) => void): Promise<PageBox[]> {
  const doc = opened.get(id);
  if (!doc) throw new PdfReadError('failed');
  if (doc.boxes) return doc.boxes;
  const mod = await loadPool();
  try {
    const data = await mod.askRender({ type: 'boxes', docId: id } as never, [], onProgress);
    if (data.type !== 'boxes') throw new PdfReadError('failed');
    doc.boxes = data.boxes;
    return data.boxes;
  } catch (error) {
    throw mapError(error, mod);
  }
}

export function releaseDocument(id: string): void {
  opened.delete(id);
  scans.delete(id);
  for (const [key, url] of thumbs) {
    if (!key.startsWith(`${id}:`)) continue;
    URL.revokeObjectURL(url);
    thumbs.delete(key);
    thumbToken.delete(key);
  }
  void loadPool().then((mod) => {
    void mod.askRender({ type: 'close', docId: id } as never, []).catch(() => undefined);
    void mod.askPdf({ type: 'release', docId: id } as never, []).result.catch(() => undefined);
  });
}

export function peekThumbnail(id: string, pageIndex: number): string | null {
  return thumbs.get(`${id}:${pageIndex}`) ?? null;
}

export function enqueueThumbnail(id: string, pageIndex: number, cssWidth: number, onReady: (url: string) => void): () => void {
  const key = `${id}:${pageIndex}`;
  const existing = thumbs.get(key);
  if (existing) {
    onReady(existing);
    return () => undefined;
  }
  const gen = thumbSerial;
  thumbSerial += 1;
  thumbToken.set(key, gen);
  let dead = false;
  const paint = (bytes: ArrayBuffer): void => {
    if (dead || thumbToken.get(key) !== gen) return;
    const previous = thumbs.get(key);
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    thumbs.set(key, url);
    onReady(url);
  };
  void (async () => {
    const quick = await renderThumb(id, pageIndex, Math.min(cssWidth, 96), gen);
    if (!quick) return;
    paint(quick);
    if (dead || cssWidth <= 96) return;
    const sharp = await renderThumb(id, pageIndex, cssWidth, gen);
    if (sharp) paint(sharp);
  })();
  return () => {
    dead = true;
    if (thumbToken.get(key) === gen) thumbToken.delete(key);
    void loadPool().then((mod) => mod.cancelRender(id, pageIndex, gen));
  };
}

async function renderThumb(id: string, pageIndex: number, cssWidth: number, gen: number): Promise<ArrayBuffer | null> {
  const mod = await loadPool();
  try {
    const data = await mod.askRender({ type: 'render', docId: id, pageIndex, cssWidth, gen } as never, []);
    if (data.type !== 'thumb') return null;
    return data.bytes;
  } catch {
    return null;
  }
}

export async function previewFirstPage(bytes: Uint8Array): Promise<string> {
  const id = `preview-${thumbSerial}`;
  thumbSerial += 1;
  await openPdf(id, bytes);
  try {
    const rendered = await renderThumb(id, 0, 280, thumbSerial);
    if (!rendered) throw new PdfReadError('failed');
    return URL.createObjectURL(new Blob([rendered], { type: 'image/jpeg' }));
  } finally {
    releaseDocument(id);
  }
}

export function beginPrescan(id: string, bytes: Uint8Array): void {
  const task = (async () => {
    const mod = await loadPool();
    const copy = transferBytes(bytes);
    const tracked = mod.askPdf({ type: 'prescan', docId: id, bytes: copy } as never, [copy]);
    const data = await tracked.result;
    if (data.type !== 'scan') throw new PdfReadError('failed');
    return data.images;
  })();
  scans.set(id, task);
  task.catch(() => undefined);
}

async function savedFiles(
  request: object,
  transfer: ArrayBuffer[],
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array[]> {
  const mod = await loadPool();
  const tracked = mod.askPdf(request as never, transfer, onProgress);
  beginJob(mod, () => mod.cancelPdf(tracked.id));
  try {
    const data = await tracked.result;
    if (data.type !== 'files') throw new PdfReadError('failed');
    return data.files.map((buffer) => new Uint8Array(buffer));
  } catch (error) {
    throw mapError(error, mod);
  } finally {
    endJob();
  }
}

export async function mergePdfs(docs: Uint8Array[], onProgress: (done: number, total: number) => void): Promise<Uint8Array> {
  const buffers = docs.map(transferBytes);
  const files = await savedFiles({ type: 'merge', docs: buffers }, buffers, onProgress);
  const first = files[0];
  if (!first) throw new PdfReadError('damaged');
  return first;
}

export async function splitPdf(
  bytes: Uint8Array,
  groups: number[][],
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array[]> {
  const buffer = transferBytes(bytes);
  return savedFiles({ type: 'split', bytes: buffer, groups }, [buffer], onProgress);
}

export async function editPdf(
  bytes: Uint8Array,
  edit: import('../workers/protocol').PdfEdit,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const buffer = transferBytes(bytes);
  const files = await savedFiles({ type: 'edit', bytes: buffer, edit }, [buffer], onProgress);
  const first = files[0];
  if (!first) throw new PdfReadError('damaged');
  return first;
}

export async function pageText(id: string): Promise<string[]> {
  const mod = await loadPool();
  try {
    const data = await mod.askRender({ type: 'text', docId: id } as never, []);
    if (data.type !== 'text') throw new PdfReadError('failed');
    return data.pages;
  } catch (error) {
    throw mapError(error, mod);
  }
}

export async function pageTables(id: string): Promise<Array<string[][]>> {
  const mod = await loadPool();
  try {
    const data = await mod.askRender({ type: 'tables', docId: id } as never, []);
    if (data.type !== 'tables') throw new PdfReadError('failed');
    return data.pages;
  } catch (error) {
    throw mapError(error, mod);
  }
}

export async function pageTextWithPositions(
  id: string,
): Promise<Array<Array<{ str: string; x: number; y: number; width: number; height: number; fontSize: number }>>> {
  const mod = await loadPool();
  try {
    const data = await mod.askRender({ type: 'textPositions', docId: id } as never, []);
    if (data.type !== 'textPositions') throw new PdfReadError('failed');
    return data.pages;
  } catch (error) {
    throw mapError(error, mod);
  }
}

export async function renderPageImage(id: string, pageIndex: number, cssWidth: number): Promise<ArrayBuffer | null> {
  const gen = thumbSerial;
  thumbSerial += 1;
  return renderThumb(id, pageIndex, cssWidth, gen);
}

export async function exportPageJpegs(
  bytes: Uint8Array,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array[]> {
  const id = `export-${thumbSerial}`;
  thumbSerial += 1;
  const openedDoc = await openPdf(id, bytes);
  const images: Uint8Array[] = [];
  try {
    for (let index = 0; index < openedDoc.pageCount; index += 1) {
      onProgress(index, openedDoc.pageCount);
      const rendered = await renderThumb(id, index, 1200, thumbSerial + index);
      if (rendered) images.push(new Uint8Array(rendered));
    }
    onProgress(openedDoc.pageCount, openedDoc.pageCount);
    return images;
  } finally {
    releaseDocument(id);
  }
}

export async function organizePdf(
  bytes: Uint8Array,
  pages: Array<{ index: number; rotation: number }>,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const buffer = transferBytes(bytes);
  const files = await savedFiles({ type: 'organize', bytes: buffer, pages }, [buffer], onProgress);
  const first = files[0];
  if (!first) throw new PdfReadError('damaged');
  return first;
}

export async function imagesToPdf(
  images: PreparedImage[],
  options: { pageSize: PageSizeId; orientation: OrientationId; margin: MarginId },
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const placements = images.map((image) => ({
    bytes: transferBytes(image.bytes),
    kind: image.kind,
    width: image.width,
    height: image.height,
  }));
  const files = await savedFiles(
    { type: 'images', images: placements, options },
    placements.map((image) => image.bytes),
    onProgress,
  );
  const first = files[0];
  if (!first) throw new PdfReadError('damaged');
  return first;
}

function worthShrinking(image: ScanImage, settings: CompressSettings): boolean {
  const long = Math.max(image.width, image.height);
  if (long < 64) return false;
  const pixels = image.width * image.height;
  const density = pixels > 0 ? image.bytes / pixels : 1;
  return !(long <= settings.maxEdge && density < 0.2);
}

export async function compressDocument(
  id: string,
  settings: CompressSettings,
  onProgress: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array; unchanged: boolean }> {
  const pending = scans.get(id);
  if (!pending) throw new PdfReadError('failed');
  const mod = await loadPool();
  beginJob(mod, () => undefined);
  const jobIds: number[] = [];
  stopActive = () => {
    for (const jobId of jobIds) mod.cancelPdf(jobId);
    mod.cancelQueuedCompress();
  };
  try {
    const found = await pending;
    if (halt) throw new PdfReadError('cancelled');
    const chosen = found.filter((image) => worthShrinking(image, settings)).sort((a, b) => b.bytes - a.bytes);
    const total = chosen.length;
    onProgress(0, total);
    let finished = 0;
    const replacements: Array<{ key: string; bytes: ArrayBuffer; width: number; height: number }> = [];
    await Promise.all(
      chosen.map(async (image) => {
        try {
          if (halt) return;
          const tracked = mod.askPdf({ type: 'extract', docId: id, keys: [image.key] } as never, []);
          jobIds.push(tracked.id);
          const extracted = await tracked.result;
          if (halt || extracted.type !== 'extracted') {
            if (extracted.type !== 'extracted' && !halt) throw new PdfReadError('failed');
            return;
          }
          const payload = extracted.images[0];
          if (!payload || halt) return;
          const shrunk = await mod.compressImage(
            {
              bytes: payload.bytes,
              width: image.width,
              height: image.height,
              kind: image.kind,
              maxEdge: settings.maxEdge,
              quality: settings.quality,
              resize: settings.resize,
              grayscale: settings.grayscale,
              squeeze: settings.squeeze,
            },
            payload.bytes,
          );
          if (halt) return;
          finished += 1;
          onProgress(finished, total);
          if (shrunk.bytes) replacements.push({ key: image.key, bytes: shrunk.bytes, width: shrunk.width, height: shrunk.height });
        } catch (error) {
          if (halt) return;
          throw error;
        }
      }),
    );
    if (halt) throw new PdfReadError('cancelled');
    const transfers = replacements.map((item) => item.bytes);
    const applied = mod.askPdf({ type: 'apply', docId: id, items: replacements } as never, transfers);
    jobIds.push(applied.id);
    const data = await applied.result;
    if (data.type !== 'applied') throw new PdfReadError('failed');
    return { bytes: new Uint8Array(data.bytes), unchanged: data.unchanged };
  } catch (error) {
    throw mapError(error, mod);
  } finally {
    endJob();
  }
}

export async function shrinkPrepared(image: PreparedImage): Promise<PreparedImage> {
  const level = COMPRESS_LEVELS.recommended;
  const long = Math.max(image.width, image.height);
  const pixels = image.width * image.height;
  const density = pixels > 0 ? image.bytes.byteLength / pixels : 1;
  if (long < 64 || (long <= level.maxEdge && density < 0.2)) return image;
  const mod = await loadPool();
  const copy = transferBytes(image.bytes);
  try {
    const shrunk = await mod.compressImage(
      {
        bytes: copy,
        width: image.width,
        height: image.height,
        kind: image.kind === 'jpg' ? 'jpeg' : 'bitmap',
        maxEdge: level.maxEdge,
        quality: level.quality,
        resize: level.resize,
        grayscale: false,
        squeeze: false,
      },
      copy,
    );
    if (!shrunk.bytes) return image;
    return { bytes: new Uint8Array(shrunk.bytes), kind: 'jpg', width: shrunk.width, height: shrunk.height };
  } catch {
    return image;
  }
}

export function parsePageRanges(input: string, pageCount: number): RangeParse {
  const trimmed = input.trim();
  if (!trimmed) return { ranges: [], pages: [], error: null, incomplete: true };
  const parts = trimmed.split(',');
  const ranges: PageRange[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim() ?? '';
    const last = index === parts.length - 1;
    if (!part) {
      if (last && trimmed.endsWith(',')) return { ranges, pages: flatten(ranges), error: null, incomplete: true };
      return fail('There is an empty spot in the list. Write pages like 1-3, 5, 8-10.');
    }
    const match = /^(\d+)\s*(?:-\s*(\d+)?)?$/.exec(part);
    if (!match) return fail(`"${part}" isn't a page or a range. Use numbers like 1-3, 5, 8-10.`);
    const start = Number(match[1]);
    const hasDash = part.includes('-');
    const endRaw = match[2];
    if (hasDash && !endRaw) {
      if (last) return { ranges, pages: flatten(ranges), error: null, incomplete: true };
      return fail(`"${part}" needs an ending page.`);
    }
    const end = endRaw ? Number(endRaw) : start;
    if (start < 1 || end < 1) return fail('Page numbers start at 1.');
    if (end < start) return fail(`Range ${start}-${end} goes backwards. Put the smaller number first.`);
    if (start > pageCount || end > pageCount) {
      const page = start > pageCount ? start : end;
      const noun = pageCount === 1 ? 'page' : 'pages';
      return fail(`Page ${page} is past the end. This PDF has ${pageCount} ${noun}.`);
    }
    ranges.push({ start, end });
  }
  return { ranges, pages: flatten(ranges), error: null, incomplete: false };
}

function fail(error: string): RangeParse {
  return { ranges: [], pages: [], error, incomplete: false };
}

function flatten(ranges: PageRange[]): number[] {
  const pages: number[] = [];
  for (const range of ranges) {
    for (let page = range.start; page <= range.end; page += 1) pages.push(page);
  }
  return pages;
}

export function turn(rotation: number, delta: number): number {
  return (((rotation + delta) % 360) + 360) % 360;
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new PdfReadError('failed');
  }
}

export async function prepareImageFile(file: File): Promise<PreparedImage> {
  const raw = await readFileBytes(file);
  const jpeg = /jpeg|jpg/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  const orientation = jpeg ? readJpegOrientation(raw) : 1;
  if (jpeg && orientation === 1) {
    const bitmap = await createImageBitmap(new Blob([transferBytes(raw)], { type: 'image/jpeg' }));
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();
    return { bytes: raw, kind: 'jpg', width, height };
  }
  const blob = new Blob([transferBytes(raw)], { type: file.type || 'application/octet-stream' });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'none' });
  } catch {
    bitmap = await createImageBitmap(blob);
  }
  try {
    return await rasterize(bitmap, orientation);
  } finally {
    bitmap.close();
  }
}

function readJpegOrientation(bytes: Uint8Array): number {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) return 1;
      const marker = bytes[offset + 1] ?? 0;
      if (marker === 0xda || marker === 0xd9) return 1;
      const size = view.getUint16(offset + 2, false);
      if (size < 2) return 1;
      if (marker === 0xe1 && view.getUint32(offset + 4) === 0x45786966) {
        return orientationFromExif(view, offset + 10, offset + 2 + size);
      }
      offset += 2 + size;
    }
  } catch {
    return 1;
  }
  return 1;
}

function orientationFromExif(view: DataView, start: number, end: number): number {
  if (start + 8 > end || start < 0) return 1;
  const little = view.getUint16(start, false) === 0x4949;
  if (view.getUint16(start + 2, little) !== 42) return 1;
  const ifd = start + view.getUint32(start + 4, little);
  if (ifd + 2 > end) return 1;
  const count = view.getUint16(ifd, little);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > end) break;
    if (view.getUint16(entry, little) !== 0x0112) continue;
    const value = view.getUint16(entry + 8, little);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 1;
}

async function rasterize(bitmap: ImageBitmap, orientation: number): Promise<PreparedImage> {
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const swapped = orientation >= 5 && orientation <= 8;
  const fullW = swapped ? srcH : srcW;
  const fullH = swapped ? srcW : srcH;
  const scale = Math.min(1, 4096 / Math.max(fullW, fullH, 1));
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = swapped ? drawH : drawW;
  canvas.height = swapped ? drawW : drawH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PdfReadError('failed');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  switch (orientation) {
    case 2:
      ctx.translate(drawW, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.translate(drawW, drawH);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.translate(0, drawH);
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
      break;
    case 6:
      ctx.rotate(Math.PI / 2);
      ctx.translate(0, -drawH);
      break;
    case 7:
      ctx.rotate(Math.PI / 2);
      ctx.translate(drawW, -drawH);
      ctx.scale(-1, 1);
      break;
    case 8:
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-drawW, 0);
      break;
    default:
      break;
  }
  ctx.drawImage(bitmap, 0, 0, drawW, drawH);
  ctx.restore();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) throw new PdfReadError('failed');
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    kind: 'png',
    width: fullW,
    height: fullH,
  };
}
