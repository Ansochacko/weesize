/** Public slugs for tools. Hash routes and short ids redirect here. */

export const TOOL_SLUG: Record<string, string> = {
  compress: 'compress-pdf',
  'compress-images': 'compress-image',
  'signature-resizer': 'signature-resizer',
  'id-photo': 'id-photo',
  presets: 'get-it-accepted',
  repair: 'repair-pdf',
  merge: 'merge-pdf',
  split: 'split-pdf',
  organize: 'organize-pdf',
  rotate: 'rotate-pdf',
  crop: 'crop-pdf',
  images: 'jpg-to-pdf',
  'pdf-images': 'pdf-to-jpg',
  numbers: 'add-page-numbers-to-pdf',
  watermark: 'watermark-pdf',
  'share-check': 'check-pdf-before-sending',
};

/**
 * Slugs of removed / deprecated tools that must 301-redirect to /tools
 */
export const REMOVED_TOOL_SLUGS = [
  'sign-pdf',
  'edit-pdf',
  'redact-pdf',
  'ocr-pdf',
  'protect-pdf',
  'unlock-pdf',
  'excel-to-pdf',
  'powerpoint-to-pdf',
  'pdf-to-excel',
  'pdf-to-powerpoint',
  'pdf-to-pdfa',
  'pdf-to-word',
  'pdf-to-markdown',
  'pdf-forms',
  'word-to-pdf',
  'html-to-pdf',
  'scan-to-pdf',
  'compare-pdf',
  'summarize-pdf',
  'translate-pdf',
  'pdf-workflows',
  'pdf-commands',
  'make-pdf-accessible',
  'is-this-pdf-signed',
  'chat-with-pdf',
  'hot-folders',
  'lite',
  'private-pdf-editor',
  'pdf-editor-without-upload',
];

const SLUG_TO_TOOL: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_SLUG).map(([id, slug]) => [slug, id]),
);

export interface ToolTarget {
  toolId: string;
  pdfTargetKb?: number;
  imageTargetKb?: number;
  imageMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  presetId?: string;
}

const PDF_TARGETS: Record<string, number> = {
  '20kb': 20,
  '50kb': 50,
  '100kb': 100,
  '150kb': 150,
  '200kb': 200,
  '300kb': 300,
  '500kb': 500,
  '1mb': 1024,
  '2mb': 2048,
  '5mb': 5120,
  '10mb': 10240,
};

const IMAGE_TARGETS: Record<string, number> = {
  '10kb': 10,
  '20kb': 20,
  '30kb': 30,
  '50kb': 50,
  '100kb': 100,
  '200kb': 200,
  '500kb': 500,
  '1mb': 1024,
};

export function hrefFor(route: string): string {
  if (!route || route === 'home') return '/';
  const slug = TOOL_SLUG[route] ?? route;
  return `/${slug}`;
}

export function legacyTarget(path: string): string | null {
  const clean = path.replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'home') return '/';
  if (TOOL_SLUG[clean]) return hrefFor(clean);
  if (REMOVED_TOOL_SLUGS.includes(clean)) return '/tools';
  if (clean === 'compare/ilovepdf-alternative') return '/alternatives/ilovepdf';
  if (clean === 'compare/smallpdf-alternative') return '/alternatives/smallpdf';
  return null;
}

