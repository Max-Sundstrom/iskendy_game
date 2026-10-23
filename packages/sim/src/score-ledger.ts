import { ScoreReason, SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import type { SimState } from './state';

// Cleared before each synchronous scoring pass; these scratch credits never affect another tick/run.
const REASONS = ScoreReason.slam;
const credits = new Float64Array(REASONS * 2);

/** Clears presentation aggregation without changing the ledger or the source-event prefix. */
export function beginCredits(): void {
  credits.fill(0);
}

/** Current multiplier, after a streak action has incremented N. */
export function streakMultiplier(state: SimState, tuning: SimTuning): number {
  return Math.min(tuning.streak.multiplierCap, 1 + tuning.streak.multiplierStep * (state.score.streakN - 1));
}

/** Refreshes only an existing series; passive roof points never create one. */
export function refreshStreak(state: SimState, tuning: SimTuning): void {
  if (state.score.streakN > 0) state.score.streakTicksLeft = Math.ceil(tuning.streak.windowS * tuning.tickRateHz);
}

function credit(
  state: SimState,
  tuning: SimTuning,
  reason: ScoreReason,
  points: number,
  meter: number,
  pot: boolean,
): void {
  const s = state.score;
  const credited = pot ? points * streakMultiplier(state, tuning) : points;
  if (pot) s.pot += credited;
  else s.total += credited;
  const index = reason - 1 + (pot ? REASONS : 0);
  credits[index] = (credits[index] ?? 0) + credited;
  s.meter = Math.min(tuning.meter.capacity, s.meter + meter);
}

/** Adds one real style action in producer order, then credits its newly incremented multiplier. */
export function awardAction(
  state: SimState,
  tuning: SimTuning,
  reason: ScoreReason,
  points: number,
  meter: number,
): void {
  state.score.streakN++;
  refreshStreak(state, tuning);
  credit(state, tuning, reason, points, meter, true);
}

/** Credits a passive interval without increasing N; the explicit target policy controls its ledger. */
export function awardPulse(
  state: SimState,
  tuning: SimTuning,
  reason: ScoreReason,
  points: number,
  meter: number,
  target: SimTuning['scoring']['boostTarget'],
): void {
  credit(state, tuning, reason, points, meter, target === 'activePot' && state.score.streakN > 0);
}

/** Emits bounded aggregated credits, followed by every newly crossed milestone, before settlement. */
export function finishCredits(state: SimState, tuning: SimTuning, previousN: number): void {
  for (let i = 0; i < credits.length; i++) {
    const points = credits[i] ?? 0;
    if (points === 0) continue;
    emit(
      state.events,
      i < REASONS ? SimEventKind.scoreAddedDirect : SimEventKind.scoreAddedToPot,
      (i % REASONS) + 1,
      points,
    );
  }
  const every = tuning.streak.fireworksEvery;
  for (let n = (Math.floor(previousN / every) + 1) * every; n <= state.score.streakN; n += every) {
    emit(state.events, SimEventKind.streakMilestone, n);
  }
}

/** Closes the pending series once; previously banked/direct points are never deducted. */
export function settleStreak(state: SimState, ratio: number): void {
  const s = state.score;
  if (s.streakN === 0) return;
  const banked = s.pot * ratio;
  emit(state.events, SimEventKind.streakSettled, banked, s.pot - banked);
  s.total += banked;
  s.pot = 0;
  s.streakN = 0;
  s.streakTicksLeft = 0;
}
