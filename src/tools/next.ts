import { PDFDocument } from 'pdf-lib';
import { applyAccessibilityFixes, checkAccessibility } from '../lib/a11y-check';
import { answerFromDocument, answerWithPrompt, browserPromptAvailable, findClauses, type PromptClient } from '../lib/doc-search';
import { backgroundEditAllowed, centerCrop, cornerUniformity, sheetSlots, PRINT_SHEET } from '../lib/id-photo';
import { inspectGenuine } from '../lib/genuine';
import { outputName, runHotQueue } from '../lib/hot-queue';
import { parseCommand, planLines, takePendingCommand, type CommandStep } from '../lib/commands';
import { checkAgainstRequirement, publicRequirements, reportOutdatedHref, requirementById, searchRequirements } from '../lib/requirements';
import { fixPdf, scanPdf, stripJpegMetadata, type Finding } from '../lib/share-check';
import { readLiteSignals, shouldUseLite } from '../lib/lite';
import { URL_PARAMETER_HELP } from '../lib/url-params';
import { actionButton, dropZone, el, formatBytes } from '../lib/dom';
import { isImageFile, isPdfFile } from '../lib/detect';
import { editPdf, openPdf, pageText, releaseDocument } from '../lib/pdf';
import { compressDocument, COMPRESS_LEVELS } from '../lib/pdf';
import { readFileBytes } from '../lib/pdf';
import { showResult } from './result';
import { toolPreset } from '../seo/preset';
import { brandName } from '../brand';
import type { ToolInfo } from './registry';
import { savePrefs } from '../lib/prefs';

export function mountNext(panel: HTMLElement, tool: ToolInfo, incoming?: File[]): void {
  if (tool.id === 'presets') mountPresets(panel);
  else if (tool.id === 'id-photo') mountIdPhoto(panel, incoming);
  else if (tool.id === 'share-check') mountShare(panel, incoming);
  else if (tool.id === 'commands') mountCommands(panel, incoming);
  else if (tool.id === 'accessible') mountAccessible(panel, incoming);
  else if (tool.id === 'genuine') mountGenuine(panel, incoming);
  else if (tool.id === 'chat') mountChat(panel, incoming);
  else if (tool.id === 'hot-folders') mountHot(panel);
  else if (tool.id === 'lite') mountLite(panel);
  else panel.append(el('p', undefined, ['This tool is not wired.']));
}

function listFindings(host: HTMLElement, findings: Finding[]): void {
  host.replaceChildren();
  if (!findings.length) {
    host.append(el('p', { class: 'status', 'data-tone': 'good' }, ['Nothing risky found.']));
    return;
  }
  for (const level of ['high', 'medium', 'info'] as const) {
    const group = findings.filter((item) => item.level === level);
    if (!group.length) continue;
    const title = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Info';
    host.append(el('h3', undefined, [title]));
    for (const item of group) {
      host.append(el('p', undefined, [el('strong', undefined, [item.title]), ` ${item.detail}`]));
    }
  }
}

