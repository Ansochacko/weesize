import { LARGE_FILE_BYTES, rejectedMessage } from './dom';

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function isImageFile(file: File): boolean {
  return /image\/(jpeg|png|webp|gif|heic|avif)/i.test(file.type) || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(file.name);
}

export type ToolRoute = 'compress' | 'merge' | 'split' | 'organize' | 'images';

export interface Offer {
  route: string;
  label: string;
  primary: boolean;
  files: File[];
}

export interface Detection {
  offers: Offer[];
  note: string | null;
  warning: string | null;
}

export function detectFiles(files: File[]): Detection {
  const pdfs = files.filter(isPdfFile);
  const images = files.filter(isImageFile);
  const rejected = files.filter((file) => !isPdfFile(file) && !isImageFile(file) && !officeRoute(file));
  const offers: Offer[] = [];
  const office = files.map(officeRoute).filter((route): route is string => route !== null);
  const officeOnly = office.length === files.length && new Set(office).size === 1;
  if (officeOnly && office[0]) {
    offers.push({ route: office[0], label: 'Convert to PDF', primary: true, files });
  } else if (pdfs.length === 1 && images.length === 0) {
    offers.push(
      { route: 'compress', label: 'Compress PDF', primary: true, files: pdfs },
      { route: 'sign', label: 'Sign & fill', primary: false, files: pdfs },
      { route: 'split', label: 'Split', primary: false, files: pdfs },
      { route: 'organize', label: 'Organize', primary: false, files: pdfs },
      { route: 'redact', label: 'Redact', primary: false, files: pdfs },
      { route: 'ocr', label: 'Make searchable', primary: false, files: pdfs },
    );
  } else if (pdfs.length > 1 && images.length === 0) {
    offers.push(
      { route: 'merge', label: 'Merge PDF', primary: true, files: pdfs },
      { route: 'compress', label: 'Compress all', primary: false, files: pdfs },
    );
  } else if (images.length > 0 && pdfs.length === 0) {
    offers.push(
      { route: 'compress-images', label: 'Compress images', primary: true, files: images },
      { route: 'images', label: 'Images to PDF', primary: false, files: images },
    );
  } else if (pdfs.length > 0 && images.length > 0) {
    if (pdfs.length > 1) offers.push({ route: 'merge', label: 'Merge', primary: true, files: pdfs });
    else offers.push({ route: 'compress', label: 'Compress', primary: true, files: pdfs });
    offers.push({ route: 'images', label: 'Images to PDF', primary: false, files: images });
  }
  const note = rejected.length
    ? rejectedMessage(rejected, "isn't a PDF or an image.")
    : pdfs.length > 0 && images.length > 0
      ? 'PDFs and images were both included. Pick what to open.'
      : null;
  const heavy = files.some((file) => file.size > LARGE_FILE_BYTES);
  const warning = heavy ? 'A file is over 150 MB. It stays on this device, and a file this large can take a while.' : null;
  return { offers, note, warning };
}

function officeRoute(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return 'word';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
  if (name.endsWith('.pptx')) return 'ppt';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
  return null;
}

export function imagesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (const item of data.items) {
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const type = file.type || 'image/png';
    const extension = type.includes('jpeg') ? 'jpg' : type.split('/')[1] || 'png';
    files.push(new File([file], `pasted-image.${extension}`, { type }));
  }
  return files;
}