export function targetFromPath(path: string): ToolTarget | null {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const tool = SLUG_TO_TOOL[clean];
  if (tool) return { toolId: tool };

  // Signature resizer targets
  const sigMatch = /^resize-signature-to-(\d+(?:kb|mb))$/.exec(clean);
  const sigKb = sigMatch?.[1] ? IMAGE_TARGETS[sigMatch[1]] : undefined;
  if (sigKb) return { toolId: 'signature-resizer', imageTargetKb: sigKb };
  if (clean === 'signature-resizer' || clean === 'resize-signature') return { toolId: 'signature-resizer' };

  // PDF targets
  const pdf = /^compress-pdf-to-(\d+(?:kb|mb))$/.exec(clean);
  const pdfKb = pdf?.[1] ? PDF_TARGETS[pdf[1]] : undefined;
  if (pdfKb) return { toolId: 'compress', pdfTargetKb: pdfKb };
  if (clean === 'compress-pdf-without-uploading' || clean === 'secure-pdf-compressor') return { toolId: 'compress' };
  if (clean === 'merge-pdf-offline') return { toolId: 'merge' };
  if (clean === 'offline-pdf-tools' || clean === 'pdf-tools-no-signup' || clean === 'pdf-tools-that-work-offline' || clean === 'free-pdf-compressor-no-watermark' || clean === 'free-pdf-tools-no-sign-up' || clean === 'private-pdf-tools' || clean === 'pdf-compressor-offline' || clean === 'free-pdf-tools-no-limit' || clean === 'open-source-pdf-tools' || clean === 'local-pdf-tools') return { toolId: 'compress' };
  if (clean.startsWith('compress-pdf-for-') || clean.startsWith('compress-pdf-on-') || clean.endsWith('-attachment-size-limit') || clean === 'whatsapp-pdf-size-limit') return { toolId: 'compress' };

  // Image targets
  const image = /^compress-image-to-(\d+(?:kb|mb))$/.exec(clean);
  const imageKb = image?.[1] ? IMAGE_TARGETS[image[1]] : undefined;
  if (imageKb) return { toolId: 'compress-images', imageTargetKb: imageKb };
  const jpg = /^compress-jpg-to-(\d+(?:kb|mb))$/.exec(clean);
  const jpgKb = jpg?.[1] ? IMAGE_TARGETS[jpg[1]] : undefined;
  if (jpgKb) return { toolId: 'compress-images', imageTargetKb: jpgKb, imageMime: 'image/jpeg' };
  const resize = /^resize-image-to-(\d+(?:kb|mb))$/.exec(clean);
  const resizeKb = resize?.[1] ? IMAGE_TARGETS[resize[1]] : undefined;
  if (resizeKb) return { toolId: 'compress-images', imageTargetKb: resizeKb, imageMime: 'image/jpeg' };
  if (clean === 'compress-png' || clean === 'reduce-photo-size' || clean === 'reduce-photo-size-for-online-application') return { toolId: 'compress-images', imageMime: 'image/jpeg' };

  const convert: Record<string, ToolTarget['imageMime']> = {
    'heic-to-jpg': 'image/jpeg',
    'webp-to-jpg': 'image/jpeg',
    'png-to-jpg': 'image/jpeg',
    'avif-to-jpg': 'image/jpeg',
    'jpg-to-png': 'image/png',
    'webp-to-png': 'image/png',
    'jpg-to-webp': 'image/webp',
  };
  if (convert[clean]) return { toolId: 'compress-images', imageMime: convert[clean] };
  if (clean === 'remove-metadata-from-pdf') return { toolId: 'share-check' };
  if (clean === 'help/url-parameters') return null;
  const preset = /^presets\/([a-z0-9-]+)$/.exec(clean);
  if (preset?.[1]) return { toolId: 'presets', presetId: preset[1] };
  return null;
}

export const PDF_SIZE_SLUGS = Object.keys(PDF_TARGETS).map((key) => `compress-pdf-to-${key}`);
export const IMAGE_SIZE_SLUGS = [
  ...Object.keys(IMAGE_TARGETS).map((key) => `compress-image-to-${key}`),
  'compress-jpg-to-20kb',
  'compress-jpg-to-50kb',
  'compress-jpg-to-100kb',
  'compress-jpg-to-200kb',
  'resize-image-to-20kb',
  'resize-image-to-50kb',
  'resize-image-to-100kb',
  'resize-signature-to-20kb',
  'resize-signature-to-50kb',
  'compress-png',
  'reduce-photo-size',
];
