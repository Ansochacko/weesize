import { getDocument, GlobalWorkerOptions, PasswordException } from 'pdfjs-dist';
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import type { RenderJob, RenderOut } from './protocol';

interface WorkerScope {
  postMessage(message: RenderOut, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<RenderJob>) => void) | null;
}

interface OpenDoc {
  proxy: import('pdfjs-dist').PDFDocumentProxy;
}

const worker = globalThis as unknown as WorkerScope;
const docs = new Map<string, OpenDoc>();
const skipped = new Set<string>();
let currentRender: { token: string; cancel: () => void } | null = null;

GlobalWorkerOptions.workerPort = new PdfJsWorker();

function skipKey(docId: string, pageIndex: number, gen: number): string {
  return `${docId}:${pageIndex}:${gen}`;
}

function isPassword(error: unknown): boolean {
  if (error instanceof PasswordException) return true;
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  return name === 'PasswordException';
}

function fail(id: number, error: unknown): void {
  const kind = isPassword(error) ? 'encrypted' : error instanceof Error && error.message === 'empty' ? 'empty' : 'damaged';
  const message: RenderOut = { id, type: 'error', kind };
  worker.postMessage(message);
}

let chain: Promise<void> = Promise.resolve();

worker.onmessage = (event: MessageEvent<RenderJob>) => {
  const job = event.data;
  if (job.type === 'cancel') {
    const token = skipKey(job.docId, job.pageIndex, job.gen);
    skipped.add(token);
    if (currentRender?.token === token) currentRender.cancel();
    return;
  }
  chain = chain.then(() => run(job)).catch(() => undefined);
};

async function run(job: Exclude<RenderJob, { type: 'cancel' }>): Promise<void> {
  try {
    if (job.type === 'open') await open(job);
    else if (job.type === 'boxes') await boxes(job);
    else if (job.type === 'render') await render(job);
    else if (job.type === 'text') await text(job);
    else await close(job);
  } catch (error) {
    fail(job.id, error);
  }
}

async function open(job: Extract<RenderJob, { type: 'open' }>): Promise<void> {
  const task = getDocument({
    data: job.bytes,
    useWasm: false,
    useWorkerFetch: false,
    useSystemFonts: true,
    disableFontFace: true,
    disableStream: true,
    disableAutoFetch: true,
    disableRange: true,
    verbosity: 0,
  });
  const proxy = await task.promise;
  if (proxy.numPages < 1) {
    await proxy.cleanup();
    throw new Error('empty');
  }
  const previous = docs.get(job.docId);
  if (previous) await previous.proxy.cleanup();
  docs.set(job.docId, { proxy });
  const page = await proxy.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  page.cleanup();
  const message: RenderOut = {
    id: job.id,
    type: 'opened',
    pageCount: proxy.numPages,
    width: viewport.width,
    height: viewport.height,
  };
  worker.postMessage(message);
}

async function boxes(job: Extract<RenderJob, { type: 'boxes' }>): Promise<void> {
  const doc = docs.get(job.docId);
  if (!doc) throw new Error('missing');
  const total = doc.proxy.numPages;
  const list: Array<{ width: number; height: number }> = [];
  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    const page = await doc.proxy.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    list.push({ width: viewport.width, height: viewport.height });
    page.cleanup();
    if (pageNumber === total || pageNumber % 16 === 0) {
      const progress: RenderOut = { id: job.id, type: 'progress', done: pageNumber, total };
      worker.postMessage(progress);
    }
  }
  const message: RenderOut = { id: job.id, type: 'boxes', boxes: list };
  worker.postMessage(message);
}

async function render(job: Extract<RenderJob, { type: 'render' }>): Promise<void> {
  const token = skipKey(job.docId, job.pageIndex, job.gen);
  if (skipped.has(token)) {
    skipped.delete(token);
    const message: RenderOut = { id: job.id, type: 'thumb', bytes: null };
    worker.postMessage(message);
    return;
  }
  const doc = docs.get(job.docId);
  if (!doc) throw new Error('missing');
  const page = await doc.proxy.getPage(job.pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: job.cssWidth / Math.max(base.width, 1) });
  const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  const task = page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport, annotationMode: 0 });
  currentRender = { token, cancel: () => task.cancel() };
  try {
    await task.promise;
  } catch (error) {
    currentRender = null;
    page.cleanup();
    if (skipped.has(token)) {
      skipped.delete(token);
      const message: RenderOut = { id: job.id, type: 'thumb', bytes: null };
      worker.postMessage(message);
      return;
    }
    throw error;
  }
  currentRender = null;
  page.cleanup();
  if (skipped.has(token)) {
    skipped.delete(token);
    const message: RenderOut = { id: job.id, type: 'thumb', bytes: null };
    worker.postMessage(message);
    return;
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
  const bytes = await blob.arrayBuffer();
  const message: RenderOut = { id: job.id, type: 'thumb', bytes };
  worker.postMessage(message, [bytes]);
}

function warmPdf(): Uint8Array {
  const text = 'BT /F1 18 Tf 40 200 Td (Warm selectable) Tj ET';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${text.length} >>\nstream\n${text}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets[index + 1] = body.length;
    body += objects[index];
  }
  const xrefAt = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(body + xref);
}

async function text(job: Extract<RenderJob, { type: 'text' }>): Promise<void> {
  const doc = docs.get(job.docId);
  if (!doc) throw new Error('missing');
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.proxy.numPages; pageNumber += 1) {
    const page = await doc.proxy.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(line);
    page.cleanup();
  }
  const message: RenderOut = { id: job.id, type: 'text', pages };
  worker.postMessage(message);
}

async function warm(): Promise<void> {
  // The first real page render pays for pdf.js startup. Do that while the
  // proof still says the tools are loading, so a dropped file's first
  // thumbnail does not.
  const task = getDocument({
    data: warmPdf(),
    useWasm: false,
    useWorkerFetch: false,
    useSystemFonts: true,
    disableFontFace: true,
    disableStream: true,
    disableAutoFetch: true,
    disableRange: true,
    verbosity: 0,
  });
  const proxy = await task.promise;
  const page = await proxy.getPage(1);
  const viewport = page.getViewport({ scale: 96 / 612 });
  const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport, annotationMode: 0 }).promise;
  page.cleanup();
  await proxy.cleanup();
}

void warm()
  .catch(() => undefined)
  .finally(() => {
    worker.postMessage({ type: 'ready' });
  });

async function close(job: Extract<RenderJob, { type: 'close' }>): Promise<void> {
  const doc = docs.get(job.docId);
  if (doc) {
    await doc.proxy.cleanup();
    docs.delete(job.docId);
  }
  const message: RenderOut = { id: job.id, type: 'closed' };
  worker.postMessage(message);
}
