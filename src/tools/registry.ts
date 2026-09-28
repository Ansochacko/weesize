import { brandName } from '../brand';
import type { ToolIconName } from '../lib/icons';

export type CategoryId = 'optimize' | 'organize' | 'to-pdf' | 'from-pdf' | 'edit' | 'security' | 'smart' | 'workflows';

export type ToolBadge = 'Beta' | 'New' | 'Needs Chrome AI';

export interface ToolInfo {
  id: string;
  icon: ToolIconName;
  name: string;
  description: string;
  category: CategoryId;
  synonyms: string[];
  badges?: ToolBadge[];
  /** ready tools open a working page. limited tools explain the boundary and do not pretend. */
  state: 'ready' | 'limited';
  limit?: string;
  popular?: boolean;
}

export const CATEGORIES: Array<{ id: CategoryId; label: string; color: string }> = [
  { id: 'optimize', label: 'Optimize', color: 'var(--cat-optimize)' },
  { id: 'organize', label: 'Organize', color: 'var(--cat-organize)' },
  { id: 'to-pdf', label: 'Convert to PDF', color: 'var(--cat-to)' },
  { id: 'from-pdf', label: 'Convert from PDF', color: 'var(--cat-from)' },
  { id: 'edit', label: 'Edit', color: 'var(--cat-edit)' },
  { id: 'security', label: 'Security', color: 'var(--cat-security)' },
  { id: 'smart', label: 'Smart', color: 'var(--cat-smart)' },
  { id: 'workflows', label: 'Workflows', color: 'var(--cat-organize)' },
];

