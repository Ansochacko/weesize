/**
 * Single source for the product name, domain, and tagline.
 * UI, titles, meta, structured data, Open Graph images, the manifest,
 * and generated copy all read this object. Rename the product here.
 */
export const brand = {
  name: 'Weesize',
  domain: 'weesize.com',
  tagline: 'Get any photo, signature or PDF to the exact size a form needs.',
  description: 'Weesize is a free, open-source tool that compresses photos, signatures and PDFs to an exact file size in your browser, without uploading files.',
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
    github: 'https://github.com/Ansochacko/weesize',
    instagram: 'https://www.instagram.com/weesize',
    facebook: 'https://www.facebook.com/weesize',
    x: '',
    mastodon: '',
  },
  /** Paste the Search Console and Bing tokens here. Empty values emit no tag and make no request. */
  verification: {
    google: 'googleacb79945c73fd494',
    bing: '',
  },
  /** Public repository URL. Empty until the repo is published. Shown as an open-source link. */
  repoUrl: 'https://github.com/Ansochacko/weesize',
  instagramUrl: 'https://www.instagram.com/weesize',
  facebookUrl: 'https://www.facebook.com/weesize',
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

export function brandInstagramUrl(): string {
  return brand.instagramUrl;
}

export function brandFacebookUrl(): string {
  return brand.facebookUrl;
}
