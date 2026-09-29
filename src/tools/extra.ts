import { actionButton, dropZone, el, partitionFiles, rejectedMessage, statusLine, toolIntro } from '../lib/dom';
import { downloadBytes, downloadZip, fileBase } from '../lib/download';
import {
  describePdfError,
  editPdf,
  exportPageJpegs,
  readFileBytes,
} from '../lib/pdf';
import { isImageFile } from '../lib/detect';
import type { PdfEdit } from '../workers/protocol';
import { armCancel } from '../lib/progress';
import { compressedName } from '../lib/names';
import { dismissResult, showResult } from './result';
import { toolById, type ToolInfo } from './registry';
import { toolPreset } from '../seo/preset';
import { mountNext } from './next';
import { mountSignature } from './signature';

export function mountExtra(panel: HTMLElement, id: string, incoming?: File[]): void {
  const tool = toolById(id);
  panel.replaceChildren();
  if (!tool) return;

  if (id === 'signature-resizer') {
    mountSignature(panel, incoming);
  } else if (id === 'compress-images') {
    mountImageCompress(panel, incoming);
  } else if (id === 'presets' || id === 'id-photo' || id === 'share-check') {
    mountNext(panel, tool, incoming);
  } else {
    mountPdfJob(panel, tool, incoming);
  }
}

function mountPdfJob(panel: HTMLElement, tool: ToolInfo, incoming?: File[]): void {
  let file: File | null = null;
  let bytes: Uint8Array | null = null;
  const drop = dropZone({
    title: 'Drop a PDF here',
    detail: 'or choose one file.',
    accept: 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: 'Choose a PDF',
    onFiles: (files) => {
      const chosen = files[0];
      if (!chosen) return;
      file = chosen;
      void readFileBytes(chosen).then((data) => {
        bytes = data;
        status.set(`${chosen.name} is ready.`, 'neutral');
        action.idle(verb(tool.id), true);
      });
    },
  });
  const watermark = el('input', { id: 'mark-text', type: 'text', value: 'Draft' });
  const crop = el('input', { id: 'crop-points', type: 'number', min: '12', max: '144', value: '36' });
  const start = el('input', { id: 'num-start', type: 'number', min: '1', value: '1' });
  const skip = el('input', { type: 'checkbox' });
  const options = el('div', { class: 'options' });
  if (tool.id === 'watermark') options.append(el('label', { class: 'choice' }, ['Watermark text ', watermark]));
  if (tool.id === 'crop') options.append(el('label', { class: 'choice' }, ['Trim each edge by this many points ', crop]));
  if (tool.id === 'numbers') options.append(el('label', { class: 'choice' }, ['Start at ', start]), el('label', { class: 'choice' }, [skip, ' Skip the first page']));

  const action = actionButton(verb(tool.id));
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);
  panel.append(el('h2', undefined, [tool.name]), toolIntro(tool.description), drop.el, options, row);
  action.idle(verb(tool.id), false);

  const seeded = incoming?.[0];
  if (seeded) {
    file = seeded;
    void readFileBytes(seeded).then((data) => {
      bytes = data;
      status.set(`${seeded.name} is ready.`, 'neutral');
      action.idle(verb(tool.id), true);
    });
  }

  action.el.addEventListener('click', () => {
    void run();
  });

  async function run(): Promise<void> {
    if (!file || !bytes) return;
    dismissResult(panel);
    action.busy('Working…', 0.04);
    status.clear();
    const stop = armCancel(row, () => undefined);
    try {
      if (tool.id === 'pdf-images') {
        const images = await exportPageJpegs(bytes, (done, total) => action.busy(`Saving page ${Math.max(done, 1)} of ${total}`, total ? done / total : 0));
        const named = images.map((data, index) => ({ name: `${fileBase(file?.name ?? 'page')}-page-${index + 1}.jpg`, bytes: data }));
        if (named.length === 1 && named[0]) downloadBytes(named[0].bytes, named[0].name, 'image/jpeg');
        else await downloadZip(named, `${fileBase(file.name)}-pages.zip`);
        status.set('The images are downloading.', 'neutral');
        action.idle(verb(tool.id), true);
        return;
      }
      const edit = editFor(tool.id, watermark.value, Number(crop.value), Number(start.value), skip.checked);
      const pdf = await editPdf(bytes, edit, (done, total) => action.busy('Saving…', total ? done / total : 0.5));
      showResult(panel, {
        source: 'organize',
        files: [{ name: `${fileBase(file.name)}-${suffix(tool.id)}.pdf`, bytes: pdf }],
        onStartOver: reset,
      });
    } catch (error) {
      status.set(describePdfError(error), 'bad');
      action.idle(verb(tool.id), true);
    } finally {
      stop.stop();
    }
  }

  function reset(): void {
    file = null;
    bytes = null;
    drop.hidden(false);
    status.clear();
    action.idle(verb(tool.id), false);
  }
}

