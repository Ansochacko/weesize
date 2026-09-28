import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import JSZip from 'jszip';

mkdirSync('test-files', { recursive: true });

async function createFiles() {
  console.log('Generating test assets using headless browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Generate real JPG, PNG, WEBP using canvas
  const images = await page.evaluate(() => {
    // 1. JPG
    const c1 = document.createElement('canvas');
    c1.width = 600;
    c1.height = 450;
    const ctx1 = c1.getContext('2d');
    const grad1 = ctx1.createLinearGradient(0, 0, 600, 450);
    grad1.addColorStop(0, '#ff4444');
    grad1.addColorStop(0.5, '#44bb44');
    grad1.addColorStop(1, '#2244cc');
    ctx1.fillStyle = grad1;
    ctx1.fillRect(0, 0, 600, 450);
    ctx1.fillStyle = '#ffffff';
    ctx1.font = 'bold 32px sans-serif';
    ctx1.fillText('High Resolution Photo Sample', 50, 220);
    const jpg = c1.toDataURL('image/jpeg', 0.95);

    // 2. PNG with transparent background
    const c2 = document.createElement('canvas');
    c2.width = 200;
    c2.height = 200;
    const ctx2 = c2.getContext('2d');
    ctx2.clearRect(0, 0, 200, 200);
    ctx2.fillStyle = 'rgba(0, 100, 250, 0.6)';
    ctx2.beginPath();
    ctx2.arc(100, 100, 80, 0, Math.PI * 2);
    ctx2.fill();
    const png = c2.toDataURL('image/png');

    // 3. WebP
    const webp = c1.toDataURL('image/webp', 0.9);

    return { jpg, png, webp };
  });

  await browser.close();

  const jpgBuffer = Buffer.from(images.jpg.split(',')[1], 'base64');
  const pngBuffer = Buffer.from(images.png.split(',')[1], 'base64');
  const webpBuffer = Buffer.from(images.webp.split(',')[1], 'base64');

  writeFileSync('test-files/sample.jpg', jpgBuffer);
  console.log('Created sample.jpg (' + jpgBuffer.length + ' bytes)');

  writeFileSync('test-files/transparent.png', pngBuffer);
  console.log('Created transparent.png (' + pngBuffer.length + ' bytes)');

  writeFileSync('test-files/sample.webp', webpBuffer);
  console.log('Created sample.webp (' + webpBuffer.length + ' bytes)');

  // 1. Normal text PDF
  const doc1 = await PDFDocument.create();
  const font = await doc1.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc1.addPage([600, 400]);
    page.drawText(`Page ${i}: This is a normal text PDF document for Weesize testing.`, { x: 50, y: 350, size: 14, font });
    page.drawText('Local client-side execution ensures zero data leakage and 100% privacy.', { x: 50, y: 300, size: 12, font });
  }
  writeFileSync('test-files/normal-text.pdf', await doc1.save());
  console.log('Created normal-text.pdf');

  // 2. Scanned PDF (single page image text)
  const doc2 = await PDFDocument.create();
  const page2 = doc2.addPage([600, 800]);
  page2.drawText('SCANNED INVOICE #10492\nDate: 2026-09-28\nTotal Due: $450.00', { x: 80, y: 700, size: 16, font });
  writeFileSync('test-files/scanned.pdf', await doc2.save());
  console.log('Created scanned.pdf');

  // 3. Photo heavy PDF (multi-page with embedded real JPEGs)
  const doc3 = await PDFDocument.create();
  // Ensure we pass a clean copy ArrayBuffer to avoid pdf-lib JpegEmbedder byteOffset pool bug
  const cleanJpgBytes = new Uint8Array(jpgBuffer.buffer, jpgBuffer.byteOffset, jpgBuffer.byteLength).slice();
  const embeddedJpg = await doc3.embedJpg(cleanJpgBytes);
  for (let i = 1; i <= 3; i++) {
    const p = doc3.addPage([650, 500]);
    p.drawText(`Photo Album Page ${i}`, { x: 50, y: 470, size: 16, font });
    p.drawImage(embeddedJpg, { x: 25, y: 25, width: 600, height: 430 });
  }
  const photoPdfBytes = await doc3.save();
  writeFileSync('test-files/photo-heavy.pdf', photoPdfBytes);
  console.log('Created photo-heavy.pdf (' + photoPdfBytes.length + ' bytes)');

  // 4. Forms, links, bookmarks PDF
  const doc4 = await PDFDocument.create();
  const formPage = doc4.addPage([600, 400]);
  formPage.drawText('Interactive Form & Links PDF', { x: 50, y: 350, size: 16, font });
  const form = doc4.getForm();
  const textField = form.createTextField('applicant_name');
  textField.setText('Jane Doe');
  textField.addToPage(formPage, { x: 50, y: 280, width: 200, height: 25 });
  writeFileSync('test-files/forms-links-bookmarks.pdf', await doc4.save());
  console.log('Created forms-links-bookmarks.pdf');

  // 5. Password-protected PDF
  const rawEncrypted = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\n4 0 obj\n<< /Filter /Standard /V 1 /R 2 /O (mock) /U (mock) /P -4 >>\nendobj\ntrailer\n<< /Root 1 0 R /Encrypt 4 0 R >>\n%%EOF';
  writeFileSync('test-files/protected.pdf', Buffer.from(rawEncrypted));
  console.log('Created protected.pdf');

  // 6. Damaged PDF
  writeFileSync('test-files/damaged.pdf', Buffer.from('%PDF-1.7 corrupt broken data [trailer not found 12345!'));
  console.log('Created damaged.pdf');

  // 7. 200-page PDF
  const doc7 = await PDFDocument.create();
  for (let i = 1; i <= 200; i++) {
    const p = doc7.addPage([400, 300]);
    p.drawText(`Page ${i} of 200`, { x: 50, y: 250, size: 14, font });
  }
  writeFileSync('test-files/large-200p.pdf', await doc7.save());
  console.log('Created large-200p.pdf');

  // 11. AVIF sample
  const avifBytes = Buffer.from([
    0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
    0x61, 0x76, 0x69, 0x66, 0x6d, 0x69, 0x66, 0x31, 0x6d, 0x69, 0x61, 0x66
  ]);
  writeFileSync('test-files/sample.avif', avifBytes);
  console.log('Created sample.avif');

  // 12. HEIC sample
  const heicBytes = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
    0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63
  ]);
  writeFileSync('test-files/sample.heic', heicBytes);
  console.log('Created sample.heic');

  // 13. DOCX sample
  const zipDocx = new JSZip();
  zipDocx.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zipDocx.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Quarterly Financial Summary 2026</w:t></w:r></w:p><w:p><w:r><w:t>Weesize private client-side processing test paragraph.</w:t></w:r></w:p></w:body></w:document>');
  writeFileSync('test-files/sample.docx', await zipDocx.generateAsync({ type: 'nodebuffer' }));
  console.log('Created sample.docx');

  // 14. XLSX sample
  const zipXlsx = new JSZip();
  zipXlsx.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>');
  zipXlsx.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Revenue" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>');
  zipXlsx.file('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Month</t></is></c><c r="B1" t="inlineStr"><is><t>Amount</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>September</t></is></c><c r="B2"><v>12500</v></c></row></sheetData></worksheet>');
  writeFileSync('test-files/sample.xlsx', await zipXlsx.generateAsync({ type: 'nodebuffer' }));
  console.log('Created sample.xlsx');

  // 15. PPTX sample
  const zipPptx = new JSZip();
  zipPptx.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
  zipPptx.file('ppt/presentation.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></p:sldIdLst></p:presentation>');
  writeFileSync('test-files/sample.pptx', await zipPptx.generateAsync({ type: 'nodebuffer' }));
  console.log('Created sample.pptx');

  // 16. HTML sample
  const htmlContent = '<!DOCTYPE html><html><head><title>Annual Statement</title><style>body { font-family: sans-serif; padding: 20px; }</style></head><body><h1>Annual Statement</h1><p>Client report generated for local browser processing test.</p></body></html>';
  writeFileSync('test-files/sample.html', htmlContent);
  console.log('Created sample.html');
}

createFiles().catch(console.error);
