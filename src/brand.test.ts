import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brand } from './brand';

const former = String.fromCharCode(81, 117, 105, 114, 101);
const other = String.fromCharCode(79, 107, 97, 121, 115, 105, 122, 101);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx|js|mjs|cjs|css|html|md|json|svg|webmanifest|txt)$/.test(name)) out.push(path);
  }
  return out;
}

describe('product name', () => {
  it('reads Weesize from the brand file', () => {
    expect(brand.name).toBe('Weesize');
    expect(brand.domain).toBe('weesize.com');
    expect(brand.tagline).toBe('Get any file to the size you need. Privately.');
    expect(brand.description).toBe('Weesize is a free, open-source tool that compresses PDFs and photos to an exact file size in your browser, without uploading files.');
  });

  it('does not keep the previous names in source', () => {
    const pattern = new RegExp(`\\b${former}\\b|\\b${former}-|${former}\\.(?:example|io)|\\b${other}\\b`, 'i');
    const hits = files(process.cwd()).filter((path) => pattern.test(readFileSync(path, 'utf8')));
    expect(hits).toEqual([]);
  });
});
