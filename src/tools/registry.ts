import type { ToolIconName } from '../lib/icons';

export type CategoryId = 'optimize' | 'organize' | 'to-pdf' | 'from-pdf' | 'edit' | 'security';

export type ToolBadge = 'Beta';

export type ToolStatus = 'ready' | 'beta' | 'coming-soon';

export interface ToolInfo {
  id: string;
  icon: ToolIconName;
  name: string;
  description: string;
  category: CategoryId;
  synonyms: string[];
  badges?: ToolBadge[];
  status: ToolStatus;
  /** @deprecated Kept for backward compatibility */
  state?: 'ready' | 'limited';
  popular?: boolean;
}

export const CATEGORIES: Array<{ id: CategoryId; label: string; color: string }> = [
  { id: 'optimize', label: 'Exact size & photo tools', color: 'var(--cat-optimize)' },
  { id: 'organize', label: 'Organize PDF', color: 'var(--cat-organize)' },
  { id: 'to-pdf', label: 'Convert to PDF', color: 'var(--cat-to)' },
  { id: 'from-pdf', label: 'Convert from PDF', color: 'var(--cat-from)' },
  { id: 'edit', label: 'Page stamps & numbers', color: 'var(--cat-edit)' },
  { id: 'security', label: 'Security & privacy', color: 'var(--cat-security)' },
];

export const CORE: ToolInfo[] = [
  // Core Focus Tools
  { id: 'compress', icon: 'compress-pdf', name: 'Compress PDF', description: 'Compress PDFs to exact KB target or reduction level without losing clarity.', category: 'optimize', synonyms: ['shrink', 'smaller', 'reduce', 'compress pdf to size'], popular: true, status: 'ready', state: 'ready' },
  { id: 'compress-images', icon: 'compress-images', name: 'Compress image', description: 'Make photos, signatures and scans smaller to exact KB size.', category: 'optimize', synonyms: ['jpg', 'jpeg', 'photo', 'png', 'webp', 'compress image', 'reduce photo size'], popular: true, status: 'ready', state: 'ready' },
  { id: 'signature-resizer', icon: 'sign-fill', name: 'Signature resizer', description: 'Clean background to white, darken ink, and resize to exact KB and pixels.', category: 'optimize', synonyms: ['signature', 'resize signature', 'sign', 'darken signature', 'jee signature', 'neet signature'], popular: true, status: 'ready', state: 'ready' },
  { id: 'id-photo', icon: 'id-photo', name: 'ID & passport photo', description: 'Crop photos to exact passport dimensions in px, mm, or inches with plain background.', category: 'optimize', synonyms: ['passport photo', 'headshot', 'visa photo', 'id photo'], popular: true, status: 'ready', state: 'ready' },
  { id: 'presets', icon: 'get-accepted', name: 'Get it accepted', description: 'Check a file against verified upload rules or apply a custom requirement.', category: 'optimize', synonyms: ['passport', 'visa', 'photo rules', 'accepted', 'requirements', 'custom rule'], status: 'ready', state: 'ready' },
  { id: 'repair', icon: 'repair-pdf', name: 'Repair PDF', description: 'Rebuild a damaged PDF structure so it can be opened again.', category: 'optimize', synonyms: ['fix', 'damaged', 'recover'], status: 'ready', state: 'ready' },

  // More PDF tools (Organize)
  { id: 'merge', icon: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDFs in any order into one document.', category: 'organize', synonyms: ['combine', 'join', 'append'], popular: true, status: 'ready', state: 'ready' },
  { id: 'split', icon: 'split-pdf', name: 'Split PDF', description: 'Extract specific pages or split a PDF into separate files.', category: 'organize', synonyms: ['extract', 'separate', 'range'], popular: true, status: 'ready', state: 'ready' },
  { id: 'organize', icon: 'organize-pages', name: 'Organize pages', description: 'Reorder, rotate, delete, and insert pages visually.', category: 'organize', synonyms: ['reorder', 'arrange', 'delete pages'], popular: true, status: 'ready', state: 'ready' },
  { id: 'rotate', icon: 'rotate-pdf', name: 'Rotate PDF', description: 'Fix orientation for sideways or upside-down pages.', category: 'organize', synonyms: ['turn', 'landscape', 'portrait'], status: 'ready', state: 'ready' },
  { id: 'crop', icon: 'crop-pdf', name: 'Crop PDF', description: 'Trim margins from all pages evenly.', category: 'organize', synonyms: ['trim', 'margin', 'cut'], status: 'ready', state: 'ready' },

  // Convert
  { id: 'images', icon: 'images-to-pdf', name: 'Images to PDF', description: 'Turn JPG, PNG, and WebP photos into a PDF document.', category: 'to-pdf', synonyms: ['jpg', 'png', 'photos to pdf', 'image to pdf'], popular: true, status: 'ready', state: 'ready' },
  { id: 'pdf-images', icon: 'pdf-to-images', name: 'PDF to images', description: 'Extract each page as a high-quality JPEG image.', category: 'from-pdf', synonyms: ['jpg', 'png', 'export images', 'pdf to jpg'], status: 'ready', state: 'ready' },

  // Page edits & stamps
  { id: 'numbers', icon: 'page-numbers', name: 'Page numbers', description: 'Add page numbers to the header or footer of each page.', category: 'edit', synonyms: ['paginate', 'footer', 'number'], status: 'ready', state: 'ready' },
  { id: 'watermark', icon: 'watermark', name: 'Watermark', description: 'Stamp text or confidentiality notices across every page.', category: 'edit', synonyms: ['stamp', 'draft', 'confidential'], status: 'ready', state: 'ready' },

  // Security & privacy
  { id: 'share-check', icon: 'safe-share', name: 'Safe to share', description: 'Inspect and remove hidden metadata, location, and edit history.', category: 'security', synonyms: ['metadata', 'hidden text', 'before sending', 'exif', 'sanitize'], status: 'ready', state: 'ready' },
];

export const TOOLS: readonly ToolInfo[] = CORE;

const byId = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function toolById(id: string): ToolInfo | undefined {
  return byId.get(id);
}

export function isToolActive(tool: ToolInfo): boolean {
  return tool.status === 'ready' || tool.status === 'beta';
}

export function activeTools(): ToolInfo[] {
  return TOOLS.filter(isToolActive);
}

export function comingSoonTools(): ToolInfo[] {
  return TOOLS.filter((tool) => tool.status === 'coming-soon');
}

export function activeToolsCount(): number {
  return activeTools().length;
}

export function toolsIn(category: CategoryId): ToolInfo[] {
  return activeTools().filter((tool) => tool.category === category);
}

export function popularTools(): ToolInfo[] {
  return TOOLS.filter((tool) => tool.status === 'ready' && tool.popular);
}

export function searchTools(query: string): ToolInfo[] {
  const q = query.trim().toLowerCase();
  const pool = activeTools();
  if (!q) return [...pool];
  return pool.filter((tool) => {
    const hay = [tool.name, tool.description, ...tool.synonyms].join(' ').toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => rank(b, q) - rank(a, q));
}

function rank(tool: ToolInfo, q: string): number {
  if (tool.name.toLowerCase().startsWith(q)) return 3;
  if (tool.synonyms.some((word) => word.includes(q))) return 2;
  return 1;
}
