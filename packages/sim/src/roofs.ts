import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { FlyStop, jumpPhysics } from './jump';
import { SimStatus, type SimState } from './state';
import { gradeLanding } from './tricks';
import { vehicleCenterX, vehicleHalfWidth } from './traffic';

// Roofs and platforms (GDD §5.8, scenarios G4, G10, G11). Cars, taxis, vans and minibuses bounce the car up (HOP);
// buses, trailers and the other long vehicles are platforms the car drives along until it leaves the end or the side,
// then it falls, with coyote time for a late jump.

export const RideEnd = { droveOff: 1, sideways: 2, jumped: 3, gone: 4 } as const;

/** Marks a touch of any surface: passing over a vehicle only counts as a CLEAR if nothing was touched meanwhile. */
export function touch(state: SimState): void {
  state.player.touchSeq++;
}

/** Touchdown bookkeeping shared by hops and rides; returns whether it was a slam. Grading may crash the run. */
function landFromAir(state: SimState, tuning: SimTuning): boolean {
  const p = state.player;
  gradeLanding(state, tuning);
  const wasSlam = p.slamming;
  p.slamming = false;
  if (p.flying) {
    p.flying = false;
    emit(state.events, SimEventKind.flyStop, FlyStop.landed);
  }
  touch(state);
  return wasSlam;
}

/** Bounce off a car or van roof at `roofY`; a slam onto the roof bounces higher (GDD §5.5). */
export function hop(state: SimState, tuning: SimTuning, roofY: number): void {
  const p = state.player;
  const slam = landFromAir(state, tuning);
  if (state.status !== SimStatus.running) return; // the landing grade crashed the run
  const { gUp } = jumpPhysics(tuning);
  p.y = roofY;
  p.vy = Math.sqrt(2 * gUp * (slam ? tuning.roofs.slamHopHeightM : tuning.roofs.hopHeightM));
  p.airborne = true;
  p.coyoteS = 0;
  p.hopChain++;
  emit(state.events, SimEventKind.hop, p.hopChain, slam ? 1 : 0);
}

/** Lands on platform `slot` with its top at `topY` and starts riding it. */
export function startRide(state: SimState, tuning: SimTuning, slot: number, topY: number): void {
  const p = state.player;
  const slam = landFromAir(state, tuning);
  if (state.status !== SimStatus.running) return;
  p.y = topY;
  p.vy = 0;
  p.airborne = false;
  p.rideSlot = slot;
  p.coyoteS = 0;
  emit(state.events, SimEventKind.land, slam ? 1 : 0);
  emit(state.events, SimEventKind.rideStart, slot, slam ? 1 : 0);
}

/** Leaves the platform. Driving off an edge starts coyote time; a jump launches from the platform's height. */
export function endRide(state: SimState, tuning: SimTuning, reason: number): void {
  const p = state.player;
  if (p.rideSlot < 0) return;
  p.rideSlot = -1;
  if (reason !== RideEnd.jumped) {
    p.airborne = true;
    p.vy = 0;
    p.coyoteS = tuning.jump.coyoteS;
  }
  emit(state.events, SimEventKind.rideEnd, reason);
}

/** Keeps the car on its platform after traffic moved, or drops it when it runs off the end or the side. */
export function updateRide(state: SimState, tuning: SimTuning): void {
  const p = state.player;
  const i = p.rideSlot;
  if (i < 0) return;
  const t = state.traffic;
  const v = tuning.vehicles[t.type[i] ?? 0];
  if (t.active[i] === 0 || !v) {
    endRide(state, tuning, RideEnd.gone);
    return;
  }
  const front = (t.z[i] ?? 0) + v.lengthM;
  if (p.z > front) {
    endRide(state, tuning, RideEnd.droveOff);
    return;
  }
  // Off the side once the car's centre is past the platform's edge (a lane change while riding).
  if (Math.abs(p.x - vehicleCenterX(t, tuning, i)) > vehicleHalfWidth(t, tuning, i)) {
    endRide(state, tuning, RideEnd.sideways);
    return;
  }
  p.y = v.heightM;
}
