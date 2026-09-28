import CompressWorker from './compress.worker?worker';
import PdfWorker from './pdf.worker?worker';
import RenderWorker from './render.worker?worker';
import type { CompressJob, CompressOut, PdfJob, PdfOut, RenderJob, RenderOut } from './protocol';

type PdfRequest = Exclude<PdfJob, { type: 'cancel' }>;
type RenderRequest = Exclude<RenderJob, { type: 'cancel' }>;

interface Waiter<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  onProgress: ((done: number, total: number) => void) | null;
}

export class WorkerFailure extends Error {
  readonly kind: 'encrypted' | 'damaged' | 'cancelled' | 'empty' | 'failed';

  constructor(kind: WorkerFailure['kind']) {
    super(kind);
    this.name = 'WorkerFailure';
    this.kind = kind;
  }
}

let pdf: Worker | null = null;
let render: Worker | null = null;
const compressors: Worker[] = [];
const freeCompressors: Worker[] = [];
let starting: Promise<void> | null = null;
let pdfSeq = 1;
let renderSeq = 1;
let compressSeq = 1;

const pdfWaiters = new Map<number, Waiter<PdfOut>>();
const renderWaiters = new Map<number, Waiter<RenderOut>>();

interface CompressTask {
  payload: Omit<CompressJob, 'id'>;
  transfer: ArrayBuffer;
  resolve: (value: { bytes: ArrayBuffer | null; width: number; height: number }) => void;
  reject: (error: Error) => void;
}

const compressQueue: CompressTask[] = [];
const compressWaiters = new Map<number, CompressTask>();

function cancelled(): Error {
  const error = new Error('cancelled');
  error.name = 'Cancelled';
  return error;
}

function whenReady(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (event: MessageEvent<{ type?: string }>) => {
      if (event.data.type !== 'ready') return;
      worker.removeEventListener('message', done);
      worker.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      worker.removeEventListener('message', done);
      reject(new WorkerFailure('failed'));
    };
    worker.addEventListener('message', done);
    worker.addEventListener('error', fail);
  });
}

function bindPdf(worker: Worker): void {
  worker.addEventListener('message', (event: MessageEvent<PdfOut>) => {
    const data = event.data;
    if (data.type === 'ready' || !('id' in data)) return;
    const waiter = pdfWaiters.get(data.id);
    if (!waiter) return;
    if (data.type === 'progress') {
      waiter.onProgress?.(data.done, data.total);
      return;
    }
    pdfWaiters.delete(data.id);
    if (data.type === 'error') waiter.reject(new WorkerFailure(data.kind));
    else waiter.resolve(data);
  });
  worker.addEventListener('error', () => {
    for (const [id, waiter] of pdfWaiters) {
      pdfWaiters.delete(id);
      waiter.reject(new WorkerFailure('failed'));
    }
  });
}

function bindRender(worker: Worker): void {
  worker.addEventListener('message', (event: MessageEvent<RenderOut>) => {
    const data = event.data;
    if (data.type === 'ready' || !('id' in data)) return;
    const waiter = renderWaiters.get(data.id);
    if (!waiter) return;
    if (data.type === 'progress') {
      waiter.onProgress?.(data.done, data.total);
      return;
    }
    renderWaiters.delete(data.id);
    if (data.type === 'error') waiter.reject(new WorkerFailure(data.kind));
    else waiter.resolve(data);
  });
  worker.addEventListener('error', () => {
    for (const [id, waiter] of renderWaiters) {
      renderWaiters.delete(id);
      waiter.reject(new WorkerFailure('failed'));
    }
  });
}

function pumpCompress(): void {
  while (compressQueue.length > 0 && freeCompressors.length > 0) {
    const worker = freeCompressors.pop();
    const task = compressQueue.shift();
    if (!worker || !task) return;
    const id = compressSeq;
    compressSeq += 1;
    compressWaiters.set(id, task);
    const message: CompressJob = { ...task.payload, id };
    worker.postMessage(message, [task.transfer]);
  }
}

function bindCompress(worker: Worker): void {
  worker.addEventListener('message', (event: MessageEvent<CompressOut>) => {
    const data = event.data;
    if (data.type === 'ready') return;
    const task = compressWaiters.get(data.id);
    compressWaiters.delete(data.id);
    freeCompressors.push(worker);
    if (task) {
      if (data.type === 'error') task.reject(new WorkerFailure('failed'));
      else task.resolve({ bytes: data.bytes, width: data.width, height: data.height });
    }
    pumpCompress();
  });
  worker.addEventListener('error', () => {
    for (const [id, task] of compressWaiters) {
      compressWaiters.delete(id);
      task.reject(new WorkerFailure('failed'));
    }
  });
}

export function startPool(): Promise<void> {
  if (starting) return starting;
  pdf = new PdfWorker();
  render = new RenderWorker();
  bindPdf(pdf);
  bindRender(render);
  const count = Math.min(6, Math.max(1, navigator.hardwareConcurrency || 2));
  for (let index = 0; index < count; index += 1) {
    const worker = new CompressWorker();
    compressors.push(worker);
    freeCompressors.push(worker);
    bindCompress(worker);
  }
  starting = Promise.all([whenReady(pdf), whenReady(render), ...compressors.map((worker) => whenReady(worker))]).then(
    () => undefined,
  );
  return starting;
}

export function workerCount(): number {
  return compressors.length;
}

function pdfWorker(): Worker {
  if (!pdf) throw new WorkerFailure('failed');
  return pdf;
}

function renderWorker(): Worker {
  if (!render) throw new WorkerFailure('failed');
  return render;
}

export function askPdf(
  request: Omit<PdfRequest, 'id'>,
  transfer: ArrayBuffer[],
  onProgress?: (done: number, total: number) => void,
): { id: number; result: Promise<PdfOut> } {
  const worker = pdfWorker();
  const id = pdfSeq;
  pdfSeq += 1;
  const result = new Promise<PdfOut>((resolve, reject) => {
    pdfWaiters.set(id, { resolve, reject, onProgress: onProgress ?? null });
    worker.postMessage({ ...request, id }, transfer);
  });
  return { id, result };
}

export function cancelPdf(id: number): void {
  pdfWorker().postMessage({ type: 'cancel', id });
}

export function askRender(
  request: Omit<RenderRequest, 'id'>,
  transfer: ArrayBuffer[],
  onProgress?: (done: number, total: number) => void,
): Promise<RenderOut> {
  const worker = renderWorker();
  const id = renderSeq;
  renderSeq += 1;
  return new Promise((resolve, reject) => {
    renderWaiters.set(id, { resolve, reject, onProgress: onProgress ?? null });
    worker.postMessage({ ...request, id }, transfer);
  });
}

export function cancelRender(docId: string, pageIndex: number, gen: number): void {
  if (!render) return;
  const message: RenderJob = { type: 'cancel', docId, pageIndex, gen };
  render.postMessage(message);
}

export function compressImage(payload: Omit<CompressJob, 'id'>, transfer: ArrayBuffer): Promise<{ bytes: ArrayBuffer | null; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    compressQueue.push({ payload, transfer, resolve, reject });
    pumpCompress();
  });
}

export function cancelQueuedCompress(): void {
  const waiting = compressQueue.splice(0);
  for (const task of waiting) task.reject(cancelled());
}
