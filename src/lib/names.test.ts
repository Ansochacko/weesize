import { describe, expect, it } from 'vitest';
import { compressedName, imagesPdfName, mergedName, organizedName, splitPartName } from './names';

describe('output names', () => {
  it('names a compressed PDF from the original file', () => {
    expect(compressedName('Contract.PDF')).toBe('Contract-compressed.pdf');
  });

  it('names a merge from the first file', () => {
    expect(mergedName(['alpha.pdf', 'beta.pdf'])).toBe('alpha-merged.pdf');
  });

  it('names an organized PDF and an images PDF', () => {
    expect(organizedName('notes.pdf')).toBe('notes-organized.pdf');
    expect(imagesPdfName(['scan.png', 'page.jpg'])).toBe('scan.pdf');
  });

  it('names split parts like contract-pages-1-3.pdf', () => {
    expect(splitPartName('contract.pdf', [0, 1, 2])).toBe('contract-pages-1-3.pdf');
    expect(splitPartName('contract.pdf', [4])).toBe('contract-pages-5.pdf');
    expect(splitPartName('contract.pdf', [0, 1, 2, 4, 7, 8])).toBe('contract-pages-1-3,5,8-9.pdf');
  });

  it('never uses a generic output name', () => {
    const names = [compressedName('a.pdf'), mergedName(['a.pdf']), splitPartName('a.pdf', [0])];
    for (const name of names) expect(name.startsWith('output')).toBe(false);
  });
});