function mountPresets(panel: HTMLElement): void {
  const wanted = toolPreset()?.presetId ?? '';
  const query = el('input', { type: 'search', 'aria-label': 'Search verified requirements', placeholder: 'Search a verified rule' });
  const list = el('div', { class: 'suggest' });
  const detail = el('div');
  const status = el('p', { class: 'status', role: 'status' });
  const checks = el('div');
  panel.append(
    el('h2', undefined, ['Get it accepted']),
    el('p', { class: 'tool-intro' }, ['Only rules checked against an official page are listed. A draft is never applied.']),
    query,
    list,
    detail,
    checks,
    status,
  );
  const paint = (text: string): void => {
    const found = searchRequirements(text);
    list.replaceChildren();
    if (!publicRequirements().length) {
      list.append(el('p', undefined, ['No verified preset is published yet. Searching for a country will not invent a file-size rule.']));
      return;
    }
    for (const entry of found) {
      const button = el('button', { class: 'btn quiet', type: 'button' }, [`${entry.country}: ${entry.documentType}`]);
      button.addEventListener('click', () => showEntry(entry.id));
      list.append(button);
    }
  };
  const showEntry = (id: string): void => {
    const entry = requirementById(id);
    detail.replaceChildren();
    if (!entry || entry.status !== 'verified') {
      detail.append(el('p', undefined, [`${id || 'This preset'} is not published. Placeholder numbers stay out of the checklist.`]));
      return;
    }
    const report = el('a', { href: reportOutdatedHref(entry), target: '_blank', rel: 'noreferrer' }, ['Report outdated']);
    detail.append(
      el('p', undefined, [`${entry.organization}. ${entry.portal}.`]),
      el('p', undefined, [`Requirement last checked: ${entry.lastVerified}.`]),
      el('p', undefined, [el('a', { href: entry.sourceUrl, target: '_blank', rel: 'noreferrer' }, ['Official source']), ' ', report]),
    );
  };
  query.addEventListener('input', () => paint(query.value));
  paint(wanted);
  if (wanted) showEntry(wanted);
  const drop = dropZone({
    title: 'Drop a file',
    detail: 'The checklist uses the selected verified rule.',
    accept: 'application/pdf,image/*',
    multiple: false,
    buttonLabel: 'Choose a file',
    onFiles: (files) => {
      const file = files[0];
      const entry = requirementById(wanted);
      if (!file || !entry) {
        status.textContent = 'Choose a verified preset first. None are published yet.';
        return;
      }
      void file.arrayBuffer().then(async (buffer) => {
        const bytes = new Uint8Array(buffer);
        let width: number | undefined;
        let height: number | undefined;
        if (isImageFile(file)) {
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close();
        }
        const items = checkAgainstRequirement(
          { mime: file.type || 'application/octet-stream', bytes: bytes.byteLength, ...(width ? { width } : {}), ...(height ? { height } : {}) },
          entry,
        );
        checks.replaceChildren();
        for (const item of items) {
          const mark = item.met === true ? 'Met' : item.met === false ? 'Not met' : 'Not checked';
          checks.append(el('p', undefined, [`${mark}: ${item.label}. ${item.detail}`]));
        }
      });
    },
  });
  panel.append(drop.el);
}

function mountIdPhoto(panel: HTMLElement, incoming?: File[]): void {
  const width = el('input', { type: 'number', min: '100', max: '2000', value: '600', 'aria-label': 'Width in pixels' });
  const height = el('input', { type: 'number', min: '100', max: '2000', value: '600', 'aria-label': 'Height in pixels' });
  const preview = el('canvas');
  const checks = el('div');
  const notice = backgroundEditAllowed(null).notice;
  const bg = el('button', { class: 'btn quiet', type: 'button', disabled: 'true' }, ['Replace background']);
  bg.disabled = true;
  const sheet = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'print-sheet' }, ['Download print sheet']);
  sheet.disabled = true;
  let last: HTMLCanvasElement | null = null;
  const paint = async (file: File): Promise<void> => {
    const bitmap = await createImageBitmap(file);
    const tw = Number(width.value) || 600;
    const th = Number(height.value) || 600;
    const crop = centerCrop(bitmap.width, bitmap.height, tw, th);
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, tw, th);
    bitmap.close();
    preview.width = tw;
    preview.height = th;
    preview.getContext('2d')?.drawImage(canvas, 0, 0);
    last = canvas;
    sheet.disabled = false;
    const sample = ctx.getImageData(0, 0, tw, th);
    const corners = cornerUniformity(sample.data, tw, th);
    checks.replaceChildren(
      el('p', undefined, [`Dimensions: ${tw}×${th} pixels.`]),
      el('p', undefined, [corners.detail]),
      el('p', undefined, ['Face position, head size, and eyes are not checked. This version has no face detector. The crop is centered and the face is not smoothed or reshaped.']),
      el('p', undefined, [notice]),
    );
  };
  const drop = dropZone({
    title: 'Drop a photo',
    detail: 'or take one with the camera button.',
    accept: 'image/*',
    multiple: false,
    buttonLabel: 'Choose a photo',
    onFiles: (files) => {
      const file = files[0];
      if (file) void paint(file);
    },
  });
  const camera = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'capture-photo' }, ['Use the camera']);
  camera.addEventListener('click', () => {
    void navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' } }).then((stream) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      void video.play();
      const take = el('button', { class: 'btn primary', type: 'button' }, ['Take photo']);
      take.addEventListener('click', () => {
        const grab = document.createElement('canvas');
        grab.width = video.videoWidth || 640;
        grab.height = video.videoHeight || 480;
        grab.getContext('2d')?.drawImage(video, 0, 0);
        for (const track of stream.getTracks()) track.stop();
        video.remove();
        take.remove();
        void blobFromCanvas(grab, 'image/jpeg').then((blob) => paint(new File([blob], 'camera.jpg', { type: 'image/jpeg' })));
      });
      panel.append(video, take);
    }).catch(() => {
      checks.replaceChildren(el('p', undefined, ['The camera is not available in this browser.']));
    });
  });
  sheet.addEventListener('click', () => {
    if (!last) return;
    const board = document.createElement('canvas');
    board.width = PRINT_SHEET.width;
    board.height = PRINT_SHEET.height;
    const ctx = board.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, board.width, board.height);
    ctx.strokeStyle = '#14181f';
    for (const slot of sheetSlots(last.width, last.height)) {
      ctx.drawImage(last, slot.x, slot.y);
      ctx.strokeRect(slot.x, slot.y, last.width, last.height);
    }
    void blobFromCanvas(board, 'image/png').then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'id-photo-sheet.png';
      link.click();
      URL.revokeObjectURL(url);
    });
  });
  panel.append(
    el('h2', undefined, ['ID photo']),
    el('p', { class: 'tool-intro' }, ['Center crop to the pixel size you set. Nothing retouches the face.']),
    el('label', undefined, ['Width ', width]),
    el('label', undefined, ['Height ', height]),
    drop.el,
    camera,
    bg,
    sheet,
    preview,
    checks,
  );
  const first = incoming?.[0];
  if (first && isImageFile(first)) void paint(first);
}

