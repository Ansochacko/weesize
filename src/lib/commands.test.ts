import { describe, expect, it } from 'vitest';
import { parseCommand, planLines } from './commands';

const cases: Array<{ sentence: string; ops: string[] }> = [
  { sentence: 'make this under 2 MB and remove page 3', ops: ['compress', 'delete-pages'] },
  { sentence: 'merge these and add page numbers', ops: ['merge', 'numbers'] },
  { sentence: 'convert to black and white and compress', ops: ['grayscale', 'compress'] },
  { sentence: 'shrink this pdf', ops: ['compress'] },
  { sentence: 'compress to 200 KB', ops: ['compress'] },
  { sentence: 'compress to 100kb', ops: ['compress'] },
  { sentence: 'make it under 500 KB', ops: ['compress'] },
  { sentence: 'delete page 3', ops: ['delete-pages'] },
  { sentence: 'remove pages 2-4', ops: ['delete-pages'] },
  { sentence: 'remove page 1 and page 5', ops: ['delete-pages'] },
  { sentence: 'rotate right', ops: ['rotate'] },
  { sentence: 'rotate left', ops: ['rotate'] },
  { sentence: 'turn the pages upside down', ops: ['rotate'] },
  { sentence: 'split out pages 1-3', ops: ['split'] },
  { sentence: 'extract pages 2, 4', ops: ['split'] },
  { sentence: 'add page numbers', ops: ['numbers'] },
  { sentence: 'number the pages', ops: ['numbers'] },
  { sentence: 'watermark Draft', ops: ['watermark'] },
  { sentence: 'stamp confidential', ops: ['watermark'] },
  { sentence: 'add a watermark that says Copy', ops: ['watermark'] },
  { sentence: 'merge these files', ops: ['merge'] },
  { sentence: 'combine the pdfs', ops: ['merge'] },
  { sentence: 'make this grayscale', ops: ['grayscale'] },
  { sentence: 'black and white', ops: ['grayscale'] },
  { sentence: 'compress and rotate', ops: ['compress', 'rotate'] },
  { sentence: 'remove page 3 then compress under 1 MB', ops: ['delete-pages', 'compress'] },
  { sentence: 'protect with a password', ops: ['unsupported'] },
  { sentence: 'make this under 50 KB', ops: ['compress'] },
  { sentence: 'delete the last page', ops: ['delete-pages'] },
  { sentence: 'add page numbers and compress', ops: ['numbers', 'compress'] },
];

describe('plain-language commands', () => {
  it('parses 30 sentences and always returns a plan', () => {
    expect(cases).toHaveLength(30);
    for (const sample of cases) {
      const steps = parseCommand(sample.sentence);
      expect(steps, sample.sentence).not.toBeNull();
      expect(steps?.map((step) => step.op)).toEqual(sample.ops);
      const lines = planLines(steps ?? []);
      expect(lines.length).toBe(sample.ops.length);
      expect(lines[0]?.startsWith('1. ')).toBe(true);
    }
  });

  it('keeps the size and the page from the first sentence', () => {
    const steps = parseCommand('make this under 2 MB and remove page 3');
    expect(steps?.[0]?.targetKb).toBe(2048);
    expect(steps?.[1]?.pages).toEqual([3]);
  });

  it('does not invent a plan for an unrelated sentence', () => {
    expect(parseCommand('what is the weather')).toBeNull();
  });
});
