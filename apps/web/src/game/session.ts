import {
  createSimState,
  DEFAULT_TUNING,
  readEvents,
  SimStatus,
  step,
  TRAFFIC_CAPACITY,
  type SimState,
} from '@kometa/sim';
import type { SimEvent, SimTuning } from '@kometa/shared';

// One run: the sim state plus the previous snapshot the renderer interpolates from (ARCHITECTURE §3).

export type Snapshot = {
  x: number;
  y: number;
  z: number;
  readonly trafficZ: Float64Array;
};

export type Session = {
  readonly tuning: SimTuning;
  state: SimState;
  readonly prev: Snapshot;
  /** Events from the steps of the current frame, decoded for presentation. */
  readonly frameEvents: SimEvent[];
};

function snapshot(s: SimState, into: Snapshot): void {
  into.x = s.player.x;
  into.y = s.player.y;
  into.z = s.player.z;
  into.trafficZ.set(s.traffic.z);
}

export function createSession(seed: number, tuning: SimTuning = DEFAULT_TUNING.sim): Session {
  const state = createSimState(seed, tuning);
  const prev: Snapshot = { x: 0, y: 0, z: 0, trafficZ: new Float64Array(TRAFFIC_CAPACITY) };
  snapshot(state, prev);
  return { tuning, state, prev, frameEvents: [] };
}

/** Runs `steps` sim steps with the held input; keeps the snapshot before the last one for interpolation. */
export function advance(session: Session, steps: number, held: number): void {
  session.frameEvents.length = 0;
  for (let i = 0; i < steps && session.state.status === SimStatus.running; i++) {
    snapshot(session.state, session.prev);
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
