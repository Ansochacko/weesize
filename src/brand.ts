/**
 * Single source for the product name, domain, and tagline.
 * UI, titles, meta, structured data, Open Graph images, the manifest,
 * and generated copy all read this object. Rename the product here.
 */
export const brand = {
  name: 'Weesize',
  domain: 'weesize.com',
  tagline: 'Get any file to the size you need. Privately.',
  description: 'Weesize shrinks PDFs and photos to the exact size you need, right in your browser. Files are never uploaded.',
  colors: {
    accent: '#2340C9',
    accentDeep: '#1A2FA6',
    accentBright: '#3A58EC',
    curl: '#A9B8FF',
    curlDeep: '#8FA2F7',
    curlLight: '#C9D3FF',
    bg: '#F5F6F8',
    text: '#14181F',
    textDark: '#E6E9EF',
    safe: '#1B7A4A',
    page: '#FFFFFF',
  },
  social: {
    x: '',
    github: '',
    mastodon: '',
  },
  /** Paste the Search Console and Bing tokens here. Empty values emit no tag and make no request. */
  verification: {
    google: '',
    bing: '',
  },
  /** Public repository URL. Empty until the repo is published. Shown as an open-source link. */
  repoUrl: '',
  /**
   * Optional support page (GitHub Sponsors, Ko-fi, etc.). Empty by default.
   * When set, the footer shows a quiet text link that opens in a new tab.
   * The app never loads payment scripts or requests this host itself.
   */
  supportUrl: '',
} as const;

export function brandName(): string {
  return brand.name;
}

export function brandSlug(): string {
  return brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function brandOrigin(): string {
  return `https://${brand.domain}`;
}

export function brandRepoUrl(): string {
  return brand.repoUrl;
}

export function brandSupportUrl(): string {
  return brand.supportUrl;
}
