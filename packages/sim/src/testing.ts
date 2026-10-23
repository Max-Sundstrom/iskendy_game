import type { SimTuning } from '@kometa/shared';
import { stateHash } from './hash';
import { Action } from './input';
import { createRng, nextInt } from './rng';
import { createSimState, SimStatus } from './state';
import { step } from './step';

/**
 * Deterministic input script for determinism checks (Node and browsers run the same one): a seeded random walk of
 * held masks that changes every 3–40 ticks. Exposed as `@kometa/sim/testing`; not used by the game.
 */
export function scriptedInputs(seed: number, ticks: number): Uint8Array {
  const rng = createRng(seed, 99);
  const out = new Uint8Array(ticks);
  const choices = [0, Action.left, Action.right, 0, Action.left | Action.right, Action.jump, Action.boost, Action.slam];
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

/** FNV-1a 32 step over the characters of a string. */
function fold(h: number, s: string): number {
  let x = h;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return x;
}

/**
 * Plays the script for `ticks` steps, restarting with seed + 1 after every crash (like a player pressing Retry), and
 * folds the state hash every 60 ticks and at every crash into one running hash, so a long check stays meaningful.
 */
export function runScripted(seed: number, ticks: number, tuning: SimTuning): { hash: string; runs: number } {
  const inputs = scriptedInputs(seed, ticks);
  let runSeed = seed;
  let state = createSimState(runSeed, tuning);
  let runs = 1;
  let h = 0x811c9dc5;
  for (let t = 0; t < ticks; t++) {
    step(state, inputs[t] ?? 0, tuning);
    if ((t + 1) % 60 === 0) h = fold(h, stateHash(state));
    if (state.status === SimStatus.crashed) {
      h = fold(h, stateHash(state));
      runSeed++;
      runs++;
      state = createSimState(runSeed, tuning);
    }
  }
  return { hash: `${stateHash(state)}-${h.toString(16).padStart(8, '0')}`, runs };
}
