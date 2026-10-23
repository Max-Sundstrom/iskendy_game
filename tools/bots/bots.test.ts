import { DEFAULT_TUNING } from '@kometa/sim';
import { describe, expect, it } from 'vitest';
import { chaos, novice } from './policies';
import { BOTS, playOne, runBot } from './run';

describe('synthetic players (TEST_STRATEGY §3)', () => {
  it('are deterministic per seed', () => {
    const a = playOne(novice(5, DEFAULT_TUNING.sim), 5, DEFAULT_TUNING.sim);
    const b = playOne(novice(5, DEFAULT_TUNING.sim), 5, DEFAULT_TUNING.sim);
    expect(a).toEqual(b);
  });

  it('Chaos finds no NaNs, exceptions or stuck runs in 300 runs', () => {
    const r = runBot(BOTS.chaos, 300, 100);
    expect(r.anomalies).toEqual([]);
    expect(r.runs).toBe(300);
    expect(r.causes.timeout).toBe(0);
  });

  it('Novice outlives Chaos (the dashboard can tell skill apart)', () => {
    const n = runBot(BOTS.novice, 150, 1);
    const c = runBot((seed) => chaos(seed), 150, 1);
    expect(n.medianM).toBeGreaterThan(c.medianM);
    expect(n.histogram.reduce((sum, [, count]) => sum + count, 0)).toBe(150);
  });
});
