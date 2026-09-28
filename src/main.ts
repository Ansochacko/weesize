import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-serif/600.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/atmosphere.css';
import { imagesFromClipboard, type ToolRoute } from './lib/detect';
import { filesFromDataTransfer } from './lib/folders';
import { savePrefs } from './lib/prefs';
import { iconElement } from './lib/icons';
import { markToolsReady, mountProof, registerOfflineApp } from './lib/offline';
import { fileFromBytes, takeStagedBytes } from './lib/session';
import { readUrlOptions } from './lib/url-params';
import { readLiteSignals, shouldUseLite } from './lib/lite';
import { registerLocalTools } from './lib/agent';
import { canonicalizeLocation, navigate, onRoute, parseRoute, type Route } from './router';
import { setToolPreset } from './seo/preset';
import { targetFromPath } from './seo/routes';
import { brand, brandName } from './brand';
import { lockupHorizontal } from './assets/brand/lockup';
import { loadRecent, markCurrent, mountCatalog, mountPalette, noteRecent } from './shell/catalog';
import { mountHome } from './tools/home';
import { mountSettings } from './tools/settings';
import { toolById } from './tools/registry';
import type { ToolApi } from './tools/types';

const THEME_KEY = 'weesize-theme';
type ThemeName = 'light' | 'dark';

const dropHost = document.querySelector<HTMLElement>('#smart-drop');
const suggestHost = document.querySelector<HTMLElement>('#suggestions');
const homePanel = document.querySelector<HTMLElement>('#panel-home');
const proof = document.querySelector<HTMLElement>('#proof');
const proofText = document.querySelector<HTMLElement>('#proof-text');
const themeButton = document.querySelector<HTMLButtonElement>('#theme-toggle');
const settingsPanel = document.querySelector<HTMLElement>('#panel-settings');
const extraPanel = document.querySelector<HTMLElement>('#panel-extra');
const viewHome = document.querySelector<HTMLElement>('#view-home');
const viewTools = document.querySelector<HTMLElement>('#view-tools');
const workspace = document.querySelector<HTMLElement>('#workspace');
const sidebar = document.querySelector<HTMLElement>('#sidebar');
const popularHost = document.querySelector<HTMLElement>('#popular');
const catalogHost = document.querySelector<HTMLElement>('#catalog');
const palette = document.querySelector<HTMLElement>('#palette');
const paletteInput = document.querySelector<HTMLInputElement>('#palette-input');
const paletteList = document.querySelector<HTMLElement>('#palette-list');
const commandOpen = document.querySelector<HTMLButtonElement>('#command-open');
const navOpen = document.querySelector<HTMLButtonElement>('#nav-open');
const statusPop = document.querySelector<HTMLElement>('#status-pop');
const shellScroll = document.querySelector<HTMLElement>('#shell-scroll');

if (
  !dropHost ||
  !suggestHost ||
  !homePanel ||
  !proof ||
  !proofText ||
  !themeButton ||
  !settingsPanel ||
  !extraPanel ||
  !viewHome ||
  !viewTools ||
  !workspace ||
  !sidebar ||
  !popularHost ||
  !catalogHost ||
  !palette ||
  !paletteInput ||
  !paletteList ||
  !commandOpen ||
  !navOpen ||
  !statusPop ||
  !shellScroll
) {
  throw new Error(`${brandName()} is missing part of the page.`);
}

const themeToggle = themeButton;
const homeView = viewHome;
const toolsView = viewTools;
const workView = workspace;
const sideNav = sidebar;
const extraHost = extraPanel;
const popular = popularHost;
const catalog = catalogHost;
const commandDialog = palette;
const commandField = paletteInput;
const commandList = paletteList;
const commandButton = commandOpen;
const menuButton = navOpen;
const statusNote = statusPop;
const proofChip = proof;
const settingsHost = settingsPanel;

let active: ToolApi | null = null;
let activeRoute: Route = 'home';
let stagedFiles: File[] | null = null;
let dragDepth = 0;

const home = mountHome({
  dropHost,
  suggestHost,
  panel: homePanel,
  onPick(route, files) {
    stagedFiles = files;
    navigate(route);
  },
});

const loaders: Record<ToolRoute, () => Promise<ToolApi>> = {
  compress: async () => (await import('./tools/compress')).mountCompress(panelFor('compress')),
  merge: async () => (await import('./tools/merge')).mountMerge(panelFor('merge')),
  split: async () => (await import('./tools/split')).mountSplit(panelFor('split')),
  organize: async () => (await import('./tools/organize')).mountOrganize(panelFor('organize')),
  images: async () => (await import('./tools/images-to-pdf')).mountImages(panelFor('images')),
};

const mounted = new Map<ToolRoute, Promise<ToolApi>>();

