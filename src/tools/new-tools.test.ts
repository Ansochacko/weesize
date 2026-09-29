import { describe, expect, it } from 'vitest';
import { toolById, activeTools } from './registry';
import { centerCrop, cornerUniformity } from '../lib/id-photo';
import { parseCustomRule } from '../lib/requirements';

describe('refocused core tools suite', () => {
  const coreIds = ['compress-images', 'signature-resizer', 'id-photo', 'compress', 'presets'];

  it('marks all core focus tools as ready in the registry', () => {
    for (const id of coreIds) {
      const tool = toolById(id);
      expect(tool).toBeDefined();
      expect(tool?.status).toBe('ready');
      expect(activeTools().some((t) => t.id === id)).toBe(true);
    }
  });

  describe('ID Photo crop math', () => {
    it('accurately calculates center crop for 2x2 inch and 35x45 mm ratios', () => {
      const squareCrop = centerCrop(1200, 800, 600, 600);
      expect(squareCrop.width).toBe(800);
      expect(squareCrop.height).toBe(800);
      expect(squareCrop.x).toBe(200);
      expect(squareCrop.y).toBe(0);

      const passportCrop = centerCrop(1000, 1000, 350, 450);
      expect(passportCrop.height).toBe(1000);
      expect(passportCrop.width).toBeLessThanOrEqual(1000);
    });

    it('samples corner uniformity correctly', () => {
      const whitePixels = new Uint8ClampedArray(4 * 10 * 10).fill(255);
      const uniform = cornerUniformity(whitePixels, 10, 10);
      expect(uniform.uniform).toBe(true);
    });
  });

  describe('Custom rule parser', () => {
    it('parses format, size bounds, and dimensions from natural text', () => {
      const req = parseCustomRule('JPG, 20–50 KB, 200×230 px');
      expect(req.requirements.formats).toContain('image/jpeg');
      expect(req.requirements.minBytes).toBe(20 * 1024);
      expect(req.requirements.maxBytes).toBe(50 * 1024);
      expect(req.requirements.minWidth).toBe(200);
      expect(req.requirements.minHeight).toBe(230);
    });

    it('parses PDF size limit rule', () => {
      const req = parseCustomRule('PDF under 200 KB');
      expect(req.requirements.formats).toContain('application/pdf');
      expect(req.requirements.maxBytes).toBe(200 * 1024);
    });
  });
});
