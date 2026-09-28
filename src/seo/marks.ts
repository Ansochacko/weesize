/** Logo marks. Gradient and mask ids are unique per instance so inline copies do not collide. */

const SQUARE = { x: 4, y: 4, w: 56, h: 56, r: 14 };
const BIG = 'M36 15H22a4 4 0 0 0-4 4v26a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V25z';
const BIG_FOLD = 'M36 15v6a4 4 0 0 0 4 4h6';
const SMALL = 'M29.5 31H22a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9.5a2 2 0 0 0 2-2V35z';
const SMALL_FOLD = 'M29.5 31v3a1 1 0 0 0 1 1h3';
const FAVICON_PAGE = 'M33 19H22a3 3 0 0 0-3 3v20a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V27z';

function square(fill: string): string {
  return `<rect x="${SQUARE.x}" y="${SQUARE.y}" width="${SQUARE.w}" height="${SQUARE.h}" rx="${SQUARE.r}" fill="${fill}"/>`;
}

function bigOutline(stroke: string, opacity: string): string {
  return `<path d="${BIG}" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="3" stroke-linejoin="round"/>
  <path d="${BIG_FOLD}" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="3" stroke-linejoin="round"/>`;
}

function smallPage(fill: string, fold: string): string {
  return `<path d="${SMALL}" fill="${fill}"/>
  <path d="${SMALL_FOLD}" fill="none" stroke="${fold}" stroke-width="1.6"/>`;
}

export function markColor(id: string): string {
  const gradient = `wg-${id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="${gradient}" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#3A58EC"/><stop offset="1" stop-color="#1A2FA6"/>
    </linearGradient>
  </defs>
  ${square(`url(#${gradient})`)}
  ${bigOutline('#fff', '.5')}
  ${smallPage('#fff', '#2A44D0')}
</svg>`;
}

export function markFlat(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">
  ${square('#2340C9')}
  ${bigOutline('#fff', '.5')}
  ${smallPage('#fff', '#2340C9')}
</svg>`;
}

export function markMono(id: string): string {
  const mask = `wm-${id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">
  <mask id="${mask}" maskUnits="userSpaceOnUse">
    <rect width="64" height="64" fill="#000"/>
    <rect x="4" y="4" width="56" height="56" rx="14" fill="#fff"/>
    <path d="${BIG}" fill="none" stroke="#808080" stroke-width="3" stroke-linejoin="round"/>
    <path d="${BIG_FOLD}" fill="none" stroke="#808080" stroke-width="3" stroke-linejoin="round"/>
    <path d="${SMALL}" fill="#000"/>
  </mask>
  <rect x="4" y="4" width="56" height="56" rx="14" fill="currentColor" mask="url(#${mask})"/>
</svg>`;
}

export function markReversed(id: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" data-variant="${id}" role="img" aria-hidden="true">
  ${square('#FFFFFF')}
  ${bigOutline('#2340C9', '.5')}
  ${smallPage('#2340C9', '#FFFFFF')}
</svg>`;
}

export function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <style>
    .ws-sq { fill: #2340C9 }
    @media (prefers-color-scheme: dark) {
      .ws-sq { fill: #7F93FF }
    }
  </style>
  <rect class="ws-sq" x="4" y="4" width="56" height="56" rx="14"/>
  <path d="${FAVICON_PAGE}" fill="#fff"/>
</svg>`;
}

export const MARK_PATHS = {
  big: BIG,
  bigFold: BIG_FOLD,
  small: SMALL,
  smallFold: SMALL_FOLD,
  faviconPage: FAVICON_PAGE,
};
