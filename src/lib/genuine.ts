import { PDFDocument } from 'pdf-lib';

export interface GenuineReport {
  lines: string[];
  revisions: number;
}

const BANNED = /\b(fake|authentic)\b/i;

export function assertCarefulWording(lines: string[]): void {
  for (const line of lines) {
    if (BANNED.test(line)) throw new Error(`Careless wording: ${line}`);
  }
}

function latin(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

/** Signals only. None of these lines prove that a document is genuine. */
export async function inspectGenuine(bytes: Uint8Array): Promise<GenuineReport> {
  const raw = latin(bytes);
  const revisions = raw.match(/%%EOF/g)?.length ?? 0;
  const lines: string[] = [];
  const byteRange = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(raw);
  if (!byteRange) {
    lines.push('No signature.');
  } else {
    const start = Number(byteRange[1]);
    const len1 = Number(byteRange[2]);
    const start2 = Number(byteRange[3]);
    const len2 = Number(byteRange[4]);
    const covered = start === 0 && len1 > 0 && start2 + len2 >= bytes.length - 2;
    lines.push(covered ? 'A signature byte range covers this file.' : 'Changed after signing.');
    lines.push('The signature bytes were not checked with a certificate. This is not a verdict on who signed.');
    lines.push('Revocation not checked (offline). No trust list is bundled, so the certificate chain was not judged.');
  }
  if (/c2pa|jumbf/i.test(raw)) {
    lines.push('A Content Credentials marker is present. This version does not verify the manifest, so it does not say who edited the file or whether a model was used.');
  } else {
    lines.push('No Content Credentials marker was found.');
  }
  if (revisions > 1) lines.push(`${revisions} revisions. An earlier save may still be inside the file. This version cannot rebuild that earlier copy, so Compare needs the earlier file from you.`);
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const creator = doc.getCreator()?.trim() ?? '';
    const producer = doc.getProducer()?.trim() ?? '';
    if (creator && producer && creator !== producer) lines.push(`Creator “${creator}” and producer “${producer}” differ. That is a signal of more than one program, not proof of tampering.`);
    const created = doc.getCreationDate();
    const modified = doc.getModificationDate();
    if (created && modified && modified.getTime() + 1000 < created.getTime()) {
      lines.push('The modification time is earlier than the creation time.');
    }
  } catch {
    lines.push('The file info could not be read.');
  }
  if (/\/JavaScript\b/.test(raw)) lines.push('A script is stored in the file.');
  const risky = lines.some((line) => /Changed after signing|revisions|differ|script|earlier than/.test(line));
  if (!risky && !byteRange) lines.push('No signs of editing found (this doesn\'t prove the document is genuine).');
  else if (risky) lines.unshift('Signs of editing found.');
  assertCarefulWording(lines);
  return { lines, revisions };
}
