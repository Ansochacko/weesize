import { actionButton, dropZone, el, formatBytes, statusLine } from '../lib/dom';
import { downloadBytes, downloadZip, fileBase } from '../lib/download';
import { iconElement } from '../lib/icons';
import { isPdfFile, isImageFile } from '../lib/detect';
import { stageBytes } from '../lib/session';
import { navigate } from '../router';

export interface RedactBox {
  id: string;
  x: number; // in normalized [0..1] coordinates relative to page/image width
  y: number; // in normalized [0..1] coordinates relative to page/image height
  w: number;
  h: number;
}

interface PageData {
  pageNumber: number;
  width: number; // natural pixel width
  height: number; // natural pixel height
  ptWidth: number; // PDF points width (or image points)
  ptHeight: number; // PDF points height
  canvas: HTMLCanvasElement;
  boxes: RedactBox[];
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_PDF_PAGES = 30;

export function mountRedact(panel: HTMLElement, incoming?: File[]): void {
  panel.replaceChildren();

  let currentFile: File | null = null;
  let pages: PageData[] = [];
  let currentPageIndex = 0;
  let selectedBoxId: string | null = null;

  // Output selection: 'pdf' | 'jpg' | 'png'
  let outputFormat: 'pdf' | 'jpg' | 'png' = 'pdf';

  // Container elements
  const intro = el('div', { class: 'tool-header' }, [
    el('h1', { style: 'font-family:var(--serif);font-size:32px;font-weight:600;margin-bottom:8px;color:var(--ink);' }, ['Redact a photo or PDF']),
    el('p', { class: 'lede', style: 'color:var(--ink-2);font-size:16px;margin-bottom:16px;' }, [
      'Black out ID numbers, addresses or signatures. It all happens on your device. Your file is never uploaded.',
    ]),
  ]);

  const noticeBox = el('div', {
    style: 'background:var(--paper-2);border-left:3px solid var(--warning);padding:10px 14px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:16px;font-size:13px;color:var(--ink-2);',
  }, [
    el('strong', { style: 'color:var(--ink);display:block;margin-bottom:2px;' }, ['Note before redacting']),
    'Some official forms (visa, exam, passport) need the full, unredacted document. Check the rules before you redact.',
  ]);

  const drop = dropZone({
    title: 'Drop a PDF or image here',
    detail: 'Supports PDF, JPG, PNG, and WebP (up to 25 MB / 30 pages).',
    accept: 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp',
    multiple: false,
    buttonLabel: 'Choose file',
    onFiles: (files) => {
      const file = files[0];
      if (file) void loadFile(file);
    },
  });

  const editorHost = el('div', { class: 'redact-editor', style: 'display:none;margin-top:20px;' });

  // Toolbar & controls
  const toolBar = el('div', {
    class: 'redact-toolbar',
    style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md) var(--radius-md) 0 0;',
  });

  // Page switcher for PDF
  const pageNav = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
  const prevPageBtn = el('button', { class: 'btn quiet', type: 'button', style: 'padding:4px 10px;font-size:13px;' }, ['← Prev']);
  const nextPageBtn = el('button', { class: 'btn quiet', type: 'button', style: 'padding:4px 10px;font-size:13px;' }, ['Next →']);
  const pageLabel = el('span', { class: 'num', style: 'font-size:14px;font-weight:500;' }, ['Page 1 of 1']);
  pageNav.append(prevPageBtn, pageLabel, nextPageBtn);

  // Edit actions (Undo, Delete, Clear all)
  const actionsWrap = el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' });
  const undoBtn = el('button', { class: 'btn quiet', type: 'button', style: 'padding:4px 10px;font-size:13px;' }, [
    iconElement('undo', { size: 14, className: 'icon-inline' }),
    ' Undo',
  ]);
  const deleteBtn = el('button', { class: 'btn quiet', type: 'button', style: 'padding:4px 10px;font-size:13px;', disabled: 'true' }, ['Delete box']);
  const clearBtn = el('button', { class: 'btn quiet', type: 'button', style: 'padding:4px 10px;font-size:13px;' }, ['Clear page']);
  actionsWrap.append(undoBtn, deleteBtn, clearBtn);

