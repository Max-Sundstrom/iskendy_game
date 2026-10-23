import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, nextU32 } from './rng';

describe('sfc32 seeded by splitmix32', () => {
  it('matches an independent Python implementation of the same algorithm', () => {
    const r = createRng(12345, 1);
    expect([nextU32(r), nextU32(r), nextU32(r), nextU32(r), nextU32(r)]).toEqual([
      3448323665, 2887151957, 742315652, 3141204330, 1724325112,
    ]);
  });

  it('is reproducible per seed and independent per stream', () => {
    const a = createRng(7, 1);
    const b = createRng(7, 1);
    const c = createRng(7, 2);
    const seqA = Array.from({ length: 8 }, () => nextU32(a));
    expect(Array.from({ length: 8 }, () => nextU32(b))).toEqual(seqA);
    expect(Array.from({ length: 8 }, () => nextU32(c))).not.toEqual(seqA);
  });

  it('produces floats in [0, 1) with a sane mean and ints in range', () => {
    const r = createRng(1, 1);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const f = nextFloat(r);
      expect(f >= 0 && f < 1).toBe(true);
      sum += f;
    }
    expect(Math.abs(sum / 20000 - 0.5)).toBeLessThan(0.01);
    const counts = new Uint32Array(5);
    for (let i = 0; i < 5000; i++) {
      const k = nextInt(r, 5);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const c of counts) expect(c).toBeGreaterThan(900);
  });
});