function mountShare(panel: HTMLElement, incoming?: File[]): void {
  let bytes: Uint8Array | null = null;
  let name = 'document';
  let image = false;
  const findingsHost = el('div');
  const status = el('p', { class: 'status', role: 'status' });
  const fix = actionButton('Fix all');
  fix.el.dataset.action = 'fix-share-risks';
  fix.idle('Fix all', false);
  const render = (findings: Finding[]): void => {
    listFindings(findingsHost, findings);
    fix.idle('Fix all', findings.length > 0);
  };
  const scan = async (): Promise<void> => {
    if (!bytes) return;
    status.textContent = 'Checking on this device.';
    if (image) {
      const marked = new TextDecoder('latin1').decode(bytes).includes('GPSLatitude');
      render(marked ? [{ id: 'gps', level: 'high', title: 'Location data is in the photo', detail: 'A GPS tag was found. Fixing rewrites the photo without that tag.' }] : []);
      return;
    }
    render(await scanPdf(bytes));
  };
  const drop = dropZone({
    title: 'Drop a PDF or a photo',
    detail: 'The check stays in this browser.',
    accept: 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg',
    multiple: false,
    buttonLabel: 'Choose a file',
    onFiles: (files) => {
      const file = files[0];
      if (!file) return;
      name = file.name;
      image = isImageFile(file) && !isPdfFile(file);
      void readFileBytes(file).then((data) => {
        bytes = data;
        void scan();
      });
    },
  });
  fix.el.addEventListener('click', () => {
    if (!bytes) return;
    void (async () => {
      const before = bytes.byteLength;
      const next = image ? stripJpegMetadata(bytes) : await fixPdf(bytes);
      bytes = next;
      await scan();
      status.textContent = findingsHost.textContent?.includes('Nothing risky found')
        ? 'Checked again. Nothing risky found.'
        : 'Checked again. Some signals are still listed above.';
      showResult(panel, {
        source: 'compress',
        files: [{ name: image ? name.replace(/\.\w+$/, '') + '-clean.jpg' : name.replace(/\.pdf$/i, '') + '-clean.pdf', bytes: next }],
        beforeBytes: before,
        onStartOver: () => undefined,
      });
    })();
  });
  panel.append(el('h2', undefined, ['Safe to share']), el('p', { class: 'tool-intro' }, ['Signals, not a guarantee. A clean list means this check found nothing it knows how to see.']), drop.el, findingsHost, status, fix.el);
  const first = incoming?.[0];
  if (first) drop.el.querySelector('input')?.dispatchEvent(new Event('change'));
  if (first) {
    name = first.name;
    image = isImageFile(first) && !isPdfFile(first);
    void readFileBytes(first).then((data) => {
      bytes = data;
      void scan();
    });
  }
}

