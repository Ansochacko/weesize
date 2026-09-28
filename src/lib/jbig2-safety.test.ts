import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(full)));
    else if (/\.(ts|js|mjs|c|h)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) files.push(full);
  }
  return files;
}

describe('JBIG2 symbol mode', () => {
  it('is never enabled, because symbol matching can swap characters', async () => {
    const root = path.resolve('src');
    const files = await sourceFiles(root);
    const banned = [/jbig2enc/i, /symbol\s*dictionary/i, /JBIG2_SYMBOL/i, /pattern matching/i];
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      for (const pattern of banned) {
        expect(text, file).not.toMatch(pattern);
      }
    }
  });
});
