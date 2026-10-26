import { ModeKind, type SimTuning } from '@kometa/shared';
import { createSimState, type SimState } from './state';
import { DEFAULT_TUNING } from './tuning';

export const T = DEFAULT_TUNING.sim;
export const dt = 1 / T.tickRateHz;

/** Isolated test world without director rows; production entry remains tested through step(). */
export function emptyRoad(tuning: SimTuning = T, seed = 1): SimState {
  const state = createSimState(seed, tuning);
  state.director.nextRowM = Number.MAX_SAFE_INTEGER;
  return state;
}

export function arm(state: SimState, active: number, grace = 0): void {
  state.mode.kind = ModeKind.liftoff;
  state.mode.activeTicksLeft = active;
  state.mode.graceTicksLeft = grace;
  state.mode.smashChain = 0;
}

export function obstacle(state: SimState, slot: number, id = 'sedan', rear = 0, lane = 2): number {
  const type = T.vehicles.findIndex((v) => v.id === id);
  if (type < 0) throw new Error('test vehicle missing');
  state.traffic.type[slot] = type;
  state.traffic.lane[slot] = lane;
  state.traffic.z[slot] = rear;
  state.traffic.speed[slot] = 0;
  state.traffic.over[slot] = 0;
  state.traffic.nearMiss[slot] = 0;
  state.traffic.active[slot] = 1;
  return type;
}