function mountCommands(panel: HTMLElement, incoming?: File[]): void {
  const field = el('textarea', { 'aria-label': 'Instruction', rows: '3' });
  field.placeholder = 'make this under 2 MB and remove page 3';
  const plan = el('div');
  const status = el('p', { class: 'status', role: 'status' });
  const run = el('button', { class: 'btn primary', type: 'button', 'data-action': 'run-command' }, ['Run']);
  const edit = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'edit-command' }, ['Edit']);
  run.disabled = true;
  let steps: CommandStep[] | null = takePendingCommand();
  let chosen: File[] = incoming ? [...incoming] : [];
  const paint = (): void => {
    plan.replaceChildren();
    if (!steps) {
      plan.append(el('p', undefined, ['Type an instruction. Nothing runs until you press Run.']));
      run.disabled = true;
      return;
    }
    for (const line of planLines(steps)) plan.append(el('p', undefined, [line]));
    plan.append(el('p', undefined, ['Confirm these steps. Nothing has run yet.']));
    run.disabled = chosen.length === 0;
  };
  field.addEventListener('input', () => {
    steps = parseCommand(field.value);
    if (!steps && browserPromptAvailable()) status.textContent = 'The built-in parser did not recognise that. An on-device model is available, and this version still will not send the sentence to a server.';
    else status.textContent = '';
    paint();
  });
  edit.addEventListener('click', () => field.focus());
  const drop = dropZone({
    title: 'Drop the PDF these steps should use',
    detail: 'One file for compress, rotate, or delete. Two or more to merge.',
    accept: 'application/pdf,.pdf',
    multiple: true,
    buttonLabel: 'Choose PDFs',
    onFiles: (files) => {
      chosen = files;
      status.textContent = files.length ? `${files.length} file${files.length === 1 ? '' : 's'} ready.` : '';
      paint();
    },
  });
  run.addEventListener('click', () => {
    if (!steps || !chosen.length) return;
    void runSteps(chosen, steps, status, panel);
  });
  panel.append(el('h2', undefined, ['Commands']), el('p', { class: 'tool-intro' }, ['The plan is shown first. Run is the confirmation.']), field, plan, drop.el, edit, run, status);
  if (steps) {
    field.value = steps.map((step) => step.label).join('. ');
    paint();
  }
}

async function runSteps(files: File[], steps: CommandStep[], status: HTMLElement, panel: HTMLElement): Promise<void> {
  let bytes = new Uint8Array(await files[0]!.arrayBuffer());
  const name = files[0]!.name;
  for (const step of steps) {
    if (step.op === 'unsupported') {
      status.textContent = step.label;
      continue;
    }
    status.textContent = step.label;
    if (step.op === 'delete-pages') {
      const doc = await PDFDocument.load(bytes);
      const indexes = doc.getPageIndices();
      const dropPages = new Set(step.lastPage ? [indexes.length] : (step.pages ?? []));
      const keep = indexes.filter((index) => !dropPages.has(index + 1));
      const out = await PDFDocument.create();
      const copied = await out.copyPages(doc, keep);
      for (const page of copied) out.addPage(page);
      bytes = new Uint8Array(await out.save());
    } else if (step.op === 'rotate' && step.turns) {
      bytes = new Uint8Array(await editPdf(bytes, { kind: 'rotate', turns: step.turns }));
    } else if (step.op === 'watermark' && step.text) {
      bytes = new Uint8Array(await editPdf(bytes, { kind: 'watermark', text: step.text }));
    } else if (step.op === 'numbers') {
      bytes = new Uint8Array(await editPdf(bytes, { kind: 'numbers', start: 1, skipFirst: false }));
    } else if (step.op === 'compress' || step.op === 'grayscale') {
      const id = `cmd-${Date.now()}`;
      await openPdf(id, bytes);
      const level = COMPRESS_LEVELS[step.targetKb && step.targetKb <= 200 ? 'strong' : 'recommended'];
      const saved = await compressDocument(id, { ...level, grayscale: step.op === 'grayscale', squeeze: false }, () => undefined);
      releaseDocument(id);
      bytes = new Uint8Array(saved.bytes);
      if (step.targetKb) status.textContent = `Compress finished at ${formatBytes(bytes.byteLength)}. ${formatBytes(step.targetKb * 1024)} was the goal, not a promise.`;
    } else if (step.op === 'merge') {
      status.textContent = files.length < 2 ? 'Merge needs at least two PDFs.' : 'Open Merge PDF to combine these files in order.';
    } else if (step.op === 'split') {
      status.textContent = step.range ? `Open Split PDF. The range ${step.range} is the plan.` : 'Open Split PDF to choose pages.';
    }
  }
  showResult(panel, {
    source: 'compress',
    files: [{ name: name.replace(/\.pdf$/i, '') + '-edited.pdf', bytes }],
    onStartOver: () => undefined,
  });
}

