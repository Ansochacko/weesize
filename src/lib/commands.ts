export type CommandOp = 'compress' | 'delete-pages' | 'merge' | 'split' | 'rotate' | 'numbers' | 'watermark' | 'grayscale' | 'unsupported';

export interface CommandStep {
  op: CommandOp;
  label: string;
  targetKb?: number;
  pages?: number[];
  lastPage?: boolean;
  range?: string;
  turns?: 1 | 2 | 3;
  text?: string;
}

interface Hit {
  at: number;
  step: CommandStep;
}

function sizeKb(raw: string, unit: string): number {
  const value = Number(raw);
  return /mb/i.test(unit) ? Math.round(value * 1024) : Math.round(value);
}

/** Rule parser for short commands. Returns null when it does not recognise the sentence. */
export function parseCommand(input: string): CommandStep[] | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  const hits: Hit[] = [];
  const add = (at: number, step: CommandStep): void => {
    hits.push({ at, step });
  };

  const size = /(?:under|to|below)\s+(\d+(?:\.\d+)?)\s*(kb|mb)\b|\b(\d+(?:\.\d+)?)\s*(kb|mb)\b/i.exec(input);
  if (size) {
    const raw = size[1] ?? size[3] ?? '';
    const unit = size[2] ?? size[4] ?? 'kb';
    add(size.index, { op: 'compress', targetKb: sizeKb(raw, unit), label: `Compress toward under ${raw} ${unit.toUpperCase()}` });
  } else if (/\b(compress|shrink|smaller)\b/.test(text)) {
    const at = text.search(/\b(compress|shrink|smaller)\b/);
    add(at, { op: 'compress', label: 'Compress' });
  }

  if (/\b(black and white|grayscale|greyscale)\b/.test(text)) {
    add(text.search(/\b(black and white|grayscale|greyscale)\b/), { op: 'grayscale', label: 'Convert to black and white' });
  }
  if (/\b(merge|combine)\b/.test(text)) {
    add(text.search(/\b(merge|combine)\b/), { op: 'merge', label: 'Merge the files' });
  }
  if (/\b(page numbers|number the pages)\b/.test(text)) {
    add(text.search(/\b(page numbers|number the pages)\b/), { op: 'numbers', label: 'Add page numbers' });
  }
  const watermark = /\b(?:watermark(?:\s+that\s+says)?|stamp)\s+([a-z0-9]+)/i.exec(input);
  if (watermark?.[1]) {
    add(watermark.index, { op: 'watermark', text: watermark[1], label: `Add a watermark that says ${watermark[1]}` });
  }
  if (/\bupside down\b/.test(text)) add(text.search(/\bupside down\b/), { op: 'rotate', turns: 2, label: 'Turn the pages upside down' });
  else if (/\b(rotate left|turn left)\b/.test(text)) add(text.search(/\b(rotate left|turn left)\b/), { op: 'rotate', turns: 3, label: 'Rotate left' });
  else if (/\brotate\b/.test(text)) add(text.search(/\brotate\b/), { op: 'rotate', turns: 1, label: 'Rotate right' });

  if (/\blast page\b/.test(text)) {
    add(text.search(/\blast page\b/), { op: 'delete-pages', lastPage: true, label: 'Delete the last page' });
  }
  const range = /\bpages?\s+(\d+)\s*-\s*(\d+)/i.exec(input);
  if (range?.[1] && range[2]) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    const pages: number[] = [];
    for (let page = Math.min(start, end); page <= Math.max(start, end); page += 1) pages.push(page);
    if (/\b(split|extract)\b/.test(text)) add(range.index, { op: 'split', pages, range: `${range[1]}-${range[2]}`, label: `Split out pages ${range[1]}-${range[2]}` });
    else add(range.index, { op: 'delete-pages', pages, label: `Delete pages ${pages.join(', ')}` });
  }
  const pair = /\bpage\s+(\d+)\s+and\s+page\s+(\d+)/i.exec(input);
  if (pair?.[1] && pair[2] && !range) {
    add(pair.index, { op: 'delete-pages', pages: [Number(pair[1]), Number(pair[2])], label: `Delete page ${pair[1]} and page ${pair[2]}` });
  }
  const one = /\b(?:remove|delete)\s+page\s+(\d+)\b/i.exec(input);
  if (one?.[1] && !range && !pair) {
    add(one.index, { op: 'delete-pages', pages: [Number(one[1])], label: `Delete page ${one[1]}` });
  }
  const listed = /\b(?:split|extract)\b[^0-9]*(\d+(?:\s*,\s*\d+)+)/i.exec(input);
  if (listed?.[1] && !range) {
    const pages = listed[1].split(',').map((part) => Number(part.trim())).filter((page) => page > 0);
    add(listed.index, { op: 'split', pages, range: pages.join(','), label: `Split out pages ${pages.join(', ')}` });
  }
  if (/\b(password|protect)\b/.test(text)) {
    add(text.search(/\b(password|protect)\b/), {
      op: 'unsupported',
      label: 'Add a password. This version cannot encrypt a PDF, so this step will not run.',
    });
  }

  if (!hits.length) return null;
  hits.sort((a, b) => a.at - b.at);
  const steps: CommandStep[] = [];
  for (const hit of hits) {
    if (hit.step.op === 'compress' && steps.some((step) => step.op === 'compress')) continue;
    if (hit.step.op === 'delete-pages' && steps.some((step) => step.op === 'delete-pages')) continue;
    steps.push(hit.step);
  }
  return steps;
}

export function planLines(steps: CommandStep[]): string[] {
  return steps.map((step, index) => `${index + 1}. ${step.label}`);
}

let pending: CommandStep[] | null = null;

export function setPendingCommand(steps: CommandStep[]): void {
  pending = steps;
}

export function takePendingCommand(): CommandStep[] | null {
  const next = pending;
  pending = null;
  return next;
}
