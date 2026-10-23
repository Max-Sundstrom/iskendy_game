import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { Action, pressed } from './input';
import { advanceLaneChange, requestLaneChange } from './lateral';
import { saturatingExp } from './math';
import { SimStatus, type SimState } from './state';
import { updateAir, verticalInput, verticalIntegrate } from './vertical';

// One fixed 60 Hz step (ARCHITECTURE §4.3). Order so far: input → lateral → AIR → vertical → forward → origin shift.
// Mutates `state` in place and allocates nothing (invariant 5).

/** Forward speed from distance (GDD §5.2): vMin + (vMax − vMin) · (1 − e^(−d / dScale)). */
export function speedAtDistance(distanceM: number, tuning: SimTuning): number {
  const s = tuning.speed;
  return s.minMps + (s.maxMps - s.minMps) * saturatingExp(distanceM / s.distanceScaleM);
}

/** Advances the run by one tick with the actions held during it. */
export function step(state: SimState, held: number, tuning: SimTuning): void {
  state.events.count = 0;
  if (state.status !== SimStatus.running) return;
  const dt = 1 / tuning.tickRateHz;
  const p = state.player;

  const press = pressed(held, state.prevHeld);
  state.prevHeld = held;
  const left = (press & Action.left) !== 0;
  const right = (press & Action.right) !== 0;
  if (left !== right) requestLaneChange(state, tuning, left ? -1 : 1); // both at once cancel out

  advanceLaneChange(state, tuning, dt);

  verticalInput(
    state,
    tuning,
    (press & Action.jump) !== 0,
    (held & Action.jump) !== 0,
    (press & Action.slam) !== 0,
    dt,
  );
  updateAir(state, tuning, (held & Action.boost) !== 0, dt);
  verticalIntegrate(state, tuning, dt);

  p.speedMps = speedAtDistance(p.distanceM, tuning) * (p.boosting ? tuning.speed.boostMultiplier : 1);
  const dz = p.speedMps * dt;
  p.distanceM += dz;
  p.z += dz;

  // Floating origin (invariant 7): nothing in the sim depends on absolute z.
  const shift = tuning.world.originShiftM;
  if (p.z >= shift) {
    p.z -= shift;
    emit(state.events, SimEventKind.originShift, -shift);
  }

  state.tick++;
}
