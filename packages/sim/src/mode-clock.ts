import type { SimTuning } from '@kometa/shared';

// Exact timing primitive; modes.ts owns eligibility/events, while physics owns the interval's effects.
export type ModeClock = {
  activeTicksLeft: number;
  graceTicksLeft: number;
};

export const ModeClockTransition = { none: 0, activeEnded: 1, graceEnded: 2 } as const;
export type ModeClockTransition = (typeof ModeClockTransition)[keyof typeof ModeClockTransition];

function ticksFor(durationS: number, tickRateHz: number): number {
  const ticks = Math.ceil(durationS * tickRateHz);
  // Validated durations can still overflow when multiplied. An unsafe integer cannot count down exactly.
  if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError('Mode duration must fit an exact tick count');
  return ticks;
}

/** Allocates a fresh idle clock, independent of every other run. */
export function createModeClock(): ModeClock {
  return { activeTicksLeft: 0, graceTicksLeft: 0 };
}

/** Clears both intervals without replacing the clock object. */
export function resetModeClock(clock: ModeClock): void {
  clock.activeTicksLeft = 0;
  clock.graceTicksLeft = 0;
}

/** Starts an idle clock from validated tuning; it neither advances time nor inspects the meter. */
export function startLiftoffClock(clock: ModeClock, tuning: SimTuning): boolean {
  if (clock.activeTicksLeft !== 0 || clock.graceTicksLeft !== 0) return false;
  const ticks = ticksFor(tuning.modes.liftoff.durationS, tuning.tickRateHz);
  clock.activeTicksLeft = ticks;
  return true;
}

/** Consumes one existing interval tick; the new grace interval begins on the following advance. */
export function advanceModeClock(clock: ModeClock, tuning: SimTuning): ModeClockTransition {
  if (clock.activeTicksLeft > 0) {
    if (clock.activeTicksLeft === 1) {
      // Resolve the next interval before changing state, so an unrepresentable duration fails atomically.
      const graceTicks = ticksFor(tuning.modes.graceS, tuning.tickRateHz);
      clock.activeTicksLeft = 0;
      clock.graceTicksLeft = graceTicks;
      return ModeClockTransition.activeEnded;
    }
    clock.activeTicksLeft--;
  } else if (clock.graceTicksLeft > 0) {
    if (--clock.graceTicksLeft === 0) return ModeClockTransition.graceEnded;
  }
  return ModeClockTransition.none;
}
