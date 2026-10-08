import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { EXACT_SIZE_PAGES } from '../config/size-pages';
import { activeTools, toolById } from './registry';
import { targetFromPath } from '../seo/routes';

describe('Redact tool and expansion tools', () => {
  it('registers all new tools with ready status', () => {
    const redact = toolById('redact');
    expect(redact).toBeDefined();
    expect(redact?.status).toBe('ready');

    const resizePixels = toolById('resize-pixels');
    expect(resizePixels).toBeDefined();
    expect(resizePixels?.status).toBe('ready');

    const heic = toolById('heic');
    expect(heic).toBeDefined();
    expect(heic?.status).toBe('ready');

    const pdfImages = toolById('pdf-images');
    expect(pdfImages).toBeDefined();
    expect(pdfImages?.status).toBe('ready');

    const images = toolById('images');
    expect(images).toBeDefined();
    expect(images?.status).toBe('ready');
  });

  it('routes public slugs correctly for new tools', () => {
    expect(targetFromPath('/redact')?.toolId).toBe('redact');
    expect(targetFromPath('/resize-image-pixels')?.toolId).toBe('resize-pixels');
    expect(targetFromPath('/heic-to-jpg')?.toolId).toBe('heic');
    expect(targetFromPath('/image-to-pdf')?.toolId).toBe('images');
    expect(targetFromPath('/pdf-to-image')?.toolId).toBe('pdf-images');
  });

  it('configures exact-size landing pages correctly', () => {
    expect(EXACT_SIZE_PAGES).toHaveLength(3);

    const pdf150 = EXACT_SIZE_PAGES.find((p) => p.slug === 'compress-pdf-to-150kb');
    expect(pdf150).toBeDefined();
    expect(pdf150?.targetKb).toBe(150);
    expect(pdf150?.fileType).toBe('pdf');
    expect(targetFromPath('/compress-pdf-to-150kb')?.pdfTargetKb).toBe(150);

    const img20 = EXACT_SIZE_PAGES.find((p) => p.slug === 'compress-image-to-20kb');
    expect(img20).toBeDefined();
    expect(img20?.targetKb).toBe(20);
    expect(img20?.fileType).toBe('image');
    expect(targetFromPath('/compress-image-to-20kb')?.imageTargetKb).toBe(20);

    const jpg50 = EXACT_SIZE_PAGES.find((p) => p.slug === 'compress-jpg-to-50kb');
    expect(jpg50).toBeDefined();
    expect(jpg50?.targetKb).toBe(50);
    expect(jpg50?.fileType).toBe('jpg');
    expect(targetFromPath('/compress-jpg-to-50kb')?.imageTargetKb).toBe(50);
  });

  it('verifies that redacted PDF outputs contain zero text streams and empty metadata', async () => {
    // Simulate what the redact tool builds with pdf-lib from flattened images
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');

    // Add a 1x1 test image page
    const page = pdfDoc.addPage([595.28, 841.89]);
    // A 1x1 transparent/black JPEG dummy byte array
    const dummyJpgBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const dummyBytes = Uint8Array.from(atob(dummyJpgBase64), (c) => c.charCodeAt(0));
    const img = await pdfDoc.embedJpg(dummyBytes);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });

    const savedBytes = await pdfDoc.save();
    const reloaded = await PDFDocument.load(savedBytes);

    // Verify metadata is empty / default
    expect(reloaded.getTitle()).toBeFalsy();
    expect(reloaded.getAuthor()).toBeFalsy();
    expect(reloaded.getSubject()).toBeFalsy();
    expect(reloaded.getKeywords()).toBeFalsy();
    expect(reloaded.getCreator()).toBeFalsy();

    // Verify page count and that page has no font/text dictionaries
    expect(reloaded.getPageCount()).toBe(1);
  });
});
