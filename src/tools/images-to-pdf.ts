import {
  actionButton,
  checkField,
  dropZone,
  el,
  formatBytes,
  iconButton,
  largeFileNote,
  miniPage,
  partitionFiles,
  rejectedMessage,
  selectField,
  statusLine,
  toolIntro,
  uid,
  yieldToMain,
} from '../lib/dom';
import { iconElement } from '../lib/icons';
import {
  cancelWork,
  describePdfError,
  imagesToPdf,
  isImageFile,
  PdfReadError,
  prepareImageFile,
  shrinkPrepared,
  type MarginId,
  type OrientationId,
  type PageSizeId,
  type PreparedImage,
} from '../lib/pdf';
import { armCancel } from '../lib/progress';
import { dismissResult, showResult } from './result';
import { imagesPdfName } from '../lib/names';
import { createSortable, flip, playStack } from '../lib/sortable';
import { createHistory } from '../lib/undo';
import type { ToolApi } from './types';

interface ImageItem {
  id: string;
  name: string;
  size: number;
  preview: string;
  prepared: PreparedImage;
  warning: string | null;
}

export function mountImages(panel: HTMLElement): ToolApi {
  let items: ImageItem[] = [];
  let busy = false;
  const history = createHistory<ImageItem[]>();
  const held = new Map<string, ImageItem>();
  let pageSize: PageSizeId = 'a4';
  let orientation: OrientationId = 'auto';
  let margin: MarginId = 'small';
  let reduce = true;

  const drop = dropZone({
    title: 'Drop images here',
    detail: 'JPG, PNG, WebP, GIF, or HEIC phone photos.',
    accept: 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/avif,.jpg,.jpeg,.png,.webp,.gif,.heic,.avif',
    multiple: true,
    buttonLabel: 'Choose images',
    onFiles: (files) => {
      void ingest(files);
    },
  });
  const list = el('ul', { class: 'file-list' });
  const add = el('button', { class: 'btn quiet add-row', type: 'button' }, [iconElement('plus', { size: 16, className: 'icon-inline' }), ' Add images']);
  add.addEventListener('click', () => drop.open());
  const options = el('div', { class: 'options' }, [
    selectField({
      id: 'page-size',
      label: 'Page size',
      value: pageSize,
      choices: [
        { value: 'image', label: 'Same as image' },
        { value: 'a4', label: 'A4' },
        { value: 'letter', label: 'Letter' },
      ],
      onChange: (value) => {
        if (value === 'image' || value === 'a4' || value === 'letter') pageSize = value;
      },
    }),
    selectField({
      id: 'orientation',
      label: 'Orientation',
      value: orientation,
      choices: [
        { value: 'auto', label: 'Auto' },
        { value: 'portrait', label: 'Portrait' },
        { value: 'landscape', label: 'Landscape' },
      ],
      onChange: (value) => {
        if (value === 'auto' || value === 'portrait' || value === 'landscape') orientation = value;
      },
    }),
    selectField({
      id: 'margin',
      label: 'Margin',
      value: margin,
      choices: [
        { value: 'none', label: 'None' },
        { value: 'small', label: 'Small' },
        { value: 'large', label: 'Large' },
      ],
      onChange: (value) => {
        if (value === 'none' || value === 'small' || value === 'large') margin = value;
      },
    }),
    checkField({
      id: 'reduce-size',
      label: 'Reduce file size',
      checked: true,
      onChange: (checked) => {
        reduce = checked;
      },
    }),
  ]);
  const note = el('p', { class: 'note' }, ['Photos keep the orientation stored in the file. Animated images use their first frame.']);
  const action = actionButton('Create PDF');
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);

  panel.append(
    el('h2', { class: 'visually-hidden' }, ['Images to PDF']),
    toolIntro('Each image becomes a page. Drag to reorder. Ctrl or Command Z undoes a change.'),
    drop.el,
    list,
    add,
    options,
    note,
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
    void create();
  });

  function paint(): void {
    const active = document.activeElement;
    const holder = active instanceof HTMLElement ? active.closest('[data-id]') : null;
    const focusId = holder instanceof HTMLElement ? holder.dataset.id : undefined;
    const focusAct = active instanceof HTMLElement ? active.dataset.act : undefined;
    drop.hidden(items.length > 0);
    add.hidden = items.length === 0;
    options.hidden = items.length === 0;
    note.hidden = items.length === 0;
    flip(list, () => {
      list.replaceChildren();
      items.forEach((item, index) => {
      const thumb = miniPage(item.prepared.width, item.prepared.height);
      thumb.show(item.preview);
      const up = iconButton(`Move ${item.name} earlier`, 'chevron-down', () => move(index, -1));
      up.querySelector('svg')?.classList.add('icon-flip');
      const down = iconButton(`Move ${item.name} later`, 'chevron-down', () => move(index, 1));
      const remove = iconButton(`Remove ${item.name}`, 'close', () => removeAt(index));
      up.dataset.act = 'up';
      down.dataset.act = 'down';
      remove.dataset.act = 'remove';
      up.disabled = index === 0;
      down.disabled = index === items.length - 1;
      const text = el('div', undefined, [
        el('p', { class: 'row-name' }, [item.name]),
        el('p', { class: 'row-meta num' }, [`${item.prepared.width} × ${item.prepared.height}, ${formatBytes(item.size)}`]),
      ]);
      if (item.warning) text.append(el('p', { class: 'row-warn' }, [item.warning]));
      list.append(
        el('li', { class: 'row', 'data-id': item.id }, [
          el('span', { class: 'grip', 'aria-hidden': 'true' }, [iconElement('grip', { size: 16 })]),
          thumb.el,
          text,
          el('div', { class: 'row-actions' }, [up, down, remove]),
        ]),
      );
    });
    });
    if (focusId) {
      const next = list.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusId)}"]`);
      const target = focusAct ? next?.querySelector<HTMLElement>(`[data-act="${focusAct}"]`) : next;
      target?.focus();
    }
    if (!busy) action.idle('Create PDF', items.length > 0);
  }

  async function ingest(files: File[]): Promise<void> {
    if (busy) return;
    dismissResult(panel);
    const { accepted, rejected } = partitionFiles(files, isImageFile);
    let message = rejected.length ? rejectedMessage(rejected, "isn't a JPG, PNG, WebP, or GIF.") : '';
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index];
      if (!file) continue;
      status.set(accepted.length > 1 ? `Reading ${index + 1} of ${accepted.length}…` : `Reading ${file.name}…`, 'neutral');
      await yieldToMain();
      try {
        const prepared = await prepareImageFile(file);
        const item: ImageItem = {
          id: uid('img'),
          name: file.name,
          size: file.size,
          preview: URL.createObjectURL(file),
          prepared,
          warning: largeFileNote(file.size),
        };
        held.set(item.id, item);
        items.push(item);
        paint();
      } catch (error) {
        message = `${file.name}: ${describePdfError(error)}`;
      }
    }
    if (message) status.set(message, 'bad');
    else status.clear();
    paint();
  }

  function reorderAt(indexes: number[], to: number): void {
    const sorted = [...indexes].sort((left, right) => left - right);
    const moving = sorted.map((index) => items[index]).filter((item): item is ImageItem => Boolean(item));
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
  }

  function releaseAll(): void {
    for (const item of held.values()) URL.revokeObjectURL(item.preview);
    held.clear();
    history.clear();
    items = [];
  }

  async function create(): Promise<void> {
    if (busy || items.length === 0) return;
    busy = true;
    action.busy('Creating…', 0.04);
    status.clear();
    const stop = armCancel(row, () => cancelWork());
    try {
      const prepared: PreparedImage[] = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (!item) continue;
        if (reduce) {
          action.busy(`Shrinking image ${index + 1} of ${items.length}`, index / Math.max(items.length, 1));
          prepared.push(await shrinkPrepared(item.prepared));
        } else prepared.push(item.prepared);
      }
      const bytes = await imagesToPdf(prepared, { pageSize, orientation, margin }, (done, total) =>
        action.busy('Creating…', total === 0 ? 0 : done / total),
      );
      await playStack(list);
      showResult(panel, {
        source: 'images',
        files: [{ name: imagesPdfName(items.map((item) => item.name)), bytes }],
        onStartOver() {
          releaseAll();
          paint();
          status.clear();
        },
      });
    } catch (error) {
      status.set(
        error instanceof PdfReadError && error.kind === 'damaged'
          ? 'One of these images could not be placed on a page. Try exporting it as a JPG or PNG.'
          : describePdfError(error),
        error instanceof PdfReadError && error.kind === 'cancelled' ? 'neutral' : 'bad',
      );
    } finally {
      stop.stop();
      busy = false;
      if (!panel.querySelector('[data-result]')) action.idle('Create PDF', items.length > 0);
    }
  }

  paint();

  return {
    ingest(files) {
      void ingest(files);
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
