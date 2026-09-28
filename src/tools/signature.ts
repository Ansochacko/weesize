import { actionButton, dropZone, el, statusLine, toolIntro } from '../lib/dom';
import { downloadBytes } from '../lib/download';
import { isImageFile } from '../lib/detect';
import { toolPreset } from '../seo/preset';
import { requirementById } from '../lib/requirements';

export interface SignatureOptions {
  width: number;
  height: number;
  minKb: number;
  maxKb: number;
  cleanBackground: boolean;
  darkenInk: boolean;
}

export function mountSignature(panel: HTMLElement, incoming?: File[]): void {
  panel.replaceChildren();

  let targetWidth = 140;
  let targetHeight = 60;
  let targetMinKb = 4;
  let targetMaxKb = 30;
  let cleanBg = true;
  let darken = true;
  let activeFile: File | null = incoming?.find(isImageFile) ?? null;
  let processedBlob: Blob | null = null;

  const presetId = toolPreset()?.presetId;
  if (presetId) {
    const req = requirementById(presetId);
    if (req) {
      if (req.requirements.minWidth) targetWidth = req.requirements.minWidth;
      if (req.requirements.minHeight) targetHeight = req.requirements.minHeight;
      if (req.requirements.minBytes) targetMinKb = Math.round(req.requirements.minBytes / 1024);
      if (req.requirements.maxBytes) targetMaxKb = Math.round(req.requirements.maxBytes / 1024);
    }
  }

  const title = el('h2', undefined, ['Signature Resizer']);
  const intro = toolIntro(
    'Crop, whiten paper background, darken pen ink, and hit the exact KB and pixel size required by online forms and exams.',
  );

  const presetsRow = el('div', { class: 'sig-presets-row', style: 'display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;' });
  const presets = [
    { label: 'JEE / NEET (140×60, 4–30 KB)', w: 140, h: 60, min: 4, max: 30 },
    { label: 'SSC (120×50, 10–20 KB)', w: 120, h: 50, min: 10, max: 20 },
    { label: 'GATE (280×80, 3–100 KB)', w: 280, h: 80, min: 3, max: 100 },
    { label: 'UPSC (350×350, 20–300 KB)', w: 350, h: 350, min: 20, max: 300 },
    { label: 'Standard (200×100, 10–50 KB)', w: 200, h: 100, min: 10, max: 50 },
  ];

  const widthInput = el('input', { type: 'number', min: '50', max: '2000', value: String(targetWidth), 'aria-label': 'Width in pixels', style: 'width:90px;' });
  const heightInput = el('input', { type: 'number', min: '20', max: '2000', value: String(targetHeight), 'aria-label': 'Height in pixels', style: 'width:90px;' });
  const minKbInput = el('input', { type: 'number', min: '1', max: '5000', value: String(targetMinKb), 'aria-label': 'Min KB', style: 'width:80px;' });
  const maxKbInput = el('input', { type: 'number', min: '2', max: '10000', value: String(targetMaxKb), 'aria-label': 'Max KB', style: 'width:80px;' });

  const cleanBgCheck = el('input', { type: 'checkbox', id: 'sig-clean-bg' });
  cleanBgCheck.checked = cleanBg;
  const darkenCheck = el('input', { type: 'checkbox', id: 'sig-darken' });
  darkenCheck.checked = darken;

  presets.forEach((p) => {
    const btn = el('button', { class: 'btn quiet', type: 'button', style: 'font-size:12px;padding:4px 8px;' }, [p.label]);
    btn.addEventListener('click', () => {
      targetWidth = p.w;
      targetHeight = p.h;
      targetMinKb = p.min;
      targetMaxKb = p.max;
      widthInput.value = String(p.w);
      heightInput.value = String(p.h);
      minKbInput.value = String(p.min);
      maxKbInput.value = String(p.max);
      if (activeFile) void processImage();
    });
    presetsRow.append(btn);
  });

  const controlsGrid = el('div', { class: 'sig-controls', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;background:var(--paper-2);padding:16px;border-radius:var(--radius-md);margin-bottom:16px;border:1px solid var(--rule);' }, [
    el('div', undefined, [
      el('strong', { style: 'display:block;margin-bottom:6px;font-size:13px;' }, ['Target Dimensions (px)']),
      el('div', { style: 'display:flex;align-items:center;gap:6px;' }, [
        widthInput,
        el('span', undefined, ['×']),
        heightInput,
        el('span', { class: 'num', style: 'color:var(--ink-2);font-size:12px;' }, ['px']),
      ]),
    ]),
    el('div', undefined, [
      el('strong', { style: 'display:block;margin-bottom:6px;font-size:13px;' }, ['Target File Size (KB)']),
      el('div', { style: 'display:flex;align-items:center;gap:6px;' }, [
        minKbInput,
        el('span', undefined, ['to']),
        maxKbInput,
        el('span', { class: 'num', style: 'color:var(--ink-2);font-size:12px;' }, ['KB']),
      ]),
    ]),
    el('div', undefined, [
      el('strong', { style: 'display:block;margin-bottom:6px;font-size:13px;' }, ['Enhancements']),
      el('div', { style: 'display:flex;flex-direction:column;gap:6px;' }, [
        el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;' }, [cleanBgCheck, 'Clean background to white']),
        el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;' }, [darkenCheck, 'Darken pen ink contrast']),
      ]),
    ]),
  ]);

  const previewBox = el('div', { class: 'sig-preview-box', style: 'margin:16px 0;padding:16px;background:var(--paper-2);border-radius:var(--radius-md);border:1px solid var(--rule);text-align:center;' });
  const previewCanvas = document.createElement('canvas');
  previewCanvas.style.maxWidth = '100%';
  previewCanvas.style.maxHeight = '240px';
  previewCanvas.style.border = '1px dashed var(--rule)';
  previewCanvas.style.borderRadius = 'var(--radius-sm)';
  previewCanvas.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
  const previewMeta = el('p', { class: 'num', style: 'margin-top:8px;font-size:13px;color:var(--ink-2);' }, ['Drop a photo or scan of a signature above.']);
  previewBox.append(previewCanvas, previewMeta);

  const action = actionButton('Download Resized Signature');
  action.idle('Download Resized Signature', false);
  const status = statusLine();
  const actionRow = el('div', { class: 'action-row', style: 'margin-top:16px;' }, [action.el, status.el]);

  const drop = dropZone({
    title: 'Drop your signature photo or scan',
    detail: 'JPG, PNG, WebP, or HEIC from phone camera.',
    accept: 'image/*',
    multiple: false,
    buttonLabel: 'Choose signature',
    onFiles: (files) => {
      const f = files[0];
      if (f && isImageFile(f)) {
        activeFile = f;
        void processImage();
      }
    },
  });

  const inputs = [widthInput, heightInput, minKbInput, maxKbInput];
  inputs.forEach((inp) => {
    inp.addEventListener('input', () => {
      targetWidth = Math.max(20, Number(widthInput.value) || 140);
      targetHeight = Math.max(20, Number(heightInput.value) || 60);
      targetMinKb = Math.max(1, Number(minKbInput.value) || 4);
      targetMaxKb = Math.max(targetMinKb, Number(maxKbInput.value) || 30);
      if (activeFile) void processImage();
    });
  });

  cleanBgCheck.addEventListener('change', () => {
    cleanBg = cleanBgCheck.checked;
    if (activeFile) void processImage();
  });

  darkenCheck.addEventListener('change', () => {
    darken = darkenCheck.checked;
    if (activeFile) void processImage();
  });

  async function processImage(): Promise<void> {
    if (!activeFile) return;
    status.set('Processing signature…', 'neutral');
    action.busy('Processing…', 0.2);

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(activeFile);
    } catch {
      status.set('Unable to open image format.', 'bad');
      action.idle('Download Resized Signature', false);
      return;
    }

    // Step 1: Draw source image onto offscreen canvas to analyze pixels
    const workCanvas = document.createElement('canvas');
    workCanvas.width = bitmap.width;
    workCanvas.height = bitmap.height;
    const ctx = workCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const imgData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const data = imgData.data;

    // Step 2: Auto-detect ink bounding box and apply whitening/darkening
    let minX = workCanvas.width;
    let minY = workCanvas.height;
    let maxX = 0;
    let maxY = 0;

    // Calculate background paper luminance estimate from 4 corner zones
    let cornerLumSum = 0;
    let cornerSamples = 0;
    const sampleSize = Math.min(20, Math.floor(workCanvas.width / 10), Math.floor(workCanvas.height / 10));
    for (let y = 0; y < sampleSize; y++) {
      for (let x = 0; x < sampleSize; x++) {
        const idx = (y * workCanvas.width + x) * 4;
        cornerLumSum += 0.299 * (data[idx] ?? 0) + 0.587 * (data[idx + 1] ?? 0) + 0.114 * (data[idx + 2] ?? 0);
        cornerSamples++;
      }
    }
    const paperThreshold = cornerSamples ? Math.max(140, Math.min(235, cornerLumSum / cornerSamples - 15)) : 180;

    for (let y = 0; y < workCanvas.height; y++) {
      for (let x = 0; x < workCanvas.width; x++) {
        const i = (y * workCanvas.width + x) * 4;
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum < paperThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }

        if (cleanBg && lum >= paperThreshold) {
          // Push paper background to clean white
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        } else if (darken && lum < paperThreshold) {
          // Darken ink contrast
          const ratio = Math.max(0, (lum / paperThreshold) ** 1.8);
          data[i] = Math.round(r * ratio * 0.7);
          data[i + 1] = Math.round(g * ratio * 0.7);
          data[i + 2] = Math.round(b * ratio * 0.7);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // If bounding box was detected with margin, crop to signature ink bounds
    const pad = Math.round(Math.max(workCanvas.width, workCanvas.height) * 0.04);
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(workCanvas.width - cropX, Math.max(10, maxX - minX + pad * 2));
    const cropH = Math.min(workCanvas.height - cropY, Math.max(10, maxY - minY + pad * 2));

    // Step 3: Draw cropped signature centered onto target canvas
    previewCanvas.width = targetWidth;
    previewCanvas.height = targetHeight;
    const prevCtx = previewCanvas.getContext('2d');
    if (!prevCtx) return;

    prevCtx.fillStyle = '#FFFFFF';
    prevCtx.fillRect(0, 0, targetWidth, targetHeight);

    // Fit within target maintaining aspect ratio
    const scale = Math.min((targetWidth * 0.92) / cropW, (targetHeight * 0.88) / cropH);
    const destW = Math.round(cropW * scale);
    const destH = Math.round(cropH * scale);
    const destX = Math.round((targetWidth - destW) / 2);
    const destY = Math.round((targetHeight - destH) / 2);

    prevCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, destX, destY, destW, destH);

    // Step 4: Iterative compression to hit target file size (KB)
    let bestBlob: Blob | null = null;
    let minQuality = 0.3;
    let maxQuality = 0.98;

    for (let pass = 0; pass < 8; pass++) {
      const q = (minQuality + maxQuality) / 2;
      const b = await new Promise<Blob | null>((resolve) => previewCanvas.toBlob(resolve, 'image/jpeg', q));
      if (!b) break;
      bestBlob = b;
      const kb = b.size / 1024;
      if (kb > targetMaxKb) {
        maxQuality = q;
      } else if (kb < targetMinKb) {
        minQuality = q;
      } else {
        break; // Inside sweet spot
      }
    }

    processedBlob = bestBlob;
    if (processedBlob) {
      const finalKb = Math.round((processedBlob.size / 1024) * 10) / 10;
      const ok = finalKb >= targetMinKb && finalKb <= targetMaxKb;
      previewMeta.textContent = `Output: ${targetWidth}×${targetHeight} px · ${finalKb} KB ${ok ? '✓ Within target range' : `(Target: ${targetMinKb}–${targetMaxKb} KB)`}`;
      status.set(`Ready: ${targetWidth}×${targetHeight} px, ${finalKb} KB.`, ok ? 'good' : 'neutral');
      action.idle(`Download Signature (${finalKb} KB)`, true);
    }
  }

  action.el.addEventListener('click', () => {
    if (!processedBlob) return;
    void (async () => {
      const buf = new Uint8Array(await processedBlob.arrayBuffer());
      downloadBytes(buf, 'signature.jpg', 'image/jpeg');
      status.set('Signature downloaded.', 'good');
    })();
  });

  panel.append(title, intro, presetsRow, controlsGrid, drop.el, previewBox, actionRow);

  if (activeFile) {
    void processImage();
  }
}
