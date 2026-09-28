import { actionButton, dropZone, el, partitionFiles, rejectedMessage, statusLine, toolIntro } from '../lib/dom';
import { downloadBytes, downloadZip, fileBase } from '../lib/download';
import { iconElement } from '../lib/icons';
import { docxToLines, htmlToLines, paragraphsToDocx } from '../lib/office';
import {
  describePdfError,
  editPdf,
  exportPageJpegs,
  imagesToPdf,
  openPdf,
  pageText,
  PdfReadError,
  prepareImageFile,
  readFileBytes,
  releaseDocument,
} from '../lib/pdf';
import { isImageFile, isPdfFile } from '../lib/detect';
import type { PdfEdit } from '../workers/protocol';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { armCancel } from '../lib/progress';
import { compressedName } from '../lib/names';
import { dismissResult, showResult } from './result';
import { toolById, type ToolInfo } from './registry';
import { brandName } from '../brand';
import { toolPreset } from '../seo/preset';
import { mountNext } from './next';

export function mountExtra(panel: HTMLElement, id: string, incoming?: File[]): void {
  const tool = toolById(id);
  panel.replaceChildren();
  if (!tool) return;
  if (tool.state === 'limited') {
    panel.append(el('h2', undefined, [tool.name]), toolIntro(tool.description), el('p', { class: 'status', 'data-tone': 'bad' }, [tool.limit ?? '']));
  } else if (id === 'summarize' || id === 'translate') {
    mountAi(panel, tool);
  } else if (id === 'workflows') {
    mountWorkflows(panel);
  } else if (id === 'scan') {
    mountScan(panel);
  } else if (id === 'html') {
    mountHtml(panel);
  } else if (id === 'compare') {
    mountCompare(panel);
  } else if (id === 'compress-images') {
    mountImageCompress(panel, incoming);
  } else if (id === 'presets' || id === 'id-photo' || id === 'share-check' || id === 'commands' || id === 'accessible' || id === 'genuine' || id === 'chat' || id === 'hot-folders' || id === 'lite') {
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
    accept: tool.id === 'word' ? '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: tool.id === 'word' ? 'Choose a Word file' : 'Choose a PDF',
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
  if (tool.id === 'word') options.append(el('p', { class: 'note' }, [`Complex layouts may shift. ${brandName()} keeps the words.`]));
  if (tool.id === 'pdf-word') options.append(el('p', { class: 'note' }, ['Scanned pages without a text layer stay blank. Pictures are not copied.']));
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
      if (tool.id === 'word') {
        const lines = await docxToLines(bytes);
        if (lines.length === 0) throw new PdfReadError('empty');
        const pdf = await editPdf(bytes, { kind: 'textpdf', lines }, (done, total) => action.busy('Creating…', total ? done / total : 0.5));
        showResult(panel, {
          source: 'images',
          files: [{ name: `${fileBase(file.name)}.pdf`, bytes: pdf }],
          onStartOver: reset,
        });
        return;
      }
      if (tool.id === 'pdf-md' || tool.id === 'pdf-word') {
        const id = `text-${file.name}`;
        await openPdf(id, bytes);
        try {
          const pages = await pageText(id);
          if (tool.id === 'pdf-md') {
            const md = pages.map((page, index) => `## Page ${index + 1}\n\n${page}`).join('\n\n');
            downloadBytes(new TextEncoder().encode(md), `${fileBase(file.name)}.md`, 'text/markdown');
            status.set('The Markdown file is downloading.', 'neutral');
            action.idle(verb(tool.id), true);
            return;
          }
          const docx = await paragraphsToDocx(pages.flatMap((page) => page.split(/(?<=[.!?])\s+/)));
          downloadBytes(docx, `${fileBase(file.name)}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          status.set('The Word file is downloading.', 'neutral');
          action.idle(verb(tool.id), true);
        } finally {
          releaseDocument(id);
        }
        return;
      }
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
  if (id === 'word') return 'Create PDF';
  if (id === 'pdf-word') return 'Create Word file';
  if (id === 'pdf-md') return 'Create Markdown';
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
  const mime = preset?.imageMime ?? 'image/jpeg';
  const targetBytes = preset?.imageTargetKb ? preset.imageTargetKb * 1024 : null;
  let files: File[] = (incoming ?? []).filter(isImageFile);
  const drop = dropZone({
    title: 'Drop images here',
    detail: 'JPG, PNG, WebP, GIF, or a format this browser already opens.',
    accept: 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/avif,.jpg,.jpeg,.png,.webp,.gif,.heic,.avif',
    multiple: true,
    buttonLabel: 'Choose images',
    onFiles: (picked) => {
      const { accepted, rejected } = partitionFiles(picked, isImageFile);
      files = accepted;
      status.set(rejected.length ? rejectedMessage(rejected, "isn't an image this page can read.") : `${accepted.length} images ready.`, rejected.length ? 'bad' : 'neutral');
      action.idle('Compress images', accepted.length > 0);
    },
  });
  const action = actionButton('Compress images');
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);
  panel.append(el('h2', undefined, ['Compress images']), toolIntro('Shrink photos and screenshots. Location data is removed.'), drop.el, row);
  action.idle('Compress images', files.length > 0);
  if (files.length) status.set(`${files.length} images ready.`, 'neutral');
  action.el.addEventListener('click', () => {
    void (async () => {
      action.busy('Compressing…', 0.05);
      const outputs: Array<{ name: string; bytes: Uint8Array }> = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;
        action.busy(`Compressing image ${index + 1} of ${files.length}`, index / files.length);
        const shrunk = await shrinkImage(file, mime, targetBytes);
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        outputs.push({ name: compressedName(file.name).replace(/\.pdf$/, `.${ext}`).replace(/\.[^.]+$/, `.${ext}`), bytes: shrunk });
      }
      if (outputs.length === 1 && outputs[0]) downloadBytes(outputs[0].bytes, outputs[0].name, mime);
      else await downloadZip(outputs, 'images-compressed.zip');
      status.set('The smaller images are downloading.', 'neutral');
      action.idle('Compress images', true);
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
  let maxEdge = 1600;
  let quality = 0.72;
  let best = new Uint8Array(await file.arrayBuffer());
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) break;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    best = bytes;
    if (!targetBytes || bytes.byteLength <= targetBytes || mime === 'image/png' && maxEdge <= 480) break;
    maxEdge = Math.round(maxEdge * 0.72);
    quality = Math.max(0.45, quality - 0.08);
  }
  bitmap.close();
  return best;
}

function mountHtml(panel: HTMLElement): void {
  const area = el('textarea', { id: 'html-source', rows: '8' });
  area.placeholder = `Paste HTML. ${brandName()} does not open web addresses.`;
  const fileInput = el('input', { class: 'file-input', type: 'file', accept: '.html,text/html' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      area.value = text;
    });
  });
  const choose = el('button', { class: 'btn quiet', type: 'button' }, ['Choose an HTML file']);
  choose.addEventListener('click', () => fileInput.click());
  const action = actionButton('Create PDF');
  const status = statusLine();
  const row = el('div', { class: 'action-row' }, [action.el, status.el]);
  panel.append(
    el('h2', undefined, ['HTML to PDF']),
    toolIntro(`Paste HTML or choose a file. ${brandName()} does not fetch websites, because that would leave this device.`),
    area,
    choose,
    fileInput,
    row,
  );
  action.el.addEventListener('click', () => {
    void (async () => {
      const lines = htmlToLines(area.value);
      if (lines.length === 0) {
        status.set('Paste some HTML first.', 'bad');
        return;
      }
      action.busy('Creating…', 0.2);
      const pdf = await editPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { kind: 'textpdf', lines });
      showResult(panel, { source: 'images', files: [{ name: 'page.pdf', bytes: pdf }], onStartOver: () => undefined });
    })().catch((error: unknown) => status.set(describePdfError(error), 'bad'));
  });
}

function mountCompare(panel: HTMLElement): void {
  let left: Uint8Array | null = null;
  let right: Uint8Array | null = null;
  const read = (label: string, assign: (bytes: Uint8Array) => void) => {
    const input = el('input', { class: 'file-input', type: 'file', accept: 'application/pdf,.pdf' });
    const button = el('button', { class: 'btn quiet', type: 'button' }, [label]);
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file || !isPdfFile(file)) return;
      void readFileBytes(file).then((bytes) => {
        assign(bytes);
        button.textContent = file.name;
      });
    });
    return el('div', undefined, [button, input]);
  };
  const out = el('div', { class: 'compare-list' });
  const action = actionButton('Compare PDFs');
  const status = statusLine();
  panel.append(
    el('h2', undefined, ['Compare PDFs']),
    toolIntro(`${brandName()} compares the words. Pictures are not part of this check.`),
    read('Choose the first PDF', (bytes) => {
      left = bytes;
    }),
    read('Choose the second PDF', (bytes) => {
      right = bytes;
    }),
    el('div', { class: 'action-row' }, [action.el, status.el]),
    out,
  );
  action.el.addEventListener('click', () => {
    if (!left || !right) {
      status.set('Choose two PDFs.', 'bad');
      return;
    }
    void (async () => {
      action.busy('Comparing…', 0.2);
      const a = await textOf(left);
      const b = await textOf(right);
      const changes = diffPages(a, b);
      out.replaceChildren();
      status.set(changes.summary, 'neutral');
      for (const row of changes.rows) out.append(el('p', undefined, [row]));
      action.idle('Compare PDFs', true);
    })().catch((error: unknown) => status.set(describePdfError(error), 'bad'));
  });
}

async function textOf(bytes: Uint8Array): Promise<string[]> {
  const id = `cmp-${Math.random().toString(36).slice(2)}`;
  await openPdf(id, bytes);
  try {
    return await pageText(id);
  } finally {
    releaseDocument(id);
  }
}

function diffPages(left: string[], right: string[]): { summary: string; rows: string[] } {
  const total = Math.max(left.length, right.length);
  const rows: string[] = [];
  let changed = 0;
  for (let index = 0; index < total; index += 1) {
    const a = new Set((left[index] ?? '').split(' ').filter(Boolean));
    const b = new Set((right[index] ?? '').split(' ').filter(Boolean));
    const added = [...b].filter((word) => !a.has(word));
    const removed = [...a].filter((word) => !b.has(word));
    if (added.length === 0 && removed.length === 0) continue;
    changed += 1;
    rows.push(`Page ${index + 1}: added ${added.slice(0, 8).join(', ') || 'nothing'}; removed ${removed.slice(0, 8).join(', ') || 'nothing'}.`);
  }
  return { summary: changed === 0 ? 'No word changes.' : `${changed} changed pages out of ${total}.`, rows: rows.slice(0, 12) };
}

function mountScan(panel: HTMLElement): void {
  const shots: File[] = [];
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.className = 'scan-video';
  const list = el('p', { class: 'note' }, ['No pages captured yet.']);
  const start = el('button', { class: 'btn quiet', type: 'button' }, [iconElement('camera', { size: 16, className: 'icon-inline' }), ' Open camera']);
  const snap = el('button', { class: 'btn quiet', type: 'button' }, [iconElement('camera', { size: 16, className: 'icon-inline' }), ' Capture page']);
  snap.disabled = true;
  const action = actionButton('Create PDF');
  const status = statusLine();
  let stream: MediaStream | null = null;
  start.addEventListener('click', () => {
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((next) => {
        stream = next;
        video.srcObject = next;
        snap.disabled = false;
        status.set('Frame the page, then capture it. Nothing is recorded.', 'neutral');
      })
      .catch(() => status.set('This browser did not open the camera. You can still use Images to PDF.', 'bad'));
  });
  snap.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      shots.push(new File([blob], `page-${shots.length + 1}.jpg`, { type: 'image/jpeg' }));
      list.textContent = `${shots.length} pages captured.`;
      action.idle('Create PDF', true);
    }, 'image/jpeg', 0.85);
  });
  panel.append(el('h2', undefined, ['Scan to PDF']), toolIntro('Frame each page yourself. Automatic corner finding is not in this version.'), video, start, snap, list, el('div', { class: 'action-row' }, [action.el, status.el]));
  action.idle('Create PDF', false);
  action.el.addEventListener('click', () => {
    void (async () => {
      action.busy('Creating…', 0.1);
      const prepared = [];
      for (const shot of shots) prepared.push(await prepareImageFile(shot));
      const pdf = await imagesToPdf(prepared, { pageSize: 'a4', orientation: 'portrait', margin: 'small' }, (done, total) =>
        action.busy('Creating…', total ? done / total : 0.5),
      );
      stream?.getTracks().forEach((track) => track.stop());
      showResult(panel, { source: 'images', files: [{ name: 'scan.pdf', bytes: pdf }], onStartOver: () => undefined });
    })().catch((error: unknown) => status.set(describePdfError(error), 'bad'));
  });
}

function mountAi(panel: HTMLElement, tool: ToolInfo): void {
  const supported = tool.id === 'summarize' ? 'Summarizer' in globalThis : 'Translator' in globalThis && 'LanguageDetector' in globalThis;
  const note = supported
    ? `This uses the browser’s own on-device model. ${brandName()} does not send the file anywhere.`
    : `This browser does not include on-device summarising or translation. ${brandName()} will not send the file to a cloud service.`;
  const button = el('button', { class: 'btn primary', type: 'button' }, [tool.id === 'summarize' ? 'Summarize PDF' : 'Translate PDF']);
  button.disabled = !supported;
  panel.append(el('h2', undefined, [tool.name]), toolIntro(tool.description), el('p', { class: 'status' }, [note]), button);
}

function mountWorkflows(panel: HTMLElement): void {
  const name = el('input', { type: 'text', value: 'Prepare a packet' });
  const status = statusLine();
  const list = el('div');
  let bytes: Uint8Array | null = null;
  let fileName = 'packet.pdf';
  const fileInput = el('input', { class: 'file-input', type: 'file', accept: 'application/pdf,.pdf' });
  const choose = el('button', { class: 'btn quiet', type: 'button' }, ['Choose a PDF']);
  choose.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file || !isPdfFile(file)) return;
    fileName = file.name;
    void readFileBytes(file).then((data) => {
      bytes = data;
      status.set(`${file.name} is ready.`, 'neutral');
    });
  });
  const run = el('button', { class: 'btn primary', type: 'button' }, ['Run workflow']);
  run.addEventListener('click', () => {
    if (!bytes) {
      status.set('Choose a PDF first.', 'bad');
      return;
    }
    const source = bytes;
    void (async () => {
      let current = await editPdf(source, { kind: 'rotate', turns: 1 });
      current = await editPdf(current, { kind: 'watermark', text: 'Draft' });
      current = await editPdf(current, { kind: 'numbers', start: 1, skipFirst: false });
      showResult(panel, {
        source: 'organize',
        files: [{ name: `${fileBase(fileName)}-prepared.pdf`, bytes: current }],
        onStartOver: () => undefined,
      });
    })().catch((error: unknown) => status.set(describePdfError(error), 'bad'));
  });
  const save = el('button', { class: 'btn quiet', type: 'button' }, ['Save workflow']);
  save.addEventListener('click', () => {
    void loadPrefs().then((prefs) => {
      const workflows = [...(prefs.workflows ?? []), { name: name.value.trim() || 'Workflow', steps: ['rotate', 'watermark', 'numbers'] }];
      return savePrefs({ workflows });
    }).then(() => {
      status.set('Saved on this device. The recipe is the steps only, never your files.', 'neutral');
      return paint();
    });
  });
  const erase = el('button', { class: 'btn quiet', type: 'button' }, ['Erase saved workflows']);
  erase.addEventListener('click', () => {
    void savePrefs({ workflows: [] }).then(() => {
      status.set('Saved workflows were erased.', 'neutral');
      return paint();
    });
  });
  panel.append(el('h2', undefined, ['Workflows']), toolIntro('Run rotate, then a Draft watermark, then page numbers. Saving keeps the steps only.'), choose, fileInput, name, run, save, erase, status.el, list);

  function paint(): Promise<void> {
    return loadPrefs().then((prefs) => {
      list.replaceChildren();
      for (const flow of prefs.workflows ?? []) {
        list.append(el('p', undefined, [`${flow.name}: ${flow.steps.join(' → ')}`]));
      }
    });
  }
  void paint();
}
