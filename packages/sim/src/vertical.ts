import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { FlyStop, jumpPhysics } from './jump';
import { endRide, RideEnd, touch } from './roofs';
import type { SimState } from './state';
import { advanceRoll } from './roll';
import { advanceFlip, airJumpPress, gradeLanding } from './tricks';

// Jump, fly, slam and gravity (GDD §5.3–5.5). Jumps integrate constant gravity exactly within each step, so the apex
// lands on 4.2 m at 0.45 s instead of the ~4 % low peak plain Euler gives at 60 Hz.

export { FlyStop, jumpPhysics };

function launch(state: SimState, tuning: SimTuning): void {
  const p = state.player;
  endRide(state, tuning, RideEnd.jumped); // jumping off a platform starts from its height
  p.coyoteS = 0;
  p.vy = jumpPhysics(tuning).v0;
  p.airborne = true;
  p.jumpHeldS = 0;
  p.jumpBufferS = 0;
  emit(state.events, SimEventKind.jump);
}

function stopFlying(state: SimState, reason: number): void {
  const p = state.player;
  if (!p.flying) return;
  p.flying = false;
  emit(state.events, SimEventKind.flyStop, reason);
}

/** Handles this tick's jump/slam presses and the jump hold, before integration. */
export function verticalInput(
  state: SimState,
  tuning: SimTuning,
  jumpPressed: boolean,
  jumpHeld: boolean,
  slamPressed: boolean,
  dt: number,
): void {
  const p = state.player;
  if (jumpPressed) {
    if (!p.airborne || p.coyoteS > 0)
      launch(state, tuning); // G4: coyote time after leaving a platform
    else if (!airJumpPress(state, tuning)) p.jumpBufferS = tuning.jump.bufferS; // G3: fires on touchdown
  }
  if (p.airborne && jumpHeld && !jumpPressed) {
    p.jumpHeldS += dt;
    if (
      !p.flying &&
      !p.slamming &&
      p.jumpHeldS >= tuning.fly.holdThresholdS &&
      (p.airLiters > 0 || state.mode.activeTicksLeft > 0)
    ) {
      p.flying = true;
      emit(state.events, SimEventKind.flyStart);
    }
  }
  if (!jumpHeld) {
    p.jumpHeldS = 0;
    stopFlying(state, FlyStop.released);
  }
  if (slamPressed && p.airborne && !p.slamming) {
    stopFlying(state, FlyStop.slam);
    p.slamming = true;
    p.vy = tuning.slam.vyMps;
    emit(state.events, SimEventKind.slam);
  }
}

/** Integrates height and handles touchdown; called after AIR is settled for the tick. */
export function verticalIntegrate(state: SimState, tuning: SimTuning, dt: number): void {
  const p = state.player;
  if (p.jumpBufferS > 0) p.jumpBufferS = Math.max(0, p.jumpBufferS - dt);
  if (p.coyoteS > 0) p.coyoteS = Math.max(0, p.coyoteS - dt);
  if (!p.airborne) return;
  advanceFlip(state, tuning, dt);
  advanceRoll(state, tuning, dt);

  if (p.flying) {
    // Thrusters: gravity is off and vertical speed eases toward the glide speed.
    const k = Math.min(1, dt / tuning.fly.glideEaseS);
    p.vy += (tuning.fly.glideVyMps - p.vy) * k;
    p.y += p.vy * dt;
    if (p.y > tuning.fly.maxAltitudeM) {
      p.y = tuning.fly.maxAltitudeM;
      if (p.vy > 0) p.vy = 0;
    }
  } else if (p.slamming) {
    p.y += p.vy * dt; // constant slam speed
  } else {
    const { gUp, gDown } = jumpPhysics(tuning);
    const g = p.vy > 0 ? gUp : gDown;
    p.y += p.vy * dt - 0.5 * g * dt * dt;
    p.vy -= g * dt;
  }

  if (p.y <= 0 && p.vy <= 0) {
    const wasSlam = p.slamming;
    p.y = 0;
    p.vy = 0;
    p.airborne = false;
    p.slamming = false;
    p.hopChain = 0; // the chain lasts until the road
    touch(state);
    stopFlying(state, FlyStop.landed);
    emit(state.events, SimEventKind.land, wasSlam ? 1 : 0);
    if (!gradeLanding(state, tuning)) return;
    if (p.jumpBufferS > 0) launch(state, tuning);
  }
}

/** AIR bookkeeping (GDD §6): regen on the ground when not boosting; fly and boost costs stack. */
export function updateAir(state: SimState, tuning: SimTuning, boostHeld: boolean, dt: number): void {
  const p = state.player;
  if (state.mode.activeTicksLeft > 0) {
    // Active thrust neither consumes nor regenerates the finite stored tank, even when it is empty.
    p.boosting = boostHeld;
    return;
  }
  const a = tuning.air;
  p.boosting = boostHeld && p.airLiters > 0;
  const before = p.airLiters;
  let rate = 0;
  if (p.flying) rate -= tuning.fly.airCostLps;
  if (p.boosting) rate -= a.boostCostLps;
  if (!p.airborne && !p.boosting) rate += a.regenLps;
  p.airLiters = Math.min(a.capacityL, Math.max(0, p.airLiters + rate * dt));
  if (p.airLiters <= 0 && rate < 0) {
    if (p.flying) stopFlying(state, FlyStop.airEmpty); // G5: thrusters sputter, the car falls
    p.boosting = false;
    if (before > 0) emit(state.events, SimEventKind.airEmpty); // once, when the tank runs dry
  }
}
