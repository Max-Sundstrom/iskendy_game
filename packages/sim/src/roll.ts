import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import type { SimState } from './state';

/** Starts a committed roll only for an actual airborne lane-change start. */
export function requestRoll(state: SimState, tuning: SimTuning, direction: number): void {
  const p = state.player;
  if (!p.airborne || (direction !== -1 && direction !== 1)) return;
  if (p.rolling) {
    if (p.rollQueuedDir === 0 && tuning.tricks.barrelRollQueuedInputs === 1) p.rollQueuedDir = direction;
    return;
  }
  p.rolling = true;
  p.rollTargetTurns = Math.round(p.rollTurns) + direction;
  emit(state.events, SimEventKind.rollStart, p.rollsDone + 1, direction);
}

/** Finishes at the exact target; a queued roll starts with no second integration in this tick. */
export function advanceRoll(state: SimState, tuning: SimTuning, dt: number): void {
  const p = state.player;
  if (!p.rolling) return;
  const direction = p.rollTargetTurns > p.rollTurns ? 1 : -1;
  const stepTurns = dt / tuning.tricks.barrelRollDurationS;
  // Bound accumulated floating-point error by tick count and magnitude, capped at 1e-9 turn and 1/4 step.
  // In particular, 27 additions of 1/27 fall slightly short of 1 and must still finish on tick 27.
  const roundingBound =
    2 *
    Number.EPSILON *
    (Math.ceil(tuning.tricks.barrelRollDurationS / dt) + 2) *
    Math.max(1, Math.abs(p.rollTargetTurns));
  const epsilon = Math.min(1e-9, stepTurns / 4, roundingBound);
  if (Math.abs(p.rollTargetTurns - p.rollTurns) > stepTurns + epsilon) {
    p.rollTurns += direction * stepTurns;
    return;
  }
  p.rollTurns = p.rollTargetTurns;
  p.rolling = false;
  p.rollsDone++;
  emit(state.events, SimEventKind.rollDone, p.rollsDone, direction);
  const queued = p.rollQueuedDir;
  p.rollQueuedDir = 0;
  if (queued !== 0) requestRoll(state, tuning, queued);
}
