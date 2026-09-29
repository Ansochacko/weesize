import { centerCrop, cornerUniformity, sheetSlots, PRINT_SHEET } from '../lib/id-photo';
import { checkAgainstRequirement, parseCustomRule, publicRequirements, reportOutdatedHref, requirementById, searchRequirements, type CheckItem, type FileFacts, type Requirement } from '../lib/requirements';
import { fixPdf, scanPdf, type Finding } from '../lib/share-check';
import { actionButton, dropZone, el, toolIntro } from '../lib/dom';
import { isImageFile, isPdfFile } from '../lib/detect';
import { readFileBytes } from '../lib/pdf';
import { toolPreset } from '../seo/preset';
import type { ToolInfo } from './registry';

export function mountNext(panel: HTMLElement, tool: ToolInfo, incoming?: File[]): void {
  if (tool.id === 'presets') mountPresets(panel);
  else if (tool.id === 'id-photo') mountIdPhoto(panel, incoming);
  else if (tool.id === 'share-check') mountShare(panel, incoming);
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

    const displayName = `${entry.country}: ${entry.organization} (${entry.documentType})`;
    detail.append(
      el('h3', undefined, [displayName]),
      el('p', undefined, [entry.requirements.notes || entry.portal]),
      el('p', { class: 'num' }, [`Formats: ${req.formats.join(', ')} | Size: ${sz} | Dimensions: ${dim}`]),
      el('p', { style: 'font-size:12px;color:var(--ink-2);' }, ['Last checked: ', entry.lastVerified, ' · ', sourceLink, ' · ', report]),
    );

    const targetTool = entry.documentType.toLowerCase().includes('signature')
      ? 'signature-resizer'
      : entry.documentType.toLowerCase().includes('photo')
      ? 'id-photo'
      : req.formats.includes('application/pdf')
      ? 'compress-pdf'
      : 'compress-image';

    const toolBtn = el('a', { class: 'btn primary', href: `/${targetTool}` }, [`Open ${targetTool} Tool`]);
    toolLinkRow.append(toolBtn);
  };

  const applyCustom = (): void => {
    const raw = customInput.value.trim();
    if (!raw) return;
    const customReq = parseCustomRule(raw);
    showEntry(customReq);
    status.textContent = 'Custom rule applied. Drop your file below to verify.';
  };

  customBtn.addEventListener('click', applyCustom);
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCustom();
    }
  });

  const paint = (filter: string): void => {
    list.replaceChildren();
    const matches = filter ? searchRequirements(filter) : publicRequirements();
    if (matches.length === 0) {
      list.append(el('span', { style: 'font-size:13px;color:var(--ink-2);padding:4px;' }, ['No matching official preset found. Try typing a custom rule above.']));
      return;
    }
    for (const item of matches.slice(0, 15)) {
      const label = `${item.country}: ${item.organization} (${item.documentType})`;
      const btn = el('button', { class: 'btn quiet', type: 'button', style: 'font-size:12px;padding:4px 8px;' }, [label]);
      btn.addEventListener('click', () => showEntry(item));
      list.append(btn);
    }
  };

  query.addEventListener('input', () => paint(query.value));
  paint('');
  if (selectedEntry) showEntry(selectedEntry);

  const drop = dropZone({
    title: 'Drop your file to check against this requirement',
    detail: 'JPG, PNG, WebP, or PDF.',
    accept: 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp',
    multiple: false,
    buttonLabel: 'Choose file to check',
    onFiles: (files) => {
      const file = files[0];
      if (!file || !selectedEntry) {
        if (!selectedEntry) status.textContent = 'Select a requirement or apply a custom rule first.';
        return;
      }

      void (async () => {
        status.textContent = `Checking ${file.name}…`;
        let width: number | undefined;
        let height: number | undefined;

        if (isImageFile(file)) {
          try {
            const bitmap = await createImageBitmap(file);
            width = bitmap.width;
            height = bitmap.height;
            bitmap.close();
          } catch {
            /* ignore */
          }
        }

        const facts: FileFacts = {
          mime: file.type || 'application/octet-stream',
          bytes: file.size,
          ...(width !== undefined && height !== undefined ? { width, height } : {}),
        };

        const res = checkAgainstRequirement(facts, selectedEntry!);
        checks.replaceChildren();

        const allPass = res.every((c) => c.met === true || c.met === null) && !res.some((c) => c.met === false);

        const summaryBox = el('div', {
          style: `padding:12px;border-radius:var(--radius-sm);margin:8px 0;background:var(--paper-2);border:1.5px solid ${allPass ? 'var(--accent)' : 'var(--rule-2)'};`,
        });

        summaryBox.append(
          el('strong', { style: `color:${allPass ? 'var(--accent)' : 'var(--ink)'};display:block;margin-bottom:6px;` }, [
            allPass ? '✓ File meets all requirements!' : '⚠ File does not meet some requirements:',
          ]),
        );

        res.forEach((c: CheckItem) => {
          const passIcon = c.met === true ? '✓' : c.met === false ? '✗' : 'ℹ';
          const passColor = c.met === true ? '#1B7A4A' : c.met === false ? '#DC2626' : 'var(--ink-2)';
          const row = el('div', { style: 'display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0;' }, [
            el('span', { style: `color:${passColor};font-weight:bold;` }, [passIcon]),
            el('span', { style: 'font-weight:600;' }, [c.label]),
            el('span', { style: 'color:var(--ink-2);font-size:12px;' }, [`- ${c.detail}`]),
          ]);
          summaryBox.append(row);
        });

        checks.append(summaryBox);
        status.textContent = allPass ? 'All checks passed.' : 'Review check details above.';
      })();
    },
  });

  panel.append(
    title,
    intro,
    customBox,
    filterRow,
    query,
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
      fix.busy('Sanitizing…', 0.5);
      const fixed = image ? bytes : await fixPdf(bytes);
      const blob = new Blob([fixed as unknown as BlobPart], { type: image ? 'image/jpeg' : 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sanitized-${name}`;
      link.click();
      URL.revokeObjectURL(url);
      fix.idle('Fix all', false);
      status.textContent = 'Saved without hidden metadata.';
    })();
  });

  panel.append(
    el('h2', undefined, ['Safe to share']),
    toolIntro('Check and remove metadata, GPS location, hidden text, and form history before you send a document or photo.'),
    drop.el,
    findingsHost,
    el('div', { class: 'action-row', style: 'margin-top:12px;' }, [fix.el, status]),
  );

  const first = incoming?.[0];
  if (first) {
    name = first.name;
    image = isImageFile(first) && !isPdfFile(first);
    void readFileBytes(first).then((data) => {
      bytes = data;
      void scan();
    });
  }
}

function blobFromCanvas(canvas: HTMLCanvasElement, mime = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? new Blob()), mime, quality);
  });
}