function panelFor(route: ToolRoute): HTMLElement {
  const panel = document.querySelector<HTMLElement>(`#panel-${route}`);
  if (!panel) throw new Error(`${brandName()} is missing part of the page.`);
  return panel;
}

function ensure(route: ToolRoute): Promise<ToolApi> {
  const existing = mounted.get(route);
  if (existing) return existing;
  const pending = loaders[route]();
  mounted.set(route, pending);
  return pending;
}

const LEGACY: readonly ToolRoute[] = ['compress', 'merge', 'split', 'organize', 'images'];

function isLegacy(route: string): route is ToolRoute {
  return (LEGACY as readonly string[]).includes(route);
}

function toolFor(route: Route): string | null {
  if (route === 'home') return null;
  return targetFromPath(`/${route}`)?.toolId ?? (toolById(route) ? route : null);
}

function show(route: Route): void {
  activeRoute = route;
  const toolId = toolFor(route);
  const landing = route !== 'home' && route !== 'tools' && route !== 'settings' && route !== 'dev/icons' && route !== 'dev/design';
  homeView.hidden = route !== 'home';
  toolsView.hidden = route !== 'tools';
  workView.hidden = route === 'home' || route === 'tools';
  document.querySelector('#landing-head')?.toggleAttribute('hidden', !landing);
  document.querySelector('#landing-rest')?.toggleAttribute('hidden', !landing);
  const sheet = document.querySelector<HTMLElement>('#workspace .sheet');
  if (sheet) sheet.hidden = landing && !toolId && route !== 'settings' && route !== 'dev/icons' && route !== 'dev/design';
  const panels = ['compress', 'merge', 'split', 'organize', 'images', 'extra', 'settings', 'home'];
  for (const name of panels) {
    const panel = document.getElementById(`panel-${name}`);
    if (panel) panel.hidden = true;
  }
  if (route === 'settings') settingsHost.hidden = false;
  else if (toolId && isLegacy(toolId)) {
    const panel = document.getElementById(`panel-${toolId}`);
    if (panel) panel.hidden = false;
  } else if (toolId || route === 'dev/icons' || route === 'dev/design') extraHost.hidden = false;
  else if (route === '404') extraHost.hidden = false;
  if (!toolId) active = null;
  markCurrent(toolId ?? route);
  sideNav.classList.remove('is-open');
  const head = document.querySelector<HTMLElement>('#landing-head');
  if (route === '404' && head) {
    head.hidden = false;
    head.innerHTML = '<h1>Page not found</h1><p class="lede">That address is not a page on this site.</p>';
    const rest = document.querySelector<HTMLElement>('#landing-rest');
    if (rest) {
      rest.hidden = false;
      rest.innerHTML = '<p>Use Search tools in the top bar.</p><p class="link-row"><a href="/compress-pdf">Compress PDF</a> <a href="/merge-pdf">Merge PDF</a> <a href="/split-pdf">Split PDF</a> <a href="/jpg-to-pdf">JPG to PDF</a> <a href="/compress-image">Compress image</a> <a href="/">Home</a></p>';
    }
    workView.hidden = false;
  }
}

async function open(route: Route): Promise<void> {
  const target = route === 'home' ? null : targetFromPath(`/${route}`);
  const query = readUrlOptions(window.location.search);
  const imageTool = target?.toolId === 'compress-images';
  setToolPreset({
    ...(target?.pdfTargetKb !== undefined ? { pdfTargetKb: target.pdfTargetKb } : {}),
    ...(target?.imageTargetKb !== undefined ? { imageTargetKb: target.imageTargetKb } : {}),
    ...(target?.imageMime ? { imageMime: target.imageMime } : {}),
    ...(query.targetKb !== undefined ? (imageTool ? { imageTargetKb: query.targetKb } : { pdfTargetKb: query.targetKb }) : {}),
    ...(query.pages ? { pages: query.pages } : {}),
    ...(query.gray ? { gray: true } : {}),
    ...(target?.presetId ? { presetId: target.presetId } : {}),
    ...(query.presetId ? { presetId: query.presetId } : {}),
  });
  const structural = route === 'home' || route === 'tools' || route === 'settings' || route === 'dev/icons' || route === 'dev/design';
  const known = structural ? true : await revealPage(route);
  if (!structural && !target && !known) {
    show('404');
    return;
  }
  show(route);
  if (route === 'home' || route === 'tools' || route === 'settings' || route === '404') return;
  if (route === 'dev/icons') {
    const { mountIconGallery } = await import('./shell/icon-gallery');
    if (activeRoute !== route) return;
    mountIconGallery(extraHost);
    return;
  }
  if (route === 'dev/design') {
    const { mountDesignGallery } = await import('./shell/design-gallery');
    if (activeRoute !== route) return;
    mountDesignGallery(extraHost);
    return;
  }
  const toolId = target?.toolId;
  if (!toolId || !toolById(toolId)) return;
  noteRecent(toolId);
  const picked = stagedFiles;
  stagedFiles = null;
  const held = takeStagedBytes();
  const heldFiles = held?.map((item) => fileFromBytes(item.name, item.bytes, 'application/pdf'));
  if (isLegacy(toolId)) {
    const tool = await ensure(toolId);
    if (activeRoute !== route) return;
    active = tool;
    tool.applyPreset?.();
    if (picked?.length) tool.ingest(picked);
    if (held?.length) tool.loadHeld?.(held);
    applyAddressOptions();
    return;
  }
  active = null;
  const { mountExtra } = await import('./tools/extra');
  if (activeRoute !== route) return;
  mountExtra(extraHost, toolId, picked ?? heldFiles);
  applyAddressOptions();
}

