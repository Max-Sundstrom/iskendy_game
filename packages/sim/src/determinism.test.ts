import { describe, expect, it } from 'vitest';
import { runScripted } from './testing';
import { DEFAULT_TUNING } from './tuning';

/** 10 000 ticks of scripted input with restarts; the same check runs in Chromium (e2e/determinism.spec.ts). */
describe('determinism golden', () => {
  it('produces the pinned hash after 10 000 scripted ticks', () => {
    const { hash, runs } = runScripted(7, 10_000, DEFAULT_TUNING.sim);
    expect(runs).toBeGreaterThan(1); // the script crashes and retries, so traffic and collisions are exercised
    expect(hash).toBe(GOLDEN_10K);
  });
});

const GOLDEN_10K = '8be91f5c-6f883e35';
