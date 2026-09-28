import { describe, expect, it } from 'vitest';
import { answerFromDocument, answerWithPrompt, findClauses } from './doc-search';

const pages = ['The rent is 500 euros and is due on 1 May.', 'The garden clause is on this page.'];

describe('document search', () => {
  it('cites the page and refuses questions the document does not answer', async () => {
    const rent = answerFromDocument(pages, 'When is the rent due?');
    expect(rent.found).toBe(true);
    expect(rent.pages).toEqual([1]);
    expect(rent.text).toContain('Page 1');
    const missing = answerFromDocument(pages, 'What is the capital of France?');
    expect(missing.found).toBe(false);
    expect(missing.text).toBe("I couldn't find that in this document.");
    const prompted = await answerWithPrompt(pages, 'What is the capital of France?', {
      prompt: () => Promise.resolve('Paris'),
    });
    expect(prompted.text).toBe("I couldn't find that in this document.");
  });

  it('keeps a prompted answer tied to a page that was retrieved', async () => {
    const prompted = await answerWithPrompt(pages, 'When is the rent due?', {
      prompt: () => Promise.resolve('The rent is due in May. See page 1.'),
    });
    expect(prompted.pages).toContain(1);
  });

  it('lists clauses that mention payment language', () => {
    expect(findClauses(pages).map((item) => item.page)).toEqual([1]);
  });
});
