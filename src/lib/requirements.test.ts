import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexablePages } from '../../content/site';
import { checkAgainstRequirement, isPublicRequirement, publicRequirements, type Requirement } from './requirements';

describe('requirement presets', () => {
  it('ships only labeled drafts and publishes none of them', () => {
    const dir = join(process.cwd(), 'content', 'requirements');
    const files = readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'schema.json');
    expect(files.length).toBe(5);
    for (const name of files) {
      const entry = JSON.parse(readFileSync(join(dir, name), 'utf8')) as Requirement;
      expect(entry.status).toBe('draft');
      expect(entry.placeholder).toBe(true);
      expect(entry.requirements.notes).toContain('PLACEHOLDER');
      expect(isPublicRequirement(entry)).toBe(false);
    }
    expect(publicRequirements()).toEqual([]);
    expect(indexablePages().some((page) => page.path.startsWith('presets/'))).toBe(false);
  });

  it('checks a verified fixture and refuses a draft', () => {
    const verified: Requirement = {
      id: 'fixture-photo',
      country: 'Fixture',
      organization: 'Fixture office',
      portal: 'Fixture portal',
      documentType: 'photo',
      requirements: {
        formats: ['image/jpeg'],
        minBytes: null,
        maxBytes: 50000,
        minWidth: 350,
        maxWidth: 350,
        minHeight: 350,
        maxHeight: 350,
        widthMm: 35,
        heightMm: 45,
        minDpi: 300,
        colorMode: 'color',
        background: 'white',
        allowBackgroundEdit: false,
        headSizePercent: { min: 50, max: 69 },
        maxPages: null,
        notes: 'Copied from the fixture page for this test only.',
      },
      sourceUrl: 'https://example.com/official',
      lastVerified: '2026-09-27',
      verifiedBy: 'test',
      status: 'verified',
      placeholder: false,
    };
    expect(isPublicRequirement(verified)).toBe(true);
    const items = checkAgainstRequirement({ mime: 'image/jpeg', bytes: 40000, width: 350, height: 350 }, verified);
    expect(items.find((item) => item.label === 'Format')?.met).toBe(true);
    expect(items.find((item) => item.label === 'File size')?.met).toBe(true);
    expect(items.find((item) => item.label === 'Dimensions')?.met).toBe(true);
    expect(items.find((item) => item.label === 'Head size')?.met).toBeNull();
    const tooBig = checkAgainstRequirement({ mime: 'image/png', bytes: 80000, width: 200, height: 200 }, verified);
    expect(tooBig.find((item) => item.label === 'Format')?.met).toBe(false);
    expect(tooBig.find((item) => item.label === 'Dimensions')?.met).toBe(false);
    const draft = checkAgainstRequirement({ mime: 'image/jpeg', bytes: 10 }, { ...verified, status: 'draft', placeholder: true });
    expect(draft[0]?.met).toBeNull();
  });
});
