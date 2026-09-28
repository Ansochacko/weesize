import { describe, expect, it } from 'vitest';
import { detectFiles } from './detect';

function file(name: string, type: string): File {
  return new File(['x'], name, { type });
}

describe('smart detection', () => {
  it('offers compress first for one PDF', () => {
    const found = detectFiles([file('a.pdf', 'application/pdf')]);
    expect(found.offers.map((offer) => offer.route)).toEqual(['compress', 'sign', 'split', 'organize', 'redact', 'ocr']);
    expect(found.offers[0]?.primary).toBe(true);
  });

  it('offers merge first for several PDFs', () => {
    const found = detectFiles([file('a.pdf', 'application/pdf'), file('b.pdf', 'application/pdf')]);
    expect(found.offers[0]?.label).toBe('Merge PDF');
    expect(found.offers[1]?.label).toBe('Compress all');
  });

  it('offers images to PDF for pictures', () => {
    const found = detectFiles([file('a.png', 'image/png')]);
    expect(found.offers[0]?.route).toBe('compress-images');
    expect(found.offers[1]?.route).toBe('images');
  });
});
