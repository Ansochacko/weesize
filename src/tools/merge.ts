import {
  actionButton,
  dropVisibility,
  dropZone,
  el,
  fileMeta,
  iconButton,
  largeFileNote,
  miniPage,
  partitionFiles,
  rejectedMessage,
  statusLine,
  toolIntro,
  uid,
  whenVisible,
  yieldToMain,
} from '../lib/dom';
import {
  cancelWork,
  describePdfError,
  enqueueThumbnail,
  isPdfFile,
  mergePdfs,
  openPdf,
  PdfReadError,
  readFileBytes,
  readFirstBox,
  releaseDocument,
} from '../lib/pdf';
import { armCancel } from '../lib/progress';
import { fileFromBytes, type StagedBytes } from '../lib/session';
import { dismissResult, showResult } from './result';
import { iconElement } from '../lib/icons';
import { mergedName } from '../lib/names';
import { createSortable, flip, playStack } from '../lib/sortable';
import { createHistory } from '../lib/undo';
import type { ToolApi } from './types';

interface MergeItem {
  id: string;
  name: string;
  bytes: Uint8Array;
  pages: number;
  size: number;
  width: number;
  height: number;
  warning: string | null;
}

export function mountMerge(panel: HTMLElement): ToolApi {
  let items: MergeItem[] = [];
  let busy = false;
  const history = createHistory<MergeItem[]>();
  const held = new Map<string, MergeItem>();

  const drop = dropZone({
    title: 'Drop PDFs here',
    detail: 'or choose files. Several at once is fine.',
    accept: 'application/pdf,.pdf',
    multiple: true,
    buttonLabel: 'Choose PDFs',
    onFiles: (files) => {
      void ingest(files);
    },
  });
  const list = el('ul', { class: 'file-list' });
  const add = el('button', { class: 'btn quiet add-row', type: 'button' }, [iconElement('plus', { size: 16, className: 'icon-inline' }), ' Add PDFs']);
  add.addEventListener('click', () => drop.open());
  const action = actionButton('Merge PDFs');
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);

  panel.append(
    el('h2', { class: 'visually-hidden' }, ['Merge']),
    toolIntro('Arrange the PDFs in the order they should be joined. Ctrl or Command Z undoes a change.'),
    drop.el,
    list,
    add,
    row,
  );

  createSortable(list, {
    layout: 'list',
    getItems: () => [...list.querySelectorAll<HTMLElement>('.row')],
    onReorder(from, to) {
      reorderAt([from], to);
    },
    onReorderMany(indexes, to) {
      reorderAt(indexes, to);
    },
  });

  action.el.addEventListener('click', () => {
    void merge();
  });

  function paint(): void {
    const active = document.activeElement;
    const holder = active instanceof HTMLElement ? active.closest('[data-id]') : null;
    const focusId = holder instanceof HTMLElement ? holder.dataset.id : undefined;
    const focusAct = active instanceof HTMLElement ? active.dataset.act : undefined;
    drop.hidden(items.length > 0);
    add.hidden = items.length === 0;
    flip(list, () => {
      dropVisibility(list);
      list.replaceChildren();
      items.forEach((item, index) => {
        const thumb = miniPage(item.width, item.height);
        const name = el('p', { class: 'row-name' }, [item.name]);
        const meta = el('p', { class: 'row-meta num' }, [fileMeta(item.pages, item.size)]);
        const text = el('div', undefined, [name, meta]);
        if (item.warning) text.append(el('p', { class: 'row-warn' }, [item.warning]));
        const up = iconButton(`Move ${item.name} earlier`, 'chevron-down', () => move(index, -1));
        up.querySelector('svg')?.classList.add('icon-flip');
        const down = iconButton(`Move ${item.name} later`, 'chevron-down', () => move(index, 1));
        const remove = iconButton(`Remove ${item.name}`, 'close', () => removeAt(index));
        up.dataset.act = 'up';
        down.dataset.act = 'down';
        remove.dataset.act = 'remove';
        up.disabled = index === 0;
        down.disabled = index === items.length - 1;
        const grip = el('span', { class: 'grip', 'aria-hidden': 'true' }, [iconElement('grip', { size: 16 })]);
        const li = el('li', { class: 'row', 'data-id': item.id }, [grip, thumb.el, text, el('div', { class: 'row-actions' }, [up, down, remove])]);
        list.append(li);
        whenVisible(thumb.el, () => enqueueThumbnail(item.id, 0, 72, (url) => thumb.show(url)));
      });
    });
    if (focusId) {
      const next = list.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusId)}"]`);
      const target = focusAct ? next?.querySelector<HTMLElement>(`[data-act="${focusAct}"]`) : next;
      target?.focus();
    }
    action.idle('Merge PDFs', items.length > 0 && !busy);
  }

  async function ingest(files: File[]): Promise<void> {
    if (busy) return;
    dismissResult(panel);
    const { accepted, rejected } = partitionFiles(files, isPdfFile);
    let message = rejected.length ? rejectedMessage(rejected, "isn't a PDF. Choose a .pdf file.") : '';
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index];
      if (!file) continue;
      status.set(accepted.length > 1 ? `Reading ${index + 1} of ${accepted.length}…` : `Reading ${file.name}…`, 'neutral');
      await yieldToMain();
      const id = uid('pdf');
      try {
        const bytes = await readFileBytes(file);
        const { pageCount } = await openPdf(id, bytes);
        const box = await readFirstBox(id);
        const item = {
          id,
          name: file.name,
          bytes,
          pages: pageCount,
          size: file.size,
          width: box.width,
          height: box.height,
          warning: largeFileNote(file.size),
        };
        held.set(id, item);
        items.push(item);
        paint();
      } catch (error) {
        releaseDocument(id);
        message = `${file.name}: ${describePdfError(error)}`;
      }
    }
    if (message) status.set(message, 'bad');
    else status.clear();
    paint();
  }

  function reorderAt(indexes: number[], to: number): void {
    const sorted = [...indexes].sort((left, right) => left - right);
    const moving = sorted.map((index) => items[index]).filter((item): item is MergeItem => Boolean(item));
    const rest = items.filter((_, index) => !sorted.includes(index));
    const next = rest.slice();
    next.splice(to, 0, ...moving);
    if (next.length !== items.length) return;
    if (next.every((item, index) => item.id === items[index]?.id)) return;
    history.push(items.slice());
    items = next;
    paint();
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const current = items[index];
    const swap = items[target];
    if (!current || !swap) return;
    history.push(items.slice());
    items[index] = swap;
    items[target] = current;
    paint();
  }

  function removeAt(index: number): void {
    const item = items[index];
    if (!item) return;
    history.push(items.slice());
    items.splice(index, 1);
    paint();
    status.clear();
  }

  function releaseAll(): void {
    for (const item of held.values()) releaseDocument(item.id);
    held.clear();
    history.clear();
    items = [];
  }

  async function merge(): Promise<void> {
    if (busy || items.length === 0) return;
    busy = true;
    action.busy('Merging…', 0.04);
    status.clear();
    const stop = armCancel(row, () => cancelWork());
    try {
      const bytes = await mergePdfs(
        items.map((item) => item.bytes),
        (done, total) => action.busy('Merging…', total === 0 ? 0 : done / total),
      );
      await playStack(list);
      showResult(panel, {
        source: 'merge',
        files: [{ name: mergedName(items.map((item) => item.name)), bytes }],
        onStartOver() {
          releaseAll();
          paint();
          status.clear();
        },
      });
    } catch (error) {
      status.set(describePdfError(error), error instanceof PdfReadError && error.kind === 'cancelled' ? 'neutral' : 'bad');
    } finally {
      stop.stop();
      busy = false;
      if (!panel.querySelector('[data-result]')) action.idle('Merge PDFs', items.length > 0);
    }
  }

  paint();

  return {
    ingest(files) {
      void ingest(files);
    },
    loadHeld(files: StagedBytes[]) {
      releaseAll();
      void ingest(files.map((file) => fileFromBytes(file.name, file.bytes, 'application/pdf')));
    },
    setDragging(on) {
      drop.setHot(on);
      panel.classList.toggle('is-hot', on);
    },
    onKeydown(event) {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return false;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return false;
      const previous = history.undo();
      if (!previous) return false;
      items = previous.slice();
      paint();
      return true;
    },
  };
}
