// Shared pdf.js loader for the main thread.
//
// Uses the "legacy" build on purpose. The modern build of pdfjs-dist 6.x calls
// newer JavaScript features (for example Map.prototype.getOrInsertComputed)
// that many phones don't have yet: Chrome before 145, iOS Safari before 26.2
// and Samsung Internet. On those browsers page.render() throws and the tool
// hangs. The legacy build ships polyfills for these, so it works everywhere.

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let loading: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!loading) {
    loading = (async () => {
      const [pdfjs, workerModule] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'),
      ]);
      // One shared worker for the whole page, instead of a new one per file.
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = new workerModule.default();
      }
      return pdfjs;
    })().catch((err: unknown) => {
      loading = null; // allow a retry after a failed chunk load
      throw err;
    });
  }
  return loading;
}

export function isPasswordError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  return name === 'PasswordException';
}
