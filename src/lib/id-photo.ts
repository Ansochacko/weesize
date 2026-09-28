/** Crop math for ID photos. Pixels are copied. Nothing here smooths, reshapes, or relights a face. */

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetSlot {
  x: number;
  y: number;
}

export function centerCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CropRect {
  const aspect = targetWidth / targetHeight;
  let width = sourceWidth;
  let height = Math.round(sourceWidth / aspect);
  if (height > sourceHeight) {
    height = sourceHeight;
    width = Math.round(sourceHeight * aspect);
  }
  width = Math.max(1, Math.min(sourceWidth, width));
  height = Math.max(1, Math.min(sourceHeight, height));
  return {
    x: Math.max(0, Math.round((sourceWidth - width) / 2)),
    y: Math.max(0, Math.round((sourceHeight - height) / 2)),
    width,
    height,
  };
}

/** 4×6 in at 300 dots per inch, which is the same sheet as 10×15 cm. */
export const PRINT_SHEET = { width: 1800, height: 1200, dpi: 300 };

export function sheetSlots(photoWidth: number, photoHeight: number, gap = 36): SheetSlot[] {
  const slots: SheetSlot[] = [];
  const { width, height } = PRINT_SHEET;
  for (let y = gap; y + photoHeight <= height - gap; y += photoHeight + gap) {
    for (let x = gap; x + photoWidth <= width - gap; x += photoWidth + gap) {
      slots.push({ x, y });
    }
  }
  return slots;
}

export interface CornerSample {
  uniform: boolean;
  detail: string;
}

/** Compares the four corners of an RGBA buffer. A similar corner color is a signal, not a portrait approval. */
export function cornerUniformity(rgba: Uint8ClampedArray, width: number, height: number): CornerSample {
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * width + x) * 4;
    return [rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0];
  };
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const first = corners[0] ?? [0, 0, 0];
  const spread = corners.reduce((max, pixel) => {
    const delta = Math.max(Math.abs(pixel[0] - first[0]), Math.abs(pixel[1] - first[1]), Math.abs(pixel[2] - first[2]));
    return Math.max(max, delta);
  }, 0);
  if (spread <= 18) return { uniform: true, detail: 'The four corners are a similar color. That does not prove the background is accepted.' };
  return { uniform: false, detail: 'The corners differ, so the background may not be a plain color. Retake the photo if the rules ask for one.' };
}

export function backgroundEditAllowed(allow: boolean | null): { enabled: boolean; notice: string } {
  if (allow === false) {
    return { enabled: false, notice: 'This preset does not allow a replaced background, so that control stays off.' };
  }
  return {
    enabled: false,
    notice: 'Some offices don\'t accept edited backgrounds. Check your preset\'s rules. This version has no background model, so replacement stays off.',
  };
}
