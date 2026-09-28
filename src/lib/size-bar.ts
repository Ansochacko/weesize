import { el, formatBytes } from './dom';
import { iconElement } from './icons';

export interface SizeBarOptions {
  before: number;
  after: number;
  limit?: number;
  limitLabel?: string;
  missed?: string | null;
  /** Target only. Does not invent a compressed size. */
  goal?: boolean;
  /** Demo hold at the original size. Not a failed compression. */
  hold?: boolean;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Measuring rule instrument. Widths are real byte ratios. */
export function sizeBar(options: SizeBarOptions): HTMLElement {
  const scale = Math.max(options.before, options.after, options.limit ?? 0, 1);
  const beforePct = Math.min(100, (options.before / scale) * 100);
  const afterPct = Math.min(100, (options.after / scale) * 100);
  const fits = !options.goal && options.limit !== undefined && options.after <= options.limit && !options.missed;
  const smaller = !options.goal && options.after < options.before;
  const percent = smaller ? Math.round((1 - options.after / options.before) * 100) : 0;
  const beforeLabel = formatBytes(options.before);
  const afterLabel = formatBytes(options.after);
  const limitLabel = options.limitLabel ?? (options.limit ? formatBytes(options.limit) : null);

  const note = options.goal
    ? `Goal: ${limitLabel ?? 'the chosen size'}. Measured size appears after compression.`
    : options.hold
      ? 'Example'
      : options.missed
      ? options.missed
      : fits && limitLabel
      ? `${percent}% smaller · Fits the ${limitLabel} limit`
      : smaller
      ? `${percent}% smaller`
      : 'No smaller version was possible.';

  const root = el('div', { class: 'size-bar' });
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', options.goal ? `${beforeLabel}. ${note}` : `${beforeLabel} to ${afterLabel}. ${note}`);

  if (options.limit && limitLabel) {
    const limitLine = el('div', { class: 'size-bar-limit-wrap' }, [
      el('span', { class: 'size-bar-limit-caption' }, [`Limit: ${limitLabel}`]),
      el('div', { class: 'size-bar-limit-line' }),
    ]);
    limitLine.style.left = `${Math.min(100, (options.limit / scale) * 100)}%`;
    root.append(limitLine);
  }

  const track = el('div', { class: 'size-bar-track' });
  const original = el('span', { class: 'size-bar-before' });
  original.style.width = `${beforePct}%`;

  const next = el('span', { class: `size-bar-after${fits ? ' is-fit' : ''}${options.missed ? ' is-miss' : ''}` });
  track.append(original);

  if (!options.goal) {
    next.style.width = reducedMotion() ? `${afterPct}%` : `${beforePct}%`;
    if (fits) next.append(iconElement('check', { size: 14, className: 'size-bar-check' }));
    track.append(next);
  }

  root.append(track);

  const readout = el('p', { class: 'size-display' }, [
    options.goal || options.hold ? beforeLabel : `${beforeLabel} → ${afterLabel}`,
  ]);
  const caption = el('p', { class: `size-bar-note${fits ? ' is-fit' : ''}${options.missed ? ' is-miss' : ''}` }, [note]);
  root.append(readout, caption);

  if (!options.goal && !reducedMotion()) {
    requestAnimationFrame(() => {
      next.style.width = `${afterPct}%`;
    });
  }

  return root;
}
