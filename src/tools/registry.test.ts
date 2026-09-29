import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  TOOLS,
  searchTools,
  toolById,
  activeTools,
  popularTools,
  activeToolsCount,
} from './registry';

describe('tool registry', () => {
  it('lists the refocused core and extra tools with unique IDs', () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(15);
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

  it('finds signature resizer from the word signature', () => {
    expect(searchTools('signature')[0]?.id).toBe('signature-resizer');
  });

  it('enforces ready or beta status on all active tools and strictly 8 ready tools in popular', () => {
    for (const tool of TOOLS) {
      expect(['ready', 'beta']).toContain(tool.status);
    }
    const popular = popularTools();
    expect(popular).toHaveLength(8);
    for (const tool of popular) {
      expect(tool.status).toBe('ready');
    }
    expect(popular.some((t) => t.id === 'compress-images')).toBe(true);
    expect(popular.some((t) => t.id === 'signature-resizer')).toBe(true);
    expect(popular.some((t) => t.id === 'id-photo')).toBe(true);
    expect(popular.some((t) => t.id === 'compress')).toBe(true);
  });

  it('accurately counts active tools as ready plus beta', () => {
    const readyAndBeta = TOOLS.filter((t) => t.status === 'ready' || t.status === 'beta');
    expect(activeToolsCount()).toBe(readyAndBeta.length);
    expect(activeTools().length).toBe(readyAndBeta.length);
  });
});
