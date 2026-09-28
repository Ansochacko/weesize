import { fileBase } from './download';

export function compressedName(filename: string): string {
  return `${fileBase(filename)}-compressed.pdf`;
}

export function mergedName(filenames: readonly string[]): string {
  return `${fileBase(filenames[0] ?? 'document')}-merged.pdf`;
}

export function organizedName(filename: string): string {
  return `${fileBase(filename)}-organized.pdf`;
}

export function imagesPdfName(filenames: readonly string[]): string {
  return `${fileBase(filenames[0] ?? 'images')}.pdf`;
}

export function splitZipName(filename: string): string {
  return `${fileBase(filename)}-split.zip`;
}

/** Pages are zero-based indexes, in order. Example: contract-pages-1-3.pdf */
export function splitPartName(filename: string, zeroBasedPages: readonly number[]): string {
  const base = fileBase(filename);
  const runs = contiguousRuns(zeroBasedPages);
  if (runs.length === 0) return `${base}-split.pdf`;
  const label = runs.map((run) => (run.start === run.end ? `${run.start}` : `${run.start}-${run.end}`)).join(',');
  return `${base}-pages-${label}.pdf`;
}

function contiguousRuns(zeroBasedPages: readonly number[]): Array<{ start: number; end: number }> {
  const pages = [...new Set(zeroBasedPages.map((page) => page + 1))].filter((page) => page > 0).sort((a, b) => a - b);
  const runs: Array<{ start: number; end: number }> = [];
  for (const page of pages) {
    const last = runs[runs.length - 1];
    if (last && page === last.end + 1) last.end = page;
    else runs.push({ start: page, end: page });
  }
  return runs;
}
