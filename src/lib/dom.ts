import { iconElement, type IconName } from './icons';

export const LARGE_FILE_BYTES = 150 * 1024 * 1024;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const shown = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${shown} ${units[unit] ?? 'KB'}`;
}

export function formatPages(count: number): string {
  return count === 1 ? '1 page' : `${count} pages`;
}

export function fileMeta(pages: number, bytes: number): string {
  return `${formatPages(pages)}, ${formatBytes(bytes)}`;
}

export function largeFileNote(bytes: number): string | null {
  if (bytes <= LARGE_FILE_BYTES) return null;
  return `This file is ${formatBytes(bytes)}. It stays on this device, and a file this large can take a while.`;
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

let idCounter = 0;

export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

export function partitionFiles(files: File[], accept: (file: File) => boolean): { accepted: File[]; rejected: File[] } {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (accept(file)) accepted.push(file);
    else rejected.push(file);
  }
  return { accepted, rejected };
}

type ShowJob = () => (() => void) | void;

interface Watch {
  onShow: ShowJob;
  cancel: (() => void) | null;
  shown: boolean;
}

const watches = new Map<Element, Watch>();
let lazyObserver: IntersectionObserver | null = null;

function teardown(element: Element): void {
  const watch = watches.get(element);
  if (!watch) return;
  watch.cancel?.();
  lazyObserver?.unobserve(element);
  watches.delete(element);
}

function observer(): IntersectionObserver {
  if (lazyObserver) return lazyObserver;
  lazyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const watch = watches.get(entry.target);
        if (!watch) continue;
        if (entry.isIntersecting) {
          if (watch.shown) continue;
          watch.shown = true;
          const cancel = watch.onShow();
          watch.cancel = typeof cancel === 'function' ? cancel : null;
        } else if (watch.shown) {
          watch.cancel?.();
          watch.cancel = null;
          watch.shown = false;
        }
      }
    },
    { rootMargin: '240px' },
  );
  return lazyObserver;
}

export function whenVisible(element: Element, onShow: ShowJob): void {
  teardown(element);
  watches.set(element, { onShow, cancel: null, shown: false });
  observer().observe(element);
}

export function dropVisibility(root: ParentNode): void {
  for (const element of [...watches.keys()]) {
    if (root.contains(element)) teardown(element);
  }
}

export interface ActionButton {
  el: HTMLButtonElement;
  idle(label: string, enabled: boolean): void;
  busy(label: string, progress: number): void;
}

export function actionButton(label: string): ActionButton {
  const text = el('span', { class: 'btn-label' }, [label]);
  const bar = el('span', { class: 'btn-bar' });
  const button = el('button', { class: 'btn primary', type: 'button' }, [text, bar]);
  button.addEventListener(
    'click',
    (event) => {
      if (button.dataset.arm === '1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      button.dataset.arm = '1';
    },
    true,
  );
  return {
    el: button,
    idle(next, enabled) {
      text.textContent = next;
      button.disabled = !enabled;
      button.dataset.arm = '0';
      button.setAttribute('aria-busy', 'false');
      bar.style.width = '0%';
    },
    busy(next, progress) {
      text.textContent = next;
      button.disabled = true;
      button.dataset.arm = '1';
      button.setAttribute('aria-busy', 'true');
      const pct = Math.max(0, Math.min(1, progress)) * 100;
      bar.style.width = `${pct}%`;
    },
  };
}

export interface StatusLine {
  el: HTMLParagraphElement;
  set(message: string, tone: 'neutral' | 'good' | 'bad'): void;
  clear(): void;
}

export function statusLine(): StatusLine {
  const node = el('p', { class: 'status' });
  node.setAttribute('role', 'status');
  return {
    el: node,
    set(message, tone) {
      node.replaceChildren();
      if (tone === 'bad') node.append(iconElement('alert', { size: 16, className: 'icon-inline' }));
      else if (tone === 'good') node.append(iconElement('check', { size: 16, className: 'icon-inline' }));
      node.append(document.createTextNode(tone === 'neutral' ? message : ` ${message}`));
      node.dataset.tone = tone;
    },
    clear() {
      node.textContent = '';
      delete node.dataset.tone;
    },
  };
}

export function iconButton(label: string, name: IconName, onClick: () => void): HTMLButtonElement {
  const button = el('button', { class: 'icon-btn', type: 'button' });
  button.setAttribute('aria-label', label);
  button.dataset.tip = label;
  button.append(iconElement(name, { size: 16 }));
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

export interface DropZone {
  el: HTMLElement;
  open(): void;
  setHot(on: boolean): void;
  hidden(on: boolean): void;
}

export function dropZone(options: {
  title: string;
  detail: string;
  accept: string;
  multiple: boolean;
  buttonLabel: string;
  onFiles: (files: File[]) => void;
}): DropZone {
  const input = el('input', { class: 'file-input', type: 'file', accept: options.accept });
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  if (options.multiple) input.multiple = true;
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length) options.onFiles(files);
  });
  const choose = el('button', { class: 'btn quiet', type: 'button' }, [options.buttonLabel]);
  choose.addEventListener('click', () => input.click());
  const mark = el('div', { class: 'drop-mark', 'aria-hidden': 'true' }, [iconElement('upload', { size: 24 })]);
  const note = el('p', { class: 'local-note' }, [iconElement('shield', { size: 16, className: 'icon-inline' }), ' Processed on this device']);
  const copy = el('div', undefined, [
    el('p', { class: 'drop-title' }, [options.title]),
    el('p', { class: 'drop-detail' }, [options.detail]),
    choose,
    note,
  ]);
  const zone = el('div', { class: 'drop' }, [mark, copy, input]);
  return {
    el: zone,
    open() {
      input.click();
    },
    setHot(on) {
      zone.classList.toggle('is-hot', on);
    },
    hidden(on) {
      zone.hidden = on;
    },
  };
}

export function pageSheet(width: number, height: number, label: string): { el: HTMLElement; show(url: string): void } {
  const image = el('img', { alt: label });
  image.hidden = true;
  const sheet = el('div', { class: 'page-sheet', 'data-rot': '0' });
  sheet.dataset.baseW = String(width);
  sheet.dataset.baseH = String(height);
  sheet.style.aspectRatio = `${width} / ${height}`;
  sheet.append(image, el('span', { class: 'page-curl', 'aria-hidden': 'true' }));
  return {
    el: sheet,
    show(url: string) {
      image.src = url;
      image.hidden = false;
    },
  };
}

export function miniPage(width: number, height: number): { el: HTMLElement; show(url: string): void } {
  const image = el('img', { alt: '' });
  image.hidden = true;
  const sheet = el('div', { class: 'mini-page', 'data-rot': '0' });
  sheet.dataset.baseW = String(width);
  sheet.dataset.baseH = String(height);
  sheet.style.aspectRatio = `${width} / ${height}`;
  sheet.append(image, el('span', { class: 'page-curl', 'aria-hidden': 'true' }));
  return {
    el: sheet,
    show(url: string) {
      image.src = url;
      image.hidden = false;
    },
  };
}

export function setRotation(sheet: HTMLElement, rotation: number): void {
  const turn = ((rotation % 360) + 360) % 360;
  const baseW = Number(sheet.dataset.baseW ?? '1');
  const baseH = Number(sheet.dataset.baseH ?? '1');
  sheet.dataset.rot = String(turn);
  sheet.style.setProperty('--turn', `${turn}deg`);
  const swapped = turn === 90 || turn === 270;
  sheet.style.aspectRatio = swapped ? `${baseH} / ${baseW}` : `${baseW} / ${baseH}`;
}

export interface TextField {
  el: HTMLElement;
  input: HTMLInputElement;
  setMessage(message: string, invalid: boolean): void;
  setDisabled(disabled: boolean): void;
}

export function textField(options: {
  id: string;
  label: string;
  placeholder: string;
  onInput: (value: string) => void;
}): TextField {
  const input = el('input', {
    class: 'input',
    id: options.id,
    type: 'text',
    placeholder: options.placeholder,
    autocomplete: 'off',
    spellcheck: 'false',
  });
  input.setAttribute('aria-describedby', `${options.id}-msg`);
  const message = el('p', { class: 'field-error', id: `${options.id}-msg` });
  input.addEventListener('input', () => options.onInput(input.value));
  const wrap = el('div', { class: 'field' }, [el('label', { class: 'field-label', for: options.id }, [options.label]), input, message]);
  return {
    el: wrap,
    input,
    setMessage(text, invalid) {
      message.textContent = text;
      input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    },
    setDisabled(disabled) {
      input.disabled = disabled;
    },
  };
}

export function selectField(options: {
  id: string;
  label: string;
  value: string;
  choices: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): HTMLElement {
  const select = el('select', { class: 'select', id: options.id });
  for (const choice of options.choices) {
    const option = el('option', { value: choice.value }, [choice.label]);
    if (choice.value === options.value) option.selected = true;
    select.append(option);
  }
  select.addEventListener('change', () => options.onChange(select.value));
  return el('div', { class: 'field' }, [el('label', { class: 'field-label', for: options.id }, [options.label]), select]);
}

export function radioGroup(options: {
  legend: string;
  name: string;
  value: string;
  choices: Array<{ value: string; label: string; hint: string }>;
  onChange: (value: string) => void;
}): HTMLFieldSetElement {
  const group = el('fieldset', { class: 'choices' });
  group.append(el('legend', undefined, [options.legend]));
  for (const choice of options.choices) {
    const input = el('input', { type: 'radio', name: options.name, value: choice.value });
    input.checked = choice.value === options.value;
    input.addEventListener('change', () => {
      if (input.checked) options.onChange(choice.value);
    });
    const label = el('label', { class: 'choice' }, [input, el('span', undefined, [choice.label]), el('small', undefined, [choice.hint])]);
    group.append(label);
  }
  return group;
}

export function checkField(options: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): HTMLLabelElement {
  const input = el('input', { type: 'checkbox', id: options.id });
  input.checked = options.checked;
  input.addEventListener('change', () => options.onChange(input.checked));
  return el('label', { class: 'choice' }, [input, el('span', undefined, [options.label])]);
}

export function toolIntro(text: string): HTMLParagraphElement {
  return el('p', { class: 'tool-intro' }, [text]);
}

export function rejectedMessage(files: File[], expected: string): string {
  const first = files[0]?.name ?? 'That file';
  if (files.length === 1) return `${first} ${expected}`;
  return `${files.length} files were skipped. ${first} ${expected}`;
}
