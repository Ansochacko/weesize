import { actionButton, dropZone, el, formatBytes, statusLine } from '../lib/dom';
import { downloadBytes, downloadZip, fileBase } from '../lib/download';
import { iconElement } from '../lib/icons';
import { isPdfFile, isImageFile } from '../lib/detect';
import { isPasswordError, loadPdfJs } from '../lib/pdfjs';
import { stageBytes } from '../lib/session';
import { navigate } from '../router';

type PdfDocument = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;

export interface RedactBox {
  id: string;
  x: number; // in normalized [0..1] coordinates relative to page/image width
  y: number; // in normalized [0..1] coordinates relative to page/image height
  w: number;
  h: number;
}

interface PageData {
  pageNumber: number;
  width: number; // rendered pixel width
  height: number; // rendered pixel height
  ptWidth: number; // PDF points width (or image points)
  ptHeight: number; // PDF points height
  scale: number; // PDF render scale (1 for images)
  image: HTMLCanvasElement | null; // photos only; PDF pages are rendered when shown or exported
  boxes: RedactBox[];
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_PDF_PAGES = 30;
const MAX_RENDER_SIDE = 2400; // px on the long side of a rendered PDF page
const MAX_IMAGE_PIXELS = 16_000_000; // stay under phone canvas limits

export function mountRedact(panel: HTMLElement, incoming?: File[]): void {
  panel.replaceChildren();

  let currentFile: File | null = null;
  let pages: PageData[] = [];
  let currentPageIndex = 0;
  let selectedBoxId: string | null = null;
  let pdfDoc: PdfDocument | null = null;
  let pdfTask: { destroy(): Promise<void> } | null = null; // closing the task frees the document
  let loadGen = 0; // bumps on every new file, so a slow old load can't overwrite a newer one
  let renderGen = 0;
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
  const newFileBtn = el('button', { class: 'btn quiet', type: 'button', style: 'padding:4px 10px;font-size:13px;' }, ['Choose another file']);
  actionsWrap.append(undoBtn, deleteBtn, clearBtn, newFileBtn);

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
  // Fit the whole page on screen, so people can see what to cover without scrolling.
  displayCanvas.style.maxWidth = '100%';
  displayCanvas.style.maxHeight = '75vh';
  displayCanvas.style.width = 'auto';
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
    el('span', undefined, ['Press and drag across what you want to hide, with your mouse or finger. Tap a box to select or delete it.']),
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
  // Shown under the drop zone when a file can't be opened.
  const pickerStatus = statusLine();
  panel.append(intro, noticeBox, drop.el, pickerStatus.el, editorHost);

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
    void showPage(currentPageIndex - 1);
  });

  nextPageBtn.addEventListener('click', () => {
    void showPage(currentPageIndex + 1);
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

  // Keyboard: Delete / Backspace removes the selected box.
  // Ignored while typing in a field, and removed once this tool is gone from the page
  // (the panel is reused by other tools, so a window listener would otherwise leak).
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!editorHost.isConnected) {
      window.removeEventListener('keydown', onKeyDown);
      return;
    }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!selectedBoxId || editorHost.style.display === 'none') return;
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
    const page = pages[currentPageIndex];
    if (!page) return;
    e.preventDefault();
    page.boxes = page.boxes.filter((b) => b.id !== selectedBoxId);
    selectedBoxId = null;
    deleteBtn.disabled = true;
    renderOverlay();
  };
  window.addEventListener('keydown', onKeyDown);

  // ==========================================
  // Drawing with mouse, finger or pen (Pointer Events)
  // ==========================================
  let drawingPointer: number | null = null;
  let startX = 0;
  let startY = 0;
  let activeDrawingRect: SVGRectElement | null = null;

  function getNormalizedPos(e: PointerEvent): { x: number; y: number } {
    const rect = svgOverlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function setRectAttrs(rect: SVGRectElement, x: number, y: number, w: number, h: number): void {
    rect.setAttribute('x', `${x * 100}%`);
    rect.setAttribute('y', `${y * 100}%`);
    rect.setAttribute('width', `${w * 100}%`);
    rect.setAttribute('height', `${h * 100}%`);
  }

  function endDrawing(): void {
    drawingPointer = null;
    if (activeDrawingRect) {
      activeDrawingRect.remove();
      activeDrawingRect = null;
    }
  }

  svgOverlay.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drawingPointer !== null) return; // ignore a second finger
    if (!pages[currentPageIndex]) return;

    const target = e.target as Element | null;
    const hitId = target?.getAttribute?.('data-box-id');
    if (hitId) {
      // Tapped an existing box: select it.
      e.preventDefault();
      selectedBoxId = hitId;
      deleteBtn.disabled = false;
      renderOverlay();
      return;
    }

    e.preventDefault();
    drawingPointer = e.pointerId;
    try {
      svgOverlay.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    selectedBoxId = null;
    deleteBtn.disabled = true;
    renderOverlay();

    const pos = getNormalizedPos(e);
    startX = pos.x;
    startY = pos.y;
    activeDrawingRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    activeDrawingRect.setAttribute('fill', '#000000');
    activeDrawingRect.setAttribute('fill-opacity', '0.85');
    activeDrawingRect.setAttribute('stroke', '#3B82F6');
    activeDrawingRect.setAttribute('stroke-width', '1.5');
    activeDrawingRect.setAttribute('pointer-events', 'none');
    setRectAttrs(activeDrawingRect, startX, startY, 0, 0);
    svgOverlay.appendChild(activeDrawingRect);
  });

  svgOverlay.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drawingPointer || !activeDrawingRect) return;
    e.preventDefault();
    const pos = getNormalizedPos(e);
    setRectAttrs(
      activeDrawingRect,
      Math.min(startX, pos.x),
      Math.min(startY, pos.y),
      Math.abs(pos.x - startX),
      Math.abs(pos.y - startY),
    );
  });

  svgOverlay.addEventListener('pointerup', (e) => {
    if (e.pointerId !== drawingPointer) return;
    const pos = getNormalizedPos(e);
    endDrawing();

    const x = Math.min(startX, pos.x);
    const y = Math.min(startY, pos.y);
    const w = Math.abs(pos.x - startX);
    const h = Math.abs(pos.y - startY);

    // Minimum size threshold to avoid accidental micro-clicks
    if (w <= 0.01 || h <= 0.01) {
      status.set('To black something out, press and drag across it. A single click or tap doesn’t draw a box.', 'neutral');
    }
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
        if (status.el.dataset.tone !== 'good') status.clear();
      }
    }
    renderOverlay();
  });

  svgOverlay.addEventListener('pointercancel', (e) => {
    if (e.pointerId === drawingPointer) endDrawing();
  });

  // ==========================================
  // File Ingestion and Page Rendering
  // ==========================================
  newFileBtn.addEventListener('click', () => drop.open());

  // Dropping a file anywhere on this tool opens it. (The site-wide drop handler
  // doesn't pass files to this tool.) The panel is reused by other tools, so the
  // listener removes itself once Redact is no longer on the page.
  const onDrop = (e: DragEvent): void => {
    if (!editorHost.isConnected) {
      panel.removeEventListener('drop', onDrop);
      return;
    }
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    e.preventDefault();
    void loadFile(file);
  };
  panel.addEventListener('drop', onDrop);

  function resetToPicker(message: string): void {
    pages = [];
    currentFile = null;
    selectedBoxId = null;
    void closePdf();
    editorHost.style.display = 'none';
    postActions.style.display = 'none';
    drop.hidden(false);
    action.idle('Download Redacted File', false);
    status.set(message, 'bad');
    // The status line lives inside the hidden editor, so show it next to the drop zone too.
    pickerStatus.set(message, 'bad');
  }

  async function closePdf(): Promise<void> {
    const task = pdfTask;
    pdfDoc = null;
    pdfTask = null;
    if (task) {
      try {
        await task.destroy();
      } catch {
        /* ignore */
      }
    }
  }

  async function loadFile(file: File): Promise<void> {
    const gen = ++loadGen;
    pickerStatus.clear();

    if (file.size > MAX_FILE_SIZE) {
      resetToPicker(`File is too large (${formatBytes(file.size)}). Maximum allowed size is 25 MB.`);
      return;
    }
    const isPdf = isPdfFile(file);
    const isImage = !isPdf && isImageFile(file);
    if (!isPdf && !isImage) {
      resetToPicker('Unsupported file format. Please choose a PDF, JPG, PNG, or WebP.');
      return;
    }

    await closePdf();
    currentFile = file;
    pages = [];
    currentPageIndex = 0;
    selectedBoxId = null;
    deleteBtn.disabled = true;
    status.clear();
    postActions.style.display = 'none';
    action.busy('Reading file…', 0.1);
    drop.hidden(true);
    editorHost.style.display = 'block';
    svgOverlay.innerHTML = '';
    displayCanvas.width = 0;
    displayCanvas.height = 0;

    let note = '';
    try {
      if (isPdf) {
        pdfRadio.checked = true;
        outputFormat = 'pdf';
        pageNav.style.display = 'flex';
        note = await loadPdfPages(file, gen);
      } else {
        jpgRadio.checked = true;
        outputFormat = 'jpg';
        pageNav.style.display = 'none';
        await loadImagePage(file, gen);
      }
      if (gen !== loadGen) return; // a newer file was picked meanwhile

      if (pages.length === 0) {
        resetToPicker('No viewable pages could be extracted from this file.');
        return;
      }

      action.busy('Rendering page 1…', 0.6);
      await renderCurrentPage();
      if (gen !== loadGen) return;
    } catch (err) {
      if (gen !== loadGen) return;
      console.error('[redact] could not open file', err);
      if (isPdf && isPasswordError(err)) {
        resetToPicker('This PDF is password-protected. Remove the password first, then try again.');
      } else if (isPdf) {
        resetToPicker('This PDF couldn’t be opened. It may be damaged.');
      } else {
        resetToPicker('This image couldn’t be opened. Try a JPG or PNG.');
      }
      return;
    }

    action.idle('Download Redacted File', true);
    // Bring the whole page preview into view, ready to draw on.
    canvasContainer.scrollIntoView({ block: 'nearest' });
    status.set(`${note}${file.name} is ready for redaction. Drag to draw black boxes over sensitive content.`, 'good');
  }

  /** Opens the PDF and records each page's size. Pages are rendered only when shown or exported. */
  async function loadPdfPages(file: File, gen: number): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfjsLib = await loadPdfJs();
    const task = pdfjsLib.getDocument({ data: bytes });
    let doc: PdfDocument;
    try {
      doc = await task.promise;
    } catch (err) {
      void task.destroy();
      throw err;
    }
    if (gen !== loadGen) {
      void task.destroy();
      return '';
    }
    pdfDoc = doc;
    pdfTask = task;

    const numPages = Math.min(doc.numPages, MAX_PDF_PAGES);
    const loaded: PageData[] = [];
    for (let i = 1; i <= numPages; i++) {
      if (gen !== loadGen) return '';
      action.busy(`Reading page ${i} of ${numPages}…`, (i / numPages) * 0.5);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = renderScale(base.width, base.height);
      loaded.push({
        pageNumber: i,
        width: Math.max(1, Math.round(base.width * scale)),
        height: Math.max(1, Math.round(base.height * scale)),
        ptWidth: base.width,
        ptHeight: base.height,
        scale,
        image: null,
        boxes: [],
      });
    }

    if (gen !== loadGen) return '';
    pages = loaded;

    return doc.numPages > MAX_PDF_PAGES
      ? `This PDF has ${doc.numPages} pages, so only the first ${MAX_PDF_PAGES} are loaded. `
      : '';
  }

  async function loadImagePage(file: File, gen: number): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });

      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;
      if (!natW || !natH) throw new Error('Image has no size');

      // Very large photos can exceed the canvas limit on phones (about 16.7 MP on iPhone).
      const shrink = Math.min(1, Math.sqrt(MAX_IMAGE_PIXELS / (natW * natH)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(natW * shrink));
      canvas.height = Math.max(1, Math.round(natH * shrink));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (gen !== loadGen) return;

      pages = [{
        pageNumber: 1,
        width: canvas.width,
        height: canvas.height,
        ptWidth: (canvas.width * 72) / 96, // 72 pt scale
        ptHeight: (canvas.height * 72) / 96,
        scale: 1,
        image: canvas,
        boxes: [],
      }];
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Render scale for a PDF page: up to 2x, but never more than MAX_RENDER_SIDE px on the long side. */
  function renderScale(ptWidth: number, ptHeight: number): number {
    const longest = Math.max(ptWidth, ptHeight, 1);
    return Math.min(2, MAX_RENDER_SIDE / longest);
  }

  /**
   * Draws one page (without boxes) into `canvas`, resizing it to the page.
   * PDF pages get a white background, so transparent pages never turn black.
   */
  async function drawPageInto(page: PageData, canvas: HTMLCanvasElement): Promise<void> {
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');

    if (page.image) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(page.image, 0, 0);
      return;
    }

    if (!pdfDoc) throw new Error('The PDF is no longer open.');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pdfPage = await pdfDoc.getPage(page.pageNumber);
    const viewport = pdfPage.getViewport({ scale: page.scale });
    // The canvas is rounded to whole pixels, so stretch the render to fill it exactly.
    const sx = canvas.width / viewport.width;
    const sy = canvas.height / viewport.height;
    await pdfPage.render({
      canvas,
      canvasContext: ctx,
      viewport,
      transform: sx !== 1 || sy !== 1 ? [sx, 0, 0, sy, 0, 0] : undefined,
    } as Parameters<typeof pdfPage.render>[0]).promise;
  }

  async function renderCurrentPage(): Promise<void> {
    const page = pages[currentPageIndex];
    if (!page) return;
    const myRender = ++renderGen;

    pageLabel.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    renderOverlay();

    try {
      const off = document.createElement('canvas');
      await drawPageInto(page, off);
      if (myRender !== renderGen) return; // user moved to another page meanwhile
      displayCanvas.width = off.width;
      displayCanvas.height = off.height;
      displayCanvas.getContext('2d')?.drawImage(off, 0, 0);
      releaseCanvas(off);
    } finally {
      if (myRender === renderGen) {
        prevPageBtn.disabled = currentPageIndex === 0;
        nextPageBtn.disabled = currentPageIndex === pages.length - 1;
      }
    }
  }

  async function showPage(index: number): Promise<void> {
    if (index < 0 || index >= pages.length || index === currentPageIndex) return;
    currentPageIndex = index;
    selectedBoxId = null;
    deleteBtn.disabled = true;
    try {
      await renderCurrentPage();
    } catch (err) {
      console.error('[redact] page render failed', err);
      status.set(`Page ${index + 1} couldn’t be shown. It may be damaged.`, 'bad');
    }
  }

  function releaseCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = 0;
    canvas.height = 0;
  }

  function renderOverlay(): void {
    const page = pages[currentPageIndex];
    if (!page) return;

    svgOverlay.innerHTML = '';
    const count = page.boxes.length;
    const countEl = hintBar.querySelector('.redact-count');
    if (countEl) {
      const total = totalBoxes();
      countEl.textContent =
        `${count} box${count === 1 ? '' : 'es'} on this page` + (pages.length > 1 ? ` · ${total} in total` : '');
    }

    page.boxes.forEach((box) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      setRectAttrs(rect, box.x, box.y, box.w, box.h);
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

  function totalBoxes(): number {
    return pages.reduce((sum, page) => sum + page.boxes.length, 0);
  }

  async function executeRedaction(): Promise<void> {
    // The action button ignores clicks until idle() re-arms it, so every early
    // return below must call idle(), or the button stops responding for good.
    if (!currentFile || !pages.length) {
      action.idle('Download Redacted File', false);
      return;
    }
    if (totalBoxes() === 0) {
      // Never hand back an unredacted copy that looks like a finished redaction.
      action.idle('Download Redacted File', true);
      status.set('Nothing is blacked out yet. Press and drag across the text you want to hide, then download.', 'bad');
      canvasContainer.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const file = currentFile;
    const gen = loadGen;
    action.busy('Generating redacted output…', 0.1);
    status.clear();

    try {
      const base = fileBase(file.name);

      if (outputFormat === 'pdf') {
        // Build fresh PDF from flattened page images (Zero text layer, empty metadata)
        const { PDFDocument } = await import('pdf-lib');
        const outPdf = await PDFDocument.create();
        outPdf.setTitle('');
        outPdf.setAuthor('');
        outPdf.setSubject('');
        outPdf.setKeywords([]);
        outPdf.setCreator('');
        outPdf.setProducer('');

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          if (!page) continue;
          action.busy(`Flattening page ${i + 1} of ${pages.length}…`, (i + 1) / (pages.length + 1));
          const imgBytes = await flattenPage(page, 'image/jpeg', true);
          if (gen !== loadGen) return;
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
        // JPG has no transparency: put a white background behind transparent images.
        const whiteBackground = outputFormat !== 'png';

        if (pages.length === 1 && pages[0]) {
          const bytes = await flattenPage(pages[0], mime, whiteBackground);
          if (gen !== loadGen) return;
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
            const bytes = await flattenPage(page, mime, whiteBackground);
            if (gen !== loadGen) return;
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
      console.error('[redact] export failed', err);
      if (gen !== loadGen) return;
      status.set(`Redaction failed: ${err instanceof Error ? err.message : String(err)}`, 'bad');
      action.idle('Download Redacted File', true);
    }
  }

  /** Renders one page, burns in the black boxes, encodes it, and frees the canvas. */
  async function flattenPage(page: PageData, mime: string, whiteBackground: boolean): Promise<Uint8Array> {
    const canvas = createFlattenedCanvas(page, whiteBackground, await renderPageCanvas(page));
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
      if (!blob) throw new Error(`Couldn’t encode page ${page.pageNumber}. Your device may be low on memory.`);
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      releaseCanvas(canvas);
    }
  }

  async function renderPageCanvas(page: PageData): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    await drawPageInto(page, canvas);
    return canvas;
  }

  function createFlattenedCanvas(page: PageData, whiteBackground: boolean, source: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');

    if (whiteBackground) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw background rendered page
    ctx.drawImage(source, 0, 0);
    releaseCanvas(source);

    // Draw solid black rectangles (rounded outwards so no sliver of content survives)
    ctx.fillStyle = '#000000';
    page.boxes.forEach((box) => {
      const x0 = Math.floor(box.x * page.width);
      const y0 = Math.floor(box.y * page.height);
      const x1 = Math.ceil((box.x + box.w) * page.width);
      const y1 = Math.ceil((box.y + box.h) * page.height);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
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

  // Load a file handed over from another tool
  if (incoming?.[0]) {
    void loadFile(incoming[0]);
  }
}
