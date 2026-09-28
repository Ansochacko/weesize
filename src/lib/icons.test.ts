import { describe, expect, it } from 'vitest';
import { icon, toolIcons, uiIcons, type IconName } from './icons';
import { TOOLS } from '../tools/registry';

const names: IconName[] = [...Object.keys(toolIcons), ...Object.keys(uiIcons)] as IconName[];

function tagsBalance(svg: string): boolean {
  const tags = svg.match(/<\/?[a-zA-Z][^>]*?>/g) ?? [];
  const stack: string[] = [];
  for (const tag of tags) {
    const name = tag.match(/^<\/?([a-zA-Z]+)/)?.[1];
    if (!name) return false;
    if (tag.startsWith('</')) {
      if (stack.pop() !== name) return false;
    } else if (!tag.endsWith('/>')) stack.push(name);
  }
  return stack.length === 0;
}

describe('icon system', () => {
  it('gives every registry tool an icon', () => {
    expect(Object.keys(toolIcons)).toHaveLength(42);
    expect(Object.keys(uiIcons)).toHaveLength(35);
    for (const tool of TOOLS) expect(tool.icon in toolIcons).toBe(true);
  });

  it('parses every icon as hidden SVG without a hard-coded color', () => {
    for (const name of names) {
      const svg = icon(name);
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
      expect(tagsBalance(svg)).toBe(true);
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(svg).not.toMatch(/\brgb\s*\(/);
      expect(svg).not.toMatch(/(?:fill|stroke)="(?!currentColor|none)[^"]+"/);
    }
  });

  it('names a labeled icon and thickens small strokes', () => {
    const labeled = icon('search', { label: 'Search tools' });
    expect(labeled).toContain('role="img"');
    expect(labeled).toContain('aria-label="Search tools"');
    expect(labeled).not.toContain('aria-hidden');
    expect(icon('file', { size: 16 })).toContain('stroke-width="2"');
    expect(icon('file', { size: 20 })).toContain('stroke-width="1.75"');
    expect(icon('file', { size: 24 })).toContain('stroke-width="1.5"');
  });
});
