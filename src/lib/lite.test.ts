import { describe, expect, it } from 'vitest';
import { readUrlOptions } from './url-params';
import { shouldUseLite } from './lite';

describe('lite mode and url options', () => {
  it('turns lite on for save-data, slow networks, and small memory', () => {
    expect(shouldUseLite({})).toBe(false);
    expect(shouldUseLite({ saveData: true })).toBe(true);
    expect(shouldUseLite({ effectiveType: '2g' })).toBe(true);
    expect(shouldUseLite({ effectiveType: '4g' })).toBe(false);
    expect(shouldUseLite({ deviceMemory: 2 })).toBe(true);
    expect(shouldUseLite({ deviceMemory: 8 })).toBe(false);
    expect(shouldUseLite({ forced: true })).toBe(true);
  });

  it('reads target, pages, and gray from a query string', () => {
    expect(readUrlOptions('?target=200kb').targetKb).toBe(200);
    expect(readUrlOptions('?target=2mb').targetKb).toBe(2048);
    expect(readUrlOptions('?pages=1-3').pages).toBe('1-3');
    expect(readUrlOptions('?gray=1').gray).toBe(true);
  });
});
