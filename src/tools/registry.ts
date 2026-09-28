import { brandName } from '../brand';
import type { ToolIconName } from '../lib/icons';

export type CategoryId = 'optimize' | 'organize' | 'to-pdf' | 'from-pdf' | 'edit' | 'security' | 'smart' | 'workflows';

export type ToolBadge = 'Beta' | 'New' | 'Needs Chrome AI' | 'Coming soon';

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
  /** @deprecated Kept for backward compatibility with existing tests/code */
  state?: 'ready' | 'limited';
  limit?: string;
  popular?: boolean;
  relatedWorkingTools?: string[];
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

export const CORE: ToolInfo[] = [
  { id: 'compress', icon: 'compress-pdf', name: 'Compress PDF', description: 'Make PDFs smaller without losing quality.', category: 'optimize', synonyms: ['shrink', 'smaller', 'reduce'], popular: true, status: 'ready', state: 'ready' },
  { id: 'compress-images', icon: 'compress-images', name: 'Compress image', description: 'Shrink photos and screenshots.', category: 'optimize', synonyms: ['jpg', 'jpeg', 'photo', 'png', 'webp', 'compress image'], popular: true, status: 'ready', state: 'ready' },
  { id: 'repair', icon: 'repair-pdf', name: 'Repair PDF', description: 'Rebuild a PDF so it can be opened again.', category: 'optimize', synonyms: ['fix', 'damaged', 'recover'], status: 'ready', state: 'ready' },
  { id: 'merge', icon: 'merge-pdf', name: 'Merge PDF', description: 'Combine PDFs in any order.', category: 'organize', synonyms: ['combine', 'join', 'append'], popular: true, status: 'ready', state: 'ready' },
  { id: 'split', icon: 'split-pdf', name: 'Split PDF', description: 'Extract pages or split into files.', category: 'organize', synonyms: ['extract', 'separate', 'range'], popular: true, status: 'ready', state: 'ready' },
  { id: 'organize', icon: 'organize-pages', name: 'Organize pages', description: 'Reorder, rotate, delete and insert pages.', category: 'organize', synonyms: ['reorder', 'arrange', 'delete pages'], popular: true, status: 'ready', state: 'ready' },
  { id: 'rotate', icon: 'rotate-pdf', name: 'Rotate PDF', description: 'Fix page orientation.', category: 'organize', synonyms: ['turn', 'landscape', 'portrait'], status: 'ready', state: 'ready' },
  { id: 'crop', icon: 'crop-pdf', name: 'Crop PDF', description: 'Trim the same margin from every page.', category: 'organize', synonyms: ['trim', 'margin', 'cut'], status: 'ready', state: 'ready' },
  { id: 'images', icon: 'images-to-pdf', name: 'Images to PDF', description: 'Turn images into a PDF.', category: 'to-pdf', synonyms: ['jpg', 'png', 'photos to pdf'], popular: true, status: 'ready', state: 'ready' },
  { id: 'scan', icon: 'scan-to-pdf', name: 'Scan to PDF', description: 'Photograph pages and save them as a PDF.', category: 'to-pdf', synonyms: ['camera', 'scan', 'phone'], status: 'beta', state: 'ready', badges: ['Beta'] },
  { id: 'word', icon: 'word-to-pdf', name: 'Word to PDF', description: 'Turn a Word document into a PDF.', category: 'to-pdf', synonyms: ['docx', 'word'], status: 'beta', state: 'ready', badges: ['Beta'] },
  { id: 'excel', icon: 'excel-to-pdf', name: 'Excel to PDF', description: 'Turn a spreadsheet into a PDF.', category: 'to-pdf', synonyms: ['xlsx', 'sheet', 'csv'], status: 'coming-soon', state: 'limited', limit: `Spreadsheet conversion is coming soon. ${brandName()} will not invent a layout it cannot check.`, relatedWorkingTools: ['images', 'word', 'html'] },
  { id: 'ppt', icon: 'powerpoint-to-pdf', name: 'PowerPoint to PDF', description: 'Turn slides into a PDF.', category: 'to-pdf', synonyms: ['pptx', 'slides'], status: 'coming-soon', state: 'limited', limit: 'Slide conversion is coming soon.', relatedWorkingTools: ['images', 'word', 'html'] },
  { id: 'html', icon: 'html-to-pdf', name: 'HTML to PDF', description: 'Turn HTML you paste or upload into a PDF.', category: 'to-pdf', synonyms: ['html', 'webpage'], status: 'beta', state: 'ready', badges: ['Beta'] },
  { id: 'pdf-images', icon: 'pdf-to-images', name: 'PDF to images', description: 'Save each page as a JPEG.', category: 'from-pdf', synonyms: ['jpg', 'png', 'export images'], popular: true, status: 'ready', state: 'ready' },
  { id: 'pdf-word', icon: 'pdf-to-word', name: 'PDF to Word', description: 'Save the text of a PDF as a Word document.', category: 'from-pdf', synonyms: ['docx', 'word'], status: 'beta', state: 'ready', badges: ['Beta'] },
  { id: 'pdf-excel', icon: 'pdf-to-excel', name: 'PDF to Excel', description: 'Pull tables out of a PDF.', category: 'from-pdf', synonyms: ['xlsx', 'table', 'sheet'], status: 'coming-soon', state: 'limited', limit: 'Table detection is coming soon. A guessed spreadsheet could move numbers.', relatedWorkingTools: ['pdf-md', 'pdf-word', 'pdf-images'] },
  { id: 'pdf-ppt', icon: 'pdf-to-powerpoint', name: 'PDF to PowerPoint', description: 'Put each page on a slide.', category: 'from-pdf', synonyms: ['pptx', 'slides'], status: 'coming-soon', state: 'limited', limit: 'Slide export is coming soon.', relatedWorkingTools: ['pdf-images', 'pdf-word', 'pdf-md'] },
  { id: 'pdf-md', icon: 'pdf-to-markdown', name: 'PDF to Markdown', description: 'Copy the text of a PDF as Markdown.', category: 'from-pdf', synonyms: ['md', 'markdown', 'text'], status: 'ready', state: 'ready' },
  { id: 'pdfa', icon: 'pdf-to-pdfa', name: 'PDF to PDF/A', description: 'Prepare a PDF for long-term storage.', category: 'from-pdf', synonyms: ['archival', 'pdfa'], status: 'coming-soon', state: 'limited', limit: `${brandName()} will not mark a file as archival unless it can check the result. Archival verification is coming soon.`, relatedWorkingTools: ['compress', 'repair', 'accessible'] },
  { id: 'edit', icon: 'edit-pdf', name: 'Edit PDF', description: 'Add text and shapes to a PDF.', category: 'edit', synonyms: ['annotate', 'draw', 'text'], status: 'coming-soon', state: 'limited', limit: 'Freehand editing is coming soon. Use Watermark or Page numbers to add text that stays in the file.', relatedWorkingTools: ['watermark', 'numbers', 'organize'] },
  { id: 'sign', icon: 'sign-fill', name: 'Sign & fill', description: 'Add a signature, a date, or a check.', category: 'edit', synonyms: ['signature', 'sign', 'fill', 'initial'], status: 'coming-soon', state: 'limited', limit: 'Placing a signature on the page is coming soon.', relatedWorkingTools: ['watermark', 'numbers', 'organize'] },
  { id: 'forms', icon: 'pdf-forms', name: 'PDF forms', description: 'Fill or create form fields.', category: 'edit', synonyms: ['form', 'acroform', 'fillable'], status: 'coming-soon', state: 'limited', limit: 'Interactive form filling is coming soon.', relatedWorkingTools: ['watermark', 'organize', 'compress'] },
  { id: 'watermark', icon: 'watermark', name: 'Watermark', description: 'Stamp text on every page.', category: 'edit', synonyms: ['stamp', 'draft', 'confidential'], status: 'ready', state: 'ready' },
  { id: 'numbers', icon: 'page-numbers', name: 'Page numbers', description: 'Add a page number to each page.', category: 'edit', synonyms: ['paginate', 'footer', 'number'], status: 'ready', state: 'ready' },
  { id: 'protect', icon: 'protect-pdf', name: 'Protect PDF', description: 'Add a password.', category: 'security', synonyms: ['password', 'encrypt', 'lock'], status: 'coming-soon', state: 'limited', limit: 'Password encryption is coming soon.', relatedWorkingTools: ['share-check', 'compress', 'organize'] },
  { id: 'unlock', icon: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove a password you already know.', category: 'security', synonyms: ['decrypt', 'password', 'open'], status: 'coming-soon', state: 'limited', limit: 'Password decryption is coming soon.', relatedWorkingTools: ['repair', 'compress', 'organize'] },
  { id: 'redact', icon: 'redact-pdf', name: 'Redact PDF', description: 'Permanently remove text from a PDF.', category: 'security', synonyms: ['blackout', 'censor', 'hide'], status: 'coming-soon', state: 'limited', limit: 'Permanent text redaction is coming soon.', relatedWorkingTools: ['share-check', 'watermark', 'crop'] },
  { id: 'ocr', icon: 'ocr-pdf', name: 'Make searchable', description: 'Add a text layer so you can search a scan.', category: 'smart', synonyms: ['ocr', 'search', 'copy text'], status: 'coming-soon', state: 'limited', limit: 'On-device OCR is coming soon.', relatedWorkingTools: ['pdf-md', 'pdf-images', 'chat'] },
  { id: 'compare', icon: 'compare-pdf', name: 'Compare PDFs', description: 'See which words changed between two PDFs.', category: 'smart', synonyms: ['diff', 'changes'], status: 'ready', state: 'ready' },
  { id: 'summarize', icon: 'summarize-pdf', name: 'Summarize PDF', description: 'Summarize a PDF with the browser’s on-device model.', category: 'smart', synonyms: ['summary', 'tldr'], badges: ['Needs Chrome AI'], status: 'ready', state: 'ready' },
  { id: 'translate', icon: 'translate-pdf', name: 'Translate PDF', description: 'Translate a PDF with the browser’s on-device model.', category: 'smart', synonyms: ['translation', 'language'], badges: ['Needs Chrome AI'], status: 'ready', state: 'ready' },
  { id: 'workflows', icon: 'workflow', name: 'Workflows', description: 'Run rotate, watermark, and page numbers as one saved recipe.', category: 'workflows', synonyms: ['recipe', 'batch', 'chain'], status: 'ready', state: 'ready' },
  { id: 'presets', icon: 'get-accepted', name: 'Get it accepted', description: 'Check a file against a verified upload rule.', category: 'smart', synonyms: ['passport', 'visa', 'photo rules', 'accepted', 'requirements', 'india'], status: 'ready', state: 'ready' },
  { id: 'id-photo', icon: 'id-photo', name: 'ID photo', description: 'Crop a photo to exact pixel size. The face is not retouched.', category: 'optimize', synonyms: ['passport photo', 'headshot', 'visa photo'], popular: true, status: 'ready', state: 'ready' },
  { id: 'share-check', icon: 'safe-share', name: 'Safe to share', description: 'Look for hidden text, scripts, and location data before you send a file.', category: 'security', synonyms: ['metadata', 'hidden text', 'before sending', 'exif'], status: 'ready', state: 'ready' },
  { id: 'commands', icon: 'commands', name: 'Commands', description: 'Type a short instruction and confirm the steps before they run.', category: 'workflows', synonyms: ['make this under', 'remove page', 'plain language'], status: 'ready', state: 'ready' },
  { id: 'accessible', icon: 'accessible-pdf', name: 'Make accessible', description: 'Report title, language, and tags. Tagging itself needs a person.', category: 'edit', synonyms: ['pdf/ua', 'screen reader', 'alt text', 'tags'], status: 'ready', state: 'ready' },
  { id: 'genuine', icon: 'genuine-pdf', name: 'Signature check', description: 'Report signature coverage and edit signals. Not a verdict.', category: 'security', synonyms: ['signed', 'signature', 'pades', 'c2pa'], status: 'ready', state: 'ready' },
  { id: 'chat', icon: 'chat-pdf', name: 'Chat with PDF', description: 'Ask about this document. Answers cite a page or say they are not in the file.', category: 'smart', synonyms: ['ask', 'question', 'find in document'], status: 'ready', state: 'ready' },
  { id: 'hot-folders', icon: 'hot-folder', name: 'Hot folders', description: 'Watch a folder while this app is open. Originals stay put.', category: 'workflows', synonyms: ['watch folder', 'desktop', 'automate'], status: 'ready', state: 'ready' },
  { id: 'lite', icon: 'lite-mode', name: 'Lite mode', description: 'A quieter, smaller path for a slow connection.', category: 'optimize', synonyms: ['slow', '2g', 'save data', 'lite'], status: 'ready', state: 'ready' },
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
