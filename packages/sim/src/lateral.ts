import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { easeOutCubic } from './math';
import { requestRoll } from './roll';
import { laneCenterX, type SimState } from './state';

// Lane changes (GDD §5.1, scenarios G1–G2).

function startLaneChange(state: SimState, tuning: SimTuning, dir: number): void {
  const p = state.player;
  const target = p.lane + dir;
  if (target < 0 || target >= tuning.lanes.count) {
    emit(state.events, SimEventKind.laneBump, dir); // G1: ignored, small feedback
    return;
  }
  p.laneFrom = p.lane;
  p.laneTo = target;
  p.laneStartX = p.x;
  p.laneT = 0;
  p.changing = true;
  emit(state.events, SimEventKind.laneChangeStarted, p.laneFrom, p.laneTo);
  requestRoll(state, tuning, dir);
}

export function requestLaneChange(state: SimState, tuning: SimTuning, dir: number): void {
  const p = state.player;
  if (!p.changing) {
    startLaneChange(state, tuning, dir);
  } else if (p.queuedDir === 0 && tuning.lanes.queuedInputs > 0) {
    p.queuedDir = dir; // G2: the second input is queued once…
    emit(state.events, SimEventKind.laneChangeQueued, p.laneTo + dir);
  } // …and a third is dropped.
}

export function advanceLaneChange(state: SimState, tuning: SimTuning, dt: number): void {
  const p = state.player;
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
  const to = laneCenterX(p.laneTo, tuning);
  p.x = p.laneStartX + (to - p.laneStartX) * easeOutCubic(p.laneT);
}
