import type { SimTuning } from '@kometa/shared';
import { createEventBuffer, type EventBuffer } from './events';
import { laneCenterX } from './lanes';
import { createRng, type RngState } from './rng';
import { createTraffic, type Traffic } from './traffic';

// Sim state (ARCHITECTURE §4.2), grown task by task. Lane space: x is lateral metres, positive to the driver's
// right; lane 0 is the leftmost lane; z is forward distance since the last origin shift; units m, s, L.

export const SimStatus = { running: 1, crashed: 2 } as const;
export type SimStatus = (typeof SimStatus)[keyof typeof SimStatus];

export type PlayerState = {
  lane: number;
  laneFrom: number;
  laneTo: number;
  /** x when the current lane change started; the change eases from here to laneTo's centre. */
  laneStartX: number;
  /** Progress of the current lane change in [0, 1); meaningful only while `changing`. */
  laneT: number;
  changing: boolean;
  /** −1, 0 or +1: the one lane change queued behind the current one (GDD §4, scenario G2). */
  queuedDir: number;
  x: number;
  z: number;
  distanceM: number;
  speedMps: number;
  y: number;
  vy: number;
  airborne: boolean;
  flying: boolean;
  slamming: boolean;
  boosting: boolean;
  /** How long Jump has been held since it was pressed while airborne; fly starts past holdThresholdS. */
  jumpHeldS: number;
  /** Remaining jump-buffer time from a press made in the air (GDD §4, scenario G3). */
  jumpBufferS: number;
  airLiters: number;
  /** Remaining speed-penalty time after a scrape (GDD §5.2). */
  penaltyS: number;
  /** A second scrape while this is above 0 is a crash (GDD §5.9). */
  scrapeTimerS: number;
};

export type SimState = {
  tick: number;
  readonly seed: number;
  status: SimStatus;
  /** Input mask held on the previous tick, to derive presses. */
  prevHeld: number;
  readonly player: PlayerState;
  readonly rng: { readonly director: RngState; readonly pickups: RngState };
  readonly traffic: Traffic;
  readonly director: DirectorState;
  /** Score so far; P1 counts distance only, P2-03 adds events, streaks and the pot (GDD §9). */
  readonly score: { total: number };
  readonly events: EventBuffer;
};

export { laneCenterX };

export type DirectorState = {
  /** Run distance at which the next row will be placed. */
  nextRowM: number;
};

/** A fresh run: centre lane, start speed, distance 0. */
export function createSimState(seed: number, tuning: SimTuning): SimState {
  const lane = Math.floor(tuning.lanes.count / 2);
  return {
    tick: 0,
    seed: seed >>> 0,
    status: SimStatus.running,
    prevHeld: 0,
    player: {
      lane,
      laneFrom: lane,
      laneTo: lane,
      laneStartX: laneCenterX(lane, tuning),
      laneT: 0,
      changing: false,
      queuedDir: 0,
      x: laneCenterX(lane, tuning),
      z: 0,
      distanceM: 0,
      speedMps: tuning.speed.minMps,
      y: 0,
      vy: 0,
      airborne: false,
      flying: false,
      slamming: false,
      boosting: false,
      jumpHeldS: 0,
      jumpBufferS: 0,
      airLiters: tuning.air.startL,
      penaltyS: 0,
      scrapeTimerS: 0,
    },
    rng: { director: createRng(seed, 1), pickups: createRng(seed, 2) },
    traffic: createTraffic(),
    director: { nextRowM: tuning.director.firstRowM },
    score: { total: 0 },
    events: createEventBuffer(),
  };
}
