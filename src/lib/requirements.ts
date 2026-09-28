import photo from '../../content/requirements/example-photo.json' with { type: 'json' };
import signature from '../../content/requirements/example-signature.json' with { type: 'json' };
import idScan from '../../content/requirements/example-id-scan.json' with { type: 'json' };
import certificate from '../../content/requirements/example-certificate.json' with { type: 'json' };
import application from '../../content/requirements/example-application-pdf.json' with { type: 'json' };
import { VERIFIED_PRESETS } from './verified-presets';
import { brand } from '../brand';

export type RequirementStatus = 'draft' | 'verified' | 'outdated';

export interface RequirementLimits {
  formats: string[];
  minBytes: number | null;
  maxBytes: number | null;
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
  widthMm: number | null;
  heightMm: number | null;
  minDpi: number | null;
  colorMode: string | null;
  background: string | null;
  allowBackgroundEdit: boolean | null;
  headSizePercent: { min: number; max: number } | null;
  maxPages: number | null;
  notes: string;
}

export interface Requirement {
  id: string;
  country: string;
  organization: string;
  portal: string;
  documentType: string;
  requirements: RequirementLimits;
  sourceUrl: string;
  lastVerified: string;
  verifiedBy: string;
  status: RequirementStatus;
  placeholder: boolean;
}

export interface FileFacts {
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  pages?: number;
}

export interface CheckItem {
  label: string;
  met: boolean | null;
  detail: string;
}

const shipped = [...VERIFIED_PRESETS, photo, signature, idScan, certificate, application] as Requirement[];

export function allRequirements(): readonly Requirement[] {
  return shipped;
}

export function parseCustomRule(ruleText: string): Requirement {
  const text = ruleText.trim();
  const formats: string[] = [];
  if (/jpe?g/i.test(text)) formats.push('image/jpeg');
  if (/png/i.test(text)) formats.push('image/png');
  if (/webp/i.test(text)) formats.push('image/webp');
  if (/pdf/i.test(text)) formats.push('application/pdf');

  let minBytes: number | null = null;
  let maxBytes: number | null = null;

  const rangeMatch = /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(kb|mb)/i.exec(text);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const unit = rangeMatch[3]?.toLowerCase() === 'mb' ? 1024 * 1024 : 1024;
    minBytes = Math.round(parseFloat(rangeMatch[1]) * unit);
    maxBytes = Math.round(parseFloat(rangeMatch[2]) * unit);
  } else {
    const singleMatch = /(?:under|max|less than|<=|<|up to)?\s*(\d+(?:\.\d+)?)\s*(kb|mb)/i.exec(text);
    if (singleMatch && singleMatch[1]) {
      const unit = singleMatch[2]?.toLowerCase() === 'mb' ? 1024 * 1024 : 1024;
      maxBytes = Math.round(parseFloat(singleMatch[1]) * unit);
    }
  }

  let minWidth: number | null = null;
  let maxWidth: number | null = null;
  let minHeight: number | null = null;
  let maxHeight: number | null = null;
  let widthMm: number | null = null;
  let heightMm: number | null = null;

  const dimMatch = /(\d+)\s*(?:x|×|\*)\s*(\d+)\s*(px|mm|in|cm)?/i.exec(text);
  if (dimMatch && dimMatch[1] && dimMatch[2]) {
    const w = parseInt(dimMatch[1], 10);
    const h = parseInt(dimMatch[2], 10);
    const unit = dimMatch[3]?.toLowerCase();
    if (unit === 'mm') {
      widthMm = w;
      heightMm = h;
      minWidth = Math.round((w * 300) / 25.4);
      maxWidth = minWidth;
      minHeight = Math.round((h * 300) / 25.4);
      maxHeight = minHeight;
    } else if (unit === 'cm') {
      widthMm = w * 10;
      heightMm = h * 10;
      minWidth = Math.round((w * 10 * 300) / 25.4);
      maxWidth = minWidth;
      minHeight = Math.round((h * 10 * 300) / 25.4);
      maxHeight = minHeight;
    } else if (unit === 'in') {
      minWidth = Math.round(w * 300);
      maxWidth = minWidth;
      minHeight = Math.round(h * 300);
      maxHeight = minHeight;
    } else {
      minWidth = w;
      maxWidth = w;
      minHeight = h;
      maxHeight = h;
    }
  }

  return {
    id: 'custom-rule',
    country: 'Custom Rule',
    organization: 'Custom form rule',
    portal: 'Form requirements',
    documentType: 'Document',
    requirements: {
      formats,
      minBytes,
      maxBytes,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      widthMm,
      heightMm,
      minDpi: widthMm ? 300 : null,
      colorMode: null,
      background: null,
      allowBackgroundEdit: true,
      headSizePercent: null,
      maxPages: formats.includes('application/pdf') ? null : 1,
      notes: text || 'Custom rule applied.',
    },
    sourceUrl: 'https://weesize.com',
    lastVerified: new Date().toISOString().slice(0, 10),
    verifiedBy: 'User custom requirement',
    status: 'verified',
    placeholder: false,
  };
}

