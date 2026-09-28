import {
  actionButton,
  dropZone,
  el,
  formatBytes,
  formatPages,
  largeFileNote,
  pageSheet,
  partitionFiles,
  radioGroup,
  rejectedMessage,
  statusLine,
  textField,
  toolIntro,
  uid,
  dropVisibility,
  whenVisible,
  yieldToMain,
} from '../lib/dom';
import { splitPartName, splitZipName } from '../lib/names';
import {
  cancelWork,
  describePdfError,
  enqueueThumbnail,
  isPdfFile,
  openPdf,
  parsePageRanges,
  PdfReadError,
  readFileBytes,
  readPageBoxes,
  releaseDocument,
  splitPdf,
  type PageBox,
  type RangeParse,
} from '../lib/pdf';
import { armCancel } from '../lib/progress';
import { fileFromBytes, type StagedBytes } from '../lib/session';
import { playStack } from '../lib/sortable';
import { dismissResult, showResult } from './result';
import type { ToolApi } from './types';

type SplitMode = 'separate' | 'combined' | 'pages';

interface SplitFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  size: number;
  boxes: PageBox[];
}

export function mountSplit(panel: HTMLElement): ToolApi {
  let file: SplitFile | null = null;
  let mode: SplitMode = 'separate';
  let busy = false;
  let parsed: RangeParse = { ranges: [], pages: [], error: null, incomplete: true };

  const drop = dropZone({
    title: 'Drop a PDF here',
    detail: 'or choose one file to split.',
    accept: 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: 'Choose a PDF',
    onFiles: (files) => {
      void ingest(files);
    },
  });
  const summary = el('div');
  const range = textField({
    id: 'split-range',
    label: 'Pages',
    placeholder: '1-3, 5, 8-10',
    onInput: () => {
      refreshRange(false);
    },
  });
  const modes = radioGroup({
    legend: 'How to save',
    name: 'split-mode',
    value: mode,
    choices: [
      { value: 'separate', label: 'Each range as its own PDF', hint: 'More than one file downloads as a zip.' },
      { value: 'combined', label: 'All ranges in one PDF', hint: 'Pages stay in the order you typed.' },
      { value: 'pages', label: 'Every page as its own PDF', hint: 'The page box is ignored.' },
    ],
    onChange: (value) => {
      if (value === 'separate' || value === 'combined' || value === 'pages') mode = value;
      refreshRange(false);
    },
  });
  const grid = el('ul', { class: 'page-grid', role: 'list' });
  const action = actionButton('Split PDF');
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);
  const controls = el('div', { id: 'split-controls' }, [summary, range.el, modes, grid]);
  controls.hidden = true;

  panel.append(
    el('h2', { class: 'visually-hidden' }, ['Split']),
    toolIntro('Choose the pages to pull out, then save them on this device.'),
    drop.el,
    controls,
    row,
  );

  action.el.addEventListener('click', () => {
    void run();
  });
  action.idle('Split PDF', false);

  function refreshRange(rebuild: boolean): void {
    if (!file) return;
    parsed = parsePageRanges(range.input.value, file.boxes.length);
    const every = mode === 'pages';
    range.setDisabled(every);
    if (every) {
      range.setMessage(`Every page becomes its own PDF. This file has ${file.boxes.length === 1 ? '1 page' : `${file.boxes.length} pages`}.`, false);
    } else if (parsed.error) {
      range.setMessage(parsed.error, true);
    } else if (parsed.incomplete && !range.input.value.trim()) {
      range.setMessage('Example: 1-3, 5, 8-10', false);
    } else if (parsed.incomplete) {
      range.setMessage('Keep typing the rest of the range.', false);
    } else {
      const count = new Set(parsed.pages).size;
      range.setMessage(count === 1 ? 'Uses 1 page.' : `Uses ${count} pages.`, false);
    }
    const highlight = new Set(every ? file.boxes.map((_, index) => index + 1) : parsed.pages);
    if (rebuild) buildGrid(highlight);
    else {
      grid.querySelectorAll<HTMLElement>('[data-page]').forEach((card) => {
        const page = Number(card.dataset.page);
        card.classList.toggle('is-in-range', highlight.has(page));
      });
    }
    const ready = every || (!parsed.error && !parsed.incomplete && parsed.pages.length > 0);
    if (!busy) action.idle('Split PDF', ready);
  }

  function buildGrid(highlight: Set<number>): void {
    if (!file) return;
    const current = file;
    grid.replaceChildren();
    dropVisibility(grid);
    current.boxes.forEach((box, index) => {
      const pageNumber = index + 1;
      const sheet = pageSheet(box.width, box.height, `Page ${pageNumber}`);
      const card = el('li', { class: 'page-card', 'data-page': String(pageNumber) }, [
        sheet.el,
        el('span', { class: 'page-num num' }, [String(pageNumber)]),
      ]);
      if (highlight.has(pageNumber)) card.classList.add('is-in-range');
      grid.append(card);
      whenVisible(sheet.el, () => enqueueThumbnail(current.id, index, 160, (url) => sheet.show(url)));
    });
  }

  async function ingest(files: File[]): Promise<void> {
    if (busy) return;
    dismissResult(panel);
    const { accepted, rejected } = partitionFiles(files, isPdfFile);
    const chosen = accepted[0];
    if (!chosen) {
      if (rejected.length) status.set(rejectedMessage(rejected, "isn't a PDF. Choose a .pdf file."), 'bad');
      return;
    }
    if (accepted.length > 1 || rejected.length) {
      status.set('Split works on one PDF at a time. The first PDF was opened.', 'neutral');
    } else status.set(`Reading ${chosen.name}…`, 'neutral');
    const id = uid('pdf');
    try {
      await yieldToMain();
      const bytes = await readFileBytes(chosen);
      const opened = await openPdf(id, bytes);
      status.set('Reading pages…', 'neutral');
      const boxes = await readPageBoxes(id, (done, total) => {
        status.set(`Reading pages… ${done} of ${total}`, 'neutral');
      });
      if (file) releaseDocument(file.id);
      file = { id, name: chosen.name, bytes, size: chosen.size, boxes };
      summary.replaceChildren(summaryLine());
      drop.hidden(true);
      controls.hidden = false;
      range.input.value = '';
      refreshRange(true);
      const warn = largeFileNote(chosen.size);
      status.set(warn ?? `${chosen.name}, ${opened.pageCount === 1 ? '1 page' : `${opened.pageCount} pages`}.`, warn ? 'neutral' : 'neutral');
    } catch (error) {
      releaseDocument(id);
      status.set(`${chosen.name}: ${describePdfError(error)}`, 'bad');
    }
  }

  function summaryLine(): HTMLElement {
    if (!file) return el('p');
    const button = el('button', { class: 'btn quiet', type: 'button' }, ['Choose a different PDF']);
    button.addEventListener('click', () => drop.open());
    return el('div', { class: 'toolbar' }, [
      el('p', undefined, [el('strong', undefined, [file.name]), ' ', el('span', { class: 'num' }, [fileMetaText()])]),
      button,
    ]);
  }

  function fileMetaText(): string {
    if (!file) return '';
    return `${formatPages(file.boxes.length)}, ${formatBytes(file.size)}`;
  }

  async function run(): Promise<void> {
    if (!file || busy) return;
    const source = file;
    const every = mode === 'pages';
    const current = every ? parsePageRanges('', source.boxes.length) : parsePageRanges(range.input.value, source.boxes.length);
    if (!every && (current.error || current.incomplete || current.pages.length === 0)) {
      refreshRange(false);
      status.set(current.error ?? 'Enter the pages to split, such as 1-3, 5, 8-10.', 'bad');
      return;
    }
    const groups = groupsFor(source.boxes.length, current);
    if (groups.length === 0) return;
    busy = true;
    action.busy('Splitting…', 0.04);
    status.clear();
    const stop = armCancel(row, () => cancelWork());
    try {
      const outputs = await splitPdf(source.bytes, groups, (done, total) => {
        action.busy('Splitting…', total === 0 ? 0 : done / total);
      });
      const named = outputs.map((bytes, index) => ({
        name: splitPartName(source.name, groups[index] ?? []),
        bytes,
      }));
      await playStack(grid);
      showResult(panel, {
        source: 'split',
        files: named,
        ...(named.length > 1 ? { zipName: splitZipName(source.name) } : {}),
        onStartOver() {
          if (file) releaseDocument(file.id);
          file = null;
          controls.hidden = true;
          drop.hidden(false);
          grid.replaceChildren();
          status.clear();
          action.idle('Split PDF', false);
        },
      });
    } catch (error) {
      status.set(describePdfError(error), error instanceof PdfReadError && error.kind === 'cancelled' ? 'neutral' : 'bad');
    } finally {
      stop.stop();
      busy = false;
      if (!panel.querySelector('[data-result]')) refreshRange(false);
    }
  }

  function groupsFor(pageCount: number, current: RangeParse): number[][] {
    if (mode === 'pages') return Array.from({ length: pageCount }, (_, index) => [index]);
    if (mode === 'combined') return [current.pages.map((page) => page - 1)];
    return current.ranges.map((range) => {
      const pages: number[] = [];
      for (let page = range.start; page <= range.end; page += 1) pages.push(page - 1);
      return pages;
    });
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
  };
}
