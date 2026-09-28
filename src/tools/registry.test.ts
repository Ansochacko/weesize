import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  TOOLS,
  searchTools,
  toolById,
  activeTools,
  popularTools,
  toolsIn,
  activeToolsCount,
} from './registry';
import { toPage } from '../../content/factory';

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

  it('enforces status on every tool and strictly 8 ready tools in popular', () => {
    for (const tool of TOOLS) {
      expect(['ready', 'beta', 'coming-soon']).toContain(tool.status);
    }
    const popular = popularTools();
    expect(popular).toHaveLength(8);
    for (const tool of popular) {
      expect(tool.status).toBe('ready');
    }
    expect(popular.some((t) => t.id === 'compress-images')).toBe(true);
    expect(popular.some((t) => t.id === 'sign')).toBe(false);
  });

  it('accurately counts active tools as ready plus beta', () => {
    const readyAndBeta = TOOLS.filter((t) => t.status === 'ready' || t.status === 'beta');
    expect(activeToolsCount()).toBe(readyAndBeta.length);
    expect(activeTools().length).toBe(readyAndBeta.length);
  });

  it('automatically promotes a tool to active, category, search, and sitemap when status is changed from coming-soon to ready', () => {
    const editTool = toolById('edit')!;
    expect(editTool.status).toBe('coming-soon');
    expect(activeTools().some((t) => t.id === 'edit')).toBe(false);
    expect(toolsIn('edit').some((t) => t.id === 'edit')).toBe(false);
    expect(searchTools('Edit PDF').some((t) => t.id === 'edit')).toBe(false);

    // Promote to ready
    const originalStatus = editTool.status;
    (editTool as any).status = 'ready';

    try {
      expect(activeTools().some((t) => t.id === 'edit')).toBe(true);
      expect(toolsIn('edit').some((t) => t.id === 'edit')).toBe(true);
      expect(searchTools('Edit PDF').some((t) => t.id === 'edit')).toBe(true);

      const page = toPage({
        path: 'edit-pdf',
        kind: 'tool',
        h1: 'Edit PDF',
        keyword: 'edit pdf',
        description: 'Edit PDF in your browser.',
        toolId: 'edit',
        essay: 'Edit PDF test.',
        steps: ['1', '2', '3'],
        points: ['1', '2', '3'],
        facts: ['1', '2', '3', '4', '5'],
        related: ['organize-pdf'],
        intent: 'transactional',
        priority: 1,
        keywords: ['edit pdf'],
      });
      expect(page.noindex).toBe(false);
    } finally {
      (editTool as any).status = originalStatus;
    }

    // Verify restored
    expect(editTool.status).toBe('coming-soon');
    expect(activeTools().some((t) => t.id === 'edit')).toBe(false);
  });
});
