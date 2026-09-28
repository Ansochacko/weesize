export interface Passage {
  page: number;
  text: string;
}

export interface DocAnswer {
  text: string;
  pages: number[];
  found: boolean;
}

const STOP = new Set(['what', 'when', 'where', 'which', 'this', 'that', 'with', 'from', 'have', 'does', 'about', 'your', 'the', 'and', 'for']);

export function passages(pages: string[]): Passage[] {
  return pages.map((text, index) => ({ page: index + 1, text }));
}

export function searchDocument(pages: string[], query: string): Passage[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3 && !STOP.has(term));
  if (!terms.length) return [];
  return passages(pages).filter((passage) => {
    const hay = passage.text.toLowerCase();
    return terms.some((term) => hay.includes(term));
  });
}

export function answerFromDocument(pages: string[], query: string): DocAnswer {
  const hits = searchDocument(pages, query);
  if (!hits.length) return { text: "I couldn't find that in this document.", pages: [], found: false };
  const cited = hits.slice(0, 3);
  const quotes = cited.map((hit) => `Page ${hit.page}: ${hit.text.trim()}`);
  return {
    text: quotes.join('\n'),
    pages: cited.map((hit) => hit.page),
    found: true,
  };
}

export function findClauses(pages: string[]): Passage[] {
  const pattern = /terminat|payment|liabilit|rent|due|amount|\$|€|£|\b\d{1,2}\s+[A-Z][a-z]+/;
  return passages(pages).filter((passage) => pattern.test(passage.text));
}

export interface PromptClient {
  prompt(input: string): Promise<string>;
}

/** Uses an on-device prompt only with the passages we already found. No passage means no call. */
export async function answerWithPrompt(pages: string[], query: string, client: PromptClient | null): Promise<DocAnswer> {
  const local = answerFromDocument(pages, query);
  if (!local.found || !client) return local;
  const instruction = [
    'Answer only from the passages. Cite a page number. If the passages do not contain the answer, reply exactly: I couldn\'t find that in this document.',
    local.text,
    `Question: ${query}`,
  ].join('\n');
  const reply = (await client.prompt(instruction)).trim();
  if (!reply || /couldn't find that/i.test(reply)) return { text: "I couldn't find that in this document.", pages: [], found: false };
  const cited = local.pages.filter((page) => reply.includes(String(page)));
  return { text: reply, pages: cited.length ? cited : local.pages, found: true };
}

export function browserPromptAvailable(): boolean {
  const host = globalThis as { LanguageModel?: { availability?: () => Promise<string> } };
  return typeof host.LanguageModel?.availability === 'function';
}
