import { PDFDocument } from 'pdf-lib';
import { applyAccessibilityFixes, checkAccessibility } from '../lib/a11y-check';
import { answerFromDocument, answerWithPrompt, browserPromptAvailable, findClauses, type PromptClient } from '../lib/doc-search';
import { centerCrop, cornerUniformity, sheetSlots, PRINT_SHEET } from '../lib/id-photo';
import { inspectGenuine } from '../lib/genuine';
import { outputName, runHotQueue } from '../lib/hot-queue';
import { parseCommand, planLines, takePendingCommand, type CommandStep } from '../lib/commands';
import { checkAgainstRequirement, parseCustomRule, publicRequirements, reportOutdatedHref, requirementById, searchRequirements, type Requirement } from '../lib/requirements';
import { fixPdf, scanPdf, stripJpegMetadata, type Finding } from '../lib/share-check';
import { readLiteSignals, shouldUseLite } from '../lib/lite';
import { URL_PARAMETER_HELP } from '../lib/url-params';
import { actionButton, dropZone, el, formatBytes, toolIntro } from '../lib/dom';
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
  let selectedEntry: Requirement | null = wanted ? requirementById(wanted) ?? null : null;

  const title = el('h2', undefined, ['Get it accepted']);
  const intro = el('p', { class: 'tool-intro' }, [
    'Check your file against verified government and exam upload rules, or enter any custom form requirement.',
  ]);

  const customBox = el('div', { class: 'custom-rule-box', style: 'background:var(--paper-2);padding:14px;border-radius:var(--radius-md);margin-bottom:16px;border:1px solid var(--rule);' });
  const customInput = el('input', { type: 'text', placeholder: 'e.g. JPG, 20–50 KB, 200×230 px or PDF under 200 KB', style: 'width:100%;max-width:400px;padding:8px 12px;margin-right:8px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);' });
  const customBtn = el('button', { class: 'btn quiet', type: 'button' }, ['Apply Custom Rule']);
  customBox.append(
    el('strong', { style: 'display:block;margin-bottom:6px;font-size:13px;' }, ['Type any form rule:']),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;' }, [customInput, customBtn]),
  );

  const filterRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;' });
  const countryFilters = ['All', 'US', 'UK', 'Canada', 'Schengen', 'India', 'China', 'Japan'];
  countryFilters.forEach((c) => {
    const pill = el('button', { class: 'btn quiet', type: 'button', style: 'font-size:12px;padding:4px 8px;' }, [c]);
    pill.addEventListener('click', () => {
      query.value = c === 'All' ? '' : c;
      paint(query.value);
    });
    filterRow.append(pill);
  });

  const query = el('input', { type: 'search', 'aria-label': 'Search verified requirements', placeholder: 'Search by country, exam, or photo type (e.g. Canada visa, JEE Main signature)…', style: 'width:100%;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);' });
  const list = el('div', { class: 'suggest', style: 'display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;max-height:160px;overflow-y:auto;' });
  const detail = el('div', { style: 'margin:12px 0;padding:12px;background:var(--paper-2);border-radius:var(--radius-sm);border:1px solid var(--rule);' });
  const status = el('p', { class: 'status', role: 'status' });
  const checks = el('div', { style: 'margin-top:12px;' });
  const toolLinkRow = el('div', { style: 'margin-top:12px;' });

  const showEntry = (entry: Requirement): void => {
    selectedEntry = entry;
    detail.replaceChildren();
    toolLinkRow.replaceChildren();

    const report = el('a', { href: reportOutdatedHref(entry), target: '_blank', rel: 'noreferrer' }, ['Report outdated']);
    const sourceLink = el('a', { href: entry.sourceUrl, target: '_blank', rel: 'noreferrer' }, ['Official source']);

    const req = entry.requirements;
    const dim = req.widthMm ? `${req.widthMm}×${req.heightMm} mm` : req.minWidth ? `${req.minWidth}×${req.minHeight} px` : 'Any';
    const sz = req.minBytes && req.maxBytes ? `${Math.round(req.minBytes / 1024)}–${Math.round(req.maxBytes / 1024)} KB` : req.maxBytes ? `≤ ${Math.round(req.maxBytes / 1024)} KB` : 'Any';

    detail.append(
      el('h3', { style: 'margin:0 0 4px;' }, [`${entry.country}: ${entry.documentType}`]),
      el('p', { style: 'margin:0 0 6px;color:var(--ink-2);font-size:13px;' }, [`${entry.organization} (${entry.portal})`]),
      el('p', { style: 'margin:0 0 6px;font-size:13px;' }, [`Requirements: ${dim} · ${sz} · ${req.formats.join(' or ')} · Background: ${req.background ?? 'Normal'}`]),
      el('p', { style: 'margin:0;font-size:12px;color:var(--ink-2);' }, [`Verified: ${entry.lastVerified} · `, sourceLink, ' · ', report]),
    );

    status.textContent = `Active preset: ${entry.country} ${entry.documentType}. Drop your file below to verify.`;

    const isSig = entry.documentType.toLowerCase().includes('signature');
    const isPhoto = entry.documentType.toLowerCase().includes('photo');
    const toolHref = isSig ? '#/signature-resizer' : isPhoto ? '#/id-photo' : '#/compress-pdf';
    const toolText = isSig ? 'Open Signature Resizer →' : isPhoto ? 'Open ID Photo Maker →' : 'Open PDF Compressor →';

    const launchBtn = el('a', { class: 'btn primary', href: toolHref }, [toolText]);
    toolLinkRow.append(launchBtn);
  };

  customBtn.addEventListener('click', () => {
    if (!customInput.value.trim()) return;
    const parsed = parseCustomRule(customInput.value);
    showEntry(parsed);
  });

  const paint = (text: string): void => {
    const found = searchRequirements(text);
    list.replaceChildren();
    if (!found.length) {
      list.append(el('p', undefined, ['No matching preset found. You can type any rule in the Custom box above.']));
      return;
    }
    for (const entry of found.slice(0, 16)) {
      const button = el('button', { class: 'btn quiet', type: 'button', style: 'font-size:12px;padding:4px 8px;' }, [`${entry.country}: ${entry.documentType}`]);
      button.addEventListener('click', () => showEntry(entry));
      list.append(button);
    }
  };

  query.addEventListener('input', () => paint(query.value));
  paint(wanted);
  if (selectedEntry) {
    showEntry(selectedEntry);
  } else if (publicRequirements().length) {
    showEntry(publicRequirements()[0]!);
  }

  const drop = dropZone({
    title: 'Drop a file to verify',
    detail: 'The checklist validates against the active preset.',
    accept: 'application/pdf,image/*',
    multiple: false,
    buttonLabel: 'Choose a file',
    onFiles: (files) => {
      const file = files[0];
      if (!file || !selectedEntry) {
        status.textContent = 'Select a preset or apply a custom rule first.';
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
          selectedEntry!,
        );
        checks.replaceChildren();
        for (const item of items) {
          const mark = item.met === true ? '✓ Met' : item.met === false ? '✗ Not met' : '○ Info';
          const color = item.met === true ? 'var(--safe)' : item.met === false ? '#DC2626' : 'var(--ink-2)';
          checks.append(el('p', { style: `color:${color};margin:4px 0;font-size:13px;` }, [`${mark}: ${item.label}. ${item.detail}`]));
        }
      });
    },
  });

  panel.append(
    title,
    intro,
    customBox,
    query,
    filterRow,
    list,
    detail,
    drop.el,
    checks,
    toolLinkRow,
    status,
  );
}

