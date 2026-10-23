import { Action } from './input';
import { createRng, nextInt } from './rng';

/**
 * Deterministic input script for determinism checks (Node and browsers run the same one): a seeded random walk of
 * held masks that changes every 3–40 ticks. Exposed as `@kometa/sim/testing`; not used by the game.
 */
export function scriptedInputs(seed: number, ticks: number): Uint8Array {
  const rng = createRng(seed, 99);
  const out = new Uint8Array(ticks);
  const choices = [0, Action.left, Action.right, 0, Action.left | Action.right, Action.jump, Action.boost];
  let held = 0;
  let next = 0;
  for (let t = 0; t < ticks; t++) {
    if (t === next) {
      held = choices[nextInt(rng, choices.length)] ?? 0;
      next = t + 3 + nextInt(rng, 38);
    }
    out[t] = held;
  }
  return out;
}
