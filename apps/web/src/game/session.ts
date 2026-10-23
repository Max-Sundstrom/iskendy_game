import {
  createRecorder,
  createSimState,
  DEFAULT_TUNING,
  readEvents,
  SimStatus,
  step,
  TRAFFIC_CAPACITY,
  type Recorder,
  type SimState,
} from '@kometa/sim';
import type { SimEvent, SimTuning } from '@kometa/shared';

// One run: the sim state plus the previous snapshot the renderer interpolates from (ARCHITECTURE §3).

export type Snapshot = {
  x: number;
  y: number;
  z: number;
  /** Front-flip rotation in turns (PlayerState.flipTurns). */
  flip: number;
  readonly trafficZ: Float64Array;
};

export type Session = {
  readonly tuning: SimTuning;
  state: SimState;
  readonly prev: Snapshot;
  /** Events from the steps of the current frame, decoded for presentation. */
  readonly frameEvents: SimEvent[];
  /** Input log of this run; `recorder.finish(state)` gives the replay (ADR-002). */
  readonly recorder: Recorder;
};

function snapshot(s: SimState, into: Snapshot): void {
  into.x = s.player.x;
  into.y = s.player.y;
  into.z = s.player.z;
  into.flip = s.player.flipTurns;
  into.trafficZ.set(s.traffic.z);
}

export function createSession(seed: number, tuning: SimTuning = DEFAULT_TUNING.sim): Session {
  const state = createSimState(seed, tuning);
  const prev: Snapshot = { x: 0, y: 0, z: 0, flip: 0, trafficZ: new Float64Array(TRAFFIC_CAPACITY) };
  snapshot(state, prev);
  return { tuning, state, prev, frameEvents: [], recorder: createRecorder(seed, tuning) };
}

/** Samples input once per actual sim tick, recording that mask; keeps the preceding snapshot for interpolation. */
export function advance(session: Session, steps: number, input: number | (() => number)): void {
  session.frameEvents.length = 0;
  for (let i = 0; i < steps && session.state.status === SimStatus.running; i++) {
    const held = typeof input === 'number' ? input : input();
    snapshot(session.state, session.prev);
    session.recorder.record(held);
    step(session.state, held, session.tuning);
    for (const e of readEvents(session.state.events)) {
      if (e.kind === 'originShift') {
        // The snapshot was taken before the shift; move it into the new frame so interpolation stays continuous.
        session.prev.z += e.dz;
        for (let k = 0; k < TRAFFIC_CAPACITY; k++) session.prev.trafficZ[k] = (session.prev.trafficZ[k] ?? 0) + e.dz;
      }
      session.frameEvents.push(e);
    }
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
