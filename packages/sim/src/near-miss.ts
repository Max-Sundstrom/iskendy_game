import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { classifyNearSweep, NearSweep, type MotionPoint } from './near-sweep';
import { SimStatus, type SimState } from './state';
import { TRAFFIC_CAPACITY, vehicleCenterX } from './traffic';

export const NearPass = { idle: 0, passing: 1, qualified: 2, disqualified: 3, awarded: 4 } as const;
// A completion is tentative until all contacts have run. Clear on every prepare, including flag-off ticks.
const completed = new Uint8Array(TRAFFIC_CAPACITY);

/** Invalidates a pending encounter for the exact contacted slot without unspending an awarded vehicle. */
export function invalidateNearMiss(state: SimState, slot: number): void {
  const pass = state.traffic.nearMiss[slot];
  if (pass === NearPass.passing || pass === NearPass.qualified) state.traffic.nearMiss[slot] = NearPass.disqualified;
}

/** Observes pre-contact end motion after ride movement, before collisions can rewind x or snap y. */
export function prepareNearMisses(
  state: SimState,
  tuning: SimTuning,
  start: MotionPoint,
  startRideSlot: number,
  dt: number,
): void {
  completed.fill(0);
  if (!tuning.scoring.nearMissEnabled) return;
  const t = state.traffic;
  const p = state.player;
  const entry = -tuning.player.lengthM / 2;
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (t.active[i] === 0 || t.nearMiss[i] === NearPass.awarded) continue;
    const v = tuning.vehicles[t.type[i] ?? 0];
    // Current content marks motor vehicles with a hop/platform roof; cones/barriers use top:none.
    if (!v || v.top === 'none') continue;
    const rear1 = t.z[i] ?? 0;
    const rear0 = rear1 - (t.speed[i] ?? 0) * dt;
    const r0 = start.z - rear0;
    const r1 = p.z - rear1;
    if (i === startRideSlot || i === p.rideSlot) {
      t.nearMiss[i] = NearPass.disqualified;
      continue;
    }
    if (r1 <= entry) {
      t.nearMiss[i] = NearPass.idle;
      continue;
    }
    let pass = t.nearMiss[i] ?? NearPass.idle;
    // Touch-only entry is not armed; the next forward tick from that exact plane is a fresh crossing.
    if (pass === NearPass.idle && r0 <= entry && r1 > entry) pass = NearPass.passing;
    if (pass === NearPass.idle) continue; // newly initialized alongside is not a fresh overtake
    const exit = v.lengthM - entry;
    if (pass !== NearPass.disqualified) {
      const sweep = classifyNearSweep(start, p, r0, r1, vehicleCenterX(t, tuning, i), v, tuning);
      if (sweep === NearSweep.penetration) pass = NearPass.disqualified;
      else if (sweep === NearSweep.close) pass = NearPass.qualified;
    }
    t.nearMiss[i] = pass;
    if (r0 < exit && r1 >= exit && pass === NearPass.qualified) completed[i] = 1;
    else if (r1 >= exit) t.nearMiss[i] = NearPass.idle; // unsuccessful completed passes may retry after separation
  }
}

/** Emits surviving completions in slot order; a terminal crash suppresses every new near miss. */
export function finishNearMisses(state: SimState, tuning: SimTuning): void {
  if (!tuning.scoring.nearMissEnabled || state.status !== SimStatus.running) return;
  const t = state.traffic;
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (completed[i] === 0 || t.active[i] === 0 || t.nearMiss[i] !== NearPass.qualified) continue;
    t.nearMiss[i] = NearPass.awarded;
    emit(state.events, SimEventKind.nearMiss, t.type[i] ?? 0, i);
  }
}
