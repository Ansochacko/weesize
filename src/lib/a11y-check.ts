import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

export type A11yState = 'pass' | 'fix' | 'human';

export interface A11yItem {
  id: string;
  state: A11yState;
  title: string;
  detail: string;
}

export async function checkAccessibility(bytes: Uint8Array): Promise<A11yItem[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const catalog = doc.catalog;
  const title = doc.getTitle()?.trim() ?? '';
  const lang = catalog.lookup(PDFName.of('Lang'));
  const marked = catalog.lookup(PDFName.of('MarkInfo'));
  const structure = catalog.lookup(PDFName.of('StructTreeRoot'));
  const pages = doc.getPageCount();
  const outlines = catalog.lookup(PDFName.of('Outlines'));
  const items: A11yItem[] = [];
  items.push(
    title
      ? { id: 'title', state: 'pass', title: 'Document title', detail: `The title is “${title}”.` }
      : { id: 'title', state: 'fix', title: 'Document title', detail: 'No title is set. A title can be written from the name you type. It is not guessed from the text.' },
  );
  items.push(
    lang
      ? { id: 'language', state: 'pass', title: 'Language', detail: 'A document language is set.' }
      : { id: 'language', state: 'fix', title: 'Language', detail: 'No document language is set. Choose one. This check does not detect the language of the text.' },
  );
  items.push(
    structure
      ? { id: 'tags', state: 'human', title: 'Tagged structure', detail: 'A structure tree is present. This check does not prove the reading order is right.' }
      : { id: 'tags', state: 'human', title: 'Tagged structure', detail: 'No structure tree was found. Headings, lists, tables, and reading order need a person. This version does not invent tags.' },
  );
  items.push(
    marked
      ? { id: 'marked', state: 'pass', title: 'Marked content flag', detail: 'The file says it contains tagged content. That flag is not a full check.' }
      : { id: 'marked', state: 'human', title: 'Marked content flag', detail: 'The file does not say it is tagged.' },
  );
  items.push({
    id: 'figures',
    state: 'human',
    title: 'Figure descriptions',
    detail: 'Alt text is not inferred. A missing description is for a person to write, or to mark the figure as decorative.',
  });
  items.push({
    id: 'contrast',
    state: 'human',
    title: 'Color contrast',
    detail: 'Contrast of painted text is not measured here. Do not treat a missing warning as a pass.',
  });
  if (pages > 10 && !outlines) {
    items.push({ id: 'bookmarks', state: 'human', title: 'Bookmarks', detail: `This file has ${pages} pages and no bookmarks. A long document is easier to navigate with them. They are not generated from headings in this version.` });
  } else if (outlines) {
    items.push({ id: 'bookmarks', state: 'pass', title: 'Bookmarks', detail: 'Bookmarks are present. Their labels were not checked against the headings.' });
  }
  return items;
}

export async function applyAccessibilityFixes(bytes: Uint8Array, title: string, language: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const cleanTitle = title.trim();
  const cleanLang = language.trim();
  if (cleanTitle) doc.setTitle(cleanTitle);
  if (cleanLang) doc.catalog.set(PDFName.of('Lang'), PDFString.of(cleanLang));
  return doc.save({ useObjectStreams: false });
}

export function needsHuman(items: A11yItem[]): boolean {
  return items.some((item) => item.state === 'human');
}
