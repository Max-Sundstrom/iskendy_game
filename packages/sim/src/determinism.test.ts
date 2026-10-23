import { describe, expect, it } from 'vitest';
import { stateHash } from './hash';
import { createSimState } from './state';
import { step } from './step';
import { scriptedInputs } from './testing';
import { DEFAULT_TUNING } from './tuning';

/** 10 000 ticks of scripted input; the same check runs in Chromium (e2e/determinism.spec.ts). */
export const DETERMINISM_SEED = 7;
export const DETERMINISM_TICKS = 10_000;

describe('determinism golden', () => {
  it('produces the pinned hash after 10 000 scripted ticks', () => {
    const s = createSimState(DETERMINISM_SEED, DEFAULT_TUNING.sim);
    const inputs = scriptedInputs(DETERMINISM_SEED, DETERMINISM_TICKS);
    for (const held of inputs) step(s, held, DEFAULT_TUNING.sim);
    expect(s.tick).toBe(DETERMINISM_TICKS);
    expect(stateHash(s)).toBe(GOLDEN_10K);
  });
});

const GOLDEN_10K = 'eb26e68b';
