import { allPages } from './site';
import { breadcrumb, landingHead, landingRest } from '../src/seo/document';

const english = allPages().filter((page) => page.lang === 'en');
const labels = new Map(english.map((page) => [page.path, page.h1]));

export function hasPage(path: string): boolean {
  const key = path === 'home' ? '' : path;
  return english.some((page) => page.path === key);
}

export function renderInto(route: string): void {
  const key = route === 'home' ? '' : route;
  const page = english.find((item) => item.path === key);
  if (!page) return;
  const head = document.querySelector('#landing-head');
  const rest = document.querySelector('#landing-rest');
  if (head) {
    head.innerHTML = landingHead(page, breadcrumb(page, labels));
    head.setAttribute('data-path', page.path);
  }
  const html = landingRest(page, (path) => labels.get(path) ?? path);
  if (page.kind === 'home') {
    const host = document.querySelector('#home-seo');
    if (host) host.innerHTML = html;
    if (rest) rest.innerHTML = '';
  } else if (rest) rest.innerHTML = html;
  document.title = page.title;
  const description = document.querySelector('meta[name="description"]');
  description?.setAttribute('content', page.description);
}
