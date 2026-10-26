import { ModeKind, SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { advanceModeClock, ModeClockTransition, startLiftoffClock } from './mode-clock';
import { SimStatus, type SimState } from './state';

export const ModePhase = { idle: 0, active: 1, grace: 2 } as const;
export type ModePhase = (typeof ModePhase)[keyof typeof ModePhase];

/** Captures protection before physics; no new mode is consumed or activated during its trigger tick. */
export function modePhase(state: SimState): ModePhase {
  return state.mode.activeTicksLeft > 0
    ? ModePhase.active
    : state.mode.graceTicksLeft > 0
      ? ModePhase.grace
      : ModePhase.idle;
}

/** Advances only the old phase, or spends a full meter after an originally ordinary, surviving tick. */
export function finishModeTick(state: SimState, tuning: SimTuning, phase: ModePhase): void {
  if (state.status !== SimStatus.running) return;
  const mode = state.mode;
  if (phase !== ModePhase.idle) {
    const transition = advanceModeClock(mode, tuning);
    if (transition === ModeClockTransition.activeEnded) {
      emit(state.events, SimEventKind.modeEnded, mode.kind, mode.graceTicksLeft);
      if (mode.graceTicksLeft === 0) mode.kind = ModeKind.none;
    } else if (transition === ModeClockTransition.graceEnded) {
      mode.kind = ModeKind.none;
      emit(state.events, SimEventKind.modeGraceEnded);
    }
    return;
  }
  if (!tuning.meter.autoTrigger || state.score.meter < tuning.meter.capacity) return;
  if (!startLiftoffClock(mode, tuning)) return;
  state.score.meter -= tuning.meter.capacity;
  mode.kind = ModeKind.liftoff;
  mode.smashChain = 0;
  emit(state.events, SimEventKind.modeStarted, mode.kind, mode.activeTicksLeft);
}
