import { inflateSync } from 'fflate';
import { squeezeJpeg } from '../lib/squeeze';
import type { CompressJob, CompressOut } from './protocol';

interface WorkerScope {
  postMessage(message: CompressOut, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<CompressJob>) => void) | null;
}

const worker = globalThis as unknown as WorkerScope;

function targetSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function bitmapFrom(source: Blob | ImageData, size: { width: number; height: number }, resize: 'high' | 'medium'): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: resize,
    });
  } catch {
    const bitmap = await createImageBitmap(source);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return bitmap;
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    return createImageBitmap(canvas);
  }
}

function flateImage(bytes: ArrayBuffer, width: number, height: number, gray: boolean): ImageData {
  const raw = inflateSync(new Uint8Array(bytes));
  const image = new ImageData(width, height);
  const pixels = image.data;
  const count = width * height;
  if (gray) {
    for (let index = 0, pixel = 0; index < count; index += 1, pixel += 4) {
      const value = raw[index] ?? 0;
      pixels[pixel] = value;
      pixels[pixel + 1] = value;
      pixels[pixel + 2] = value;
      pixels[pixel + 3] = 255;
    }
  } else {
    for (let index = 0, pixel = 0; index < count; index += 1, pixel += 4) {
      const offset = index * 3;
      pixels[pixel] = raw[offset] ?? 0;
      pixels[pixel + 1] = raw[offset + 1] ?? 0;
      pixels[pixel + 2] = raw[offset + 2] ?? 0;
      pixels[pixel + 3] = 255;
    }
  }
  return image;
}

function washGray(image: ImageData): void {
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const tone = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
    pixels[index] = tone;
    pixels[index + 1] = tone;
    pixels[index + 2] = tone;
  }
}

async function shrink(job: CompressJob): Promise<{ bytes: ArrayBuffer; width: number; height: number } | null> {
  const size = targetSize(job.width, job.height, job.maxEdge);
  const source =
    job.kind === 'jpeg'
      ? new Blob([job.bytes], { type: 'image/jpeg' })
      : job.kind === 'bitmap'
        ? new Blob([job.bytes], { type: 'image/png' })
        : flateImage(job.bytes, job.width, job.height, job.kind === 'flate-gray');
  const bitmap = await bitmapFrom(source, size, job.resize);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: job.grayscale || job.squeeze });
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  if (job.grayscale || job.squeeze) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (job.grayscale) washGray(image);
    if (job.squeeze) {
      const encoded = await squeezeJpeg(image, job.quality);
      if (encoded.byteLength >= job.bytes.byteLength) return null;
      return { bytes: encoded, width: canvas.width, height: canvas.height };
    }
    ctx.putImageData(image, 0, 0);
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: job.quality });
  const next = await blob.arrayBuffer();
  if (next.byteLength >= job.bytes.byteLength) return null;
  return { bytes: next, width: canvas.width, height: canvas.height };
}

worker.postMessage({ type: 'ready' });

worker.onmessage = (event: MessageEvent<CompressJob>) => {
  const job = event.data;
  shrink(job)
    .then((result) => {
      if (!result) {
        const message: CompressOut = { id: job.id, type: 'done', bytes: null, width: job.width, height: job.height };
        worker.postMessage(message);
        return;
      }
      const message: CompressOut = {
        id: job.id,
        type: 'done',
        bytes: result.bytes,
        width: result.width,
        height: result.height,
      };
      worker.postMessage(message, [result.bytes]);
    })
    .catch(() => {
      const message: CompressOut = { id: job.id, type: 'error' };
      worker.postMessage(message);
    });
};
