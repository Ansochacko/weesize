import { brand, brandName } from '../src/brand';
import { pageTitle, UPDATED, type Faq, type SeoPage } from '../src/seo/document';
import { toolById } from '../src/tools/registry';
import { targetFromPath } from '../src/seo/routes';

function isSoonSlug(slug: string): boolean {
  if (!slug) return false;
  const target = targetFromPath(`/${slug}`);
  const tool = target?.toolId ? toolById(target.toolId) : toolById(slug);
  return tool?.status === 'coming-soon';
}

export interface Seed {
  path: string;
  kind: SeoPage['kind'];
  h1: string;
  subtitle?: string | undefined;
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

function computeSubtitle(seed: Seed): string {
  if (seed.subtitle) return seed.subtitle;
  if (seed.kind === 'size') {
    if (seed.presetKb) {
      const kbStr = seed.presetKb >= 1024 && seed.presetKb % 1024 === 0 
        ? `${seed.presetKb / 1024} MB` 
        : `${seed.presetKb} KB`;
      if (seed.toolId === 'compress-images' || seed.path.includes('image') || seed.path.includes('jpg')) {
        return `Shrink photos and pictures to under ${kbStr}. Free, private, and nothing is uploaded.`;
      }
      return `Compress PDF files to under ${kbStr} right in your browser. Free, private, and no upload.`;
    }
    return `Resize your files to the exact size you need. Free, private, and runs in your browser.`;
  }
  if (seed.kind === 'tool') {
    if (seed.path === 'compress-image') {
      return 'Shrink photos to the exact size you need, like 20 KB or 50 KB. Free, nothing is uploaded.';
    }
    if (seed.path === 'compress-pdf') {
      return 'Compress PDFs to an exact target size or strength. Free, private, and runs in your browser.';
    }
    if (seed.path === 'merge-pdf') {
      return 'Combine multiple PDF documents into one in seconds. Free, private, and nothing is uploaded.';
    }
    if (seed.path === 'split-pdf') {
      return 'Extract pages or split PDF files into separate documents. Free, private, and runs on your device.';
    }
    if (seed.path === 'organize-pdf' || seed.path === 'organize-pages') {
      return 'Rearrange, rotate, and delete PDF pages visually. Free, private, and nothing is uploaded.';
    }
    if (seed.path === 'id-photo') {
      return 'Create passport, visa, and ID photos to exact dimensions and file size. Free and runs on your device.';
    }
    if (seed.path === 'signature' || seed.path === 'signature-resizer') {
      return 'Clean background to white, darken ink, and resize signatures for online forms. Free, instant, and private.';
    }
    if (seed.path === 'jpg-to-pdf') {
      return 'Convert JPG, JPEG, and PNG images into a clean PDF document. Free, fast, and no upload.';
    }
    if (seed.path === 'pdf-to-jpg') {
      return 'Convert PDF pages into high-quality JPG photos. Free, fast, and 100% private.';
    }
  }
  if (seed.description) {
    const firstSentence = seed.description.split('.')[0]?.trim() ?? '';
    if (firstSentence.length > 15 && firstSentence.length < 120) {
      return `${firstSentence}. Free, private, and processed on your device.`;
    }
  }
  return brand.tagline;
}

export function toPage(seed: Seed): SeoPage {
  const tool = seed.toolId ? toolById(seed.toolId) : undefined;
  const isSoon = tool?.status === 'coming-soon';
  return {
    id: seed.path || 'home',
    path: seed.path,
    lang: 'en',
    htmlLang: 'en',
    reviewed: true,
    noindex: isSoon,
    kind: seed.kind,
    keyword: seed.keyword,
    title: seed.title ?? pageTitle(seed.h1),
    description: seed.description,
    h1: seed.h1,
    subtitle: computeSubtitle(seed),
    toolId: seed.toolId ?? null,
    essay: `${seed.essay}\n\n${seed.h1} is processed entirely on your device. Your original file remains untouched, and nothing is ever uploaded to a server or saved in the cloud.`,
    steps: seed.steps,
    points: seed.points,
    faqs: seed.faqs ?? faqs(seed.h1, seed.facts),
    related: seed.related.filter((item) => !isSoonSlug(item)),
    neighbors: (seed.neighbors ?? []).filter((item) => !isSoonSlug(item)),
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
    `Select or drop your file to start ${task}. Everything runs directly in your browser.`,
    `Choose your target size or options. ${task} processes the file instantly on your device.`,
    'Download your finished file. Nothing is ever uploaded to a server.',
  ];
}

export function why(specific: string): [string, string, string] {
  return [
    `No upload: ${specific}`,
    'Speed: processing happens instantly on your device with no upload or download delays.',
    'Quality: you can check your file before saving, and the original remains unchanged.',
  ];
}

export function localFacts(name: string, change: string, wrong: string, check: string): [string, string, string, string, string] {
  return [
    `${name} processes your file locally in this browser tab. There is no upload step and no account required.`,
    change,
    wrong,
    check,
    `You can turn off Wi-Fi after loading this page and ${name} still works completely offline.`,
  ];
}

void brandName;
