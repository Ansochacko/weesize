export interface ToolPreset {
  pdfTargetKb?: number;
  imageTargetKb?: number;
  imageMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  pages?: string;
  gray?: boolean;
  presetId?: string;
}

let current: ToolPreset | null = null;

export function setToolPreset(preset: ToolPreset | null): void {
  current = preset;
}

export function toolPreset(): ToolPreset | null {
  return current;
}

export function formatTarget(kb: number): string {
  if (kb >= 1024 && kb % 1024 === 0) return `${kb / 1024} MB`;
  return `${kb} KB`;
}
