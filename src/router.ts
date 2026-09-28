import { hrefFor as slugHref, legacyTarget } from './seo/routes';

export type Route = string;

type Listener = (route: Route) => void;

const listeners = new Set<Listener>();

export function parseRoute(pathname = typeof window === 'undefined' ? '/' : window.location.pathname): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return 'home';
  const path = clean.replace(/^\//, '');
  if (path === 'pro' || path === 'pricing' || /(?:^|\/)(?:pro|pricing)$/.test(path)) return 'home';
  return path;
}

export function hrefFor(route: Route): string {
  if (!route || route === 'home') return '/';
  if (route === 'pro' || route === 'pricing' || /(?:^|\/)(?:pro|pricing)$/.test(route)) return '/';
  return slugHref(route);
}

export function navigate(route: Route): void {
  const next = hrefFor(route);
  const current = window.location.pathname.replace(/\/+$/, '') || '/';
  if (current === next) {
    emit(parseRoute(next));
    return;
  }
  history.pushState(null, '', next);
  emit(parseRoute(next));
}

export function canonicalizeLocation(): void {
  const hash = window.location.hash;
  if (hash.startsWith('#/') || hash === '#') {
    const name = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
    history.replaceState(null, '', hrefFor(name || 'home'));
    return;
  }
  const path = window.location.pathname;
  const trimmed = path.replace(/\/+$/, '') || '/';
  if (trimmed === '/pro' || trimmed === '/pricing' || /\/(?:pro|pricing)$/.test(trimmed)) {
    history.replaceState(null, '', '/');
    return;
  }
  if (trimmed !== path && path !== '/') {
    history.replaceState(null, '', trimmed);
    return;
  }
  const legacy = legacyTarget(trimmed);
  if (legacy && legacy !== trimmed) history.replaceState(null, '', legacy);
}

export function onRoute(listener: Listener): void {
  listeners.add(listener);
}

function emit(route: Route): void {
  for (const listener of listeners) listener(route);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => emit(parseRoute()));
}
