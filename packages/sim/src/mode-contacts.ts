import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { hasClosedModeContact, hasClosedModeOverlap } from './mode-contact-sweep';
import { invalidateNearMiss } from './near-miss';
import type { MotionPoint } from './near-sweep';
import { RideEnd } from './roofs';
import type { SimState } from './state';
import { TRAFFIC_CAPACITY, vehicleCenterX, vehicleHalfWidth } from './traffic';

function detachSupport(state: SimState): void {
  const p = state.player;
  if (p.rideSlot < 0) return; // an already launched jump retains its velocity and input history
  p.rideSlot = -1;
  p.airborne = true;
  p.vy = 0;
  p.coyoteS = 0;
  emit(state.events, SimEventKind.rideEnd, RideEnd.gone);
}

function retire(state: SimState, slot: number): void {
  const t = state.traffic;
  invalidateNearMiss(state, slot);
  t.active[slot] = 0;
  t.over[slot] = 0;
  t.nearMiss[slot] = 0;
}

/** Protected contacts precede rewards: active destroys; grace phases through without creating roof support. */
export function resolveModeContacts(state: SimState, tuning: SimTuning, start: MotionPoint, dt: number): void {
  const p = state.player;
  const t = state.traffic;
  const mode = state.mode;
  const active = mode.activeTicksLeft > 0;
  const expires = active ? mode.activeTicksLeft === 1 && tuning.modes.graceS === 0 : mode.graceTicksLeft === 1;
  detachSupport(state);
  const halfL = tuning.player.lengthM / 2;
  const halfW = tuning.player.widthM / 2;
  const seq = p.touchSeq + 1;
  for (let slot = 0; slot < TRAFFIC_CAPACITY; slot++) {
    if (t.active[slot] === 0) continue;
    const type = t.type[slot] ?? 0;
    const vehicle = tuning.vehicles[type];
    if (!vehicle) continue;
    const rear1 = t.z[slot] ?? 0;
    const rear0 = rear1 - (t.speed[slot] ?? 0) * dt;
    const relative0 = start.z - rear0;
    const relative1 = p.z - rear1;
    const x = vehicleCenterX(t, tuning, slot);
    const contact = hasClosedModeContact(start, p, relative0, relative1, x, vehicle, tuning);
    if (active && contact) {
      retire(state, slot);
      mode.smashChain++;
      emit(state.events, SimEventKind.smash, type, mode.smashChain);
      continue;
    }
    if (expires && hasClosedModeOverlap(p, relative1, x, vehicle, tuning)) {
      retire(state, slot);
      emit(state.events, SimEventKind.trafficPhasedOut, type);
      continue;
    }
    if (contact) {
      t.over[slot] = 0;
      invalidateNearMiss(state, slot);
      continue;
    }
    // Keep existing contact-free CLEAR semantics. A protected touch cannot reach this reward producer.
    if (vehicle.top === 'none') continue;
    const crossedRear = relative0 < -halfL && relative1 >= -halfL;
    const lateral = Math.abs(p.x - x) < halfW + vehicleHalfWidth(t, tuning, slot);
    if (crossedRear && lateral && p.airborne && p.y >= vehicle.heightM) t.over[slot] = seq;
    if (t.over[slot] === 0) continue;
    if (t.over[slot] !== seq || !lateral) t.over[slot] = 0;
    else if (p.z - halfL >= rear1 + vehicle.lengthM) {
      t.over[slot] = 0;
      invalidateNearMiss(state, slot);
      emit(state.events, SimEventKind.clear, type, vehicle.top === 'platform' ? 1 : 0);
    }
  }
}
