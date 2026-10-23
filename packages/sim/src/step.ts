import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { Action, pressed } from './input';
import { easeOutCubic, saturatingExp } from './math';
import { laneCenterX, SimStatus, type PlayerState, type SimState } from './state';

// One fixed 60 Hz step (ARCHITECTURE §4.3). Order so far: input → lateral → forward → origin shift.
// Mutates `state` in place and allocates nothing (invariant 5).

function startLaneChange(state: SimState, tuning: SimTuning, dir: number): void {
  const p = state.player;
  const target = p.lane + dir;
  if (target < 0 || target >= tuning.lanes.count) {
    emit(state.events, SimEventKind.laneBump, dir); // scenario G1: ignored, small feedback
    return;
  }
  p.laneFrom = p.lane;
  p.laneTo = target;
  p.laneT = 0;
  p.changing = true;
  emit(state.events, SimEventKind.laneChangeStarted, p.laneFrom, p.laneTo);
}

function requestLaneChange(state: SimState, tuning: SimTuning, dir: number): void {
  const p = state.player;
  if (!p.changing) {
    startLaneChange(state, tuning, dir);
  } else if (p.queuedDir === 0 && tuning.lanes.queuedInputs > 0) {
    p.queuedDir = dir; // scenario G2: the second input is queued once…
    emit(state.events, SimEventKind.laneChangeQueued, p.laneTo + dir);
  } // …and a third is dropped.
}

function advanceLaneChange(state: SimState, tuning: SimTuning, dt: number): void {
  const p: PlayerState = state.player;
  if (!p.changing) return;
  p.laneT += dt / tuning.lanes.changeDurationS;
  if (p.laneT >= 1) {
    p.lane = p.laneTo;
    p.laneFrom = p.lane;
    p.laneT = 0;
    p.changing = false;
    p.x = laneCenterX(p.lane, tuning);
    if (p.queuedDir !== 0) {
      const dir = p.queuedDir;
      p.queuedDir = 0;
      startLaneChange(state, tuning, dir);
    }
    return;
  }
  const from = laneCenterX(p.laneFrom, tuning);
  const to = laneCenterX(p.laneTo, tuning);
  p.x = from + (to - from) * easeOutCubic(p.laneT);
}

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

  p.speedMps = speedAtDistance(p.distanceM, tuning);
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
