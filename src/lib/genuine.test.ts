import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { inspectGenuine } from './genuine';

describe('genuine check', () => {
  it('reports an unsigned file without claiming it is genuine', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const report = await inspectGenuine(await doc.save());
    expect(report.lines.some((line) => line.includes('No signature'))).toBe(true);
    expect(report.lines.join(' ')).not.toMatch(/\b(fake|authentic)\b/i);
    expect(report.lines.some((line) => line.includes("doesn't prove"))).toBe(true);
  });

  it('reports a byte range that does not cover the file, and a second revision', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setCreator('Writer');
    doc.setProducer('Printer');
    const saved = await doc.save();
    const marker = new TextEncoder().encode('\n/ByteRange [0 4 8 4]\n%%EOF');
    const bytes = new Uint8Array(saved.length + marker.length);
    bytes.set(saved);
    bytes.set(marker, saved.length);
    const report = await inspectGenuine(bytes);
    expect(report.lines.some((line) => line.includes('Changed after signing'))).toBe(true);
    expect(report.revisions).toBeGreaterThan(1);
    expect(report.lines.join(' ')).toContain('Signs of editing found');
    expect(report.lines.join(' ')).not.toMatch(/\b(fake|authentic)\b/i);
  });
});