function mountIdPhoto(panel: HTMLElement, incoming?: File[]): void {
  panel.replaceChildren();

  let activeUnit: 'px' | 'mm' | 'in' = 'px';
  let targetWidthPx = 600;
  let targetHeightPx = 600;
  let targetMaxKb: number | null = 240;
  let chosenBg = '#FFFFFF';
  let activeFile: File | null = incoming?.find(isImageFile) ?? null;
  let last: HTMLCanvasElement | null = null;

  const presetId = toolPreset()?.presetId;
  if (presetId) {
    const req = requirementById(presetId);
    if (req) {
      if (req.requirements.widthMm && req.requirements.heightMm) {
        targetWidthPx = Math.round((req.requirements.widthMm * 300) / 25.4);
        targetHeightPx = Math.round((req.requirements.heightMm * 300) / 25.4);
      } else if (req.requirements.minWidth && req.requirements.minHeight) {
        targetWidthPx = req.requirements.minWidth;
        targetHeightPx = req.requirements.minHeight;
      }
      if (req.requirements.maxBytes) targetMaxKb = Math.round(req.requirements.maxBytes / 1024);
    }
  }

  const title = el('h2', undefined, ['ID & Passport Photo Maker']);
  const intro = toolIntro('Crop photos to exact passport and visa specifications in px, mm, or inches, and change background color without uploading.');

  const unitSelect = el('select', { class: 'select', style: 'padding:4px 8px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);' }, [
    el('option', { value: 'px' }, ['Pixels (px)']),
    el('option', { value: 'mm' }, ['Millimetres (mm)']),
    el('option', { value: 'in' }, ['Inches (in)']),
  ]);

  const widthInput = el('input', { type: 'number', min: '10', max: '4000', value: String(targetWidthPx), style: 'width:90px;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);' });
  const heightInput = el('input', { type: 'number', min: '10', max: '4000', value: String(targetHeightPx), style: 'width:90px;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--rule);background:var(--paper);color:var(--ink);' });
  const unitLabel = el('span', { class: 'num', style: 'font-size:13px;color:var(--ink-2);' }, ['px @ 300 DPI']);

  const presetsRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;' });
  const sizePresets = [
    { label: 'US / India (2×2 in / 51×51 mm)', wMm: 51, hMm: 51 },
    { label: 'UK / Schengen / Canada (35×45 mm)', wMm: 35, hMm: 45 },
    { label: 'China Visa (33×48 mm)', wMm: 33, hMm: 48 },
    { label: 'Square (600×600 px)', pxW: 600, pxH: 600 },
  ];
  sizePresets.forEach((sp) => {
    const btn = el('button', { class: 'btn quiet', type: 'button', style: 'font-size:12px;padding:4px 8px;' }, [sp.label]);
    btn.addEventListener('click', () => {
      if (sp.wMm && sp.hMm) {
        targetWidthPx = Math.round((sp.wMm * 300) / 25.4);
        targetHeightPx = Math.round((sp.hMm * 300) / 25.4);
        if (activeUnit === 'mm') {
          widthInput.value = String(sp.wMm);
          heightInput.value = String(sp.hMm);
        } else if (activeUnit === 'in') {
          widthInput.value = String(Math.round((sp.wMm / 25.4) * 100) / 100);
          heightInput.value = String(Math.round((sp.hMm / 25.4) * 100) / 100);
        } else {
          widthInput.value = String(targetWidthPx);
          heightInput.value = String(targetHeightPx);
        }
      } else if (sp.pxW && sp.pxH) {
        targetWidthPx = sp.pxW;
        targetHeightPx = sp.pxH;
        activeUnit = 'px';
        unitSelect.value = 'px';
        unitLabel.textContent = 'px @ 300 DPI';
        widthInput.value = String(sp.pxW);
        heightInput.value = String(sp.pxH);
      }
      if (activeFile) void paint(activeFile);
    });
    presetsRow.append(btn);
  });

  unitSelect.addEventListener('change', () => {
    activeUnit = unitSelect.value as 'px' | 'mm' | 'in';
    unitLabel.textContent = activeUnit === 'px' ? 'px @ 300 DPI' : activeUnit === 'mm' ? 'mm @ 300 DPI' : 'in @ 300 DPI';
    if (activeUnit === 'mm') {
      widthInput.value = String(Math.round((targetWidthPx * 25.4) / 300));
      heightInput.value = String(Math.round((targetHeightPx * 25.4) / 300));
    } else if (activeUnit === 'in') {
      widthInput.value = String(Math.round((targetWidthPx / 300) * 100) / 100);
      heightInput.value = String(Math.round((targetHeightPx / 300) * 100) / 100);
    } else {
      widthInput.value = String(targetWidthPx);
      heightInput.value = String(targetHeightPx);
    }
  });

  const updateDimensions = (): void => {
    const wVal = parseFloat(widthInput.value) || 10;
    const hVal = parseFloat(heightInput.value) || 10;
    if (activeUnit === 'mm') {
      targetWidthPx = Math.round((wVal * 300) / 25.4);
      targetHeightPx = Math.round((hVal * 300) / 25.4);
    } else if (activeUnit === 'in') {
      targetWidthPx = Math.round(wVal * 300);
      targetHeightPx = Math.round(hVal * 300);
    } else {
      targetWidthPx = Math.round(wVal);
      targetHeightPx = Math.round(hVal);
    }
    if (activeFile) void paint(activeFile);
  };
  widthInput.addEventListener('input', updateDimensions);
  heightInput.addEventListener('input', updateDimensions);

  const bgRow = el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0;' });
  const bgColors = [
    { label: 'White', color: '#FFFFFF' },
    { label: 'Off-White', color: '#F5F5F0' },
    { label: 'Light Blue', color: '#B0D4F1' },
    { label: 'Royal Blue', color: '#1E40AF' },
    { label: 'Red', color: '#DC2626' },
  ];
  const colorPicker = el('input', { type: 'color', value: '#FFFFFF', 'aria-label': 'Custom background color', style: 'width:36px;height:32px;padding:0;border:1px solid var(--rule);border-radius:var(--radius-sm);cursor:pointer;' });
  colorPicker.addEventListener('input', () => {
    chosenBg = colorPicker.value;
    if (activeFile) void paint(activeFile);
  });

  bgColors.forEach((c) => {
    const dot = el('button', { class: 'btn quiet', type: 'button', style: 'display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 8px;' }, [
      el('span', { style: `display:inline-block;width:12px;height:12px;border-radius:50%;background:${c.color};border:1px solid #CBD5E1;` }),
      c.label,
    ]);
    dot.addEventListener('click', () => {
      chosenBg = c.color;
      colorPicker.value = c.color;
      if (activeFile) void paint(activeFile);
    });
    bgRow.append(dot);
  });
  bgRow.append(el('span', { style: 'font-size:12px;color:var(--ink-2);margin-left:4px;' }, ['Custom:']), colorPicker);

  const preview = el('canvas');
  preview.style.maxWidth = '100%';
  preview.style.maxHeight = '280px';
  preview.style.border = '1px solid var(--rule)';
  preview.style.borderRadius = 'var(--radius-sm)';
  preview.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';

  const checks = el('div', { style: 'margin-top:10px;' });
  const sheet = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'print-sheet' }, ['Download print sheet (4×6")']);
  sheet.disabled = true;

  const downloadPhotoBtn = el('button', { class: 'btn primary', type: 'button' }, ['Download photo']);
  downloadPhotoBtn.disabled = true;

  const replaceBgBtn = el('button', { class: 'btn quiet', type: 'button' }, ['Apply background color']);
  replaceBgBtn.disabled = true;

  const paint = async (file: File, applyBgReplace = false): Promise<void> => {
    activeFile = file;
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      checks.replaceChildren(el('p', { class: 'status', 'data-tone': 'bad' }, ['Could not read image file.']));
      return;
    }

    const crop = centerCrop(bitmap.width, bitmap.height, targetWidthPx, targetHeightPx);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidthPx;
    canvas.height = targetHeightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, targetWidthPx, targetHeightPx);
    bitmap.close();

    if (applyBgReplace && chosenBg) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      const cornerR = (data[0]! + data[(canvas.width - 1) * 4]! + data[(canvas.height - 1) * canvas.width * 4]!) / 3;
      const cornerG = (data[1]! + data[(canvas.width - 1) * 4 + 1]! + data[(canvas.height - 1) * canvas.width * 4 + 1]!) / 3;
      const cornerB = (data[2]! + data[(canvas.width - 1) * 4 + 2]! + data[(canvas.height - 1) * canvas.width * 4 + 2]!) / 3;

      const hex = chosenBg.replace('#', '');
      const tR = parseInt(hex.slice(0, 2), 16);
      const tG = parseInt(hex.slice(2, 4), 16);
      const tB = parseInt(hex.slice(4, 6), 16);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const dist = Math.sqrt((r - cornerR) ** 2 + (g - cornerG) ** 2 + (b - cornerB) ** 2);
        if (dist < 42) {
          data[i] = tR;
          data[i + 1] = tG;
          data[i + 2] = tB;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    preview.width = targetWidthPx;
    preview.height = targetHeightPx;
    preview.getContext('2d')?.drawImage(canvas, 0, 0);
    last = canvas;
    sheet.disabled = false;
    downloadPhotoBtn.disabled = false;
    replaceBgBtn.disabled = false;

    const sample = ctx.getImageData(0, 0, targetWidthPx, targetHeightPx);
    const corners = cornerUniformity(sample.data, targetWidthPx, targetHeightPx);
    checks.replaceChildren(
      el('p', { class: 'num', style: 'margin:4px 0;' }, [`Output Dimensions: ${targetWidthPx}×${targetHeightPx} pixels (${Math.round((targetWidthPx * 25.4) / 300)}×${Math.round((targetHeightPx * 25.4) / 300)} mm).`]),
      targetMaxKb ? el('p', { class: 'num', style: 'margin:4px 0;' }, [`Target Max Size: ${targetMaxKb} KB.`]) : el('span'),
      el('p', { style: 'margin:4px 0;' }, [corners.detail]),
      el('p', { style: 'margin:4px 0;font-size:12px;color:var(--ink-2);' }, ['Face position is centered. No smoothing or facial distortion is applied.']),
    );
  };

  replaceBgBtn.addEventListener('click', () => {
    if (activeFile) void paint(activeFile, true);
  });

  downloadPhotoBtn.addEventListener('click', () => {
    if (!last) return;
    void blobFromCanvas(last, 'image/jpeg').then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'passport-photo.jpg';
      link.click();
      URL.revokeObjectURL(url);
    });
  });

  const drop = dropZone({
    title: 'Drop a portrait photo',
    detail: 'JPG, PNG, WebP, or HEIC phone photo.',
    accept: 'image/*',
    multiple: false,
    buttonLabel: 'Choose photo',
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
      checks.replaceChildren(el('p', undefined, ['Camera not available in this browser.']));
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
    ctx.strokeStyle = '#CBD5E1';
    for (const slot of sheetSlots(last.width, last.height)) {
      ctx.drawImage(last, slot.x, slot.y);
      ctx.strokeRect(slot.x, slot.y, last.width, last.height);
    }
    void blobFromCanvas(board, 'image/png').then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'passport-photo-print-sheet.png';
      link.click();
      URL.revokeObjectURL(url);
    });
  });

  const controlsBox = el('div', { class: 'id-controls', style: 'background:var(--paper-2);padding:14px;border-radius:var(--radius-md);margin-bottom:16px;border:1px solid var(--rule);' }, [
    el('strong', { style: 'display:block;margin-bottom:6px;font-size:13px;' }, ['1. Target Dimensions']),
    presetsRow,
    el('div', { style: 'display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap;' }, [
      unitSelect,
      widthInput,
      el('span', undefined, ['×']),
      heightInput,
      unitLabel,
    ]),
    el('strong', { style: 'display:block;margin:12px 0 6px;font-size:13px;' }, ['2. Background Color']),
    bgRow,
  ]);

  const buttonRow = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:14px 0;' }, [
    downloadPhotoBtn,
    replaceBgBtn,
    sheet,
    camera,
  ]);

  panel.append(
    title,
    intro,
    controlsBox,
    drop.el,
    el('div', { style: 'margin:16px 0;text-align:center;' }, [preview]),
    buttonRow,
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