function mountAccessible(panel: HTMLElement, incoming?: File[]): void {
  let bytes: Uint8Array | null = null;
  const report = el('div');
  const title = el('input', { type: 'text', 'aria-label': 'Document title' });
  const language = el('input', { type: 'text', value: 'en', 'aria-label': 'Language code' });
  const fix = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'fix-title-language' }, ['Write title and language']);
  const note = el('p', undefined, ['Automatic fixes cover the title and the language you type. For legal compliance, review the report and test with a screen reader. Free checkers such as PDF Accessibility Checker and Adobe Acrobat\'s checker are outside this app.']);
  const paint = async (): Promise<void> => {
    if (!bytes) return;
    report.replaceChildren();
    for (const item of await checkAccessibility(bytes)) {
      const state = item.state === 'pass' ? 'Pass' : item.state === 'fix' ? 'Fix available' : 'Needs a human';
      report.append(el('p', undefined, [`${state}: ${item.title}. ${item.detail}`]));
    }
  };
  fix.addEventListener('click', () => {
    void (async () => {
      if (!bytes) return;
      bytes = await applyAccessibilityFixes(bytes, title.value, language.value);
      await paint();
    })();
  });
  const drop = dropZone({
    title: 'Drop a PDF',
    detail: 'The report runs on this device.',
    accept: 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: 'Choose a PDF',
    onFiles: (files) => {
      const file = files[0];
      if (!file) return;
      title.value = file.name.replace(/\.pdf$/i, '');
      void readFileBytes(file).then((data) => {
        bytes = data;
        void paint();
      });
    },
  });
  panel.append(el('h2', undefined, ['Make accessible']), el('p', { class: 'tool-intro' }, ['This is an in-house report. It is not a PDF/UA certificate.']), drop.el, report, el('label', undefined, ['Title ', title]), el('label', undefined, ['Language ', language]), fix, note);
  const first = incoming?.[0];
  if (first) void readFileBytes(first).then((data) => { bytes = data; title.value = first.name.replace(/\.pdf$/i, ''); void paint(); });
}

function mountGenuine(panel: HTMLElement, incoming?: File[]): void {
  const report = el('div');
  const drop = dropZone({
    title: 'Drop a PDF',
    detail: 'The wording stays short of a verdict.',
    accept: 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: 'Choose a PDF',
    onFiles: (files) => {
      const file = files[0];
      if (!file) return;
      void readFileBytes(file).then(async (bytes) => {
        const found = await inspectGenuine(bytes);
        report.replaceChildren(...found.lines.map((line) => el('p', undefined, [line])));
      });
    },
  });
  panel.append(el('h2', undefined, ['Signature check']), el('p', { class: 'tool-intro' }, ['Coverage and edit signals. This does not prove who signed, and it does not say a file is genuine.']), drop.el, report);
  const first = incoming?.[0];
  if (first) void readFileBytes(first).then(async (bytes) => {
    const found = await inspectGenuine(bytes);
    report.replaceChildren(...found.lines.map((line) => el('p', undefined, [line])));
  });
}

function mountChat(panel: HTMLElement, incoming?: File[]): void {
  let pages: string[] = [];
  const question = el('input', { type: 'text', 'aria-label': 'Question about this document' });
  const answer = el('div');
  const ask = el('button', { class: 'btn primary', type: 'button', 'data-action': 'ask-document' }, ['Ask']);
  const clear = (): void => {
    pages = [];
    answer.replaceChildren();
  };
  const show = (text: string, cited: number[]): void => {
    answer.replaceChildren(el('p', undefined, [text]));
    for (const page of cited) {
      const jump = el('button', { class: 'btn quiet', type: 'button' }, [`Page ${page}`]);
      jump.addEventListener('click', () => {
        const passage = pages[page - 1] ?? '';
        answer.append(el('p', undefined, [`Page ${page}: ${passage}`]));
      });
      answer.append(jump);
    }
  };
  ask.addEventListener('click', () => {
    const client: PromptClient | null = null;
    void answerWithPrompt(pages, question.value, client).then((result) => show(result.text, result.pages));
  });
  for (const label of ['Summarize', 'Dates and amounts', 'Clauses']) {
    const button = el('button', { class: 'btn quiet', type: 'button' }, [label]);
    button.addEventListener('click', () => {
      if (label === 'Clauses') {
        const hits = findClauses(pages);
        show(hits.length ? hits.map((hit) => `Page ${hit.page}: ${hit.text}`).join('\n') : "I couldn't find that in this document.", hits.map((hit) => hit.page));
        return;
      }
      const query = label === 'Summarize' ? 'summary of the pages' : 'date amount payment';
      const result = answerFromDocument(pages, query);
      show(result.text, result.pages);
    });
    panel.append(button);
  }
  const drop = dropZone({
    title: 'Drop a PDF',
    detail: 'Text is read on this device. The index is dropped when you start over.',
    accept: 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: 'Choose a PDF',
    onFiles: (files) => {
      const file = files[0];
      if (!file) return;
      clear();
      void readFileBytes(file).then(async (bytes) => {
        const id = `chat-${Date.now()}`;
        await openPdf(id, bytes);
        pages = await pageText(id);
        releaseDocument(id);
        answer.replaceChildren(el('p', undefined, [`${pages.length} pages read. Ask a question. A downloadable model is not published with this version, so answers come from the words in the file.`]));
      });
    },
  });
  const reset = el('button', { class: 'btn quiet', type: 'button' }, ['Close the document']);
  reset.addEventListener('click', clear);
  panel.prepend(el('h2', undefined, ['Chat with PDF']), el('p', { class: 'tool-intro' }, ['Every answer cites a page, or says the document does not contain it.']), drop.el, question, ask);
  panel.append(answer, reset);
  const first = incoming?.[0];
  if (first) void readFileBytes(first).then(async (bytes) => {
    const id = `chat-${Date.now()}`;
    await openPdf(id, bytes);
    pages = await pageText(id);
    releaseDocument(id);
  });
}

