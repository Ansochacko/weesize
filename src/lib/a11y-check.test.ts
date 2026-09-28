import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { applyAccessibilityFixes, checkAccessibility } from './a11y-check';

describe('accessibility check', () => {
  it('reports a missing title as a fix and tags as a human job', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const before = await checkAccessibility(bytes);
    expect(before.find((item) => item.id === 'title')?.state).toBe('fix');
    expect(before.find((item) => item.id === 'tags')?.state).toBe('human');
    const fixed = await applyAccessibilityFixes(bytes, 'Notes', 'en');
    const after = await checkAccessibility(fixed);
    expect(after.find((item) => item.id === 'title')?.state).toBe('pass');
    expect(after.find((item) => item.id === 'language')?.state).toBe('pass');
    expect(after.find((item) => item.id === 'tags')?.state).toBe('human');
  });
});
