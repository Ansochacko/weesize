import { actionButton, dropZone, el, formatBytes, statusLine, textField } from '../lib/dom';
import { downloadBytes, downloadZip, fileBase } from '../lib/download';
import { iconElement } from '../lib/icons';
import { isPdfFile } from '../lib/detect';
import { parsePageRanges } from '../lib/pdf';
import { stageBytes } from '../lib/session';
import { navigate } from '../router';

export function mountPdfToImage(panel: HTMLElement, incoming?: File[]): void {
  panel.replaceChildren();

  let pdfFile: File | null = null;
  let pdfBytes: Uint8Array | null = null;
  let outputFormat: 'image/jpeg' | 'image/png' = 'image/jpeg';
  let qualityScale: number = 1.5; // Standard = 1.5x, High = 2.0x

  const intro = el('div', { class: 'tool-header' }, [
    el('h1', { style: 'font-family:var(--serif);font-size:32px;font-weight:600;margin-bottom:8px;color:var(--ink);' }, ['Convert PDF to JPG or PNG Images']),
    el('p', { class: 'lede', style: 'color:var(--ink-2);font-size:16px;margin-bottom:16px;' }, [
      'Extract PDF pages as high-quality images. Pick page ranges, choose quality, and download on your device.',
    ]),
  ]);

  const drop = dropZone({
    title: 'Drop a PDF here',
    detail: 'or choose a PDF file.',
    accept: 'application/pdf,.pdf',
    multiple: false,
    buttonLabel: 'Choose PDF',
    onFiles: (files) => {
      const file = files[0];
      if (file && isPdfFile(file)) void loadPdf(file);
    },
  });

  const editorHost = el('div', { style: 'display:none;margin-top:20px;' });

  const optionsCard = el('div', {
    style: 'background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);padding:20px;margin-bottom:16px;',
  });

  // Page range input
  const rangeField = textField({
    id: 'pdf-img-range',
    label: 'Pages to extract (optional)',
    placeholder: 'All pages (or e.g. 1-3, 5)',
    onInput: () => {},
  });

  // Format & Quality row
  const row = el('div', { style: 'display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-top:16px;' });

  const formatSelect = el('select', {
    style: 'padding:6px 12px;border:1px solid var(--rule);border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);font-size:14px;',
    'aria-label': 'Image format',
  }, [
    el('option', { value: 'image/jpeg' }, ['JPG (Standard photos)']),
    el('option', { value: 'image/png' }, ['PNG (Lossless text)']),
  ]);

  const qualitySelect = el('select', {
    style: 'padding:6px 12px;border:1px solid var(--rule);border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);font-size:14px;',
    'aria-label': 'Resolution quality',
  }, [
    el('option', { value: '1.5' }, ['Standard Quality (1.5× scale, ~108 DPI)']),
    el('option', { value: '2.0' }, ['High Quality (2.0× scale, ~144 DPI)']),
  ]);

  row.append(
    el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
      el('strong', { style: 'font-size:13px;' }, ['Format:']),
      formatSelect,
    ]),
    el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
      el('strong', { style: 'font-size:13px;' }, ['Quality:']),
      qualitySelect,
    ]),
  );

  optionsCard.append(rangeField.el, row);

  const action = actionButton('Convert to Images');
  const status = statusLine();
  const actionRow = el('div', { class: 'action-row', style: 'margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, [action.el, status.el]);

  const postActions = el('div', { style: 'display:none;margin-top:20px;padding:16px;background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);' });

  editorHost.append(optionsCard, actionRow, postActions);
  panel.append(intro, drop.el, editorHost);

  if (incoming?.[0] && isPdfFile(incoming[0])) {
    void loadPdf(incoming[0]);
  }

  formatSelect.addEventListener('change', () => {
    outputFormat = formatSelect.value === 'image/png' ? 'image/png' : 'image/jpeg';
  });

  qualitySelect.addEventListener('change', () => {
    qualityScale = Number(qualitySelect.value) || 1.5;
  });

  async function loadPdf(file: File): Promise<void> {
    pdfFile = file;
    pdfBytes = new Uint8Array(await file.arrayBuffer());
    drop.hidden(true);
    editorHost.style.display = 'block';
    status.set(`${file.name} is ready. Choose your options and click Convert.`, 'good');
    action.idle('Convert to Images', true);
  }

  action.el.addEventListener('click', () => {
    void executeExport();
  });

  async function executeExport(): Promise<void> {
    if (!pdfFile || !pdfBytes) return;
    action.busy('Rendering PDF pages…', 0.1);
    status.clear();

    try {
      const pdfjsLib = await import('pdfjs-dist');
      const pdfWorkerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker');
      pdfjsLib.GlobalWorkerOptions.workerPort = new pdfWorkerModule.default();

      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      const pdfDoc = await loadingTask.promise;
      const totalPages = pdfDoc.numPages;

      const rawRange = rangeField.input.value.trim();
      let targetPages: number[] = [];

      if (rawRange) {
        const parsed = parsePageRanges(rawRange, totalPages);
        targetPages = parsed.pages;
        if (targetPages.length === 0) {
          status.set('Please enter a valid page range (e.g. 1-3, 5).', 'bad');
          action.idle('Convert to Images', true);
          return;
        }
      } else {
        for (let i = 1; i <= totalPages; i++) targetPages.push(i);
      }

      const mime = outputFormat;
      const ext = outputFormat === 'image/png' ? 'png' : 'jpg';
      const base = fileBase(pdfFile.name);
      const renderedImages: Array<{ name: string; bytes: Uint8Array }> = [];

      for (let idx = 0; idx < targetPages.length; idx++) {
        const pageNum = targetPages[idx];
        if (typeof pageNum !== 'number') continue;
        action.busy(`Rendering page ${pageNum} (${idx + 1} of ${targetPages.length})…`, (idx + 1) / (targetPages.length + 1));

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: qualityScale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, 0.92));
          if (blob) {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            renderedImages.push({
              name: `${base}-page-${pageNum}.${ext}`,
              bytes,
            });
          }
        }
      }

      if (renderedImages.length === 1 && renderedImages[0]) {
        const single = renderedImages[0];
        downloadBytes(single.bytes, single.name, mime);
        status.set(`Downloaded ${single.name} (${formatBytes(single.bytes.byteLength)}).`, 'good');
        action.idle('Convert to Images', true);
        showPostDownloadOptions(single.name, single.bytes);
      } else if (renderedImages.length > 1) {
        const zipName = `${base}-pages.zip`;
        await downloadZip(renderedImages, zipName);
        status.set(`Downloaded ${zipName} with ${renderedImages.length} page images.`, 'good');
        action.idle('Convert to Images', true);
        if (renderedImages[0]) {
          showPostDownloadOptions(renderedImages[0].name, renderedImages[0].bytes);
        }
      }
    } catch (err) {
      status.set(`PDF to Image conversion failed: ${err instanceof Error ? err.message : String(err)}`, 'bad');
      action.idle('Convert to Images', true);
    }
  }

  function showPostDownloadOptions(fileName: string, fileBytes: Uint8Array): void {
    postActions.replaceChildren();
    postActions.style.display = 'block';

    const promptText = el('p', { style: 'font-weight:600;margin-bottom:8px;font-size:14px;color:var(--ink);' }, [
      'Need to shrink an extracted image to an exact KB size for an online form?',
    ]);

    const compressBtn = el('button', { class: 'btn primary', type: 'button' }, [
      iconElement('compress-images', { size: 16, className: 'icon-inline' }),
      ' Compress image to exact size',
    ]);

    compressBtn.addEventListener('click', () => {
      stageBytes([{ name: fileName, bytes: fileBytes }]);
      navigate('compress-image');
    });

    postActions.append(promptText, compressBtn);
  }
}
