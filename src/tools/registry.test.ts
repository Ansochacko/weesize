import { describe, expect, it } from 'vitest';
import { CATEGORIES, TOOLS, searchTools, toolById } from './registry';

describe('tool registry', () => {
  it('lists the 30 core tools plus the browser-AI and workflow pages', () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(30);
    const ids = TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every tool a category that exists', () => {
    const ids = new Set(CATEGORIES.map((category) => category.id));
    for (const tool of TOOLS) expect(ids.has(tool.category)).toBe(true);
  });

  it('finds compress from the word shrink', () => {
    expect(searchTools('shrink')[0]?.id).toBe('compress');
  });

  it('does not offer password guessing', () => {
    expect(toolById('unlock')?.state).toBe('limited');
    expect(toolById('protect')?.state).toBe('limited');
    expect(toolById('redact')?.state).toBe('limited');
  });
});
