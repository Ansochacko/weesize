import { actionButton, el, fileMeta, iconButton, largeFileNote, partitionFiles, rejectedMessage, statusLine, toolIntro, uid } from '../lib/dom';
import {
  ALREADY_SMALL,
  beginPrescan,
  cancelWork,
  COMPRESS_LEVELS,
  compressDocument,
  describePdfError,
  isPdfFile,
  openPdf,
  PdfReadError,
  readFileBytes,
  releaseDocument,
  type CompressSettings,
} from '../lib/pdf';
import { iconElement } from '../lib/icons';
import { sizeBar } from '../lib/size-bar';
import { compressedName } from '../lib/names';
import { loadPrefs, savePrefs, type CompressLevelPref } from '../lib/prefs';
import { armCancel } from '../lib/progress';
import type { StagedBytes } from '../lib/session';
import type { ToolApi } from './types';
import { showResult } from './result';
import { formatTarget, toolPreset } from '../seo/preset';

type LevelId = keyof typeof COMPRESS_LEVELS;

interface Item {
  id: string;
  name: string;
  bytes: Uint8Array;
  pages: number;
  size: number;
  warning: string | null;
}

export function mountCompress(panel: HTMLElement): ToolApi {
  let items: Item[] = [];
  let busy = false;
  let level: LevelId = 'recommended';
  let grayscale = false;
  let squeeze = false;
  let quality = COMPRESS_LEVELS.recommended.quality;
  let qualityCustom = false;
  let levelTouched = false;

  const list = el('ul', { class: 'file-list' });
  const add = el('button', { class: 'btn quiet add-row', type: 'button' }, [iconElement('plus', { size: 16, className: 'icon-inline' }), ' Add PDFs']);
  const picker = el('input', { class: 'file-input', type: 'file', accept: 'application/pdf,.pdf' });
  picker.multiple = true;
  picker.tabIndex = -1;
  picker.setAttribute('aria-hidden', 'true');
  picker.addEventListener('change', () => {
    const files = [...(picker.files ?? [])];
    picker.value = '';
    if (files.length) void ingest(files);
  });
  add.addEventListener('click', () => picker.click());

  const levels = el('div', { class: 'levels', role: 'radiogroup', 'aria-label': 'Compression level' });
  const cards: HTMLButtonElement[] = [];
  const choices: Array<{ id: LevelId; title: string; copy: string; badge?: string }> = [
    { id: 'light', title: 'Light', copy: 'Best quality, slightly smaller.' },
    { id: 'recommended', title: 'Recommended', copy: 'Good quality, much smaller.', badge: 'Recommended' },
    { id: 'strong', title: 'Strong', copy: 'Smallest file, lower image quality.' },
  ];
  for (const choice of choices) {
    const button = el('button', { class: 'level', type: 'button', role: 'radio' }, [
      el('span', { class: 'level-title' }, [choice.badge ? `${choice.title}` : choice.title]),
      el('span', { class: 'level-copy' }, [choice.copy]),
    ]);
    if (choice.badge) button.prepend(el('span', { class: 'badge' }, [choice.badge]));
    button.dataset.level = choice.id;
    button.setAttribute('aria-checked', choice.id === level ? 'true' : 'false');
    button.addEventListener('click', () => {
      level = choice.id;
      levelTouched = true;
      void savePrefs({ compressLevel: level });
      if (!qualityCustom) quality = COMPRESS_LEVELS[level].quality;
      slider.value = String(Math.round(quality * 100));
      readQuality.textContent = slider.value;
      for (const card of cards) card.setAttribute('aria-checked', card === button ? 'true' : 'false');
    });
    cards.push(button);
    levels.append(button);
  }

  const gray = el('input', { type: 'checkbox', id: 'compress-gray' });
  gray.addEventListener('change', () => {
    grayscale = gray.checked;
  });
  const squeezeBox = el('input', { type: 'checkbox', id: 'compress-squeeze' });
  squeezeBox.addEventListener('change', () => {
    squeeze = squeezeBox.checked;
  });
  const slider = el('input', { id: 'compress-quality', type: 'range', min: '40', max: '95' });
  slider.value = String(Math.round(quality * 100));
  const readQuality = el('span', { class: 'num' }, [slider.value]);
  slider.setAttribute('aria-describedby', 'compress-quality-read');
  readQuality.id = 'compress-quality-read';
  slider.addEventListener('input', () => {
    qualityCustom = true;
    quality = Number(slider.value) / 100;
    readQuality.textContent = slider.value;
  });

  function showLevel(next: CompressLevelPref): void {
    level = next;
    if (!qualityCustom) {
      quality = COMPRESS_LEVELS[level].quality;
      slider.value = String(Math.round(quality * 100));
      readQuality.textContent = slider.value;
    }
    for (const [index, card] of cards.entries()) {
      card.setAttribute('aria-checked', choices[index]?.id === level ? 'true' : 'false');
    }
  }

  void loadPrefs().then((prefs) => {
    if (levelTouched) return;
    if (toolPreset()?.pdfTargetKb) return;
    const saved = prefs.compressLevel;
    if (saved === 'light' || saved === 'recommended' || saved === 'strong') showLevel(saved);
  });
  const more = el('details', { class: 'more' }, [
    el('summary', undefined, ['More options']),
    el('div', { class: 'more-body' }, [
      el('label', { class: 'choice' }, [gray, el('span', undefined, ['Convert to black & white'])]),
      el('label', { class: 'choice' }, [squeezeBox, el('span', undefined, ['Maximum squeeze (slower)'])]),
      el('label', { class: 'quality', for: 'compress-quality' }, ['Custom quality ', readQuality]),
      slider,
    ]),
  ]);

  let chosenTargetKb: number | null = toolPreset()?.pdfTargetKb ?? null;

  const targetNote = el('p', { class: 'target-note', hidden: '' });
  const goalHost = el('div');
  function paintGoal(): void {
    goalHost.replaceChildren();
    const kb = chosenTargetKb;
    if (!kb || items.length === 0) return;
    const before = items.reduce((sum, item) => sum + item.size, 0);
    goalHost.append(
      sizeBar({
        before,
        after: before,
        limit: kb * 1024,
        limitLabel: formatTarget(kb),
        goal: true,
      }),
    );
  }
  function applyTarget(): void {
    const kb = chosenTargetKb;
    if (!kb) {
      targetNote.hidden = true;
      return;
    }
    targetNote.hidden = false;
    const label = formatTarget(kb);
    targetNote.textContent = `Fit to size: ${label}. This is a goal. If the pages cannot reach it while staying readable, the download is the smaller honest file, or the original.`;
    const next: LevelId = kb <= 200 ? 'strong' : kb <= 1024 ? 'recommended' : 'light';
    if (!levelTouched) {
      level = next;
      if (!qualityCustom) quality = COMPRESS_LEVELS[next].quality;
      slider.value = String(Math.round(quality * 100));
      readQuality.textContent = slider.value;
      for (const card of cards) card.setAttribute('aria-checked', card.dataset.level === next ? 'true' : 'false');
    }
  }

  const targetHost = el('div', { class: 'pdf-target-picker', style: 'margin: 12px 0;' });
  const targetLabel = el('label', { style: 'display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--ink);' }, ['Target size (optional)']);
  const targetChips = el('div', { class: 'chips-row', style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;' });
  const customTargetInput = el('input', {
    type: 'number',
    min: '10',
    max: '50000',
    placeholder: 'KB',
    style: 'width:80px;padding:4px 8px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);font-size:13px;',
    'aria-label': 'Custom target KB',
  });
  if (chosenTargetKb) customTargetInput.value = String(chosenTargetKb);

  const targetPresets = [
    { label: 'Any', kb: null },
    { label: '100 KB', kb: 100 },
    { label: '200 KB', kb: 200 },
    { label: '500 KB', kb: 500 },
    { label: '1 MB', kb: 1024 },
    { label: '2 MB', kb: 2048 },
    { label: 'Custom', kb: -1 },
  ];

  function renderTargetChips(): void {
    targetChips.replaceChildren();
    for (const p of targetPresets) {
      const isCustom = p.kb === -1;
      const isSelected = isCustom
        ? chosenTargetKb !== null && ![100, 200, 500, 1024, 2048].includes(chosenTargetKb)
        : chosenTargetKb === p.kb;
      const chip = el('button', {
        class: `chip${isSelected ? ' is-on' : ''}`,
        type: 'button',
        style: 'font-size:12px;padding:4px 10px;',
      }, [p.label]);
      chip.addEventListener('click', () => {
        if (p.kb === null) {
          chosenTargetKb = null;
          customTargetInput.value = '';
        } else if (p.kb === -1) {
          chosenTargetKb = Number(customTargetInput.value) || 200;
          customTargetInput.value = String(chosenTargetKb);
        } else {
          chosenTargetKb = p.kb;
          customTargetInput.value = String(p.kb);
        }
        applyTarget();
        paintGoal();
        renderTargetChips();
      });
      targetChips.append(chip);
    }
    const isCustomActive = chosenTargetKb !== null && ![100, 200, 500, 1024, 2048].includes(chosenTargetKb);
    if (isCustomActive || customTargetInput.value) {
      targetChips.append(customTargetInput);
    }
  }

  customTargetInput.addEventListener('input', () => {
    const val = Number(customTargetInput.value);
    if (val > 0) {
      chosenTargetKb = val;
      applyTarget();
      paintGoal();
      renderTargetChips();
    }
  });

  targetHost.append(targetLabel, targetChips);
  renderTargetChips();
  if (toolPreset()?.pdfTargetKb) {
    targetHost.hidden = true;
  }

  const action = actionButton('Compress PDF');
  action.el.dataset.action = 'compress-pdf';
  action.el.append(el('kbd', { class: 'btn-hint' }, [navigator.platform.includes('Mac') ? '⌘↵' : 'Ctrl ↵']));
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);
  panel.classList.add('tool-frame');
  const canvas = el('div', { class: 'work-canvas' });
  const inspector = el('aside', { class: 'inspector', 'aria-label': 'Compress options' });
  canvas.append(list, add, picker);
  inspector.append(
    el('h2', { class: 'inspector-title' }, ['Compress PDF']),
    toolIntro('Make a PDF smaller. The original stays on this device.'),
    targetHost,
    targetNote,
    goalHost,
    levels,
    more,
    row,
  );
  panel.append(canvas, inspector);
  action.el.addEventListener('click', () => {
    void run();
  });

  function paint(): void {
    list.replaceChildren();
    for (const item of items) {
      const remove = iconButton(`Remove ${item.name}`, 'close', () => removeItem(item.id));
      const text = el('div', undefined, [
        el('p', { class: 'row-name' }, [iconElement('file', { size: 16, className: 'icon-inline' }), ' ', item.name]),
        el('p', { class: 'row-meta num' }, [fileMeta(item.pages, item.size)]),
      ]);
      if (item.warning) text.append(el('p', { class: 'row-warn' }, [item.warning]));
      list.append(el('li', { class: 'row', 'data-id': item.id }, [text, el('div', { class: 'row-actions' }, [remove])]));
    }
    const empty = items.length === 0;
    list.hidden = empty;
    levels.hidden = empty;
    more.hidden = empty;
    action.idle(items.length > 1 ? 'Compress PDFs' : 'Compress PDF', items.length > 0 && !busy);
    paintGoal();
    const invite = panel.querySelector('.empty-invite');
    if (empty && !panel.querySelector('[data-result]')) {
      if (!invite) list.before(el('p', { class: 'tool-intro empty-invite' }, ['Drop a PDF anywhere on this page.']));
    } else invite?.remove();
  }

  function reveal(): void {
    panel.querySelector('[data-result]')?.remove();
    for (const child of panel.children) {
      if (child instanceof HTMLElement) child.hidden = false;
    }
  }

  async function addBytes(name: string, bytes: Uint8Array, reportedSize: number): Promise<string | null> {
    const id = uid('pdf');
    try {
      const opened = await openPdf(id, bytes);
      beginPrescan(id, bytes);
      items.push({
        id,
        name,
        bytes,
        pages: opened.pageCount,
        size: reportedSize,
        warning: largeFileNote(reportedSize),
      });
      return null;
    } catch (error) {
      releaseDocument(id);
      return `${name}: ${describePdfError(error)}`;
    }
  }

  async function ingest(files: File[]): Promise<void> {
    if (busy) return;
    const { accepted, rejected } = partitionFiles(files, isPdfFile);
    let message = rejected.length ? rejectedMessage(rejected, "isn't a PDF. Choose a .pdf file.") : '';
    for (const file of accepted) {
      status.set(accepted.length > 1 ? `Reading ${file.name}…` : `Reading ${file.name}…`, 'neutral');
      const bytes = await readFileBytes(file);
      const problem = await addBytes(file.name, bytes, file.size);
      if (problem) message = problem;
      paint();
    }
    if (message) status.set(message, 'bad');
    else status.clear();
    paint();
  }

  function removeItem(id: string): void {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    releaseDocument(item.id);
    items = items.filter((entry) => entry.id !== id);
    paint();
    status.clear();
  }

  function clearAll(): void {
    reveal();
    for (const item of items) releaseDocument(item.id);
    items = [];
    busy = false;
    paint();
    status.clear();
  }

  async function run(): Promise<void> {
    if (busy || items.length === 0) return;
    busy = true;
    action.busy('Compressing…', 0.04);
    status.clear();
    const stop = armCancel(row, () => cancelWork());
    const settings: CompressSettings = {
      maxEdge: COMPRESS_LEVELS[level].maxEdge,
      quality,
      resize: COMPRESS_LEVELS[level].resize,
      grayscale,
      squeeze,
    };
    try {
      const outputs: Array<{ name: string; bytes: Uint8Array; before: number; unchanged: boolean }> = [];
      const snapshot = [...items];
      for (let index = 0; index < snapshot.length; index += 1) {
        const item = snapshot[index];
        if (!item) continue;
        const result = await compressDocument(item.id, settings, (done, total) => {
          const label = total > 0 ? `Compressing image ${Math.max(done, 1)} of ${total}` : 'Compressing…';
          const filePart = snapshot.length > 1 ? `File ${index + 1} of ${snapshot.length}. ` : '';
          action.busy(`${filePart}${label}`, total === 0 ? 0.5 : done / total);
        });
        outputs.push({
          name: result.unchanged ? item.name : compressedName(item.name),
          bytes: result.bytes,
          before: item.bytes.byteLength,
          unchanged: result.unchanged,
        });
      }
      const single = outputs.length === 1 ? outputs[0] : undefined;
      const unchanged = outputs.every((file) => file.unchanged);
      const missedTarget = chosenTargetKb && single && single.bytes.byteLength > chosenTargetKb * 1024;
      showResult(panel, {
        source: 'compress',
        files: outputs.map((file) => ({ name: file.name, bytes: file.bytes })),
        ...(outputs.length > 1 ? { zipName: compressedName(snapshot[0]?.name ?? 'files').replace(/\.pdf$/, '.zip') } : {}),
        ...(single ? { beforeBytes: single.before } : {}),
        ...(unchanged
          ? { unchanged: ALREADY_SMALL }
          : missedTarget
            ? {
                unchanged: `Target was ${formatTarget(chosenTargetKb!)}. Reached ${formatTarget(Math.round(single.bytes.byteLength / 1024))}. Vector lines and fonts were preserved for legibility.`,
              }
            : {}),
        ...(single && !single.unchanged ? { compare: { before: snapshot[0]?.bytes ?? single.bytes, after: single.bytes } } : {}),
        onStartOver: clearAll,
      });
    } catch (error) {
      status.set(describePdfError(error), error instanceof PdfReadError && error.kind === 'cancelled' ? 'neutral' : 'bad');
      paint();
    } finally {
      stop.stop();
      busy = false;
      if (!panel.querySelector('[data-result]')) action.idle(items.length > 1 ? 'Compress PDFs' : 'Compress PDF', items.length > 0);
    }
  }

  paint();
  applyTarget();
  levels.addEventListener('keydown', (event) => {
    const index = cards.findIndex((card) => card.getAttribute('aria-checked') === 'true');
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = event.key === 'ArrowRight' ? (index + 1) % cards.length : (index - 1 + cards.length) % cards.length;
    cards[next]?.click();
    cards[next]?.focus();
  });

  return {
    ingest(files) {
      void ingest(files);
    },
    loadHeld(files: StagedBytes[]) {
      reveal();
      for (const item of items) releaseDocument(item.id);
      items = [];
      void (async () => {
        let message = '';
        for (const file of files) {
          const problem = await addBytes(file.name, file.bytes, file.bytes.byteLength);
          if (problem) message = problem;
        }
        if (message) status.set(message, 'bad');
        paint();
      })();
    },
    setDragging(on) {
      panel.classList.toggle('is-hot', on);
    },
    applyPreset: applyTarget,
  };
}