  toolBar.append(pageNav, actionsWrap);

  // Canvas viewport container with interactive overlay
  const canvasContainer = el('div', {
    class: 'canvas-container',
    style: 'position:relative;background:#333;overflow:auto;display:flex;justify-content:center;padding:20px 10px;border:1px solid var(--rule);border-top:none;user-select:none;touch-action:none;',
  });

  const stageWrapper = el('div', {
    class: 'stage-wrapper',
    style: 'position:relative;display:inline-block;box-shadow:0 4px 12px rgba(0,0,0,0.3);line-height:0;',
  });

  const displayCanvas = document.createElement('canvas');
  displayCanvas.style.display = 'block';
  displayCanvas.style.maxWidth = '100%';
  displayCanvas.style.height = 'auto';

  // SVG Overlay for drawing and rendering interactive black boxes
  const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.setAttribute('style', 'position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;touch-action:none;');

  stageWrapper.append(displayCanvas, svgOverlay);
  canvasContainer.append(stageWrapper);

  // Hint bar
  const hintBar = el('div', {
    style: 'padding:8px 14px;background:var(--paper);border:1px solid var(--rule);border-top:none;font-size:13px;color:var(--ink-2);display:flex;justify-content:space-between;align-items:center;',
  }, [
    el('span', undefined, ['Drag with mouse or finger to draw solid black boxes. Click a box to select or delete it.']),
    el('span', { class: 'redact-count', style: 'font-weight:600;color:var(--ink);' }, ['0 boxes']),
  ]);

  // Output format options box
  const formatOptionsBox = el('div', {
    style: 'background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);padding:16px;margin-top:16px;',
  });

  const formatChoiceRow = el('div', { style: 'display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:8px;' });
  const formatLabel = el('strong', { style: 'font-size:14px;color:var(--ink);' }, ['Download as:']);

  const pdfRadio = el('input', { type: 'radio', name: 'redact-format', value: 'pdf', id: 'fmt-pdf' });
  const jpgRadio = el('input', { type: 'radio', name: 'redact-format', value: 'jpg', id: 'fmt-jpg' });
  const pngRadio = el('input', { type: 'radio', name: 'redact-format', value: 'png', id: 'fmt-png' });

  const pdfLabel = el('label', { class: 'choice', for: 'fmt-pdf', style: 'cursor:pointer;display:inline-flex;align-items:center;gap:6px;' }, [pdfRadio, ' PDF document']);
  const jpgLabel = el('label', { class: 'choice', for: 'fmt-jpg', style: 'cursor:pointer;display:inline-flex;align-items:center;gap:6px;' }, [jpgRadio, ' JPG image(s)']);
  const pngLabel = el('label', { class: 'choice', for: 'fmt-png', style: 'cursor:pointer;display:inline-flex;align-items:center;gap:6px;' }, [pngRadio, ' PNG image(s)']);

  formatChoiceRow.append(formatLabel, pdfLabel, jpgLabel, pngLabel);

  const securityNote = el('p', {
    style: 'margin:0;font-size:13px;color:var(--ink-2);line-height:1.4;',
  }, ['Redacted PDFs are saved as images, so the text can’t be copied. That’s what makes the redaction real.']);

  formatOptionsBox.append(formatChoiceRow, securityNote);

