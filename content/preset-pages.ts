import { VERIFIED_PRESETS } from '../src/lib/verified-presets';
import { brandName } from '../src/brand';
import type { Seed } from './factory';
import { how, localFacts, why } from './factory';

export const presetSeeds: Seed[] = VERIFIED_PRESETS.map((preset) => {
  const req = preset.requirements;
  const dimStr = req.widthMm && req.heightMm
    ? `${req.widthMm}×${req.heightMm} mm`
    : req.minWidth && req.minHeight
    ? `${req.minWidth}×${req.minHeight} px`
    : 'Standard dimensions';

  const sizeStr = req.minBytes && req.maxBytes
    ? `${Math.round(req.minBytes / 1024)}–${Math.round(req.maxBytes / 1024)} KB`
    : req.maxBytes
    ? `under ${Math.round(req.maxBytes / 1024)} KB`
    : 'Standard size';

  const isSig = preset.documentType.toLowerCase().includes('signature');
  const toolId = isSig ? 'signature-resizer' : 'id-photo';

  const essay = `${preset.country} ${preset.documentType} official specifications. Verified against official documentation from ${preset.organization} (${preset.portal}). Requirements: Dimensions ${dimStr}, File size ${sizeStr}, Format ${req.formats.map((f) => f.replace('image/', '').toUpperCase()).join(' or ')}, Background: ${req.background ?? 'Specified by office'}.\n\nOfficial requirement last checked: ${preset.lastVerified}. Verified source: ${preset.sourceUrl}. ${req.notes}\n\n${brandName()} crops and resizes your file to these exact specifications directly in your browser. No files are uploaded to any server.`;

  const shortCountry = preset.country.replace(/\s*\(.*?\)/, '');
  const h1 = `${shortCountry} ${preset.documentType}`;
  const title = `${h1} — ${brandName()}`.slice(0, 60);
  const description = `${shortCountry} ${preset.documentType} rules: ${dimStr}, ${sizeStr}. Resize without upload in your browser.`.slice(0, 155);

  return {
    path: `presets/${preset.id}`,
    kind: 'tool',
    h1,
    keyword: `${shortCountry.toLowerCase()} ${preset.documentType.toLowerCase()}`,
    title,
    description,
    toolId,
    essay,
    steps: how(h1),
    points: why(`the specifications for ${preset.country} ${preset.documentType} are verified against official government guidelines.`),
    facts: localFacts(
      `${preset.country} ${preset.documentType}`,
      `Verified for ${preset.country} ${preset.documentType} against ${preset.organization} (${preset.portal}) on ${preset.lastVerified}.`,
      `Official specifications for ${preset.country} ${preset.documentType}: ${dimStr}, ${sizeStr}, ${req.formats.join(' or ')}.`,
      `Processed 100% on this device using client-side WebAssembly and canvas with zero upload for ${preset.country} ${preset.documentType}.`,
    ),
    related: ['id-photo', 'signature-resizer', 'compress-image', 'compress-pdf', 'tools'],
    guides: ['guides/is-it-safe-to-upload-pdfs', 'guides/how-to-check-a-tool-does-not-upload'],
    intent: 'commercial',
    priority: 1,
    keywords: [
      `${preset.country.toLowerCase()} ${preset.documentType.toLowerCase()}`,
      `${preset.id.replaceAll('-', ' ')}`,
      `${preset.portal.toLowerCase()} upload size`,
    ],
  };
});