function applyAddressOptions(): void {
  const options = readUrlOptions(window.location.search);
  const range = document.querySelector<HTMLInputElement>('#split-range');
  if (range && options.pages) {
    range.value = options.pages;
    range.dispatchEvent(new Event('input'));
  }
  const gray = document.querySelector<HTMLInputElement>('#compress-gray');
  if (gray && options.gray) {
    gray.checked = true;
    gray.dispatchEvent(new Event('change'));
  }
}

async function revealPage(route: Route): Promise<boolean> {
  const head = document.querySelector('#landing-head');
  if (head?.getAttribute('data-path') === route && head.textContent?.trim()) return true;
  if (import.meta.env.DEV) {
    const { hasPage, renderInto } = await import('../content/render-client');
    if (!hasPage(route)) return false;
    renderInto(route);
    return true;
  }
  try {
    const response = await fetch(route ? `/${route}` : '/', { headers: { accept: 'text/html' } });
    if (!response.ok) return false;
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextHead = doc.querySelector('#landing-head');
    const nextRest = doc.querySelector('#landing-rest');
    if (!nextHead?.textContent?.trim()) return false;
    if (head) {
      head.innerHTML = nextHead.innerHTML;
      head.setAttribute('data-path', route);
    }
    const rest = document.querySelector('#landing-rest');
    if (rest && nextRest) rest.innerHTML = nextRest.innerHTML;
    if (doc.title) document.title = doc.title;
    return true;
  } catch {
    return false;
  }
}

onRoute((route) => {
  void open(route);
});

mountCatalog(popular, catalog, sideNav, toolsView);
loadRecent();
const commands = mountPalette(commandDialog, commandField, commandList);
commandButton.addEventListener('click', () => commands.open());
menuButton.addEventListener('click', () => sideNav.classList.toggle('is-open'));
menuButton.replaceChildren(iconElement('menu', { size: 16 }));
document.querySelector('#command-open')?.prepend(iconElement('search', { size: 16 }));
document.querySelector('#hero-lock')?.replaceChildren(iconElement('lock', { size: 14 }));
document.querySelector('#trust-icon-1')?.replaceChildren(iconElement('offline', { size: 18 }));
document.querySelector('#trust-icon-2')?.replaceChildren(iconElement('compress-pdf', { size: 18 }));
document.querySelector('#trust-icon-3')?.replaceChildren(iconElement('shield', { size: 18 }));
const wordmark = document.querySelector('.wordmark');
if (wordmark) {
  wordmark.setAttribute('aria-label', brandName());
  wordmark.innerHTML = lockupHorizontal;
}
paintStatusIcon();
function paintStatusIcon(): void {
  const host = document.querySelector('#proof-icon');
  if (!host) return;
  if (!host.classList.contains('status-dot')) {
    host.replaceChildren(iconElement(proofChip.dataset.state === 'offline' ? 'offline' : 'shield', { size: 16 }));
  }
}

proof.addEventListener('click', (event) => {
  event.stopPropagation();
  statusNote.hidden = !statusNote.hidden;
});
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Node)) return;
  if (proof.contains(event.target) || statusNote.contains(event.target)) return;
  statusNote.hidden = true;
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === 'k') {
    event.preventDefault();
    if (commandDialog.hidden) commands.open();
    else commands.close();
    return;
  }
  if (key === 'escape' && !commandDialog.hidden) {
    commands.close();
    return;
  }
  if (active?.onKeydown?.(event)) event.preventDefault();
});

function isFileDrag(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

document.addEventListener('dragover', (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('dragenter', (event) => {
  if (!isFileDrag(event)) return;
  dragDepth += 1;
  home.setHot(true);
  active?.setDragging(true);
});

document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    home.setHot(false);
    active?.setDragging(false);
  }
});

document.addEventListener('drop', (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  home.setHot(false);
  active?.setDragging(false);
  const transfer = event.dataTransfer;
  if (!transfer) return;
  const inHero = event.target instanceof Node && dropHost.contains(event.target);
  void filesFromDataTransfer(transfer).then((files) => {
    if (!files.length) return;
    if (activeRoute === 'home' || inHero) home.offer(files);
    else active?.ingest(files);
  });
});

