import {
  actionButton,
  dropZone,
  el,
  formatBytes,
  formatPages,
  iconButton,
  largeFileNote,
  pageSheet,
  partitionFiles,
  rejectedMessage,
  setRotation,
  statusLine,
  toolIntro,
  uid,
  dropVisibility,
  whenVisible,
  yieldToMain,
} from '../lib/dom';
import { iconElement } from '../lib/icons';
import { organizedName } from '../lib/names';
import { createSortable, flip, playStack } from '../lib/sortable';
import {
  cancelWork,
  describePdfError,
  enqueueThumbnail,
  isPdfFile,
  openPdf,
  organizePdf,
  PdfReadError,
  peekThumbnail,
  readFileBytes,
  readPageBoxes,
  releaseDocument,
  turn,
  type PageBox,
} from '../lib/pdf';
import { armCancel } from '../lib/progress';
import { fileFromBytes, type StagedBytes } from '../lib/session';
import { dismissResult, showResult } from './result';
import type { ToolApi } from './types';

interface OrgPage {
  id: string;
  sourceIndex: number;
  rotation: number;
  width: number;
  height: number;
}

interface Loaded {
  id: string;
  name: string;
  bytes: Uint8Array;
  size: number;
}

interface Memory {
  pages: OrgPage[];
  selected: string[];
}

