import { registerSW } from 'virtual:pwa-register';

export type ProofState = 'loading' | 'ready' | 'offline';

const COPY: Record<ProofState, string> = {
  loading: 'Checking…',
  ready: 'Processed on your device',
  offline: 'Processed on your device',
};

let booted = false;
let proofRoot: HTMLElement | null = null;
let proofText: HTMLElement | null = null;

function paintProof(): void {
  if (!proofRoot || !proofText) return;
  const state: ProofState = !booted ? 'loading' : navigator.onLine ? 'ready' : 'offline';
  proofRoot.dataset.state = state;
  proofText.textContent = COPY[state];
}

export function mountProof(root: HTMLElement, text: HTMLElement): void {
  proofRoot = root;
  proofText = text;
  window.addEventListener('online', paintProof);
  window.addEventListener('offline', paintProof);
  paintProof();
}

export function markToolsReady(): void {
  booted = true;
  paintProof();
  performance.mark('weesize-ready');
}

/** Registers the app shell only. User files are never added to the cache. */
export function registerOfflineApp(): void {
  registerSW({ immediate: true });
}