/** A record is public only when a person has checked an official page and cleared every placeholder guard. */
export function isPublicRequirement(entry: Requirement): boolean {
  if (entry.status !== 'verified' || entry.placeholder) return false;
  if (!entry.sourceUrl.startsWith('https://') || entry.sourceUrl.includes('example.invalid')) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastVerified) || !entry.verifiedBy.trim()) return false;
  if (entry.requirements.notes.toLowerCase().includes('placeholder')) return false;
  return true;
}

export function publicRequirements(): Requirement[] {
  return shipped.filter(isPublicRequirement);
}

export function requirementById(id: string): Requirement | undefined {
  return shipped.find((entry) => entry.id === id);
}

export function searchRequirements(query: string): Requirement[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = publicRequirements();
  if (!tokens.length) return list;
  return list.filter((entry) => {
    const haystack = [entry.id, entry.country, entry.organization, entry.portal, entry.documentType, entry.requirements.notes]
      .join(' ')
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export function reportOutdatedHref(entry: Requirement): string {
  const title = encodeURIComponent(`Requirement may be outdated: ${entry.id}`);
  const body = encodeURIComponent(
    `Preset: ${entry.id}\nLast checked: ${entry.lastVerified || 'unknown'}\nSource: ${entry.sourceUrl}\n\nWhat changed:\n`,
  );
  const repo = brand.social.github.replace(/\/$/, '');
  if (repo) return `${repo}/issues/new?title=${title}&body=${body}`;
  return `mailto:?subject=${title}&body=${body}`;
}

function between(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

export function checkAgainstRequirement(facts: FileFacts, entry: Requirement): CheckItem[] {
  if (!isPublicRequirement(entry)) {
    return [
      {
        label: 'Preset',
        met: null,
        detail: `${entry.id} is ${entry.status}. It is not applied, because its numbers are not from a checked official page.`,
      },
    ];
  }
  const rules = entry.requirements;
  const items: CheckItem[] = [];
  const formatOk = rules.formats.length === 0 || rules.formats.includes(facts.mime);
  items.push({
    label: 'Format',
    met: formatOk,
    detail: formatOk ? `Format ${facts.mime} is listed.` : `This file is ${facts.mime}. The page asks for ${rules.formats.join(' or ')}.`,
  });
  if (rules.minBytes !== null || rules.maxBytes !== null) {
    const met = between(facts.bytes, rules.minBytes, rules.maxBytes);
    const cap = rules.maxBytes !== null ? `under ${rules.maxBytes} bytes` : 'above the minimum';
    items.push({
      label: 'File size',
      met,
      detail: met ? `Size is ${cap}.` : `Size is ${facts.bytes} bytes. The page asks for a file ${cap}.`,
    });
  }
  if (facts.width !== undefined && facts.height !== undefined && (rules.minWidth !== null || rules.maxWidth !== null || rules.minHeight !== null || rules.maxHeight !== null)) {
    const met = between(facts.width, rules.minWidth, rules.maxWidth) && between(facts.height, rules.minHeight, rules.maxHeight);
    items.push({
      label: 'Dimensions',
      met,
      detail: met
        ? `${facts.width}×${facts.height} matches the listed pixel size.`
        : `${facts.width}×${facts.height} is outside the listed pixel size.`,
    });
  }
  if (rules.minDpi !== null && facts.width && rules.widthMm) {
    const dpi = facts.width / (rules.widthMm / 25.4);
    items.push({
      label: 'Detail',
      met: dpi + 0.5 >= rules.minDpi,
      detail: `About ${Math.round(dpi)} dots per inch from the pixel width and the stated width in millimetres. The page asks for at least ${rules.minDpi}.`,
    });
  } else if (rules.minDpi !== null) {
    items.push({ label: 'Detail', met: null, detail: 'Dots per inch were not measured. The pixel size or the physical size is missing.' });
  }
  if (facts.pages !== undefined && rules.maxPages !== null) {
    items.push({
      label: 'Pages',
      met: facts.pages <= rules.maxPages,
      detail: facts.pages <= rules.maxPages ? `${facts.pages} pages is within the limit.` : `${facts.pages} pages is over the limit of ${rules.maxPages}.`,
    });
  }
  if (rules.background) {
    items.push({
      label: 'Background',
      met: null,
      detail: `The page asks for a ${rules.background} background. This check does not judge the photo. Look at it yourself.`,
    });
  }
  if (rules.headSizePercent) {
    items.push({
      label: 'Head size',
      met: null,
      detail: 'Head size is not measured in this version. Compare it with the official example.',
    });
  }
  return items;
}
