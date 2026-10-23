import { canonicalJson, tuningHash } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { saturatingExp } from './math';
import { SAT_EXP, SAT_EXP_MAX, SAT_EXP_STEP } from './tables';

// Tests may use Math.exp as the reference; the sim itself may not (invariant 2).
describe('SAT_EXP table', () => {
  it('holds 1 − e^(−u) exactly at its sample points', () => {
    SAT_EXP.forEach((v, i) => expect(v).toBe(1 - Math.exp(-i * SAT_EXP_STEP)));
    expect((SAT_EXP.length - 1) * SAT_EXP_STEP).toBe(SAT_EXP_MAX);
  });

  it('is pinned, so a regenerated table that changes sim outcomes is noticed', () => {
    // tuningHash is just FNV-1a 64 over canonical JSON; reused here as a generic content hash.
    expect(tuningHash(SAT_EXP as never)).toBe(tuningHash(JSON.parse(canonicalJson(SAT_EXP)) as never));
    expect(tuningHash(SAT_EXP as never)).toBe(GOLDEN_TABLE_HASH);
  });

  it('interpolates within 5e-5 of the real curve (linear error h²/8 ≈ 3e-5) and saturates beyond the table', () => {
    for (let u = 0; u < SAT_EXP_MAX; u += 0.0137) {
      expect(Math.abs(saturatingExp(u) - (1 - Math.exp(-u)))).toBeLessThan(5e-5);
    }
    expect(saturatingExp(-1)).toBe(0);
    expect(saturatingExp(100)).toBe(1);
  });
});

const GOLDEN_TABLE_HASH = '640f6b2d123806f0';
