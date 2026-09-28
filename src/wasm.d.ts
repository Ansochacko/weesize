declare module '@jsquash/jpeg/encode.js' {
  export function init(module?: WebAssembly.Module): Promise<void>;
  export default function encode(data: ImageData, options?: { quality?: number }): Promise<ArrayBuffer>;
}
