import { describe, expect, it } from 'vitest';
import {
  currentLocale,
  formatLocalizedFileSize,
  formatLocalizedNumber,
  setLocale,
  SUPPORTED_LOCALES,
  t,
  UI_STRINGS,
} from './i18n';

describe('i18n system', () => {
  it('supports the 11 required languages including RTL languages', () => {
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
    expect(codes).toContain('es');
    expect(codes).toContain('pt-br');
    expect(codes).toContain('id');
    expect(codes).toContain('ar');
    expect(codes).toContain('fr');
    expect(codes).toContain('de');
    expect(codes).toContain('fil');
    expect(codes).toContain('bn');
    expect(codes).toContain('ur');

    const ar = SUPPORTED_LOCALES.find((l) => l.code === 'ar');
    expect(ar?.dir).toBe('rtl');

    const ur = SUPPORTED_LOCALES.find((l) => l.code === 'ur');
    expect(ur?.dir).toBe('rtl');
  });

  it('translates core UI strings across all 11 languages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      setLocale(locale.code);
      expect(t('tagline').length).toBeGreaterThan(10);
      expect(t('compressPdf').length).toBeGreaterThan(2);
      expect(t('signatureResizer').length).toBeGreaterThan(2);
      expect(t('idPhoto').length).toBeGreaterThan(2);
    }
  });

  it('localizes number and file size formats', () => {
    setLocale('en');
    expect(formatLocalizedNumber(1000)).toBe('1,000');
    expect(formatLocalizedFileSize(50 * 1024)).toBe('50 KB');
    expect(formatLocalizedFileSize(2 * 1024 * 1024)).toBe('2 MB');

    setLocale('de');
    expect(formatLocalizedNumber(1000)).toBe('1.000');
  });
});
