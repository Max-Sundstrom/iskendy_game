import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { jumpPhysics } from './jump';
import { crash, CrashCause } from './outcome';
import type { SimState } from './state';

// Front flips and landing grades (GDD §5.6–5.7). Pressing Jump again in the air starts a 360° front flip that is
// committed once started; another press during a flip queues one more. The angle from upright at touchdown grades
// the landing: PERFECT ≤ 12°, STUNT ≤ 35°, SLOPPY ≤ 75° (speed penalty), worse is a crash. Barrel rolls: P2-02.

export const LandingGrade = { perfect: 1, stunt: 2, sloppy: 3 } as const;

/** Seconds until the car would reach the road falling freely from here (no thrust). */
export function timeToGround(state: SimState, tuning: SimTuning): number {
  const p = state.player;
  const { gUp, gDown } = jumpPhysics(tuning);
  const g = p.vy > 0 ? gUp : gDown;
  return (p.vy + Math.sqrt(p.vy * p.vy + 2 * g * Math.max(0, p.y))) / g;
}

/**
 * A Jump press in the air: a flip, a queued flip, or — when the road is closer than the jump buffer — a buffered
 * jump (G3 keeps working: a press 100 ms before landing jumps on touchdown instead of starting a doomed flip).
 * Returns false when the press should be buffered.
 */
export function airJumpPress(state: SimState, tuning: SimTuning): boolean {
  const p = state.player;
  if (p.flipping) {
    p.flipQueued = true;
    return true;
  }
  if (!p.flying && timeToGround(state, tuning) < tuning.jump.bufferS) return false;
  p.flipping = true;
  emit(state.events, SimEventKind.flipStart, Math.floor(p.flipTurns) + 1);
  return true;
}

/** Advances the flip; a completed flip rolls straight into a queued one. */
export function advanceFlip(state: SimState, tuning: SimTuning, dt: number): void {
  const p = state.player;
  if (!p.flipping) return;
  const before = Math.floor(p.flipTurns);
  p.flipTurns += dt / tuning.tricks.frontFlipDurationS;
  if (Math.floor(p.flipTurns) > before) {
    p.flipsDone++;
    emit(state.events, SimEventKind.flipDone, p.flipsDone);
    if (p.flipQueued) {
      p.flipQueued = false;
      emit(state.events, SimEventKind.flipStart, p.flipsDone + 1);
    } else {
      p.flipping = false;
      p.flipTurns = Math.round(p.flipTurns);
    }
  }
}

/** Degrees between the car's pitch and upright. */
export function uprightErrorDeg(flipTurns: number): number {
  const frac = flipTurns - Math.round(flipTurns);
  return Math.abs(frac) * 360;
}

/** Grades a touchdown on any surface. Plain jumps (no flip) aren't graded. Returns false if the landing crashed. */
export function gradeLanding(state: SimState, tuning: SimTuning): boolean {
  const p = state.player;
  const tricked = p.flipping || p.flipsDone > 0;
  const angle = uprightErrorDeg(p.flipTurns);
  const flips = p.flipsDone;
  p.flipping = false;
  p.flipQueued = false;
  p.flipTurns = 0;
  p.flipsDone = 0;
  if (!tricked) return true;
  const l = tuning.landing;
  const EPS = 1e-9; // bounds are inclusive (G6); turns→degrees isn't exact in floating point
  if (angle > l.sloppyMaxDeg + EPS) {
    crash(state, CrashCause.landing);
    return false;
  }
  const grade =
    angle <= l.perfectMaxDeg + EPS
      ? LandingGrade.perfect
      : angle <= l.stuntMaxDeg + EPS
        ? LandingGrade.stunt
        : LandingGrade.sloppy;
  if (grade === LandingGrade.sloppy) {
    p.penaltyS = tuning.speed.sloppyPenaltyDurationS;
    p.penaltyFactor = tuning.speed.sloppyPenalty;
  }
  emit(state.events, SimEventKind.landingGraded, grade, flips);
  return true;
}
