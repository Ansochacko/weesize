export interface UrlOptions {
  targetKb?: number;
  pages?: string;
  gray?: boolean;
  presetId?: string;
}

export function readUrlOptions(search: string): UrlOptions {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const options: UrlOptions = {};
  const target = params.get('target');
  const match = target ? /^(\d+(?:\.\d+)?)(kb|mb)$/i.exec(target.replace(/\s+/g, '')) : null;
  if (match?.[1] && match[2]) {
    const amount = Number(match[1]);
    options.targetKb = /mb/i.test(match[2]) ? Math.round(amount * 1024) : Math.round(amount);
  }
  const pages = params.get('pages');
  if (pages) options.pages = pages;
  if (params.get('gray') === '1') options.gray = true;
  const preset = params.get('preset');
  if (preset) options.presetId = preset;
  return options;
}

export const URL_PARAMETER_HELP: Array<{ path: string; detail: string }> = [
  { path: '/compress-pdf?target=200kb', detail: 'Opens Compress and treats 200 KB as a goal.' },
  { path: '/compress-image?target=50kb', detail: 'Opens Compress images with a 50 KB goal.' },
  { path: '/compress-pdf?gray=1', detail: 'Starts the black and white option.' },
  { path: '/split-pdf?pages=1-3', detail: 'Fills the page range.' },
  { path: '/presets/{id}', detail: 'Opens Get it accepted for a verified preset. Draft ids are refused.' },
];