const CORE: ToolInfo[] = [
  { id: 'compress', icon: 'compress-pdf', name: 'Compress PDF', description: 'Make PDFs smaller without losing quality.', category: 'optimize', synonyms: ['shrink', 'smaller', 'reduce'], popular: true, state: 'ready' },
  { id: 'compress-images', icon: 'compress-images', name: 'Compress images', description: 'Shrink photos and screenshots.', category: 'optimize', synonyms: ['jpg', 'jpeg', 'photo', 'png', 'webp'], state: 'ready' },
  { id: 'repair', icon: 'repair-pdf', name: 'Repair PDF', description: 'Rebuild a PDF so it can be opened again.', category: 'optimize', synonyms: ['fix', 'damaged', 'recover'], state: 'ready' },
  { id: 'merge', icon: 'merge-pdf', name: 'Merge PDF', description: 'Combine PDFs in any order.', category: 'organize', synonyms: ['combine', 'join', 'append'], popular: true, state: 'ready' },
  { id: 'split', icon: 'split-pdf', name: 'Split PDF', description: 'Extract pages or split into files.', category: 'organize', synonyms: ['extract', 'separate', 'range'], popular: true, state: 'ready' },
  { id: 'organize', icon: 'organize-pages', name: 'Organize pages', description: 'Reorder, rotate, delete and insert pages.', category: 'organize', synonyms: ['reorder', 'arrange', 'delete pages'], popular: true, state: 'ready' },
  { id: 'rotate', icon: 'rotate-pdf', name: 'Rotate PDF', description: 'Fix page orientation.', category: 'organize', synonyms: ['turn', 'landscape', 'portrait'], state: 'ready' },
  { id: 'crop', icon: 'crop-pdf', name: 'Crop PDF', description: 'Trim the same margin from every page.', category: 'organize', synonyms: ['trim', 'margin', 'cut'], state: 'ready' },
  { id: 'images', icon: 'images-to-pdf', name: 'Images to PDF', description: 'Turn images into a PDF.', category: 'to-pdf', synonyms: ['jpg', 'png', 'photos to pdf'], popular: true, state: 'ready' },
  { id: 'scan', icon: 'scan-to-pdf', name: 'Scan to PDF', description: 'Photograph pages and save them as a PDF.', category: 'to-pdf', synonyms: ['camera', 'scan', 'phone'], popular: true, state: 'ready', badges: ['Beta'] },
  { id: 'word', icon: 'word-to-pdf', name: 'Word to PDF', description: 'Turn a Word document into a PDF.', category: 'to-pdf', synonyms: ['docx', 'word'], state: 'ready', badges: ['Beta'] },
  { id: 'excel', icon: 'excel-to-pdf', name: 'Excel to PDF', description: 'Turn a spreadsheet into a PDF.', category: 'to-pdf', synonyms: ['xlsx', 'sheet', 'csv'], state: 'limited', limit: `Spreadsheet conversion is not in this version. ${brandName()} will not invent a layout it cannot check.` },
  { id: 'ppt', icon: 'powerpoint-to-pdf', name: 'PowerPoint to PDF', description: 'Turn slides into a PDF.', category: 'to-pdf', synonyms: ['pptx', 'slides'], state: 'limited', limit: 'Slide conversion is not in this version.' },
  { id: 'html', icon: 'html-to-pdf', name: 'HTML to PDF', description: 'Turn HTML you paste or upload into a PDF.', category: 'to-pdf', synonyms: ['html', 'webpage'], state: 'ready', badges: ['Beta'] },
  { id: 'pdf-images', icon: 'pdf-to-images', name: 'PDF to images', description: 'Save each page as a JPEG.', category: 'from-pdf', synonyms: ['jpg', 'png', 'export images'], state: 'ready' },
  { id: 'pdf-word', icon: 'pdf-to-word', name: 'PDF to Word', description: 'Save the text of a PDF as a Word document.', category: 'from-pdf', synonyms: ['docx', 'word'], popular: true, state: 'ready', badges: ['Beta'] },
  { id: 'pdf-excel', icon: 'pdf-to-excel', name: 'PDF to Excel', description: 'Pull tables out of a PDF.', category: 'from-pdf', synonyms: ['xlsx', 'table', 'sheet'], state: 'limited', limit: 'Table detection is not in this version. A guessed spreadsheet could move numbers.' },
  { id: 'pdf-ppt', icon: 'pdf-to-powerpoint', name: 'PDF to PowerPoint', description: 'Put each page on a slide.', category: 'from-pdf', synonyms: ['pptx', 'slides'], state: 'limited', limit: 'Slide export is not in this version.' },
  { id: 'pdf-md', icon: 'pdf-to-markdown', name: 'PDF to Markdown', description: 'Copy the text of a PDF as Markdown.', category: 'from-pdf', synonyms: ['md', 'markdown', 'text'], state: 'ready' },
  { id: 'pdfa', icon: 'pdf-to-pdfa', name: 'PDF to PDF/A', description: 'Prepare a PDF for long-term storage.', category: 'from-pdf', synonyms: ['archival', 'pdfa'], state: 'limited', badges: ['Beta'], limit: `${brandName()} will not mark a file as archival unless it can check the result. That check is not in this version.` },
  { id: 'edit', icon: 'edit-pdf', name: 'Edit PDF', description: 'Add text and shapes to a PDF.', category: 'edit', synonyms: ['annotate', 'draw', 'text'], state: 'limited', limit: 'Freehand editing is not in this version. Use Watermark or Page numbers to add text that stays in the file.' },
  { id: 'sign', icon: 'sign-fill', name: 'Sign & fill', description: 'Add a signature, a date, or a check.', category: 'edit', synonyms: ['signature', 'sign', 'fill', 'initial'], popular: true, state: 'limited', limit: 'Placing a signature on the page is not in this version. A fake signature box would not be a real signature.' },
  { id: 'forms', icon: 'pdf-forms', name: 'PDF forms', description: 'Fill or create form fields.', category: 'edit', synonyms: ['form', 'acroform', 'fillable'], state: 'limited', limit: 'Form fields are not edited in this version.' },
  { id: 'watermark', icon: 'watermark', name: 'Watermark', description: 'Stamp text on every page.', category: 'edit', synonyms: ['stamp', 'draft', 'confidential'], state: 'ready' },
  { id: 'numbers', icon: 'page-numbers', name: 'Page numbers', description: 'Add a page number to each page.', category: 'edit', synonyms: ['paginate', 'footer', 'number'], state: 'ready' },
  { id: 'protect', icon: 'protect-pdf', name: 'Protect PDF', description: 'Add a password.', category: 'security', synonyms: ['password', 'encrypt', 'lock'], state: 'limited', limit: `Password protection is not in this version. ${brandName()} will not pretend a file is encrypted.` },
  { id: 'unlock', icon: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove a password you already know.', category: 'security', synonyms: ['decrypt', 'password', 'open'], state: 'limited', limit: `Removing a password is not in this version. ${brandName()} will never try to guess one.` },
  { id: 'redact', icon: 'redact-pdf', name: 'Redact PDF', description: 'Permanently remove text from a PDF.', category: 'security', synonyms: ['blackout', 'censor', 'hide'], state: 'limited', limit: 'A white box would leave the words in the file. Permanent removal is not in this version, so this tool stays off.' },
  { id: 'ocr', icon: 'ocr-pdf', name: 'Make searchable', description: 'Add a text layer so you can search a scan.', category: 'smart', synonyms: ['ocr', 'search', 'copy text'], state: 'limited', limit: 'The on-device text reader is not included in this version.' },
  { id: 'compare', icon: 'compare-pdf', name: 'Compare PDFs', description: 'See which words changed between two PDFs.', category: 'smart', synonyms: ['diff', 'changes'], state: 'ready' },
  { id: 'summarize', icon: 'summarize-pdf', name: 'Summarize PDF', description: 'Summarize a PDF with the browser’s on-device model.', category: 'smart', synonyms: ['summary', 'tldr'], badges: ['Needs Chrome AI'], state: 'ready' },
  { id: 'translate', icon: 'translate-pdf', name: 'Translate PDF', description: 'Translate a PDF with the browser’s on-device model.', category: 'smart', synonyms: ['translation', 'language'], badges: ['Needs Chrome AI'], state: 'ready' },
  { id: 'workflows', icon: 'workflow', name: 'Workflows', description: 'Run rotate, watermark, and page numbers as one saved recipe.', category: 'workflows', synonyms: ['recipe', 'batch', 'chain'], state: 'ready' },
  { id: 'presets', icon: 'get-accepted', name: 'Get it accepted', description: 'Check a file against a verified upload rule.', category: 'smart', synonyms: ['passport', 'visa', 'photo rules', 'accepted', 'requirements', 'india'], state: 'ready' },
  { id: 'id-photo', icon: 'id-photo', name: 'ID photo', description: 'Crop a photo to exact pixel size. The face is not retouched.', category: 'optimize', synonyms: ['passport photo', 'headshot', 'visa photo'], state: 'ready' },
  { id: 'share-check', icon: 'safe-share', name: 'Safe to share', description: 'Look for hidden text, scripts, and location data before you send a file.', category: 'security', synonyms: ['metadata', 'hidden text', 'before sending', 'exif'], state: 'ready' },
  { id: 'commands', icon: 'commands', name: 'Commands', description: 'Type a short instruction and confirm the steps before they run.', category: 'workflows', synonyms: ['make this under', 'remove page', 'plain language'], state: 'ready' },
  { id: 'accessible', icon: 'accessible-pdf', name: 'Make accessible', description: 'Report title, language, and tags. Tagging itself needs a person.', category: 'edit', synonyms: ['pdf/ua', 'screen reader', 'alt text', 'tags'], state: 'ready' },
  { id: 'genuine', icon: 'genuine-pdf', name: 'Signature check', description: 'Report signature coverage and edit signals. Not a verdict.', category: 'security', synonyms: ['signed', 'signature', 'pades', 'c2pa'], state: 'ready' },
  { id: 'chat', icon: 'chat-pdf', name: 'Chat with PDF', description: 'Ask about this document. Answers cite a page or say they are not in the file.', category: 'smart', synonyms: ['ask', 'question', 'find in document'], state: 'ready' },
  { id: 'hot-folders', icon: 'hot-folder', name: 'Hot folders', description: 'Watch a folder while this app is open. Originals stay put.', category: 'workflows', synonyms: ['watch folder', 'desktop', 'automate'], state: 'ready' },
  { id: 'lite', icon: 'lite-mode', name: 'Lite mode', description: 'A quieter, smaller path for a slow connection.', category: 'optimize', synonyms: ['slow', '2g', 'save data', 'lite'], state: 'ready' },
];

export const TOOLS: readonly ToolInfo[] = CORE;

const byId = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function toolById(id: string): ToolInfo | undefined {
  return byId.get(id);
}

export function toolsIn(category: CategoryId): ToolInfo[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function popularTools(): ToolInfo[] {
  return TOOLS.filter((tool) => tool.popular);
}

export function searchTools(query: string): ToolInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...TOOLS];
  return TOOLS.filter((tool) => {
    const hay = [tool.name, tool.description, ...tool.synonyms].join(' ').toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => rank(b, q) - rank(a, q));
}

function rank(tool: ToolInfo, q: string): number {
  if (tool.name.toLowerCase().startsWith(q)) return 3;
  if (tool.synonyms.some((word) => word.includes(q))) return 2;
  return 1;
}
