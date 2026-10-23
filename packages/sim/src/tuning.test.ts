import { SimTuningSchema } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, DEFAULT_TUNING_HASH } from './tuning';

describe('default tuning', () => {
  it('loads the shipped file through the schema', () => {
    expect(SimTuningSchema.safeParse(DEFAULT_TUNING.sim).success).toBe(true);
    expect(DEFAULT_TUNING.sim.tickRateHz).toBe(60);
  });

  it('exposes a 16-hex-digit hash for replays', () => {
    expect(DEFAULT_TUNING_HASH).toMatch(/^[0-9a-f]{16}$/);
  });
});