function editFor(id: string, mark: string, points: number, startAt: number, skipFirst: boolean): PdfEdit {
  if (id === 'rotate') return { kind: 'rotate', turns: 1 };
  if (id === 'crop') return { kind: 'crop', points: Number.isFinite(points) ? points : 36 };
  if (id === 'watermark') return { kind: 'watermark', text: mark.trim() || 'Draft' };
  if (id === 'numbers') return { kind: 'numbers', start: Number.isFinite(startAt) ? startAt : 1, skipFirst };
  return { kind: 'repair' };
}

function verb(id: string): string {
  if (id === 'rotate') return 'Rotate PDF';
  if (id === 'crop') return 'Crop PDF';
  if (id === 'watermark') return 'Add watermark';
  if (id === 'numbers') return 'Add page numbers';
  if (id === 'repair') return 'Repair PDF';
  if (id === 'pdf-images') return 'Save images';
  return 'Save PDF';
}

function suffix(id: string): string {
  if (id === 'rotate') return 'rotated';
  if (id === 'crop') return 'cropped';
  if (id === 'watermark') return 'watermarked';
  if (id === 'numbers') return 'numbered';
  return 'repaired';
}

function mountImageCompress(panel: HTMLElement, incoming?: File[]): void {
  const preset = toolPreset();
  let mime: string = preset?.imageMime ?? 'image/jpeg';
  let targetKb: number | null = preset?.imageTargetKb ?? 50;
  let files: File[] = (incoming ?? []).filter(isImageFile);

  const targetBox = el('div', { class: 'target-size-control', style: 'background:var(--paper-2);padding:14px;border-radius:var(--radius-md);margin-bottom:16px;border:1px solid var(--rule);display:flex;flex-wrap:wrap;align-items:center;gap:12px;' });
  const formatSelect = el('select', { class: 'select', 'aria-label': 'Output format', style: 'padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);' }, [
    el('option', { value: 'image/jpeg' }, ['JPG (Recommended)']),
    el('option', { value: 'image/webp' }, ['WebP (Modern)']),
    el('option', { value: 'image/png' }, ['PNG (Lossless)']),
  ]);
  formatSelect.value = mime;

  const targetInput = el('input', { type: 'number', min: '5', max: '20000', value: String(targetKb ?? 50), 'aria-label': 'Target size in KB', style: 'width:90px;padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);' });

  const presetsWrap = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });
  const quickSizes = [10, 20, 50, 100, 200];
  quickSizes.forEach((kb) => {
    const btn = el('button', { class: 'btn quiet', type: 'button', style: 'font-size:12px;padding:4px 8px;' }, [`${kb} KB`]);
    btn.addEventListener('click', () => {
      targetKb = kb;
      targetInput.value = String(kb);
      status.set(`Target set to ${kb} KB.`, 'neutral');
    });
    presetsWrap.append(btn);
  });

  formatSelect.addEventListener('change', () => {
    mime = formatSelect.value;
  });

  targetInput.addEventListener('input', () => {
    const val = Number(targetInput.value);
    targetKb = val > 0 ? val : null;
  });

  targetBox.append(
    el('strong', { style: 'font-size:13px;' }, ['Target size:']),
    targetInput,
    el('span', { class: 'num', style: 'font-size:13px;color:var(--ink-2);' }, ['KB']),
    presetsWrap,
    el('span', { style: 'border-left:1px solid var(--rule);height:20px;margin:0 4px;' }),
    el('strong', { style: 'font-size:13px;' }, ['Format:']),
    formatSelect,
  );

  const drop = dropZone({
    title: 'Drop photos, signatures, or scans here',
    detail: 'Supports JPG, PNG, WebP, AVIF, and HEIC phone photos.',
    accept: 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/avif,.jpg,.jpeg,.png,.webp,.gif,.heic,.avif',
    multiple: true,
    buttonLabel: 'Choose image',
    onFiles: (picked) => {
      const { accepted, rejected } = partitionFiles(picked, isImageFile);
      files = accepted;
      status.set(rejected.length ? rejectedMessage(rejected, "isn't an image this page can read.") : `${accepted.length} image${accepted.length === 1 ? '' : 's'} ready.`, rejected.length ? 'bad' : 'neutral');
      action.idle('Compress to target', accepted.length > 0);
    },
  });

  const action = actionButton('Compress to target');
  const status = statusLine();
  const row = el('div', { class: 'action-row', style: 'margin-top:16px;' }, [action.el, status.el]);
  panel.append(el('h2', undefined, ['Compress image to exact size']), toolIntro('Shrink photos, signatures, and scans to an exact KB file size. Processed 100% on your device.'), targetBox, drop.el, row);
  action.idle('Compress to target', files.length > 0);
  if (files.length) status.set(`${files.length} image${files.length === 1 ? '' : 's'} ready.`, 'neutral');

  action.el.addEventListener('click', () => {
    void (async () => {
      action.busy('Compressing to exact size…', 0.05);
      const targetBytes = targetKb ? targetKb * 1024 : null;
      const outputs: Array<{ name: string; bytes: Uint8Array }> = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;
        action.busy(`Compressing image ${index + 1} of ${files.length}`, (index + 0.5) / files.length);
        const shrunk = await shrinkImage(file, mime, targetBytes);
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        outputs.push({ name: compressedName(file.name).replace(/\.pdf$/, `.${ext}`).replace(/\.[^.]+$/, `.${ext}`), bytes: shrunk });
      }
      if (outputs.length === 1 && outputs[0]) {
        const finalKb = Math.round((outputs[0].bytes.byteLength / 1024) * 10) / 10;
        downloadBytes(outputs[0].bytes, outputs[0].name, mime);
        const hit = targetKb ? finalKb <= targetKb : true;
        status.set(`Downloaded ${outputs[0].name} (${finalKb} KB)${hit ? ' ✓ Target reached' : ''}`, hit ? 'good' : 'neutral');
      } else {
        await downloadZip(outputs, 'images-compressed.zip');
        status.set('The compressed images zip is downloading.', 'good');
      }
      action.idle('Compress to target', true);
    })();
  });
}

async function shrinkImage(file: File, mime: string, targetBytes: number | null): Promise<Uint8Array> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return new Uint8Array(await file.arrayBuffer());
  }
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  if (!targetBytes) {
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.75));
    bitmap.close();
    return blob ? new Uint8Array(await blob.arrayBuffer()) : originalBytes;
  }

  let maxEdge = 1920;
  let best = originalBytes;

  for (let edgePass = 0; edgePass < 6; edgePass++) {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let minQ = 0.10;
    let maxQ = 0.95;
    for (let qPass = 0; qPass < 7; qPass++) {
      const q = (minQ + maxQ) / 2;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, q));
      if (!blob) break;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      best = bytes;
      if (bytes.byteLength <= targetBytes) {
        if (targetBytes - bytes.byteLength <= targetBytes * 0.05) {
          bitmap.close();
          return best;
        }
        minQ = q;
      } else {
        maxQ = q;
      }
    }

    if (best.byteLength <= targetBytes || (mime === 'image/png' && maxEdge <= 300)) {
      break;
    }
    maxEdge = Math.round(maxEdge * 0.7);
  }

  bitmap.close();
  return best;
}