export function mountOrganize(panel: HTMLElement): ToolApi {
  let loaded: Loaded | null = null;
  let pages: OrgPage[] = [];
  let original: OrgPage[] = [];
  let history: Memory[] = [];
  let selected = new Set<string>();
  let busy = false;

  const drop = dropZone({
    title: 'Drop a PDF here',
    detail: 'or choose one file to rearrange.',
    accept: 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: 'Choose a PDF',
    onFiles: (files) => {
      void ingest(files);
    },
  });
  const summary = el('div');
  const rotateAll = el('button', { class: 'btn quiet', type: 'button' }, ['Rotate all']);
  const undoBtn = el('button', { class: 'btn quiet', type: 'button' }, [iconElement('undo', { size: 16, className: 'icon-inline' }), ' Undo']);
  undoBtn.setAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
  const undoAll = el('button', { class: 'btn quiet', type: 'button' }, [iconElement('undo', { size: 16, className: 'icon-inline' }), ' Undo all changes']);
  const toolbar = el('div', { class: 'toolbar' }, [rotateAll, undoBtn, undoAll]);
  const bulkText = el('p', undefined, ['No pages selected']);
  const moveEarlier = iconButton('Move selected pages earlier', 'chevron-down', () => nudge(-1));
  moveEarlier.querySelector('svg')?.classList.add('icon-flip');
  const moveLater = iconButton('Move selected pages later', 'chevron-down', () => nudge(1));
  const bulkLeft = iconButton('Rotate selected pages left', 'rotate-left', () => rotateIds([...selected], -90));
  const bulkRight = iconButton('Rotate selected pages right', 'rotate-right', () => rotateIds([...selected], 90));
  const bulkDelete = iconButton('Delete selected pages', 'trash', () => removeIds([...selected]));
  const bulk = el('div', { class: 'bulk' }, [bulkText, el('div', { class: 'bulk-actions' }, [moveEarlier, moveLater, bulkLeft, bulkRight, bulkDelete])]);
  const grid = el('ul', { class: 'page-grid' });
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-multiselectable', 'true');
  grid.setAttribute('aria-label', 'Pages');
  const hint = el('p', { class: 'note' }, [
    'Drag a page to move it, or focus it and press Space. Click to select, Shift-click for a range, and Ctrl or Command Z to undo.',
  ]);
  const editor = el('div', undefined, [summary, toolbar, bulk, hint, grid]);
  editor.hidden = true;
  const action = actionButton('Save PDF');
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);

  panel.append(
    el('h2', { class: 'visually-hidden' }, ['Organize']),
    toolIntro('Reorder, rotate, or remove pages, then save a new PDF.'),
    drop.el,
    editor,
    row,
  );

  rotateAll.addEventListener('click', () => rotateIds(pages.map((page) => page.id), 90));
  undoBtn.addEventListener('click', () => undo());
  undoAll.addEventListener('click', () => resetAll());
  action.el.addEventListener('click', () => {
    void save();
  });
  action.idle('Save PDF', false);

  createSortable(grid, {
    layout: 'grid',
    getItems: () => [...grid.querySelectorAll<HTMLElement>('.page-card')],
    onReorder(from, to) {
      applyOrder([from], to);
    },
    onReorderMany(indexes, to) {
      applyOrder(indexes, to);
    },
  });

  grid.addEventListener('row-select', () => {
    selected = new Set(
      [...grid.querySelectorAll<HTMLElement>('.page-card.is-selected')]
        .map((card) => card.dataset.id)
        .filter((id): id is string => Boolean(id)),
    );
    refreshBulk();
  });

  grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const cards = [...grid.querySelectorAll<HTMLElement>('.page-card')];
    const index = cards.findIndex((card) => card === document.activeElement || card.contains(document.activeElement));
    if (index < 0) return;
    event.preventDefault();
    const id = cards[index]?.dataset.id;
    if (!id) return;
    removeIds(selected.has(id) ? [...selected] : [id]);
  });

  async function ingest(files: File[]): Promise<void> {
    if (busy) return;
    dismissResult(panel);
    const { accepted, rejected } = partitionFiles(files, isPdfFile);
    const chosen = accepted[0];
    if (!chosen) {
      if (rejected.length) status.set(rejectedMessage(rejected, "isn't a PDF. Choose a .pdf file."), 'bad');
      return;
    }
    status.set(`Reading ${chosen.name}…`, 'neutral');
    const id = uid('pdf');
    try {
      await yieldToMain();
      const bytes = await readFileBytes(chosen);
      await openPdf(id, bytes);
      status.set('Reading pages…', 'neutral');
      const boxes = await readPageBoxes(id, (done, total) => status.set(`Reading pages… ${done} of ${total}`, 'neutral'));
      if (loaded) releaseDocument(loaded.id);
      loaded = { id, name: chosen.name, bytes, size: chosen.size };
      pages = boxes.map((box, index) => makePage(index, box));
      original = clonePages(pages);
      history = [];
      selected = new Set();
      editor.hidden = false;
      drop.hidden(true);
      paint();
      const warn = largeFileNote(chosen.size);
      status.set(warn ?? `${chosen.name} is ready to rearrange.`, 'neutral');
    } catch (error) {
      releaseDocument(id);
      status.set(`${chosen.name}: ${describePdfError(error)}`, 'bad');
    }
  }

  function paint(): void {
    const active = document.activeElement;
    const holder = active instanceof HTMLElement ? active.closest('[data-id]') : null;
    const focusId = holder instanceof HTMLElement ? holder.dataset.id : undefined;
    summary.replaceChildren();
    if (loaded) {
      const change = el('button', { class: 'btn quiet', type: 'button' }, ['Choose a different PDF']);
      change.addEventListener('click', () => drop.open());
      summary.append(
        el('div', { class: 'toolbar' }, [
          el('p', undefined, [
            el('strong', undefined, [loaded.name]),
            ' ',
            el('span', { class: 'num' }, [`${formatPages(pages.length)}, ${formatBytes(loaded.size)}`]),
          ]),
          change,
        ]),
      );
    }
    const docId = loaded?.id;
    flip(grid, () => {
      dropVisibility(grid);
      grid.replaceChildren();
      if (!docId) return;
      pages.forEach((page, index) => {
        const sheet = pageSheet(page.width, page.height, `Page ${index + 1}`);
        setRotation(sheet.el, page.rotation);
        const ready = peekThumbnail(docId, page.sourceIndex);
        if (ready) sheet.show(ready);
        const left = iconButton(`Rotate page ${index + 1} left`, 'rotate-left', () => rotateIds([page.id], -90));
        const right = iconButton(`Rotate page ${index + 1} right`, 'rotate-right', () => rotateIds([page.id], 90));
        const remove = iconButton(`Delete page ${index + 1}`, 'trash', () => removeIds([page.id]));
        const card = el('li', { class: 'page-card', 'data-id': page.id, tabindex: '-1' });
        card.setAttribute('role', 'option');
        card.append(sheet.el, el('span', { class: 'page-num num' }, [String(index + 1)]), el('div', { class: 'page-tools' }, [left, right, remove]));
        const on = selected.has(page.id);
        card.classList.toggle('is-selected', on);
        card.dataset.chosen = on ? 'true' : 'false';
        card.setAttribute('aria-selected', on ? 'true' : 'false');
        grid.append(card);
        if (!ready) {
          whenVisible(sheet.el, () => enqueueThumbnail(docId, page.sourceIndex, 180, (url) => sheet.show(url)));
        }
      });
    });
    if (focusId) grid.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusId)}"]`)?.focus();
    undoBtn.disabled = history.length === 0;
    undoAll.disabled = !isDirty();
    rotateAll.disabled = pages.length === 0;
    refreshBulk();
    action.idle('Save PDF', pages.length > 0 && !busy);
  }

  function refreshBulk(): void {
    const count = selected.size;
    bulk.hidden = count === 0;
    bulkText.textContent = count === 1 ? '1 page selected' : `${count} pages selected`;
  }

  function applyOrder(indexes: number[], to: number): void {
    const sorted = [...indexes].sort((left, right) => left - right);
    const moving = sorted.map((index) => pages[index]).filter((page): page is OrgPage => Boolean(page));
    const rest = pages.filter((_, index) => !sorted.includes(index));
    const next = rest.slice();
    next.splice(to, 0, ...moving);
    if (next.length !== pages.length) return;
    if (next.every((page, index) => page.id === pages[index]?.id)) return;
    remember();
    pages = next;
    paint();
  }

  function rotateIds(ids: string[], delta: number): void {
    if (ids.length === 0) return;
    const set = new Set(ids);
    remember();
    pages = pages.map((page) => (set.has(page.id) ? { ...page, rotation: turn(page.rotation, delta) } : page));
    paint();
  }

  function removeIds(ids: string[]): void {
    if (ids.length === 0) return;
    const set = new Set(ids);
    remember();
    pages = pages.filter((page) => !set.has(page.id));
    selected = new Set([...selected].filter((id) => pages.some((page) => page.id === id)));
    paint();
    if (pages.length === 0) status.set('All pages were removed. Undo all changes to bring them back.', 'neutral');
  }

  function nudge(direction: -1 | 1): void {
    if (selected.size === 0) return;
    const next = pages.slice();
    const indexes = next.flatMap((page, index) => (selected.has(page.id) ? [index] : []));
    const order = direction < 0 ? indexes : [...indexes].reverse();
    let changed = false;
    for (const index of order) {
      const swapWith = index + direction;
      const current = next[index];
      const other = next[swapWith];
      if (!current || !other || selected.has(other.id)) continue;
      next[index] = other;
      next[swapWith] = current;
      changed = true;
    }
    if (!changed) return;
    remember();
    pages = next;
    paint();
  }

  function undo(): void {
    const previous = history.pop();
    if (!previous) return;
    pages = previous.pages;
    selected = new Set(previous.selected);
    paint();
  }

  function resetAll(): void {
    if (!isDirty()) return;
    history = [];
    pages = clonePages(original);
    selected = new Set();
    paint();
  }

  function remember(): void {
    history.push({ pages: clonePages(pages), selected: [...selected] });
    if (history.length > 50) history.shift();
  }

  function isDirty(): boolean {
    if (pages.length !== original.length) return true;
    return pages.some((page, index) => {
      const start = original[index];
      return !start || start.id !== page.id || page.rotation !== 0;
    });
  }

  async function save(): Promise<void> {
    if (!loaded || busy || pages.length === 0) return;
    busy = true;
    action.busy('Saving…', 0.04);
    status.clear();
    const stop = armCancel(row, () => cancelWork());
    const source = loaded;
    try {
      const bytes = await organizePdf(
        source.bytes,
        pages.map((page) => ({ index: page.sourceIndex, rotation: page.rotation })),
        (done, total) => action.busy('Saving…', total === 0 ? 0 : done / total),
      );
      await playStack(grid);
      showResult(panel, {
        source: 'organize',
        files: [{ name: organizedName(source.name), bytes }],
        onStartOver() {
          if (loaded) releaseDocument(loaded.id);
          loaded = null;
          pages = [];
          original = [];
          history = [];
          selected = new Set();
          editor.hidden = true;
          drop.hidden(false);
          paint();
          status.clear();
        },
      });
    } catch (error) {
      status.set(describePdfError(error), error instanceof PdfReadError && error.kind === 'cancelled' ? 'neutral' : 'bad');
    } finally {
      stop.stop();
      busy = false;
      if (!panel.querySelector('[data-result]')) action.idle('Save PDF', pages.length > 0);
    }
  }

  return {
    ingest(files) {
      void ingest(files);
    },
    loadHeld(files: StagedBytes[]) {
      const first = files[0];
      if (!first) return;
      void ingest([fileFromBytes(first.name, first.bytes, 'application/pdf')]);
    },
    setDragging(on) {
      drop.setHot(on);
      panel.classList.toggle('is-hot', on);
    },
    onKeydown(event) {
      if (editor.hidden) return false;
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return false;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return false;
      if (history.length === 0) return false;
      undo();
      return true;
    },
  };
}

function makePage(index: number, box: PageBox): OrgPage {
  return { id: `page-${index}`, sourceIndex: index, rotation: 0, width: box.width, height: box.height };
}

function clonePages(source: OrgPage[]): OrgPage[] {
  return source.map((page) => ({ ...page }));
}

