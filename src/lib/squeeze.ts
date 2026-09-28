import encodeJpeg, { init } from '@jsquash/jpeg/encode.js';
import { jpegWasm } from './jpeg-wasm';

const start = init as (module?: WebAssembly.Module) => Promise<void>;

let opening: Promise<void> | null = null;

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function prepare(): Promise<void> {
  if (!opening) {
    opening = (async () => {
      const bytes = decode(jpegWasm);
      const wasm = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const module = await WebAssembly.compile(wasm);
      await start(module);
    })();
  }
  return opening;
}

export async function squeezeJpeg(image: ImageData, quality: number): Promise<ArrayBuffer> {
  await prepare();
  const score = Math.max(1, Math.min(100, Math.round(quality * 100)));
  const encoded = await encodeJpeg(image, { quality: score });
  return encoded;
}
