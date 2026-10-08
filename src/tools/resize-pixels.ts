import { actionButton, dropZone, el, formatBytes, statusLine } from '../lib/dom';
import { downloadBytes, fileBase } from '../lib/download';
import { iconElement } from '../lib/icons';
import { isImageFile } from '../lib/detect';
import { stageBytes } from '../lib/session';
import { navigate } from '../router';

export function mountResizePixels(panel: HTMLElement, incoming?: File[]): void {
  panel.replaceChildren();

  let originalBitmap: ImageBitmap | null = null;
  let originalFile: File | null = null;
  let origWidth = 0;
  let origHeight = 0;

  let unit: 'px' | 'cm' | 'mm' = 'px';
  let dpi = 300;
  let keepAspect = true;
  let outputFormat: 'image/jpeg' | 'image/png' = 'image/jpeg';
  let targetWidth = 0;
  let targetHeight = 0;

  // Header & intro
  const intro = el('div', { class: 'tool-header' }, [
    el('h1', { style: 'font-family:var(--serif);font-size:32px;font-weight:600;margin-bottom:8px;color:var(--ink);' }, ['Resize Image in Pixels, CM or MM']),
    el('p', { class: 'lede', style: 'color:var(--ink-2);font-size:16px;margin-bottom:16px;' }, [
      'Change image dimensions in pixels, centimeters or millimeters with exact DPI. 100% private in your browser.',
    ]),
  ]);

  const drop = dropZone({
    title: 'Drop an image here',
    detail: 'Supports JPG, PNG, WebP, AVIF, and GIF.',
    accept: 'image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif',
    multiple: false,
    buttonLabel: 'Choose image',
    onFiles: (files) => {
      const file = files[0];
      if (file && isImageFile(file)) void loadImage(file);
    },
  });

  const editorHost = el('div', { class: 'resize-editor', style: 'display:none;margin-top:20px;' });

  // Control card
  const controlsCard = el('div', {
    style: 'background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);padding:20px;margin-bottom:16px;',
  });

  // Unit selector (px, cm, mm)
  const unitRow = el('div', { style: 'display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px;' });
  const unitLabel = el('strong', { style: 'font-size:14px;color:var(--ink);' }, ['Dimensions Unit:']);
  const unitPx = el('input', { type: 'radio', name: 'dim-unit', value: 'px', id: 'unit-px', checked: 'true' });
  const unitCm = el('input', { type: 'radio', name: 'dim-unit', value: 'cm', id: 'unit-cm' });
  const unitMm = el('input', { type: 'radio', name: 'dim-unit', value: 'mm', id: 'unit-mm' });

  unitRow.append(
    unitLabel,
    el('label', { class: 'choice', for: 'unit-px', style: 'display:inline-flex;align-items:center;gap:6px;' }, [unitPx, ' Pixels (px)']),
    el('label', { class: 'choice', for: 'unit-cm', style: 'display:inline-flex;align-items:center;gap:6px;' }, [unitCm, ' Centimeters (cm)']),
    el('label', { class: 'choice', for: 'unit-mm', style: 'display:inline-flex;align-items:center;gap:6px;' }, [unitMm, ' Millimeters (mm)']),
  );

  // Width & Height inputs
  const dimsRow = el('div', { style: 'display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px;' });

  const widthInput = el('input', {
    type: 'number',
    step: 'any',
    min: '1',
    style: 'width:110px;padding:6px 10px;border:1px solid var(--rule);border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);',
    'aria-label': 'Width',
  });

  const heightInput = el('input', {
    type: 'number',
    step: 'any',
    min: '1',
    style: 'width:110px;padding:6px 10px;border:1px solid var(--rule);border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);',
    'aria-label': 'Height',
  });

  const unitSuffix1 = el('span', { class: 'num', style: 'font-size:14px;color:var(--ink-2);' }, ['px']);
  const unitSuffix2 = el('span', { class: 'num', style: 'font-size:14px;color:var(--ink-2);' }, ['px']);

  const dpiWrap = el('div', { style: 'display:flex;align-items:center;gap:6px;margin-left:auto;' });
  const dpiInput = el('input', {
    type: 'number',
    min: '72',
    max: '1200',
    value: '300',
    style: 'width:80px;padding:6px 10px;border:1px solid var(--rule);border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);',
    'aria-label': 'DPI',
  });
  dpiWrap.append(el('strong', { style: 'font-size:13px;' }, ['DPI:']), dpiInput);

  dimsRow.append(
    el('label', { style: 'display:flex;align-items:center;gap:6px;font-size:14px;' }, ['Width:', widthInput, unitSuffix1]),
    el('span', { style: 'font-size:16px;color:var(--ink-3);' }, ['×']),
    el('label', { style: 'display:flex;align-items:center;gap:6px;font-size:14px;' }, ['Height:', heightInput, unitSuffix2]),
    dpiWrap,
  );

  // Aspect Ratio & Format toggles
  const togglesRow = el('div', { style: 'display:flex;align-items:center;gap:20px;flex-wrap:wrap;border-top:1px solid var(--rule);padding-top:14px;' });
  const aspectCheckbox = el('input', { type: 'checkbox', id: 'keep-aspect', checked: 'true' });
  const aspectLabel = el('label', { class: 'choice', for: 'keep-aspect', style: 'display:inline-flex;align-items:center;gap:6px;font-size:14px;' }, [
    aspectCheckbox,
    ' Keep aspect ratio',
  ]);

  const formatSelect = el('select', {
    style: 'padding:6px 12px;border:1px solid var(--rule);border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);font-size:14px;',
    'aria-label': 'Output format',
  }, [
    el('option', { value: 'image/jpeg' }, ['JPG (Recommended)']),
    el('option', { value: 'image/png' }, ['PNG (Lossless)']),
  ]);

  togglesRow.append(
    aspectLabel,
    el('div', { style: 'display:flex;align-items:center;gap:8px;margin-left:auto;' }, [
      el('strong', { style: 'font-size:13px;' }, ['Output Format:']),
      formatSelect,
    ]),
  );

  controlsCard.append(unitRow, dimsRow, togglesRow);

  // Preview & Size indicator card
  const previewCard = el('div', {
    style: 'background:var(--paper);border:1px solid var(--rule);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;',
  });

  const previewInfo = el('div', undefined, [
    el('p', { class: 'preview-px-text num', style: 'font-weight:600;font-size:15px;color:var(--ink);margin-bottom:4px;' }, ['Output size: 0 × 0 px']),
    el('p', { class: 'preview-est-text', style: 'font-size:13px;color:var(--ink-2);' }, ['Estimated file size: ~0 KB']),
  ]);

  previewCard.append(previewInfo);

  // Action button & status
  const action = actionButton('Download Resized Image');
  const status = statusLine();
  const actionRow = el('div', { class: 'action-row', style: 'margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, [action.el, status.el]);

  // Post-download connector
  const postActions = el('div', { style: 'display:none;margin-top:20px;padding:16px;background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);' });

  editorHost.append(controlsCard, previewCard, actionRow, postActions);
  panel.append(intro, drop.el, editorHost);

  if (incoming?.[0] && isImageFile(incoming[0])) {
    void loadImage(incoming[0]);
  }

  // ==========================================
  // Event Handlers
  // ==========================================
  unitPx.addEventListener('change', () => setUnit('px'));
  unitCm.addEventListener('change', () => setUnit('cm'));
  unitMm.addEventListener('change', () => setUnit('mm'));

  dpiInput.addEventListener('input', () => {
    dpi = Math.max(1, Number(dpiInput.value) || 300);
    recalcInputsFromPixels();
  });

  aspectCheckbox.addEventListener('change', () => {
    keepAspect = aspectCheckbox.checked;
  });

  formatSelect.addEventListener('change', () => {
    outputFormat = formatSelect.value === 'image/png' ? 'image/png' : 'image/jpeg';
    updatePreviewInfo();
  });

  widthInput.addEventListener('input', () => {
    const val = Number(widthInput.value);
    if (!val || val <= 0) return;
    targetWidth = unitToPx(val);
    if (keepAspect && origWidth > 0 && origHeight > 0) {
      targetHeight = Math.round((targetWidth * origHeight) / origWidth);
      heightInput.value = String(formatUnitVal(pxToUnit(targetHeight)));
    }
    updatePreviewInfo();
  });

  heightInput.addEventListener('input', () => {
    const val = Number(heightInput.value);
    if (!val || val <= 0) return;
    targetHeight = unitToPx(val);
    if (keepAspect && origWidth > 0 && origHeight > 0) {
      targetWidth = Math.round((targetHeight * origWidth) / origHeight);
      widthInput.value = String(formatUnitVal(pxToUnit(targetWidth)));
    }
    updatePreviewInfo();
  });

  function setUnit(nextUnit: 'px' | 'cm' | 'mm'): void {
    unit = nextUnit;
    unitSuffix1.textContent = unit;
    unitSuffix2.textContent = unit;
    recalcInputsFromPixels();
  }

  function unitToPx(val: number): number {
    if (unit === 'px') return Math.round(val);
    if (unit === 'cm') return Math.round((val / 2.54) * dpi);
    if (unit === 'mm') return Math.round((val / 25.4) * dpi);
    return Math.round(val);
  }

  function pxToUnit(pxVal: number): number {
    if (unit === 'px') return pxVal;
    if (unit === 'cm') return (pxVal / dpi) * 2.54;
    if (unit === 'mm') return (pxVal / dpi) * 25.4;
    return pxVal;
  }

  function formatUnitVal(val: number): number {
    return unit === 'px' ? Math.round(val) : Math.round(val * 100) / 100;
  }

  function recalcInputsFromPixels(): void {
    widthInput.value = String(formatUnitVal(pxToUnit(targetWidth)));
    heightInput.value = String(formatUnitVal(pxToUnit(targetHeight)));
    updatePreviewInfo();
  }

  function updatePreviewInfo(): void {
    const pxText = previewCard.querySelector('.preview-px-text');
    const estText = previewCard.querySelector('.preview-est-text');
    if (pxText) pxText.textContent = `Output size: ${targetWidth} × ${targetHeight} px`;

    if (estText) {
      const estBytes = (targetWidth * targetHeight * (outputFormat === 'image/png' ? 0.8 : 0.25));
      estText.textContent = `Estimated file size: ~${formatBytes(Math.max(1024, Math.round(estBytes)))}`;
    }
  }

  async function loadImage(file: File): Promise<void> {
    originalFile = file;
    status.clear();
    action.busy('Reading image…', 0.2);

    try {
      originalBitmap = await createImageBitmap(file);
      origWidth = originalBitmap.width;
      origHeight = originalBitmap.height;
      targetWidth = origWidth;
      targetHeight = origHeight;

      drop.hidden(true);
      editorHost.style.display = 'block';
      recalcInputsFromPixels();

      status.set(`${file.name} loaded (${origWidth} × ${origHeight} px). Set new dimensions and download.`, 'good');
      action.idle('Download Resized Image', true);
    } catch (err) {
      status.set(`Failed to read image: ${err instanceof Error ? err.message : String(err)}`, 'bad');
      action.idle('Download Resized Image', false);
    }
  }

  action.el.addEventListener('click', () => {
    void executeResize();
  });

  async function executeResize(): Promise<void> {
    if (!originalBitmap || !originalFile) return;
    if (targetWidth <= 0 || targetHeight <= 0) {
      status.set('Please specify valid width and height dimensions.', 'bad');
      return;
    }

    action.busy('Resizing image…', 0.3);
    status.clear();

    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      ctx.drawImage(originalBitmap, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputFormat, outputFormat === 'image/jpeg' ? 0.92 : undefined),
      );
      if (!blob) throw new Error('Failed to encode resized image.');

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const ext = outputFormat === 'image/png' ? 'png' : 'jpg';
      const base = fileBase(originalFile.name);
      const outName = `${base}-resized.${ext}`;

      downloadBytes(bytes, outName, outputFormat);

      status.set(`Downloaded ${outName} (${targetWidth}×${targetHeight} px, ${formatBytes(bytes.byteLength)}).`, 'good');
      action.idle('Download Resized Image', true);

      showPostDownloadOptions(outName, bytes);
    } catch (err) {
      status.set(`Resize failed: ${err instanceof Error ? err.message : String(err)}`, 'bad');
      action.idle('Download Resized Image', true);
    }
  }

  function showPostDownloadOptions(fileName: string, fileBytes: Uint8Array): void {
    postActions.replaceChildren();
    postActions.style.display = 'block';

    const promptText = el('p', { style: 'font-weight:600;margin-bottom:8px;font-size:14px;color:var(--ink);' }, [
      'Need this resized photo at an exact KB limit (e.g. 20 KB or 50 KB) for a form?',
    ]);

    const compressBtn = el('button', { class: 'btn primary', type: 'button' }, [
      iconElement('compress-images', { size: 16, className: 'icon-inline' }),
      ' Compress to exact KB size',
    ]);

    compressBtn.addEventListener('click', () => {
      stageBytes([{ name: fileName, bytes: fileBytes }]);
      navigate('compress-image');
    });

    postActions.append(promptText, compressBtn);
  }
}
