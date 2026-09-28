import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { fixPdf, insertExifGps, scanPdf, stripJpegMetadata } from './share-check';

const TINY_JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5OXq6enx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==',
  ),
  (char) => char.charCodeAt(0),
);

async function planted(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('SECRET', { x: 40, y: 300, size: 18, font, color: rgb(0, 0, 0) });
  page.drawText('GHOST', { x: 20, y: 480, size: 12, font, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 30, y: 290, width: 140, height: 40, color: rgb(0, 0, 0) });
  doc.setAuthor('Ada Lovelace');
  doc.setCreator('HiddenCreator');
  doc.setProducer('HiddenProducer');
  const js = doc.context.obj({ Type: 'Action', S: 'JavaScript', JS: 'app.alert(1)' });
  doc.catalog.set(PDFName.of('OpenAction'), doc.context.register(js));
  await doc.attach(insertExifGps(TINY_JPEG), 'where.jpg');
  const saved = await doc.save({ useObjectStreams: false });
  const extra = new Uint8Array(saved.length + 6);
  extra.set(saved);
  extra.set(new TextEncoder().encode('\n%%EOF'), saved.length);
  return extra;
}

describe('safe to share', () => {
  it('finds the planted risks and a rebuild clears them', async () => {
    const bytes = await planted();
    const before = await scanPdf(bytes);
    const ids = before.map((item) => item.id);
    for (const id of ['revisions', 'javascript', 'attachment', 'gps', 'metadata', 'covered-text', 'white-text', 'off-page']) {
      expect(ids, id).toContain(id);
    }
    const fixed = await fixPdf(bytes);
    const after = await scanPdf(fixed);
    expect(after.map((item) => item.id)).toEqual([]);
    expect(new TextDecoder('latin1').decode(fixed)).not.toContain('SECRET');
    expect(new TextDecoder('latin1').decode(fixed)).not.toContain('Ada Lovelace');
  });

  it('strips a GPS marker from a JPEG without claiming the pixels changed meaning', () => {
    const marked = insertExifGps(TINY_JPEG);
    expect(new TextDecoder('latin1').decode(marked)).toContain('GPSLatitude');
    const clean = stripJpegMetadata(marked);
    expect(new TextDecoder('latin1').decode(clean)).not.toContain('GPSLatitude');
    expect(clean[0]).toBe(0xff);
    expect(clean[1]).toBe(0xd8);
  });
});
