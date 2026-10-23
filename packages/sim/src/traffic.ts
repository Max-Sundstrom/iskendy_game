import type { SimTuning } from '@kometa/shared';
import { laneCenterX } from './lanes';

// Traffic as struct-of-arrays (invariant 5, ARCHITECTURE §3). z is the vehicle's rear bumper in the same
// origin-shifted frame as the player.

export const TRAFFIC_CAPACITY = 64;

export type Traffic = {
  readonly active: Uint8Array;
  readonly type: Uint8Array;
  readonly lane: Uint8Array;
  readonly z: Float64Array;
  readonly speed: Float64Array;
  /** player.touchSeq + 1 while the player is passing over this vehicle in the air, else 0 (CLEAR tracking). */
  readonly over: Int32Array;
};

export function createTraffic(): Traffic {
  return {
    active: new Uint8Array(TRAFFIC_CAPACITY),
    type: new Uint8Array(TRAFFIC_CAPACITY),
    lane: new Uint8Array(TRAFFIC_CAPACITY),
    z: new Float64Array(TRAFFIC_CAPACITY),
    speed: new Float64Array(TRAFFIC_CAPACITY),
    over: new Int32Array(TRAFFIC_CAPACITY),
  };
}

/** Index of a free slot, or −1 when traffic is at capacity. */
export function freeSlot(t: Traffic): number {
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) if (t.active[i] === 0) return i;
  return -1;
}

/** True when a vehicle of `length` at rear `z` in `lane` keeps `clearance` from every vehicle already there. */
export function laneIsClear(
  t: Traffic,
  tuning: SimTuning,
  lane: number,
  z: number,
  length: number,
  clearance: number,
): boolean {
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (t.active[i] === 0 || t.lane[i] !== lane) continue;
    const other = tuning.vehicles[t.type[i] ?? 0];
    const oz = t.z[i] ?? 0;
    if (z < oz + (other?.lengthM ?? 0) + clearance && oz < z + length + clearance) return false;
  }
  return true;
}

/**
 * Moves traffic forward. A vehicle closing on the one ahead in its lane slows to that vehicle's speed, so rows that
 * spawned with different speeds never overlap (scenario G13).
 */
export function moveTraffic(t: Traffic, tuning: SimTuning, dt: number): void {
  const gap = tuning.traffic.followGapM;
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (t.active[i] === 0) continue;
    const me = tuning.vehicles[t.type[i] ?? 0];
    const myFront = (t.z[i] ?? 0) + (me?.lengthM ?? 0);
    let aheadSpeed = Infinity;
    let aheadRear = Infinity;
    for (let j = 0; j < TRAFFIC_CAPACITY; j++) {
      if (j === i || t.active[j] === 0 || t.lane[j] !== t.lane[i]) continue;
      const rear = t.z[j] ?? 0;
      if (rear >= (t.z[i] ?? 0) && rear < aheadRear) {
        aheadRear = rear;
        aheadSpeed = t.speed[j] ?? 0;
      }
    }
    if (aheadRear - myFront < gap && (t.speed[i] ?? 0) > aheadSpeed) t.speed[i] = aheadSpeed;
    t.z[i] = (t.z[i] ?? 0) + (t.speed[i] ?? 0) * dt;
  }
}

/** Lateral extent of vehicle `i`: [centre − width/2, centre + width/2]. */
export function vehicleHalfWidth(t: Traffic, tuning: SimTuning, i: number): number {
  return (tuning.vehicles[t.type[i] ?? 0]?.widthM ?? 0) / 2;
}

export function vehicleCenterX(t: Traffic, tuning: SimTuning, i: number): number {
  return laneCenterX(t.lane[i] ?? 0, tuning);
}
