import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { Action, pressed } from './input';
import { resolveCollisions, type StepStart } from './collisions';
import { runDirector } from './director';
import { scoreTick } from './score';
import { finishNearMisses, prepareNearMisses } from './near-miss';
import { updateRide } from './roofs';
import { advanceLaneChange, requestLaneChange } from './lateral';
import { saturatingExp } from './math';
import { SimStatus, type SimState } from './state';
import { moveTraffic, TRAFFIC_CAPACITY } from './traffic';
import { updateAir, verticalInput, verticalIntegrate } from './vertical';

/** Reused scratch for the step's starting position (no allocation per step). */
const start: StepStart = { x: 0, y: 0, z: 0 };

// One fixed 60 Hz step (ARCHITECTURE §4.3). Order so far:
// input → lateral → AIR → vertical → forward → traffic → ride → collisions → score/streak → director → origin shift.
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

  const startRideSlot = p.rideSlot;
  start.x = p.x;
  start.y = p.y;
  start.z = p.z;
  if (p.penaltyS > 0) p.penaltyS = Math.max(0, p.penaltyS - dt);
  if (p.scrapeTimerS > 0) p.scrapeTimerS = Math.max(0, p.scrapeTimerS - dt);

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

  const penalty = p.penaltyS > 0 ? 1 - p.penaltyFactor : 1;
  p.speedMps = speedAtDistance(p.distanceM, tuning) * (p.boosting ? tuning.speed.boostMultiplier : 1) * penalty;
  const dz = p.speedMps * dt;
  p.distanceM += dz;
  p.z += dz;
  state.score.total += dz * tuning.score.perMeter;

  moveTraffic(state.traffic, tuning, dt);
  updateRide(state, tuning);
  prepareNearMisses(state, tuning, start, startRideSlot, dt);
  resolveCollisions(state, tuning, start, dt);
  finishNearMisses(state, tuning);
  scoreTick(state, tuning, startRideSlot, dz, (state.traffic.speed[startRideSlot] ?? 0) * dt);
  runDirector(state, tuning);

  // Floating origin (invariant 7): nothing in the sim depends on absolute z.
  const shift = tuning.world.originShiftM;
  if (p.z >= shift) {
    p.z -= shift;
    for (let i = 0; i < TRAFFIC_CAPACITY; i++) state.traffic.z[i] = (state.traffic.z[i] ?? 0) - shift;
    emit(state.events, SimEventKind.originShift, -shift);
  }

  state.tick++;
}
