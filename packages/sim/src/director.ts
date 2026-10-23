import type { SimTuning } from '@kometa/shared';
import { nextFloat, nextInt } from './rng';
import type { SimState } from './state';
export type { DirectorState } from './state';
import { freeSlot, laneIsClear, TRAFFIC_CAPACITY } from './traffic';

// Director v0 (P1-03): random rows ahead of the player, despawn behind. Patterns, waves and the fairness solver
// arrive in P2-06; until then each row leaves at least one lane free and only steady vehicles spawn.

const SPAWNABLE: ReadonlySet<string> = new Set(['constant', 'slow']);

/** Difficulty D in [0, 1], ramping with distance (GDD §11). */
export function difficulty(distanceM: number, tuning: SimTuning): number {
  return Math.min(1, distanceM / tuning.director.difficultyRampM);
}

/** Preallocated lane shuffle buffer; the director runs inside the step and must not allocate. */
const lanes = new Uint8Array(16);

function pickVehicle(state: SimState, tuning: SimTuning, rowM: number): number {
  let total = 0;
  for (const v of tuning.vehicles) if (SPAWNABLE.has(v.behaviour) && v.fromM <= rowM) total += v.weight;
  let r = nextFloat(state.rng.director) * total;
  for (let i = 0; i < tuning.vehicles.length; i++) {
    const v = tuning.vehicles[i];
    if (!v || !SPAWNABLE.has(v.behaviour) || v.fromM > rowM) continue;
    r -= v.weight;
    if (r < 0) return i;
  }
  return 0;
}

function spawnRow(state: SimState, tuning: SimTuning, rowM: number): void {
  const p = state.player;
  const n = tuning.lanes.count;
  const d = difficulty(rowM, tuning);
  const blocked = 1 + nextInt(state.rng.director, 1 + Math.floor(d * (tuning.director.maxBlockedGroundLanes - 1)));
  for (let i = 0; i < n; i++) lanes[i] = i;
  for (let i = 0; i < blocked; i++) {
    const j = i + nextInt(state.rng.director, n - i);
    const tmp = lanes[i] ?? 0;
    lanes[i] = lanes[j] ?? 0;
    lanes[j] = tmp;
  }
  const z = p.z + (rowM - p.distanceM);
  for (let k = 0; k < blocked; k++) {
    const lane = lanes[k] ?? 0;
    const type = pickVehicle(state, tuning, rowM);
    const v = tuning.vehicles[type];
    if (!v) continue;
    const slot = freeSlot(state.traffic);
    if (slot < 0) return;
    if (!laneIsClear(state.traffic, tuning, lane, z, v.lengthM, tuning.traffic.spawnClearanceM)) continue;
    state.traffic.active[slot] = 1;
    state.traffic.type[slot] = type;
    state.traffic.lane[slot] = lane;
    state.traffic.z[slot] = z;
    state.traffic.over[slot] = 0;
    state.traffic.speed[slot] = v.minMps + nextFloat(state.rng.director) * (v.maxMps - v.minMps);
  }
}

/** Spawns rows up to spawnAheadM ahead and removes traffic more than despawnBehindM behind. */
export function runDirector(state: SimState, tuning: SimTuning): void {
  const p = state.player;
  const t = state.traffic;
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (
      t.active[i] === 1 &&
      (t.z[i] ?? 0) + (tuning.vehicles[t.type[i] ?? 0]?.lengthM ?? 0) < p.z - tuning.director.despawnBehindM
    )
      t.active[i] = 0;
  }
  const dir = tuning.director;
  while (state.director.nextRowM < p.distanceM + dir.spawnAheadM) {
    spawnRow(state, tuning, state.director.nextRowM);
    const spacing =
      dir.rowSpacingStartM + (dir.rowSpacingEndM - dir.rowSpacingStartM) * difficulty(state.director.nextRowM, tuning);
    state.director.nextRowM += spacing;
  }
}
