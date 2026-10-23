// Fixed-step accumulator (ARCHITECTURE §3): real time is clamped to 100 ms per frame and spent in 1/60 s steps,
// at most 5 per frame; beyond that the game slows down instead of spiralling. Pure, so it is unit-tested.

export const STEP_S = 1 / 60;
export const MAX_FRAME_S = 0.1;
export const MAX_STEPS_PER_FRAME = 5;

export type Accumulator = { carry: number };

/** Returns how many sim steps to run for this frame and leaves the remainder (for interpolation) in `acc.carry`. */
export function stepsForFrame(acc: Accumulator, frameS: number): number {
  acc.carry += Math.min(Math.max(frameS, 0), MAX_FRAME_S);
  let steps = Math.floor(acc.carry / STEP_S + 1e-9);
  if (steps > MAX_STEPS_PER_FRAME) {
    steps = MAX_STEPS_PER_FRAME;
    acc.carry = 0; // drop the backlog: slow down rather than spiral
  } else {
    acc.carry -= steps * STEP_S;
  }
  return steps;
}

/** Interpolation factor between the previous and current snapshot. */
export function alpha(acc: Accumulator): number {
  return Math.min(1, Math.max(0, acc.carry / STEP_S));
}
