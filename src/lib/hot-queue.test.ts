import { describe, expect, it } from 'vitest';
import { outputName, runHotQueue } from './hot-queue';

describe('hot folder queue', () => {
  it('writes beside the original name and continues after a failure', async () => {
    const names = Array.from({ length: 100 }, (_, index) => `file-${index}.pdf`);
    const events = await runHotQueue(
      names,
      (file) => {
        if (file === 'file-3.pdf') return Promise.reject(new Error('Permission was lost. Choose the folder again.'));
        return Promise.resolve({ savedBytes: 10 });
      },
      () => false,
    );
    expect(events).toHaveLength(100);
    expect(events.filter((event) => event.ok)).toHaveLength(99);
    expect(events[3]?.detail).toContain('Permission was lost');
    expect(events[4]?.ok).toBe(true);
    for (const event of events) {
      expect(event.detail.toLowerCase()).not.toContain('deleted');
      if (event.ok) expect(event.detail).toContain(outputName(event.file));
    }
    expect(outputName('contract.pdf')).toBe('contract-copy.pdf');
  });
});
