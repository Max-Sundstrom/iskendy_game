import { describe, expect, it } from 'vitest';
import { readBest, submitBest } from './best';

function memoryStore(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe('local personal best', () => {
  it('keeps the higher score', () => {
    const s = memoryStore();
    expect(submitBest(100, 90, s)).toBe(true);
    expect(submitBest(50, 40, s)).toBe(false);
    expect(submitBest(150, 140, s)).toBe(true);
    expect(readBest(s)?.score).toBe(150);
  });

  it('ignores corrupt or foreign records and survives missing storage', () => {
    const s = memoryStore();
    s.setItem('kometa.best.v1', '{"schemaVersion":2,"score":1e9}');
    expect(readBest(s)).toBeUndefined();
    s.setItem('kometa.best.v1', 'not json');
    expect(readBest(s)).toBeUndefined();
    expect(submitBest(10, 10, undefined)).toBe(true);
  });
});
