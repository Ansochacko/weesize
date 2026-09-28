import { describe, expect, it } from 'vitest';
import { createHistory } from './undo';

describe('undo history', () => {
  it('returns steps from newest to oldest', () => {
    const history = createHistory<string>();
    history.push('a');
    history.push('b');
    expect(history.undo()).toBe('b');
    expect(history.undo()).toBe('a');
    expect(history.undo()).toBeUndefined();
  });

  it('keeps at most the limit', () => {
    const history = createHistory<number>(2);
    history.push(1);
    history.push(2);
    history.push(3);
    expect(history.length).toBe(2);
    expect(history.undo()).toBe(3);
    expect(history.undo()).toBe(2);
  });
});
