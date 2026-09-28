import { describe, expect, it } from 'vitest';
import { backgroundEditAllowed, centerCrop, cornerUniformity, sheetSlots } from './id-photo';

describe('id photo', () => {
  it('center-crops to the target shape without a smoothing step', () => {
    const crop = centerCrop(1000, 800, 350, 450);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1000);
    expect(crop.y + crop.height).toBeLessThanOrEqual(800);
    expect(Math.abs(crop.width / crop.height - 350 / 450)).toBeLessThan(0.02);
  });

  it('places copies inside a 4 by 6 inch sheet', () => {
    const slots = sheetSlots(413, 531);
    expect(slots.length).toBeGreaterThan(1);
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.x + 413).toBeLessThanOrEqual(1800);
      expect(slot.y + 531).toBeLessThanOrEqual(1200);
    }
  });

  it('keeps background replacement off when a preset forbids it', () => {
    expect(backgroundEditAllowed(false).enabled).toBe(false);
    expect(backgroundEditAllowed(null).enabled).toBe(false);
  });

  it('notices uneven corners and similar ones', () => {
    const flat = new Uint8ClampedArray(8 * 8 * 4).fill(250);
    expect(cornerUniformity(flat, 8, 8).uniform).toBe(true);
    const mixed = new Uint8ClampedArray(flat);
    mixed[0] = 10;
    expect(cornerUniformity(mixed, 8, 8).uniform).toBe(false);
  });
});