  // Action button & status
  const action = actionButton('Download Redacted File');
  const status = statusLine();
  const actionRow = el('div', { class: 'action-row', style: 'margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, [action.el, status.el]);

  // Post-download container for "Compress to exact size"
  const postActions = el('div', { style: 'display:none;margin-top:20px;padding:16px;background:var(--paper-2);border:1px solid var(--rule);border-radius:var(--radius-md);' });

  editorHost.append(toolBar, canvasContainer, hintBar, formatOptionsBox, actionRow, postActions);
  panel.append(intro, noticeBox, drop.el, editorHost);

  // Set initial state
  if (incoming?.[0]) {
    void loadFile(incoming[0]);
  }

  // Format radio change listeners
  [pdfRadio, jpgRadio, pngRadio].forEach((radio) => {
    radio.addEventListener('change', () => {
      if (pdfRadio.checked) outputFormat = 'pdf';
      else if (jpgRadio.checked) outputFormat = 'jpg';
      else if (pngRadio.checked) outputFormat = 'png';
    });
  });

  // Page navigation listeners
  prevPageBtn.addEventListener('click', () => {
    if (currentPageIndex > 0) {
      currentPageIndex--;
      renderCurrentPage();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPageIndex < pages.length - 1) {
      currentPageIndex++;
      renderCurrentPage();
    }
  });

  // Undo button listener
  undoBtn.addEventListener('click', () => {
    const page = pages[currentPageIndex];
    if (!page || !page.boxes.length) return;
    page.boxes.pop();
    selectedBoxId = null;
    deleteBtn.disabled = true;
    renderOverlay();
  });

  // Delete selected box
  deleteBtn.addEventListener('click', () => {
    if (!selectedBoxId) return;
    const page = pages[currentPageIndex];
    if (!page) return;
    page.boxes = page.boxes.filter((b) => b.id !== selectedBoxId);
    selectedBoxId = null;
    deleteBtn.disabled = true;
    renderOverlay();
  });

  // Clear all boxes on page
  clearBtn.addEventListener('click', () => {
    const page = pages[currentPageIndex];
    if (!page) return;
    page.boxes = [];
    selectedBoxId = null;
    deleteBtn.disabled = true;
    renderOverlay();
  });

  // Keyboard listener for Delete key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedBoxId && document.activeElement?.tagName !== 'INPUT') {
        const page = pages[currentPageIndex];
        if (page) {
          page.boxes = page.boxes.filter((b) => b.id !== selectedBoxId);
          selectedBoxId = null;
          deleteBtn.disabled = true;
          renderOverlay();
        }
      }
    }
  });

  // ==========================================
  // Mouse and Touch Interaction for Drawing
  // ==========================================
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let activeDrawingRect: SVGRectElement | null = null;

  function getNormalizedPos(e: MouseEvent | Touch): { x: number; y: number } {
    const rect = svgOverlay.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  }

  function getTouchOrEvent(e: MouseEvent | TouchEvent): MouseEvent | Touch | null {
    if ('changedTouches' in e && e.changedTouches.length > 0) return e.changedTouches[0] ?? null;
    if ('touches' in e && e.touches.length > 0) return e.touches[0] ?? null;
    return e as MouseEvent;
  }

  function onPointerDown(e: MouseEvent | TouchEvent): void {
    const touch = getTouchOrEvent(e);
    if (!touch) return;
    const target = e.target as Element;
    if (target && target.tagName === 'rect' && target.getAttribute('data-box-id')) {
      // Clicked an existing box -> Select it
      selectedBoxId = target.getAttribute('data-box-id');
      deleteBtn.disabled = false;
      renderOverlay();
      return;
    }

    // Start drawing new solid black box
    isDrawing = true;
    selectedBoxId = null;
    deleteBtn.disabled = true;
    const pos = getNormalizedPos(touch);
    startX = pos.x;
    startY = pos.y;

    if (!activeDrawingRect) {
      activeDrawingRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      activeDrawingRect.setAttribute('fill', '#000000');
      activeDrawingRect.setAttribute('fill-opacity', '0.85');
      activeDrawingRect.setAttribute('stroke', '#3B82F6');
      activeDrawingRect.setAttribute('stroke-width', '1.5');
      svgOverlay.appendChild(activeDrawingRect);
    }
  }

  function onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!isDrawing || !activeDrawingRect) return;
    const touch = getTouchOrEvent(e);
    if (!touch) return;
    if (e.cancelable) e.preventDefault();

    const pos = getNormalizedPos(touch);
    const x = Math.min(startX, pos.x);
    const y = Math.min(startY, pos.y);
    const w = Math.abs(pos.x - startX);
    const h = Math.abs(pos.y - startY);

    activeDrawingRect.setAttribute('x', `${x * 100}%`);
    activeDrawingRect.setAttribute('y', `${y * 100}%`);
    activeDrawingRect.setAttribute('width', `${w * 100}%`);
    activeDrawingRect.setAttribute('height', `${h * 100}%`);
  }

  function onPointerUp(e: MouseEvent | TouchEvent): void {
    if (!isDrawing) return;
    isDrawing = false;
    if (activeDrawingRect) {
      activeDrawingRect.remove();
      activeDrawingRect = null;
    }

    const touch = getTouchOrEvent(e);
    if (!touch) return;
    const pos = getNormalizedPos(touch);
    const x = Math.min(startX, pos.x);
    const y = Math.min(startY, pos.y);
    const w = Math.abs(pos.x - startX);
    const h = Math.abs(pos.y - startY);

    // Minimum size threshold to avoid accidental micro-clicks
    if (w > 0.01 && h > 0.01) {
      const page = pages[currentPageIndex];
      if (page) {
        const newBox: RedactBox = {
          id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          x,
          y,
          w,
          h,
        };
        page.boxes.push(newBox);
        selectedBoxId = newBox.id;
        deleteBtn.disabled = false;
        renderOverlay();
      }
    }
  }

  svgOverlay.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  svgOverlay.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);

  // ==========================================
  // File Ingestion and Page Rendering
  // ==========================================
  async function loadFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_SIZE) {
      status.set(`File is too large (${formatBytes(file.size)}). Maximum allowed size is 25 MB.`, 'bad');
      return;
    }

    currentFile = file;
    status.clear();
    action.busy('Reading file…', 0.1);
    drop.hidden(true);
    editorHost.style.display = 'block';
    pages = [];
    currentPageIndex = 0;
    selectedBoxId = null;

    if (isPdfFile(file)) {
      pdfRadio.checked = true;
      outputFormat = 'pdf';
      pageNav.style.display = 'flex';
      await loadPdfPages(file);
    } else if (isImageFile(file)) {
      jpgRadio.checked = true;
      outputFormat = 'jpg';
      pageNav.style.display = 'none';
      await loadImagePage(file);
    } else {
      status.set('Unsupported file format. Please choose a PDF, JPG, PNG, or WebP.', 'bad');
      action.idle('Download Redacted File', false);
      return;
    }

    if (pages.length === 0) {
      status.set('No viewable pages could be extracted from this file.', 'bad');
      action.idle('Download Redacted File', false);
      return;
    }

    renderCurrentPage();
    action.idle('Download Redacted File', true);
    status.set(`${file.name} is ready for redaction. Drag to draw black boxes over sensitive content.`, 'good');
  }

  async function loadPdfPages(file: File): Promise<void> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfjsLib = await import('pdfjs-dist');
    const pdfWorkerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker');
    pdfjsLib.GlobalWorkerOptions.workerPort = new pdfWorkerModule.default();

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdfDoc = await loadingTask.promise;
    const numPages = Math.min(pdfDoc.numPages, MAX_PDF_PAGES);

    if (pdfDoc.numPages > MAX_PDF_PAGES) {
      status.set(`Note: This PDF has ${pdfDoc.numPages} pages. Only the first ${MAX_PDF_PAGES} pages are loaded.`, 'neutral');
    }

    for (let i = 1; i <= numPages; i++) {
      action.busy(`Rendering page ${i} of ${numPages}…`, i / numPages);
      const page = await pdfDoc.getPage(i);
      const scale = 2.0; // 2x high-resolution rendering
      const viewport = page.getViewport({ scale });
      const origViewport = page.getViewport({ scale: 1.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      }

      pages.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        ptWidth: origViewport.width,
        ptHeight: origViewport.height,
        canvas,
        boxes: [],
      });
    }
  }

  async function loadImagePage(file: File): Promise<void> {
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    pages.push({
      pageNumber: 1,
      width: canvas.width,
      height: canvas.height,
      ptWidth: (canvas.width * 72) / 96, // 72 pt scale
      ptHeight: (canvas.height * 72) / 96,
      canvas,
      boxes: [],
    });
  }

  function renderCurrentPage(): void {
    const page = pages[currentPageIndex];
    if (!page) return;

    pageLabel.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
    prevPageBtn.disabled = currentPageIndex === 0;
    nextPageBtn.disabled = currentPageIndex === pages.length - 1;

    displayCanvas.width = page.width;
    displayCanvas.height = page.height;
    const ctx = displayCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(page.canvas, 0, 0);
    }

    renderOverlay();
  }

  function renderOverlay(): void {
    const page = pages[currentPageIndex];
    if (!page) return;

    svgOverlay.innerHTML = '';
    const count = page.boxes.length;
    const countEl = hintBar.querySelector('.redact-count');
    if (countEl) countEl.textContent = `${count} box${count === 1 ? '' : 'es'} on this page`;

    page.boxes.forEach((box) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', `${box.x * 100}%`);
      rect.setAttribute('y', `${box.y * 100}%`);
      rect.setAttribute('width', `${box.w * 100}%`);
      rect.setAttribute('height', `${box.h * 100}%`);
      rect.setAttribute('fill', '#000000');
      rect.setAttribute('data-box-id', box.id);
      rect.setAttribute('cursor', 'pointer');

      if (box.id === selectedBoxId) {
        rect.setAttribute('stroke', '#3B82F6');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '4 2');
      } else {
        rect.setAttribute('stroke', '#111827');
        rect.setAttribute('stroke-width', '1');
      }

      svgOverlay.appendChild(rect);
    });
  }

  // ==========================================
  // Redaction Flattening & Export Execution
  // ==========================================
  action.el.addEventListener('click', () => {
    void executeRedaction();
  });

  async function executeRedaction(): Promise<void> {
    if (!currentFile || !pages.length) return;
    action.busy('Generating redacted output…', 0.1);
    status.clear();

    try {
      const base = fileBase(currentFile.name);

      if (outputFormat === 'pdf') {
        // Build fresh PDF from flattened page images (Zero text layer, empty metadata)
        const { PDFDocument } = await import('pdf-lib');
        const outPdf = await PDFDocument.create();
        outPdf.setTitle('');
        outPdf.setAuthor('');
        outPdf.setSubject('');
        outPdf.setKeywords([]);
        outPdf.setCreator('');

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          if (!page) continue;
          action.busy(`Flattening page ${i + 1} of ${pages.length}…`, (i + 1) / (pages.length + 1));
          const flatCanvas = createFlattenedCanvas(page);
          const blob = await new Promise<Blob | null>((resolve) => flatCanvas.toBlob(resolve, 'image/jpeg', 0.92));
          if (!blob) throw new Error('Failed to encode page image.');

          const imgBytes = new Uint8Array(await blob.arrayBuffer());
          const embeddedImg = await outPdf.embedJpg(imgBytes);
          const pdfPage = outPdf.addPage([page.ptWidth, page.ptHeight]);
          pdfPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: page.ptWidth,
            height: page.ptHeight,
          });
        }

        action.busy('Finalizing PDF…', 0.95);
        const pdfBytes = await outPdf.save();
        const outName = `${base}-redacted.pdf`;
        downloadBytes(pdfBytes, outName, 'application/pdf');

        status.set(`Downloaded ${outName} (${formatBytes(pdfBytes.byteLength)}). All text is permanently flattened into image layers.`, 'good');
        action.idle('Download Redacted File', true);
        showPostDownloadOptions(outName, pdfBytes, 'pdf');
      } else {
        // Export as JPG or PNG images (EXIF stripped via fresh canvas re-encode)
        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        const ext = outputFormat === 'png' ? 'png' : 'jpg';

        if (pages.length === 1 && pages[0]) {
          const page = pages[0];
          const flatCanvas = createFlattenedCanvas(page);
          const blob = await new Promise<Blob | null>((resolve) => flatCanvas.toBlob(resolve, mime, 0.92));
          if (!blob) throw new Error('Failed to encode image.');

          const bytes = new Uint8Array(await blob.arrayBuffer());
          const outName = `${base}-redacted.${ext}`;
          downloadBytes(bytes, outName, mime);

          status.set(`Downloaded ${outName} (${formatBytes(bytes.byteLength)}). EXIF metadata removed.`, 'good');
          action.idle('Download Redacted File', true);
          showPostDownloadOptions(outName, bytes, 'image');
        } else {
          // Multiple pages -> ZIP
          const zipFiles: Array<{ name: string; bytes: Uint8Array }> = [];
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            if (!page) continue;
            action.busy(`Encoding page ${i + 1} of ${pages.length}…`, (i + 1) / pages.length);
            const flatCanvas = createFlattenedCanvas(page);
            const blob = await new Promise<Blob | null>((resolve) => flatCanvas.toBlob(resolve, mime, 0.92));
            if (!blob) continue;
            const bytes = new Uint8Array(await blob.arrayBuffer());
            zipFiles.push({ name: `${base}-redacted-page-${i + 1}.${ext}`, bytes });
          }

          const zipName = `${base}-redacted-pages.zip`;
          await downloadZip(zipFiles, zipName);

          status.set(`Downloaded ${zipName} containing ${zipFiles.length} redacted page images.`, 'good');
          action.idle('Download Redacted File', true);
          if (zipFiles[0]) {
            showPostDownloadOptions(zipFiles[0].name, zipFiles[0].bytes, 'image');
          }
        }
      }
    } catch (err) {
      status.set(`Redaction failed: ${err instanceof Error ? err.message : String(err)}`, 'bad');
      action.idle('Download Redacted File', true);
    }
  }

  function createFlattenedCanvas(page: PageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Draw background rendered page
    ctx.drawImage(page.canvas, 0, 0);

    // Draw solid black rectangles
    ctx.fillStyle = '#000000';
    page.boxes.forEach((box) => {
      const bx = Math.round(box.x * page.width);
      const by = Math.round(box.y * page.height);
      const bw = Math.round(box.w * page.width);
      const bh = Math.round(box.h * page.height);
      ctx.fillRect(bx, by, bw, bh);
    });

    return canvas;
  }

  function showPostDownloadOptions(fileName: string, fileBytes: Uint8Array, type: 'pdf' | 'image'): void {
    postActions.replaceChildren();
    postActions.style.display = 'block';

    const promptText = el('p', { style: 'font-weight:600;margin-bottom:8px;font-size:14px;color:var(--ink);' }, [
      'Need to upload this redacted file to a form with an exact file size limit?',
    ]);

    const compressBtn = el('button', { class: 'btn primary', type: 'button' }, [
      iconElement('compress-pdf', { size: 16, className: 'icon-inline' }),
      type === 'pdf' ? ' Compress PDF to exact size' : ' Compress image to exact size',
    ]);

    compressBtn.addEventListener('click', () => {
      stageBytes([{ name: fileName, bytes: fileBytes }]);
      navigate(type === 'pdf' ? 'compress-pdf' : 'compress-image');
    });

    postActions.append(promptText, compressBtn);
  }
}
