import type { ToolRoute } from '../lib/detect';
import { downloadBytes, downloadZip, fileBase } from '../lib/download';
import { el, formatBytes } from '../lib/dom';
import { iconElement } from '../lib/icons';
import { sizeBar } from '../lib/size-bar';
import { previewFirstPage } from '../lib/pdf';
import { stageBytes } from '../lib/session';
import { navigate } from '../router';

export interface ResultFile {
  name: string;
  bytes: Uint8Array;
}

export interface ResultOptions {
  source: ToolRoute;
  files: ResultFile[];
  zipName?: string;
  beforeBytes?: number;
  unchanged?: string | null;
  compare?: { before: Uint8Array; after: Uint8Array } | null;
  onStartOver: () => void;
}

const heldUrls = new WeakMap<HTMLElement, string[]>();

export function showResult(panel: HTMLElement, options: ResultOptions): void {
  panel.querySelector('[data-result]')?.remove();
  const hidden: HTMLElement[] = [];
  for (const child of panel.children) {
    if (child instanceof HTMLElement && !child.hidden) {
      child.hidden = true;
      hidden.push(child);
    }
  }
  const urls: string[] = [];
  const host = el('div', { class: 'result', 'data-result': 'true' });
  heldUrls.set(host, urls);
  const only = options.files.length === 1 ? options.files[0] : undefined;
  const total = options.files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  const before = options.beforeBytes;
  const after = only ? only.bytes.byteLength : total;
  const smaller = before !== undefined && only !== undefined && after < before;
  const percent = smaller ? Math.round((1 - after / before) * 100) : 0;
  const size = el('p', { class: 'result-size num' }, [formatBytes(smaller && before ? before : total)]);
  const card = el('div', { class: 'result-card' }, [
    el('h2', { class: 'result-title' }, ['Your file is ready']),
    el('p', { class: 'result-filename' }, [only ? only.name : `${options.files.length} PDFs`]),
  ]);
  if (before !== undefined) {
    card.append(
      sizeBar({
        before,
        after,
        ...(options.unchanged ? { missed: options.unchanged } : {}),
      }),
    );
  } else {
    card.append(size);
    if (smaller) card.append(el('p', { class: 'shrink num' }, [`${percent}% smaller`]));
    if (options.unchanged) {
      const note = el('p', { class: 'status', role: 'status' }, [options.unchanged]);
      note.dataset.tone = 'neutral';
      card.append(note);
    }
  }
  const preview = el('div', { class: 'compare' });
  preview.hidden = true;
  card.append(preview);
  const download = el('button', { class: 'btn primary', type: 'button', 'data-action': 'download-result' }, [iconElement(options.files.length > 1 ? 'zip' : 'download', { size: 16, className: 'icon-inline' }), ' Download']);
  const check = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'check-before-sharing' }, ['Check before sharing']);
  const again = el('button', { class: 'btn quiet text-link-btn', type: 'button' }, [iconElement('undo', { size: 16, className: 'icon-inline' }), ' Start over']);
  const actions = el('div', { class: 'action-row' }, [download, check, again]);
  host.append(card, actions);
  if (only) {
    const chain = el('div', { class: 'chain' }, [el('p', undefined, ['Use this file in another tool'])]);
    const row = el('div', { class: 'suggest' });
    const choices: Array<{ route: ToolRoute; label: string }> = [
      { route: 'compress', label: 'Compress' },
      { route: 'split', label: 'Split' },
      { route: 'organize', label: 'Organize' },
      { route: 'merge', label: 'Merge' },
    ];
    for (const choice of choices) {
      if (choice.route === options.source) continue;
      const button = el('button', { class: 'btn quiet', type: 'button' }, [
        choice.label,
      ]);
      button.addEventListener('click', () => {
        if (!only) return;
        stageBytes([{ name: only.name, bytes: only.bytes }]);
        navigate(choice.route);
      });
      row.append(button);
    }
    chain.append(row);
    host.append(chain);
  }
  panel.append(host);
  check.addEventListener('click', () => {
    stageBytes(options.files);
    navigate('share-check');
  });
  download.addEventListener('click', () => {
    if (only) downloadBytes(only.bytes, only.name, 'application/pdf');
    else {
      const zipName = options.zipName ?? 'weesize.zip';
      void downloadZip(
        options.files.map((file) => ({ name: file.name, bytes: file.bytes })),
        zipName,
      );
    }
  });
  const close = (): void => {
    host.remove();
    for (const child of hidden) child.hidden = false;
    for (const url of urls) URL.revokeObjectURL(url);
  };
  again.addEventListener('click', () => {
    close();
    options.onStartOver();
  });
  if (options.compare && !options.unchanged) {
    void paintCompare(preview, options.compare, urls);
  }
}

async function paintCompare(
  host: HTMLElement,
  compare: { before: Uint8Array; after: Uint8Array },
  urls: string[],
): Promise<void> {
  try {
    const before = await previewFirstPage(compare.before);
    const after = await previewFirstPage(compare.after);
    urls.push(before, after);
    host.hidden = false;
    host.append(sheet('Before', before), sheet('After', after));
  } catch {
    host.remove();
  }
}

function sheet(label: string, url: string): HTMLElement {
  const image = el('img', { alt: `${label}, first page` });
  image.src = url;
  const page = el('div', { class: 'page-sheet compare-page' }, [image, el('span', { class: 'page-curl', 'aria-hidden': 'true' })]);
  page.style.aspectRatio = '3 / 4';
  return el('figure', { class: 'compare-fig' }, [page, el('figcaption', undefined, [label])]);
}

export function dismissResult(panel: HTMLElement): void {
  const host = panel.querySelector('[data-result]');
  if (!(host instanceof HTMLElement)) return;
  for (const url of heldUrls.get(host) ?? []) URL.revokeObjectURL(url);
  heldUrls.delete(host);
  host.remove();
  for (const child of panel.children) {
    if (child instanceof HTMLElement) child.hidden = false;
  }
}

export function zipSafeName(name: string): string {
  return `${fileBase(name)}.pdf`;
}
