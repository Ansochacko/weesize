export interface ScanImage {
  key: string;
  width: number;
  height: number;
  bytes: number;
  kind: 'jpeg' | 'flate-rgb' | 'flate-gray';
}

export interface ImagePlacement {
  bytes: ArrayBuffer;
  kind: 'jpg' | 'png';
  width: number;
  height: number;
}

export interface ImageOptions {
  pageSize: 'image' | 'a4' | 'letter';
  orientation: 'auto' | 'portrait' | 'landscape';
  margin: 'none' | 'small' | 'large';
}

export type PdfEdit =
  | { kind: 'rotate'; turns: 1 | 2 | 3 }
  | { kind: 'crop'; points: number }
  | { kind: 'watermark'; text: string }
  | { kind: 'numbers'; start: number; skipFirst: boolean }
  | { kind: 'repair' }
  | { kind: 'textpdf'; lines: string[] };

export type PdfJob =
  | { id: number; type: 'merge'; docs: ArrayBuffer[] }
  | { id: number; type: 'edit'; bytes: ArrayBuffer; edit: PdfEdit }
  | { id: number; type: 'split'; bytes: ArrayBuffer; groups: number[][] }
  | { id: number; type: 'organize'; bytes: ArrayBuffer; pages: Array<{ index: number; rotation: number }> }
  | { id: number; type: 'images'; images: ImagePlacement[]; options: ImageOptions }
  | { id: number; type: 'prescan'; docId: string; bytes: ArrayBuffer }
  | { id: number; type: 'extract'; docId: string; keys: string[] }
  | { id: number; type: 'apply'; docId: string; items: Array<{ key: string; bytes: ArrayBuffer; width: number; height: number }> }
  | { id: number; type: 'release'; docId: string }
  | { type: 'cancel'; id: number };

export type PdfOut =
  | { type: 'ready' }
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'files'; files: ArrayBuffer[] }
  | { id: number; type: 'scan'; images: ScanImage[] }
  | { id: number; type: 'extracted'; images: Array<{ key: string; bytes: ArrayBuffer }> }
  | { id: number; type: 'applied'; bytes: ArrayBuffer; unchanged: boolean }
  | { id: number; type: 'released' }
  | { id: number; type: 'error'; kind: 'encrypted' | 'damaged' | 'cancelled' | 'empty' };

export interface TextPosition {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export type RenderJob =
  | { id: number; type: 'open'; docId: string; bytes: ArrayBuffer }
  | { id: number; type: 'boxes'; docId: string }
  | { id: number; type: 'render'; docId: string; pageIndex: number; cssWidth: number; gen: number }
  | { id: number; type: 'text'; docId: string }
  | { id: number; type: 'tables'; docId: string }
  | { id: number; type: 'textPositions'; docId: string }
  | { id: number; type: 'close'; docId: string }
  | { type: 'cancel'; docId: string; pageIndex: number; gen: number };

export type RenderOut =
  | { type: 'ready' }
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'opened'; pageCount: number; width: number; height: number }
  | { id: number; type: 'boxes'; boxes: Array<{ width: number; height: number }> }
  | { id: number; type: 'thumb'; bytes: ArrayBuffer | null }
  | { id: number; type: 'text'; pages: string[] }
  | { id: number; type: 'tables'; pages: Array<string[][]> }
  | { id: number; type: 'textPositions'; pages: Array<TextPosition[]> }
  | { id: number; type: 'closed' }
  | { id: number; type: 'error'; kind: 'encrypted' | 'damaged' | 'empty' };

export interface CompressJob {
  id: number;
  bytes: ArrayBuffer;
  width: number;
  height: number;
  kind: 'jpeg' | 'bitmap' | 'flate-rgb' | 'flate-gray';
  maxEdge: number;
  quality: number;
  resize: 'high' | 'medium';
  grayscale: boolean;
  squeeze: boolean;
}

export type CompressOut =
  | { type: 'ready' }
  | { id: number; type: 'done'; bytes: ArrayBuffer | null; width: number; height: number }
  | { id: number; type: 'error' };
