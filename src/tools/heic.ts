import { actionButton, dropZone, el, formatBytes, statusLine } from '../lib/dom';
import { downloadBytes, downloadZip, fileBase } from '../lib/download';
import { iconElement } from '../lib/icons';
import { stageBytes } from '../lib/session';
import { navigate } from '../router';

export function mountHeic(panel: HTMLElement, incoming?: File[]): void {
  panel.replaceChildren();

  let files: File[] = [];
  let outputFormat: 'image/jpeg' | 'image/png' = 'image/jpeg';

  const intro = el('div', { class: 'tool-header' }, [
    el('h1', { style: 'font-family:var(--serif);font-size:32px;font-weight:600;margin-bottom:8px;color:var(--ink);' }, ['Convert iPhone HEIC Photos to JPG']),
    el('p', { class: 'lede', style: 'color:var(--ink-2);font-size:16px;margin-bottom:16px;' }, [
      'Turn Apple HEIC and HEIF photos into standard JPG or PNG images. Fast batch conversion on your device.',
    ]),
  ]);

  const drop = dropZone({
    title: 'Drop HEIC or HEIF photos here',
    detail: 'Batch convert iPhone photos to standard JPG format.',
    accept: 'image/heic,image/heif,.heic,.heif',
    multiple: true,
    buttonLabel: 'Choose HEIC photos',
    onFiles: (picked) => {
      files = picked;
      updateStatus();
    },
  });

  const optionsCard = el('div', {
    style: 'background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);padding:16px;margin:16px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;',
  });

  const formatSelect = el('select', {
    style: 'padding:6px 12px;border:1px solid var(--rule);border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);font-size:14px;',
    'aria-label': 'Output format',
  }, [
    el('option', { value: 'image/jpeg' }, ['JPG (Standard photo)']),
    el('option', { value: 'image/png' }, ['PNG (Lossless)']),
  ]);

  optionsCard.append(
    el('strong', { style: 'font-size:14px;color:var(--ink);' }, ['Save format:']),
    formatSelect,
  );

  const action = actionButton('Convert to JPG');
  const status = statusLine();
  const actionRow = el('div', { class: 'action-row', style: 'margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, [action.el, status.el]);

  const postActions = el('div', { style: 'display:none;margin-top:20px;padding:16px;background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);' });

  panel.append(intro, drop.el, optionsCard, actionRow, postActions);
  action.idle('Convert to JPG', false);

  if (incoming?.length) {
    files = incoming;
    updateStatus();
  }

  formatSelect.addEventListener('change', () => {
    outputFormat = formatSelect.value === 'image/png' ? 'image/png' : 'image/jpeg';
    action.idle(outputFormat === 'image/png' ? 'Convert to PNG' : 'Convert to JPG', files.length > 0);
  });

  function updateStatus(): void {
    if (files.length === 0) {
      status.clear();
      action.idle('Convert to JPG', false);
      return;
    }

    status.set(`${files.length} HEIC photo${files.length === 1 ? '' : 's'} ready to convert.`, 'neutral');
    action.idle(outputFormat === 'image/png' ? 'Convert to PNG' : 'Convert to JPG', true);
  }

  action.el.addEventListener('click', () => {
    void executeConversion();
  });

  async function executeConversion(): Promise<void> {
    if (!files.length) return;
    action.busy('Converting photos…', 0.1);
    status.clear();

    const ext = outputFormat === 'image/png' ? 'png' : 'jpg';
    const convertedFiles: Array<{ name: string; bytes: Uint8Array }> = [];
    const failedFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      action.busy(`Converting ${i + 1} of ${files.length}…`, (i + 0.5) / files.length);

      try {
        const bytes = await convertHeicFile(file, outputFormat);
        const base = fileBase(file.name);
        convertedFiles.push({ name: `${base}-converted.${ext}`, bytes });
      } catch (err) {
        failedFiles.push(file.name);
      }
    }

    if (failedFiles.length > 0 && convertedFiles.length === 0) {
      status.set(
        `This browser cannot decode these HEIC photos directly. On iPhone/Mac Safari or Chromium with HEVC extensions, decoding happens natively. On other browsers, please export as JPG on your phone.`,
        'bad',
      );
      action.idle('Convert to JPG', true);
      return;
    }

    if (convertedFiles.length === 1 && convertedFiles[0]) {
      const single = convertedFiles[0];
      downloadBytes(single.bytes, single.name, outputFormat);
      status.set(`Downloaded ${single.name} (${formatBytes(single.bytes.byteLength)}).`, 'good');
      action.idle('Convert to JPG', true);
      showPostDownloadOptions(single.name, single.bytes);
    } else if (convertedFiles.length > 1) {
      const zipName = 'heic-photos-converted.zip';
      await downloadZip(convertedFiles, zipName);
      status.set(`Downloaded ${zipName} with ${convertedFiles.length} converted photos.`, 'good');
      action.idle('Convert to JPG', true);
      if (convertedFiles[0]) {
        showPostDownloadOptions(convertedFiles[0].name, convertedFiles[0].bytes);
      }
    }
  }

  async function convertHeicFile(file: File, mime: string): Promise<Uint8Array> {
    // Try createImageBitmap
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      // If createImageBitmap fails, try <img> loading
      const img = new Image();
      const url = URL.createObjectURL(file);
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('HEIC decoding not supported in this browser environment.'));
          img.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable.');
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
      if (!blob) throw new Error('Encoding failed.');
      return new Uint8Array(await blob.arrayBuffer());
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable.');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
    if (!blob) throw new Error('Encoding failed.');
    return new Uint8Array(await blob.arrayBuffer());
  }

  function showPostDownloadOptions(fileName: string, fileBytes: Uint8Array): void {
    postActions.replaceChildren();
    postActions.style.display = 'block';

    const promptText = el('p', { style: 'font-weight:600;margin-bottom:8px;font-size:14px;color:var(--ink);' }, [
      'Need to shrink this converted photo to an exact KB size (e.g. 50 KB or 100 KB)?',
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
