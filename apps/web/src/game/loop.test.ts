import { describe, expect, it } from 'vitest';
import { alpha, MAX_STEPS_PER_FRAME, STEP_S, stepsForFrame } from './loop';

describe('fixed-step accumulator', () => {
  it('runs one step per 60 Hz frame and two per 30 Hz frame', () => {
    const acc = { carry: 0 };
    expect(stepsForFrame(acc, STEP_S)).toBe(1);
    expect(stepsForFrame(acc, 2 * STEP_S)).toBe(2);
    expect(acc.carry).toBeCloseTo(0, 9);
  });

  it('keeps the remainder for interpolation at 120 Hz', () => {
    const acc = { carry: 0 };
    expect(stepsForFrame(acc, STEP_S / 2)).toBe(0);
    expect(alpha(acc)).toBeCloseTo(0.5, 6);
    expect(stepsForFrame(acc, STEP_S / 2)).toBe(1);
  });

  it('clamps long frames and never spirals', () => {
    const acc = { carry: 0 };
    expect(stepsForFrame(acc, 5)).toBe(MAX_STEPS_PER_FRAME);
    expect(acc.carry).toBe(0);
    expect(stepsForFrame(acc, -1)).toBe(0);
  });
});
