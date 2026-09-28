export interface StagedBytes {
  name: string;
  bytes: Uint8Array;
}

let staged: StagedBytes[] | null = null;

export function stageBytes(files: StagedBytes[]): void {
  staged = files;
}

export function fileFromBytes(name: string, bytes: Uint8Array, type: string): File {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([copy], name, { type });
}

export function takeStagedBytes(): StagedBytes[] | null {
  const next = staged;
  staged = null;
  return next;
}