window.addEventListener('paste', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  const files = imagesFromClipboard(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  if (activeRoute === 'images') active?.ingest(files);
  else {
    stagedFiles = files;
    navigate('images');
  }
});

type ThemeMode = 'system' | 'light' | 'dark';

function systemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedMode(): ThemeMode {
  try {
    const val = localStorage.getItem('weesize-theme-mode');
    if (val === 'light' || val === 'dark' || val === 'system') return val;
    const old = localStorage.getItem(THEME_KEY);
    if (old === 'light' || old === 'dark') return old;
  } catch {
    /* Storage is optional. */
  }
  return 'system';
}

function applyTheme(mode: ThemeMode): void {
  const effectiveTheme: ThemeName = mode === 'system' ? systemTheme() : mode;
  if (mode === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = effectiveTheme;
  }
  try {
    localStorage.setItem('weesize-theme-mode', mode);
    localStorage.setItem(THEME_KEY, effectiveTheme);
  } catch {
    /* The page still switches for this visit. */
  }
  void savePrefs({ theme: effectiveTheme });
  const label = mode === 'system' ? 'System theme' : mode === 'light' ? 'Light theme' : 'Dark theme';
  themeToggle.setAttribute('aria-label', `Switch theme (${label})`);
  themeToggle.dataset.tip = label;
  themeToggle.replaceChildren(iconElement(effectiveTheme === 'dark' ? 'sun' : 'moon', { size: 16 }));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effectiveTheme === 'dark' ? '#0F1216' : '#F6F7F9');
}

applyTheme(storedMode());

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (storedMode() === 'system') applyTheme('system');
});

themeToggle.addEventListener('click', () => {
  const current = storedMode();
  const next: ThemeMode = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
  applyTheme(next);
});

mountSettings(settingsHost, () => {
  applyTheme('system');
});

const topbar = document.querySelector('.topbar');
const onScroll = () => topbar?.classList.toggle('is-scrolled', shellScroll.scrollTop > 8);
onScroll();
shellScroll.addEventListener('scroll', onScroll, { passive: true });

const finePointer = window.matchMedia('(pointer: fine)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('pointermove', (event) => {
  if (!finePointer.matches || reduceMotion.matches || document.documentElement.dataset.lite === 'on') return;
  const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.tool-card') : null;
  if (!card) return;
  const box = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${event.clientX - box.left}px`);
  card.style.setProperty('--my', `${event.clientY - box.top}px`);
});

const shortcut = navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K';
const shortcutKey = document.querySelector('#command-open kbd');
if (shortcutKey) shortcutKey.textContent = shortcut;

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest('a');
  if (!link || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname.includes('.')) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const hashed = url.hash.startsWith('#/');
  if (!hashed && url.pathname === '/' && !url.hash) {
    event.preventDefault();
    navigate('home');
    return;
  }
  if (!hashed && url.pathname === window.location.pathname) return;
  event.preventDefault();
  navigate(hashed ? (url.hash.replace(/^#\/?/, '') || 'home') : parseRoute(url.pathname));
});

canonicalizeLocation();
void open(parseRoute());

requestAnimationFrame(() => {
  if (shouldUseLite(readLiteSignals()) || parseRoute() === 'lite') document.documentElement.dataset.lite = 'on';
  registerLocalTools();
  const lite = document.documentElement.dataset.lite === 'on';
  const boot = Promise.all([
    import('./lib/pdf').then((mod) => mod.startEngines()),
    import('./tools/compress'),
    import('./tools/merge'),
    import('./tools/images-to-pdf'),
    import('./tools/result'),
    ...(lite ? [] : [import('./tools/split'), import('./tools/organize')]),
  ]);
  void boot.then(() => markToolsReady()).catch(() => markToolsReady());
});

registerOfflineApp();
mountProof(proof, proofText);
paintStatusIcon();
new MutationObserver(paintStatusIcon).observe(proofChip, { attributes: true, attributeFilter: ['data-state'] });

{
  const host = document.querySelector<HTMLElement>('#foot-extra');
  if (host) {
    const links: HTMLAnchorElement[] = [];
    if (brand.repoUrl) {
      const open = document.createElement('a');
      open.href = brand.repoUrl;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'Open source';
      links.push(open);
    }
    if (brand.supportUrl) {
      const support = document.createElement('a');
      support.href = brand.supportUrl;
      support.target = '_blank';
      support.rel = 'noopener';
      support.textContent = `Support ${brandName()}`;
      links.push(support);
    }
    if (links.length) {
      host.hidden = false;
      host.replaceChildren(...links);
    }
  }
}
