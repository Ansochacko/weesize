import JSZip from 'jszip';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: mime,
  });
  downloadBlob(blob, filename);
}

export async function downloadZip(files: Array<{ name: string; bytes: Uint8Array }>, filename: string): Promise<void> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.bytes);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, filename);
}

export function savedMessage(filename: string): string {
  return `Saved ${filename}. Made on this device, never uploaded.`;
}

export function fileBase(name: string): string {
  const trimmed = name.replace(/\.[^.]+$/, '').replace(/[^\w.\- ()]+/g, '').trim();
  return trimmed || 'document';
}
