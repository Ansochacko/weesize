import { brand, brandName } from '../src/brand';
import { pageTitle, UPDATED, type Faq, type SeoPage } from '../src/seo/document';

export interface Seed {
  path: string;
  kind: SeoPage['kind'];
  h1: string;
  keyword: string;
  title?: string | undefined;
  description: string;
  toolId?: string;
  essay: string;
  steps: [string, string, string];
  points: [string, string, string];
  facts: [string, string, string, string, string];
  faqs?: Faq[] | undefined;
  related: string[];
  neighbors?: string[];
  guides?: string[];
  intent: string;
  priority: number;
  keywords: string[];
  presetKb?: number;
  presetMime?: SeoPage['presetMime'];
}

export function faqs(subject: string, facts: [string, string, string, string, string]): Faq[] {
  return [
    { q: `Does “${subject}” upload my file?`, a: facts[0] },
    { q: `What will “${subject}” actually change?`, a: facts[1] },
    { q: `When is “${subject}” the wrong job?`, a: facts[2] },
    { q: `How do I check the result of “${subject}”?`, a: facts[3] },
    { q: `Can I run “${subject}” with Wi-Fi off?`, a: facts[4] },
  ];
}

export function toPage(seed: Seed): SeoPage {
  return {
    id: seed.path || 'home',
    path: seed.path,
    lang: 'en',
    htmlLang: 'en',
    reviewed: true,
    noindex: false,
    kind: seed.kind,
    keyword: seed.keyword,
    title: seed.title ?? pageTitle(seed.h1),
    description: seed.description,
    h1: seed.h1,
    subtitle: brand.tagline,
    toolId: seed.toolId ?? null,
    essay: `${seed.essay}\n\n${seed.h1} stays on this device. The download is the copy you keep, and ${brandName()} does not store a second one. Close the tab when you are finished and the bytes are gone.`,
    steps: seed.steps,
    points: seed.points,
    faqs: seed.faqs ?? faqs(seed.h1, seed.facts),
    related: seed.related,
    neighbors: seed.neighbors ?? [],
    guides: seed.guides ?? [],
    updated: UPDATED,
    intent: seed.intent,
    priority: seed.priority,
    keywords: seed.keywords,
    sources: [],
    ...(seed.presetKb !== undefined ? { presetKb: seed.presetKb } : {}),
    ...(seed.presetMime ? { presetMime: seed.presetMime } : {}),
  };
}

export function how(task: string): [string, string, string] {
  return [
    `Open this page and add the file. ${task} starts in the browser you already have open.`,
    'Run the tool. If this version cannot do the job honestly, it says so instead of inventing a result.',
    'Download the file that was built on this device. Closing the tab drops the bytes.',
  ];
}

export function why(specific: string): [string, string, string] {
  return [
    `No upload: ${specific}`,
    'Speed: the file does not travel to a server and back, so the wait is only the work itself.',
    'Quality: the original is kept when the new file would be worse or is not actually smaller.',
  ];
}

export function localFacts(name: string, change: string, wrong: string, check: string): [string, string, string, string, string] {
  return [
    `${name} reads the file in this tab. There is no upload step and no account.`,
    change,
    wrong,
    check,
    `Load this page, then turn Wi-Fi off and run ${name} again. A finished result is the proof that the file was not sent anywhere.`,
  ];
}

void brandName;