interface DirHandle {
  entries(): AsyncIterable<[string, { kind: string }]>;
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, options?: { create: boolean }): Promise<{
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void> }>;
  }>;
}

function mountHot(panel: HTMLElement): void {
  const log = el('div');
  const status = el('p', undefined, [`Runs while ${brandName()} is open. New files are copies, not compressed. Originals stay in place.`]);
  const supported = 'showDirectoryPicker' in window;
  if (!supported) {
    panel.append(el('h2', undefined, ['Hot folders']), el('p', { class: 'tool-intro' }, ['Folder watching needs a desktop Chromium browser. This browser does not offer it.']));
    return;
  }
  let paused = false;
  let timer = 0;
  const pause = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'pause-hot-folder' }, ['Pause']);
  const start = el('button', { class: 'btn primary', type: 'button', 'data-action': 'start-hot-folder' }, ['Choose an input folder']);
  start.addEventListener('click', () => {
    const picker = (window as unknown as { showDirectoryPicker: () => Promise<DirHandle> }).showDirectoryPicker;
    void picker().then(async (input) => {
      const output = await input.getDirectoryHandle(`${brandName()} output`, { create: true });
      const tick = async (): Promise<void> => {
        const names: string[] = [];
        for await (const [name, handle] of input.entries()) {
          if (handle.kind === 'file' && name.toLowerCase().endsWith('.pdf')) names.push(name);
        }
        const events = await runHotQueue(names, async (file) => {
          const source = await input.getFileHandle(file);
          const blob = await (await source.getFile()).arrayBuffer();
          const target = outputName(file);
          const dest = await output.getFileHandle(target, { create: true });
          const writable = await dest.createWritable();
          await writable.write(blob);
          await writable.close();
          return { savedBytes: 0 };
        }, () => paused);
        log.replaceChildren(...events.slice(-8).map((event) => el('p', undefined, [`${event.file}: ${event.detail}`])));
      };
      await tick();
      timer = window.setInterval(() => void tick().catch(() => {
        status.textContent = 'Permission was lost. Choose the folder again.';
        window.clearInterval(timer);
      }), 5000);
    }).catch(() => {
      status.textContent = 'The folder was not chosen.';
    });
  });
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? 'Resume' : 'Pause';
  });
  panel.append(el('h2', undefined, ['Hot folders']), status, start, pause, log);
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}

function mountLite(panel: HTMLElement): void {
  const on = shouldUseLite({ ...readLiteSignals(), forced: true });
  if (on) document.documentElement.dataset.lite = 'on';
  void savePrefs({ lite: true });
  panel.append(
    el('h2', undefined, ['Lite mode']),
    el('p', { class: 'tool-intro' }, ['Animations stay off. The everyday tools are Compress, Merge, Images to PDF, ID photo resize, and Safe to share.']),
    el('p', undefined, ['No model is downloaded unless you ask, and this version has no model file to ask for.']),
  );
  for (const item of URL_PARAMETER_HELP) panel.append(el('p', undefined, [item.path]));
}

function blobFromCanvas(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The canvas was empty.'))), type);
  });
}
